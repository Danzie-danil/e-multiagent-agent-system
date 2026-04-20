// pages/agent-pos/AgentWallets.jsx
import { useState, useEffect } from 'react'
import { Wallet, CheckCircle2, Circle, Send, Lock, RefreshCw, Hash, Edit3, Check, TrendingUp } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase/client'
import { formatCurrencyCompact, formatCurrencyTZS } from '../../utils/formatters'

const WALLET_META = {
  MPESA:    { name: 'M-Pesa',       color: '#00A651', bg: 'rgba(0,166,81,0.12)' },
  AIRTEL:   { name: 'Airtel Money', color: '#E40000', bg: 'rgba(228,0,0,0.10)' },
  CRDB:     { name: 'CRDB Bank',    color: '#003580', bg: 'rgba(0,53,128,0.12)' },
  HALOPESA: { name: 'HaloPesa',     color: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
  MIXX:     { name: 'Mixx by Yas',  color: '#7B2FBE', bg: 'rgba(123,47,190,0.12)' },
  NMB:      { name: 'NMB Bank',     color: '#00897B', bg: 'rgba(0,137,123,0.12)' },
  EQUITY:   { name: 'Equity Bank',  color: '#D32F2F', bg: 'rgba(211,47,47,0.12)' },
  NBC:      { name: 'NBC Bank',     color: '#1565C0', bg: 'rgba(21,101,192,0.12)' },
  KCB:      { name: 'KCB Bank',     color: '#2E7D32', bg: 'rgba(46,125,50,0.12)' },
}

export default function AgentWallets() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()

  const [schemes, setSchemes]       = useState([])
  const [myWallets, setMyWallets]   = useState([])
  const [agentId, setAgentId]       = useState(null)
  const [supervisorId, setSupervisorId] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [refloating, setRefloating] = useState(false)

  // Fund modal (individual agents only)
  const [fundModal, setFundModal]   = useState(false)
  const [fundWallet, setFundWallet] = useState(null)
  const [fundAmount, setFundAmount] = useState('')
  const [funding, setFunding]       = useState(false)

  // Till number inline editing
  const [editingTill, setEditingTill]   = useState(null)  // wallet_scheme_id
  const [tillDraft, setTillDraft]       = useState('')
  const [savingTill, setSavingTill]     = useState(false)

  const [savingComm, setSavingComm] = useState(false)
  const [commModal, setCommModal]   = useState(false)
  const [commWallet, setCommWallet] = useState(null)
  const [commAmount, setCommAmount] = useState('')
  
  // Internal Refloat Modal (Cash -> Float)
  const [internalModal, setInternalModal] = useState(false)
  const [internalWallet, setInternalWallet] = useState(null)
  const [internalAmount, setInternalAmount] = useState('')
  const [internalRefloating, setInternalRefloating] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        // Get agent profile
        const { data: userData } = await supabase
          .from('users')
          .select('supervisor_id, agent_id')
          .eq('id', user.id)
          .maybeSingle()

        setSupervisorId(userData?.supervisor_id || null)
        setAgentId(userData?.agent_id || null)

        // Fetch all available wallet schemes
        const { data: schemeData } = await supabase
          .from('wallet_schemes')
          .select('*')
          .eq('active', true)
          .order('code')
        setSchemes(schemeData || [])

        // Fetch this agent's current wallet accounts
        if (userData?.agent_id) {
          const { data: walletData } = await supabase
            .from('agent_wallet_accounts')
            .select('*, wallet_schemes(code, name)')
            .eq('agent_id', userData.agent_id)
          setMyWallets(walletData || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (user?.id) load()
  }, [user])

  const isEnabled     = (schemeId) => myWallets.some(w  => w.wallet_scheme_id === schemeId)
  const getBalance     = (schemeId) => myWallets.find(w => w.wallet_scheme_id === schemeId)?.balance || 0
  const getCashBalance = (schemeId) => myWallets.find(w => w.wallet_scheme_id === schemeId)?.cash_balance || 0
  const getTill        = (schemeId) => myWallets.find(w => w.wallet_scheme_id === schemeId)?.till_number || null
  const getWalletId    = (schemeId) => myWallets.find(w => w.wallet_scheme_id === schemeId)?.id || null

  // Individual agent: toggle wallet on/off
  const toggleWallet = async (scheme) => {
    if (supervisorId) return // network agents can't self-toggle
    if (!agentId) return

    const existing = myWallets.find(w => w.wallet_scheme_id === scheme.id)
    if (existing) {
      // Disable — remove the wallet account
      const { error } = await supabase
        .from('agent_wallet_accounts')
        .delete()
        .eq('id', existing.id)
      if (error) { toastError('Error', error.message); return }
      setMyWallets(prev => prev.filter(w => w.id !== existing.id))
    } else {
      // Enable — create wallet account
      const { data, error } = await supabase
        .from('agent_wallet_accounts')
        .insert({ agent_id: agentId, wallet_scheme_id: scheme.id, balance: 0 })
        .select('*, wallet_schemes(code, name)')
        .single()
      if (error) { toastError('Error', error.message); return }
      setMyWallets(prev => [...prev, data])
    }
  }

  // Individual agent: fund a wallet
  const openFund = (scheme) => {
    setFundWallet(scheme)
    setFundAmount('')
    setFundModal(true)
  }

  const handleFund = async () => {
    const amt = Number(fundAmount)
    if (!amt || amt < 1000) { toastError('Invalid', 'Minimum TZS 1,000'); return }
    setFunding(true)
    try {
      const wallet = myWallets.find(w => w.wallet_scheme_id === fundWallet.id)
      if (!wallet) throw new Error('Wallet not activated')

      // External refloat: Only Float Balance increases
      const { data, error } = await supabase.rpc('adjust_wallet_balances', {
        p_agent_id: agentId,
        p_wallet_code: fundWallet.code,
        p_float_change: amt,
        p_cash_change: 0
      })

      if (error) throw error
      
      // Update local state by re-fetching or optimistic update
      // For simplicity here, we'll re-trigger the load effect by updating user state or just manually update
      const { data: updated } = await supabase.from('agent_wallet_accounts').select('*, wallet_schemes(code, name)').eq('id', wallet.id).single()
      setMyWallets(prev => prev.map(w => w.id === updated.id ? updated : w))
      
      success('External Refloat Complete', `${formatCurrencyTZS(amt)} added to ${fundWallet.code} Float Balance.`)
      setFundModal(false)
    } catch (err) {
      toastError('Failed', err.message)
    } finally {
      setFunding(false)
    }
  }

  // Handle Internal Refloat (Cash Balance -> Float Balance)
  const handleInternalRefloat = async () => {
    const amt = Number(internalAmount)
    if (!amt || amt < 1000) { toastError('Invalid', 'Minimum TZS 1,000'); return }
    
    // Check if enough cash balance
    const wallet = myWallets.find(w => w.wallet_scheme_id === internalWallet.id)
    if (wallet.cash_balance < amt) {
       toastError('Insufficient Cash', `You only have ${formatCurrencyTZS(wallet.cash_balance)} in cash for this wallet.`); 
       return 
    }

    setInternalRefloating(true)
    try {
      const { error } = await supabase.rpc('adjust_wallet_balances', {
        p_agent_id: agentId,
        p_wallet_code: internalWallet.code,
        p_float_change: amt,
        p_cash_change: -amt
      })

      if (error) throw error
      
      const { data: updated } = await supabase.from('agent_wallet_accounts').select('*, wallet_schemes(code, name)').eq('id', wallet.id).single()
      setMyWallets(prev => prev.map(w => w.id === updated.id ? updated : w))
      
      success('Internal Refloat Complete', `${formatCurrencyTZS(amt)} moved from Cash to Float Balance.`);
      setInternalModal(false)
      setInternalAmount('')
    } catch (err) {
      toastError('Refloat Failed', err.message)
    } finally {
      setInternalRefloating(false)
    }
  }

  // Monthly Commission save
  const handleSaveMonthlyComm = async () => {
    const amt = Number(commAmount)
    if (!amt || amt <= 0) { toastError('Invalid', 'Enter a valid amount'); return }
    setSavingComm(true)
    try {
      await supabase.from('commissions').insert({
        agent_id: agentId,
        supervisor_id: supervisorId,
        agent_fee: amt,
        super_agent_fee: 0, 
        platform_fee: 0,
        type: 'MONTHLY',
        wallet_scheme_id: commWallet.id
      })
      success('Commission Recorded', `Monthly earnings for ${commWallet.code} saved.`)
      setCommModal(false)
      setCommAmount('')
    } catch (err) {
      toastError('Error', err.message)
    } finally {
      setSavingComm(false)
    }
  }

  // Save till number for individual agent
  const saveTill = async (scheme) => {
    const walletRow = myWallets.find(w => w.wallet_scheme_id === scheme.id)
    if (!walletRow) return
    setSavingTill(true)
    try {
      const { data, error } = await supabase
        .from('agent_wallet_accounts')
        .update({ till_number: tillDraft || null, updated_at: new Date().toISOString() })
        .eq('id', walletRow.id)
        .select('*, wallet_schemes(code, name)')
        .single()
      if (error) throw error
      setMyWallets(prev => prev.map(w => w.id === data.id ? data : w))
      success('Till Saved', `Till number updated for ${scheme.code}.`)
      setEditingTill(null)
    } catch (err) {
      toastError('Failed', err.message)
    } finally {
      setSavingTill(false)
    }
  }

  // Network agent: request refloat from supervisor
  const handleRefloat = async () => {
    setRefloating(true)
    try {
      const { data: u } = await supabase.from('users').select('supervisor_id, id').eq('id', user.id).maybeSingle()
      if (!u?.supervisor_id) throw new Error('No supervisor network attached.')

      const [supersRes, adminsRes] = await Promise.all([
        supabase.from('users').select('id').eq('role', 'SUPERVISOR').eq('supervisor_id', u.supervisor_id),
        supabase.from('users').select('id').eq('role', 'PLATFORM_ADMIN')
      ])

      const targets = [...(supersRes.data || []), ...(adminsRes.data || [])]
      if (!targets.length) throw new Error('No supervisors found.')

      await supabase.from('notifications').insert(targets.map(t => ({
        user_id: t.id,
        type: 'LIQUIDITY',
        title: 'Agent Refloat Request',
        message: `${user?.name} is requesting float replenishment for their wallet accounts.`,
        is_read: false,
        metadata: { agent_id: u.id, flow: 'wallet_refloat' }
      })))

      success('Refloat Requested', 'Your supervisor has been notified.')
    } catch (err) {
      toastError('Failed', err.message)
    } finally {
      setRefloating(false)
    }
  }

  const totalBalance     = myWallets.reduce((s, w) => s + (w.balance || 0), 0)
  const totalCashBalance = myWallets.reduce((s, w) => s + (w.cash_balance || 0), 0)
  const isNetworkAgent   = !!supervisorId

  return (
    <div className="animate-fadeIn">
      <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">My Wallets</h1>
          <p className="page-subtitle">
            {isNetworkAgent
              ? 'Your wallets logic follows your supervisor network rules'
              : 'Manage your payment channels and dual-balance accounts'}
          </p>
        </div>
        {isNetworkAgent && (
          <Button
            label="Request Network Refloat"
            variant="primary"
            icon={<RefreshCw size={16} />}
            loading={refloating}
            onClick={handleRefloat}
            hint="Request float from supervisor source"
          />
        )}
      </div>

      {/* Dual Balance Summary */}
      {myWallets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--color-primary-dark), rgba(0,168,107,0.06))', border: '1px solid var(--color-primary-light)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Total Float Balance</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>{formatCurrencyTZS(totalBalance)}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Electronic Liquidity</div>
            </div>
            <Wallet size={36} color="var(--color-primary)" style={{ opacity: 0.3 }} />
          </div>

          <div style={{ background: 'linear-gradient(135deg, var(--color-accent-dark), rgba(245,166,35,0.06))', border: '1px solid var(--color-accent-light)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Total Cash Balance</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>{formatCurrencyTZS(totalCashBalance)}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Physical Cash at Hand</div>
            </div>
            <TrendingUp size={36} color="var(--color-accent)" style={{ opacity: 0.3 }} />
          </div>
        </div>
      )}

      {/* Network Agent Banner */}
      {isNetworkAgent && (
        <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Lock size={18} color="#F5A623" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#F5A623' }}>Supervisor-Managed Wallets</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Your wallet configuration and float funding are controlled by your supervisor. Request a refloat if your balance is low.</div>
          </div>
        </div>
      )}

      {/* Wallet Scheme Grid */}
      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-4)' }}>Loading wallets...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 'var(--space-3)' }}>
          {schemes.map(scheme => {
            const meta = WALLET_META[scheme.code] || { name: scheme.name, color: '#888', bg: 'rgba(128,128,128,0.1)' }
            const enabled = isEnabled(scheme.id)
            const balance = getBalance(scheme.id)

            return (
              <div
                key={scheme.id}
                onClick={() => !isNetworkAgent && toggleWallet(scheme)}
                style={{
                  cursor: isNetworkAgent ? 'default' : 'pointer',
                  padding: 'var(--space-4)',
                  background: enabled ? meta.bg : 'var(--color-surface)',
                  border: `2px solid ${enabled ? meta.color : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-xl)',
                  transition: 'all 0.18s ease',
                  opacity: !enabled && isNetworkAgent ? 0.4 : 1,
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: meta.bg, border: `1px solid ${meta.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={16} color={meta.color} />
                  </div>
                  {isNetworkAgent
                    ? enabled ? <CheckCircle2 size={18} color={meta.color} /> : <Circle size={18} color="var(--color-border)" />
                    : enabled ? <CheckCircle2 size={18} color={meta.color} /> : <Circle size={18} color="var(--color-text-muted)" />
                  }
                </div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{meta.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-1)' }}>{scheme.code}</div>
                {enabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      <span>FLOAT</span>
                      <span style={{ color: meta.color, fontFamily: 'var(--font-mono)' }}>{formatCurrencyCompact(balance)}</span>
                    </div>
                    <div style={{ width: '100%', height: 3, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                       <div style={{ width: '60%', height: '100%', background: meta.color, opacity: 0.7 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      <span>CASH</span>
                      <span style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{formatCurrencyCompact(getCashBalance(scheme.id))}</span>
                    </div>
                  </div>
                )}

                {/* Till Number */}
                {enabled && (() => {
                  const till = getTill(scheme.id)
                  const isEditing = editingTill === scheme.id
                  if (isNetworkAgent) {
                    return till ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Hash size={10} color={meta.color} />
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: meta.color, fontWeight: 700 }}>{till}</span>
                      </div>
                    ) : null
                  }
                  // Individual agent — editable
                  return isEditing ? (
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      <input
                        autoFocus
                        value={tillDraft}
                        onChange={e => setTillDraft(e.target.value)}
                        placeholder="Till / Paybill No."
                        style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)', border: `1px solid ${meta.color}`, borderRadius: 'var(--radius-sm)', padding: '4px 6px', color: 'white', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                      />
                      <button
                        onClick={() => saveTill(scheme)}
                        disabled={savingTill}
                        style={{ background: meta.color, border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Check size={12} color="#fff" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={e => { e.stopPropagation(); setEditingTill(scheme.id); setTillDraft(till || '') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, cursor: 'pointer', opacity: 0.7 }}
                    >
                      {till
                        ? <><Hash size={10} color={meta.color} /><span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: meta.color, fontWeight: 700 }}>{till}</span><Edit3 size={9} color={meta.color} /></>
                        : <><Hash size={10} color="var(--color-text-muted)" /><span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Set till number</span></>
                      }
                    </div>
                  )
                })()}

                {/* Refloat Actions */}
                {enabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 'var(--space-3)' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setInternalWallet(scheme); setInternalModal(true); }}
                      style={{ padding: '6px 4px', background: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                    >
                      Cash → Float
                    </button>
                    {!isNetworkAgent ? (
                      <button
                        onClick={e => { e.stopPropagation(); openFund(scheme) }}
                        style={{ padding: '6px 4px', background: meta.color, color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                      >
                        + External
                      </button>
                    ) : (
                      <div style={{ padding: '6px 4px', border: `1px solid ${meta.color}`, color: meta.color, borderRadius: 'var(--radius-md)', fontSize: 9, fontWeight: 700, textAlign: 'center', opacity: 0.6 }}>
                        Network Locked
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setCommWallet(scheme); setCommModal(true); }}
                      style={{ gridColumn: 'span 2', padding: '6px 4px', background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', borderRadius: 'var(--radius-md)', fontSize: 9, fontWeight: 600, border: '1px solid var(--color-border)', cursor: 'pointer', marginTop: 4 }}
                    >
                      Record Monthly Commission
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Internal Refloat Modal (Cash to Float) */}
      <Modal
        id="agent-internal-refloat-modal"
        isOpen={internalModal}
        onClose={() => setInternalModal(false)}
        title={`Internal Refloat — ${internalWallet?.code}`}
        size="sm"
        footer={<>
          <Button label="Cancel" variant="secondary" onClick={() => setInternalModal(false)} />
          <Button label="Process Refloat" loading={internalRefloating} onClick={handleInternalRefloat} icon={<RefreshCw size={14} />} />
        </>}
      >
        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>Available Cash</span>
            <strong style={{ color: 'var(--color-accent)' }}>{formatCurrencyTZS(internalWallet ? getCashBalance(internalWallet.id) : 0)}</strong>
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>This will move money from your physical cash balance into your digital float balance.</p>
        </div>
        <Input
          id="internal-refloat-amount"
          name="internal-amount"
          label="Amount to Move (TZS)"
          placeholder="e.g. 50,000"
          type="number"
          value={internalAmount}
          onChange={e => setInternalAmount(e.target.value)}
          prefix={<span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>TZS</span>}
        />
      </Modal>

      {/* Fund Wallet Modal (Individual Agents) */}
      <Modal
        id="agent-fund-modal"
        isOpen={fundModal}
        onClose={() => setFundModal(false)}
        title={`External Refloat — ${fundWallet?.code}`}
        size="sm"
        footer={<>
          <Button label="Cancel" variant="secondary" onClick={() => setFundModal(false)} />
          <Button label="Add External Float" loading={funding} onClick={handleFund} icon={<Send size={14} />} />
        </>}
      >
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
          Use this for funding your wallet from sources outside of your daily cash balance (e.g. self-funding or external deposits).
        </p>
        <Input
          id="agent-fund-amount"
          name="fund-amount"
          label="Amount (TZS)"
          placeholder="e.g. 200,000"
          type="number"
          value={fundAmount}
          onChange={e => setFundAmount(e.target.value)}
          hint="Minimum TZS 1,000"
          prefix={<span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>TZS</span>}
        />
      </Modal>

      {/* Record Monthly Commission Modal */}
      <Modal
        id="agent-comm-modal"
        isOpen={commModal}
        onClose={() => setCommModal(false)}
        title={`Monthly Commission — ${commWallet?.code}`}
        size="sm"
        footer={<>
          <Button label="Cancel" variant="secondary" onClick={() => setCommModal(false)} />
          <Button label="Save Earnings" loading={savingComm} onClick={handleSaveMonthlyComm} icon={<TrendingUp size={14} />} />
        </>}
      >
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
          Record the lump-sum monthly commission payout received from the provider for this channel.
        </p>
        <Input
          id="agent-comm-amount"
          name="comm-amount"
          label="Commission Amount (TZS)"
          placeholder="e.g. 50,000"
          type="number"
          value={commAmount}
          onChange={e => setCommAmount(e.target.value)}
          prefix={<span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>TZS</span>}
        />
      </Modal>
    </div>
  )
}
