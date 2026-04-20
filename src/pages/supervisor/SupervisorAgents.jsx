// pages/supervisor/SupervisorAgents.jsx
import { useState, useEffect, useCallback } from 'react'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { formatCurrencyCompact } from '../../utils/formatters'
import { Plus, UserPlus, X, Copy, CheckCircle2, Circle, Settings, Wallet as WalletIcon, TrendingUp } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../context/AuthContext'

export default function SupervisorAgents() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()
  const [showOnboard, setShowOnboard] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(1) // 1: Form, 2: Code
  const [generatedCode, setGeneratedCode] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Persistent Cache Initialization
  const getCached = (key, fallback) => {
    try {
      const val = localStorage.getItem(`ewakala_super_${key}`)
      return val ? JSON.parse(val) : fallback
    } catch { return fallback }
  }

  const [agents, setAgents] = useState(() => getCached('agents_list', []))
  const [loadingAgents, setLoadingAgents] = useState(!localStorage.getItem('ewakala_super_agents_list'))
  
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [schemes, setSchemes]             = useState([])
  const [agentWalletToggles, setAgentWalletToggles] = useState({})
  const [agentWalletAmounts, setAgentWalletAmounts] = useState({})
  const [agentWalletTills,   setAgentWalletTills]   = useState({})
  const [provisioningAgent, setProvisioningAgent]   = useState(false)
  const [loadingConfig,     setLoadingConfig]       = useState(false)
  const [isUpdateMode,      setIsUpdateMode]        = useState(false)

  const WALLET_META = {
    MPESA: { color: '#00A651' }, AIRTEL: { color: '#E40000' }, CRDB: { color: '#003580' },
    HALOPESA: { color: '#F5A623' }, MIXX: { color: '#7B2FBE' }, NMB: { color: '#00897B' },
    EQUITY: { color: '#D32F2F' }, NBC: { color: '#1565C0' }, KCB: { color: '#2E7D32' },
  }

  // Fetch wallet schemes once
  useEffect(() => {
    supabase.from('wallet_schemes').select('*').eq('active', true).order('code')
      .then(({ data }) => setSchemes(data || []))
  }, [])

  // Opens the config modal and pre-loads existing wallet state for the agent
  const openAgentConfig = async (ag) => {
    setLoadingConfig(true)
    setSelectedAgent(ag)
    setAgentWalletToggles({})
    setAgentWalletAmounts({})
    setAgentWalletTills({})
    setIsUpdateMode(false)
    try {
      const { data: existing } = await supabase
        .from('agent_wallet_accounts')
        .select('*, wallet_schemes(id, code)')
        .eq('agent_id', ag.id)
      if (existing && existing.length > 0) {
        setIsUpdateMode(true)
        const toggles = {}, amounts = {}, tills = {}
        existing.forEach(w => {
          toggles[w.wallet_scheme_id] = true
          amounts[w.wallet_scheme_id] = w.balance > 0 ? String(w.balance) : ''
          tills[w.wallet_scheme_id]   = w.till_number || ''
        })
        setAgentWalletToggles(toggles)
        setAgentWalletAmounts(amounts)
        setAgentWalletTills(tills)
      }
    } catch (err) {
      console.error('Failed to load agent wallet config:', err)
    } finally {
      setLoadingConfig(false)
    }
  }

  const [supervisorId, setSupervisorId] = useState(null)

  // Elevate fetchAgents to component scope so it can be called from realtime
  const fetchAgents = useCallback(async (sid) => {
    const resolvedSid = sid || supervisorId
    if (!resolvedSid) return
    try {
      const { data: ags, error } = await supabase
        .from('agents')
        .select('*')
        .eq('supervisor_id', resolvedSid)
        .order('created_at', { ascending: false })
      if (error) throw error

      const agentIds = ags.map(a => a.id)
      const { data: userDataList } = await supabase.from('users').select('id, agent_id').in('agent_id', agentIds)
      const userMap = {}
      userDataList?.forEach(u => { userMap[u.agent_id] = u.id })

      const { data: bals } = await supabase.from('agent_wallet_accounts').select('agent_id, balance').in('agent_id', agentIds)
      
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { data: txCounts } = await supabase
        .from('transactions')
        .select('from_agent_id')
        .in('from_agent_id', agentIds)
        .gte('created_at', startOfDay.toISOString())

      const metricsMap = {}
      ags.forEach(a => { metricsMap[a.id] = { float: 0, txToday: 0 } })
      bals?.forEach(b => { if (metricsMap[b.agent_id]) metricsMap[b.agent_id].float += Number(b.balance) })
      txCounts?.forEach(tx => { if (metricsMap[tx.from_agent_id]) metricsMap[tx.from_agent_id].txToday += 1 })

      const FinalAgents = ags.map(a => ({ ...a, float: metricsMap[a.id].float, txToday: metricsMap[a.id].txToday, userId: userMap[a.id] }))
      setAgents(FinalAgents)
      localStorage.setItem('ewakala_super_agents_list', JSON.stringify(FinalAgents))
    } catch (err) {
      console.error("Failed to load agents", err)
    } finally {
      setLoadingAgents(false)
    }
  }, [supervisorId])

  useEffect(() => {
    async function init() {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('supervisor_id')
          .eq('id', user.id)
          .maybeSingle()

        if (userData?.supervisor_id) {
          setSupervisorId(userData.supervisor_id)
          await fetchAgents(userData.supervisor_id)
        }
      } catch(err) {
        console.error("Init error:", err)
      }
    }
    if (user?.id) init()
  }, [user])


  // Realtime Subscriptions
  useEffect(() => {
    if (!supervisorId) return

    const channel = supabase
      .channel(`supervisor_agents_${supervisorId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agents', 
        filter: `supervisor_id=eq.${supervisorId}` 
      }, () => fetchAgents())
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'agent_wallet_accounts'
      }, () => fetchAgents())
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'transactions'
      }, () => fetchAgents())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime: Agents list for supervisor ${supervisorId} active`)
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [supervisorId, fetchAgents])

  const handleOnboard = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    // Generate a random 8-char join code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    
    try {
      // Get the supervisor_id for the current user safely from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('supervisor_id')
        .eq('id', user.id)
        .maybeSingle()
        
      if (userError || !userData?.supervisor_id) {
         throw new Error("Could not verify your supervisor identity network")
      }
      
      const { error } = await supabase.from('agents').insert({
        name: newAgent.name,
        phone: newAgent.phone,
        supervisor_id: userData.supervisor_id,
        join_code: code,
        onboarding_status: 'PENDING'
      })
      if (error) throw error

      setGeneratedCode(code)
      setOnboardingStep(2)
      success('Agent Record Created', `Registration code generated for ${newAgent.name}`)
      // Add instantly to local state to reflect creation
      setAgents(prev => [
        { id: Math.random(), name: newAgent.name, phone: newAgent.phone, join_code: code, onboarding_status: 'PENDING' },
        ...prev
      ])
    } catch (err) {
      toastError('Onboarding Failed', err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode)
    success('Copied', 'Join code copied to clipboard')
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Agent Network</h1>
          <p className="page-subtitle">Currently managing {agents.length} active terminals</p>
        </div>
        <Button 
          label="Onboard New Agent" 
          variant="primary" 
          icon={<UserPlus size={18} />}
          onClick={() => { setShowOnboard(true); setOnboardingStep(1); }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {loadingAgents ? (
           <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)' }}>Loading network...</div>
        ) : agents.length === 0 ? (
           <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)' }}>No agents registered yet.</div>
        ) : (
          agents.map(ag => {
            const isPending = ag.onboarding_status === 'PENDING'
            const total = ag.float || 0
            const txCount = isPending ? '--' : (ag.txToday || 0)

            return (
              <div 
                key={ag.id} 
                onClick={() => !isPending && openAgentConfig(ag)}
                style={{ cursor: isPending ? 'default' : 'pointer', padding: 'var(--space-5)', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', opacity: isPending ? 0.8 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-text-primary)', fontSize: 'var(--text-md)', marginBottom: 2 }}>{ag.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{ag.phone}</div>
                  </div>
                  {isPending ? (
                     <StatusBadge status="WARNING" /> /* Using warning style for pending amber */
                  ) : (
                     <StatusBadge status={ag.status || 'ACTIVE'} />
                  )}
                </div>
                
                {isPending && ag.join_code && (
                  <div style={{ padding: '4px 8px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, fontWeight: 700, marginBottom: 'var(--space-3)', display: 'inline-block' }}>
                     JOIN CODE: {ag.join_code}
                  </div>
                )}
                
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 'var(--weight-bold)' }}>TOTAL FLOAT</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: 'var(--text-sm)' }}>
                      {isPending ? '--' : formatCurrencyCompact(total)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 'var(--weight-bold)' }}>TX TODAY</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: 'var(--text-sm)' }}>{txCount}</div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Agent Config Modal — Full Wallet Provisioning */}
      {selectedAgent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', paddingBottom: '90px', overflowY: 'auto' }}>
          <div className="animate-slideUp" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', width: '100%', maxWidth: 540, overflow: 'hidden', margin: 'auto' }}>
            {/* Header */}
            <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ background: 'var(--color-primary-dark)', padding: 'var(--space-2)', borderRadius: 'var(--radius-lg)' }}><Settings size={20} color="var(--color-primary)" /></div>
                <div>
                  <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, lineHeight: 1 }}>{selectedAgent.name}</h2>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{selectedAgent.phone}</div>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20}/></button>
            </div>

            {/* Wallet Provisioning Body */}
            <div style={{ padding: 'var(--space-5)', maxHeight: '65vh', overflowY: 'auto' }}>
              {/* Mode banner */}
              {isUpdateMode && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  padding: '10px 14px', 
                  background: 'var(--color-success-light)', 
                  border: '1px solid var(--color-success)', 
                  borderRadius: 'var(--radius-lg)', 
                  marginBottom: 'var(--space-4)' 
                }}>
                  <CheckCircle2 size={16} color="var(--color-success)" />
                  <span style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600 }}>
                    Existing wallet config loaded. Toggle wallets on/off, update till numbers or adjust balances then save.
                  </span>
                </div>
              )}
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>Enable wallets, set the <strong>Till/Paybill number</strong> and an optional initial float. Only enabled wallets will be provisioned.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {schemes.map(s => {
                  const color = WALLET_META[s.code]?.color || '#888'
                  const isOn  = !!agentWalletToggles[s.id]
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', background: isOn ? `${color}10` : 'var(--color-bg)', border: `1px solid ${isOn ? color : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', transition: 'all 0.15s' }}>
                      {/* Toggle */}
                      <button
                        onClick={() => setAgentWalletToggles(p => ({ ...p, [s.id]: !p[s.id] }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                      >
                        {isOn
                          ? <CheckCircle2 size={22} color={color} />
                          : <Circle size={22} color="var(--color-text-muted)" />
                        }
                      </button>
                      {/* Wallet name */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: isOn ? color : 'var(--color-text-primary)' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{s.code}</div>
                      </div>
                      {/* Till + Amount inputs */}
                      {isOn && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          <input
                            type="text"
                            placeholder="Till / Paybill No."
                            value={agentWalletTills[s.id] || ''}
                            onChange={e => setAgentWalletTills(p => ({ ...p, [s.id]: e.target.value }))}
                                                        style={{ 
                              width: 140, 
                              background: 'var(--color-bg)', 
                              border: `1px solid ${color}80`, 
                              borderRadius: 'var(--radius-md)', 
                              padding: '6px 10px', 
                              color: 'var(--color-text-primary)', 
                              fontFamily: 'var(--font-mono)', 
                              fontSize: 12 
                            }}
                          />
                          <input
                            type="number"
                            placeholder={isUpdateMode && agentWalletAmounts[s.id] ? `Current: ${agentWalletAmounts[s.id]}` : 'Float TZS'}
                            value={agentWalletAmounts[s.id] || ''}
                            onChange={e => setAgentWalletAmounts(p => ({ ...p, [s.id]: e.target.value }))}
                            style={{ 
                              width: 140, 
                              background: 'var(--color-bg)', 
                              border: `1px solid ${color}40`, 
                              borderRadius: 'var(--radius-md)', 
                              padding: '6px 10px', 
                              color: 'var(--color-text-primary)', 
                              fontFamily: 'var(--font-mono)', 
                              fontSize: 12 
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <Button label="Cancel" variant="secondary" onClick={() => setSelectedAgent(null)} />
              <Button
                label={loadingConfig ? 'Loading...' : isUpdateMode ? 'Update Wallets' : 'Provision Wallets'}
                icon={<WalletIcon size={15} />}
                loading={provisioningAgent || loadingConfig}
                disabled={loadingConfig}
                onClick={async () => {
                  const enabled = schemes.filter(s => agentWalletToggles[s.id])
                  if (!enabled.length) { success('Nothing to provision', 'Enable at least one wallet.'); return }
                  setProvisioningAgent(true)
                  try {
                    const upserts = enabled.map(s => ({
                      agent_id: selectedAgent.id,
                      wallet_scheme_id: s.id,
                      balance: Number(agentWalletAmounts[s.id] || 0),
                      till_number: agentWalletTills[s.id] || null,
                      updated_at: new Date().toISOString()
                    }))
                    const { error } = await supabase
                      .from('agent_wallet_accounts')
                      .upsert(upserts, { onConflict: 'agent_id,wallet_scheme_id' })
                    if (error) throw error
                    success(
                      isUpdateMode ? 'Wallets Updated' : 'Wallets Provisioned',
                      `${enabled.length} wallet(s) ${isUpdateMode ? 'updated' : 'set up'} for ${selectedAgent.name}.`
                    )
                    setSelectedAgent(null)
                    setAgentWalletToggles({})
                    setAgentWalletAmounts({})
                    setAgentWalletTills({})
                  } catch (err) {
                    toastError(isUpdateMode ? 'Update Failed' : 'Provision Failed', err.message)
                  } finally {
                    setProvisioningAgent(false)
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Modal Overlay */}
      {showOnboard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="animate-slideUp" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', width: '100%', maxWidth: 400, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>Onboard New Agent</h2>
              <button onClick={() => setShowOnboard(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20}/></button>
            </div>

            <div style={{ padding: 'var(--space-6)' }}>
              {onboardingStep === 1 ? (
                <form onSubmit={handleOnboard}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
                    Pre-register an agent to generate a secure join code. They will use this code to link their account to your network.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Agent Full Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Hassan Juma" 
                        required
                        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', color: 'white' }}
                        value={newAgent.name}
                        onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Phone Number</label>
                      <input 
                        type="tel" 
                        placeholder="0712345678" 
                        required
                        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', color: 'white' }}
                        value={newAgent.phone}
                        onChange={(e) => setNewAgent({...newAgent, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  <Button type="submit" label="Generate Join Code" variant="primary" size="lg" style={{ width: '100%' }} loading={loading} />
                </form>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ background: 'var(--color-success-light)', color: 'var(--color-success)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 style={{ fontWeight: 800, fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>Code Generated!</h3>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
                    Share this code with <strong>{newAgent.name}</strong>. They must enter it during signup to join your network.
                  </p>
                  
                  <div style={{ display: 'flex', gap: 'var(--space-2)', background: 'var(--color-bg)', padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)', border: '1px dashed var(--color-border)', marginBottom: 'var(--space-6)', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 800, letterSpacing: 2, color: 'var(--color-primary)' }}>{generatedCode}</span>
                    <button onClick={copyCode} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 'var(--space-2)' }}><Copy size={18}/></button>
                  </div>

                  <Button label="Done" variant="ghost" size="lg" style={{ width: '100%' }} onClick={() => setShowOnboard(false)} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
