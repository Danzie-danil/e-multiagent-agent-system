// pages/supervisor/SuperAgentFloat.jsx
import { useState, useEffect, useCallback } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../utils/cn'
import { useToast } from '../../context/ToastContext'
import { formatCurrencyTZS, formatCurrencyCompact, generateIdempotencyKey } from '../../utils/formatters'
import { validateForm, validators } from '../../utils/validators'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../context/AuthContext'

const WALLETS = ['MPESA', 'AIRTEL', 'CRDB']

export default function SuperAgentFloat() {
  const { user } = useAuth()
  const { success: toastSuccess, error: toastError } = useToast()
  const [agents, setAgents] = useState([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [form, setForm] = useState({ amount: '', wallet: 'MPESA', note: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const [supervisorId, setSupervisorId] = useState(null)

  // Stable loadAgents for realtime use
  const loadAgents = useCallback(async (sid) => {
    const resolvedSid = sid || supervisorId
    if (!resolvedSid) return
    try {
      setLoadingAgents(true)
      const { data } = await supabase
        .from('agents')
        .select('*, agent_wallet_accounts(*, wallet_schemes(*))')
        .eq('supervisor_id', resolvedSid)
      setAgents(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAgents(false)
    }
  }, [supervisorId])

  // Fetch agents for this supervisor
  useEffect(() => {
    async function init() {
      try {
        const { data: userData } = await supabase.from('users').select('supervisor_id').eq('id', user.id).single()
        if (userData?.supervisor_id) {
          setSupervisorId(userData.supervisor_id)
          await loadAgents(userData.supervisor_id)
        }
      } catch (err) {
        console.error(err)
      }
    }
    if (user?.id) init()
  }, [user])

  // Realtime: refresh agent balances on wallet_accounts change
  useEffect(() => {
    if (!supervisorId) return
    const channel = supabase
      .channel(`super_float_${supervisorId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agent_wallet_accounts' }, () => loadAgents())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => loadAgents())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [supervisorId, loadAgents])

  const handleOpen = (agent) => {
    setSelectedAgent(agent)
    setForm({ amount: '', wallet: 'MPESA', note: '' })
    setErrors({})
    setModalOpen(true)
  }

  const handleSend = async () => {
    const { errors: errs, isValid } = validateForm(form, {
      amount: [validators.required, (v) => validators.amount(v, 1000, 50000000)],
    })
    setErrors(errs)
    if (!isValid) return

    setLoading(true)
    try {
      const amountNum = Number(form.amount)
      
      // 1. Record the float dispatch
      const { error: txErr } = await supabase.from('transactions').insert({
        from_agent_id: null, // Supervisor dispatch
        to_agent_id: selectedAgent.id,
        type: 'DEPOSIT',
        amount: amountNum,
        status: 'COMPLETED',
        idempotency_key: generateIdempotencyKey()
      })
      if (txErr) throw txErr

      // 2. Adjust balance
      const { error: balErr } = await supabase.rpc('adjust_wallet_balance', {
        p_agent_id: selectedAgent.id,
        p_wallet_code: form.wallet,
        p_amount: amountNum
      })
      if (balErr) throw balErr

      toastSuccess('Float Sent', `${formatCurrencyTZS(amountNum)} sent to ${selectedAgent.name}.`)
      setModalOpen(false)
      
      // Refresh local state
      setAgents(prev => prev.map(ag => ag.id === selectedAgent.id 
        ? { ...ag, agent_wallet_accounts: ag.agent_wallet_accounts.map(w => 
            w.wallet_schemes.code === form.wallet ? { ...w, balance: Number(w.balance) + amountNum } : w
          )} : ag
      ))
    } catch (err) {
      toastError('Float Distribution Failed', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Float Distribution</h1>
          <p className="page-subtitle">Send float to agents in your network</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {loadingAgents ? (
          <div style={{ color: 'var(--color-text-muted)', gridColumn: '1/-1', textAlign: 'center', padding: 'var(--space-8)' }}>Loading Network...</div>
        ) : agents.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', gridColumn: '1/-1', textAlign: 'center', padding: 'var(--space-8)' }}>No agents found in your network.</div>
        ) : agents.map(ag => {
          const total = ag.agent_wallet_accounts?.reduce((s, v) => s + Number(v.balance), 0) || 0
          return (
            <div key={ag.id} className="card card--pad-md" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)' }}>{ag.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{ag.phone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-lg)' }}>{formatCurrencyCompact(total)}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>total float</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {WALLETS.map(w => {
                  const acc = ag.agent_wallet_accounts?.find(acc => acc.wallet_schemes.code === w)
                  return (
                    <div key={w} style={{ flex: 1, minWidth: 70, padding: 'var(--space-2)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>{w}</div>
                      <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-semibold)' }}>{formatCurrencyCompact(acc?.balance || 0)}</div>
                    </div>
                  )
                })}
              </div>

              <Button
                id={`send-float-${ag.id}.button.float`}
                label="Send Float"
                icon={<Send size={14}/>}
                size="sm"
                fullWidth
                variant={ag.status === 'SUSPENDED' ? 'secondary' : 'primary'}
                disabled={ag.status === 'SUSPENDED'}
                onClick={() => handleOpen(ag)}
              />
            </div>
          )
        })}
      </div>

      <Modal
        id="send-float-md-modal"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Send Float to ${selectedAgent?.name}`}
        size="sm"
        footer={<>
          <Button id="cancel-float.button.modal" label="Cancel" variant="secondary" onClick={() => setModalOpen(false)} />
          <Button id="send-float.button.modal" label="Send Float" loading={loading} onClick={handleSend} icon={<Send size={15}/>} />
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="input-field__label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Wallet Scheme</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {WALLETS.map(w => (
                <button key={w} type="button"
                  style={{ minWidth: '70px', flex: '1 0 calc(33.33% - var(--space-2))' }}
                  className={cn(
                    'wallet-toggle', 
                    form.wallet === w && 'wallet-toggle--active',
                    form.wallet === w && `wallet-toggle--${w.toLowerCase()}`
                  )}
                  onClick={() => setForm(f => ({ ...f, wallet: w }))}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <Input
            id="float-amount-input"
            name="float-amount"
            label="Amount (TZS)"
            placeholder="e.g. 500,000"
            type="number"
            required
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            error={errors.amount}
            hint="Min: TZS 1,000 · Max: TZS 5,000,000"
            prefix={<span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>TZS</span>}
          />
          <Input
            id="float-note-input"
            name="float-note"
            label="Note (optional)"
            placeholder="e.g. Weekend float top-up"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  )
}
