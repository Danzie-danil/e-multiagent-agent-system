// pages/supervisor/SupervisorWallets.jsx
import { useState, useEffect } from 'react'
import { Wallet, CheckCircle2, Circle, Send, TrendingUp, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase/client'
import { formatCurrencyCompact, formatCurrencyTZS } from '../../utils/formatters'

const WALLET_META = {
  MPESA:    { name: 'M-Pesa',      color: '#00A651', bg: 'rgba(0,166,81,0.12)' },
  AIRTEL:   { name: 'Airtel Money',color: '#E40000', bg: 'rgba(228,0,0,0.10)' },
  CRDB:     { name: 'CRDB Bank',   color: '#003580', bg: 'rgba(0,53,128,0.12)' },
  HALOPESA: { name: 'HaloPesa',    color: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
  MIXX:     { name: 'Mixx by Yas', color: '#7B2FBE', bg: 'rgba(123,47,190,0.12)' },
  NMB:      { name: 'NMB Bank',    color: '#00897B', bg: 'rgba(0,137,123,0.12)' },
  EQUITY:   { name: 'Equity Bank', color: '#D32F2F', bg: 'rgba(211,47,47,0.12)' },
  NBC:      { name: 'NBC Bank',    color: '#1565C0', bg: 'rgba(21,101,192,0.12)' },
  KCB:      { name: 'KCB Bank',    color: '#2E7D32', bg: 'rgba(46,125,50,0.12)' },
}

export default function SupervisorWallets() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()

  const [schemes, setSchemes] = useState([])
  const [activeWallets, setActiveWallets] = useState(new Set())
  const [agentWallets, setAgentWallets] = useState([])
  const [agents, setAgents] = useState([])
  const [showAgents, setShowAgents] = useState(false)
  const [loadingSchemes, setLoadingSchemes] = useState(true)

  // Fund modal state
  const [fundModal, setFundModal] = useState(false)
  const [fundForm, setFundForm] = useState({ wallet_code: '', amount: '' })
  const [funding, setFunding] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        // Fetch all wallet schemes
        const { data: schemeData } = await supabase
          .from('wallet_schemes')
          .select('*')
          .eq('active', true)
          .order('code')
        setSchemes(schemeData || [])

        // Get supervisor's agents
        const { data: userData } = await supabase
          .from('users')
          .select('supervisor_id')
          .eq('id', user.id)
          .maybeSingle()

        if (userData?.supervisor_id) {
          const { data: agentsData } = await supabase
            .from('agents')
            .select('id, name, phone, status')
            .eq('supervisor_id', userData.supervisor_id)
            .eq('onboarding_status', 'COMPLETED')

          setAgents(agentsData || [])

          // Fetch all wallet balances for all agents
          if (agentsData?.length) {
            const agentIds = agentsData.map(a => a.id)
            const { data: walletData } = await supabase
              .from('agent_wallet_accounts')
              .select('*, wallet_schemes(code, name)')
              .in('agent_id', agentIds)

            setAgentWallets(walletData || [])
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingSchemes(false)
      }
    }
    if (user?.id) load()
  }, [user])

  const toggleWallet = (code) => {
    setActiveWallets(prev => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  const openFund = (code) => {
    setFundForm({ wallet_code: code, amount: '' })
    setFundModal(true)
  }

  const handleFund = async () => {
    if (!fundForm.amount || isNaN(fundForm.amount)) return
    setFunding(true)
    try {
      // Supervisor funds their own master wallet ledger — simulated here
      await new Promise(r => setTimeout(r, 700))
      success('Wallet Funded', `${formatCurrencyTZS(Number(fundForm.amount))} added to ${fundForm.wallet_code} master pool.`)
      setFundModal(false)
    } catch (err) {
      toastError('Failed', err.message)
    } finally {
      setFunding(false)
    }
  }

  // Group agent wallets by agent
  const walletsByAgent = agents.map(ag => ({
    ...ag,
    wallets: agentWallets.filter(w => w.agent_id === ag.id)
  }))

  const totalActiveAgentFloat = agentWallets.reduce((s, w) => s + (w.balance || 0), 0)

  return (
    <div className="animate-fadeIn">
      <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">Wallet Network</h1>
          <p className="page-subtitle">Configure and fund your network's digital payment channels</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: 6 }}>ACTIVE WALLETS</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{activeWallets.size}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>of {schemes.length} available</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: 6 }}>NETWORK AGENTS</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{agents.length}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>agents with wallets</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: 6 }}>TOTAL FLOAT OUT</div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{formatCurrencyCompact(totalActiveAgentFloat)}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>across all agents</div>
        </div>
      </div>

      {/* Wallet Scheme Grid */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-4)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Payment Channels</h2>
        {loadingSchemes ? (
          <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-4)' }}>Loading wallet schemes...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            {schemes.map(scheme => {
              const meta = WALLET_META[scheme.code] || { name: scheme.name, color: '#888', bg: 'rgba(128,128,128,0.1)' }
              const isActive = activeWallets.has(scheme.code)
              return (
                <div
                  key={scheme.code}
                  onClick={() => toggleWallet(scheme.code)}
                  style={{
                    cursor: 'pointer',
                    padding: 'var(--space-4)',
                    background: isActive ? meta.bg : 'var(--color-surface)',
                    border: `2px solid ${isActive ? meta.color : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-xl)',
                    transition: 'all 0.18s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta.bg, border: `1px solid ${meta.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Wallet size={18} color={meta.color} />
                    </div>
                    {isActive
                      ? <CheckCircle2 size={20} color={meta.color} />
                      : <Circle size={20} color="var(--color-text-muted)" />
                    }
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 2 }}>{meta.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{scheme.code}</div>
                  {isActive && (
                    <div
                      onClick={e => { e.stopPropagation(); openFund(scheme.code) }}
                      style={{ marginTop: 'var(--space-3)', padding: '6px 12px', background: meta.color, color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}
                    >
                      + Fund Pool
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Agent Wallet Network Overview */}
      <section>
        <button
          onClick={() => setShowAgents(!showAgents)}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)', padding: 0 }}
        >
          <Users size={16} color="var(--color-text-muted)" />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>Agent Wallet Overview</span>
          {showAgents ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
        </button>

        {showAgents && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {walletsByAgent.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-4)' }}>No active agents with wallets yet. Fund agents via Agent Management.</div>
            ) : walletsByAgent.map(ag => (
              <div key={ag.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{ag.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{ag.phone}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {formatCurrencyCompact(ag.wallets.reduce((s, w) => s + (w.balance || 0), 0))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {ag.wallets.length === 0
                    ? <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No wallets provisioned — use Agent Management to fund.</span>
                    : ag.wallets.map(w => {
                        const meta = WALLET_META[w.wallet_schemes?.code] || {}
                        return (
                          <div key={w.id} style={{ padding: '4px 10px', background: meta.bg || 'var(--color-bg)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600 }}>
                            <span style={{ color: meta.color || 'var(--color-text-muted)' }}>{w.wallet_schemes?.code}</span>
                            <span style={{ marginLeft: 4, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{formatCurrencyCompact(w.balance)}</span>
                          </div>
                        )
                      })
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fund Modal */}
      <Modal
        id="fund-wallet-modal"
        isOpen={fundModal}
        onClose={() => setFundModal(false)}
        title={`Fund ${fundForm.wallet_code} Master Pool`}
        size="sm"
        footer={<>
          <Button label="Cancel" variant="secondary" onClick={() => setFundModal(false)} />
          <Button label="Confirm Funding" loading={funding} onClick={handleFund} icon={<Send size={14} />} />
        </>}
      >
        <Input
          id="fund-amount-input"
          name="fund-amount"
          label="Amount (TZS)"
          placeholder="e.g. 1,000,000"
          type="number"
          value={fundForm.amount}
          onChange={e => setFundForm(f => ({ ...f, amount: e.target.value }))}
          hint="Genesis balance for this wallet channel"
          prefix={<span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>TZS</span>}
        />
      </Modal>
    </div>
  )
}
