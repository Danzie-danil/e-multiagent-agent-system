// pages/agent-pos/AgentHome.jsx
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowDownLeft, ArrowUpRight, Clock, Wifi, Wallet, Send, CreditCard, TrendingUp } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../supabase/client'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { formatCurrencyTZS, formatCurrencyCompact } from '../../utils/formatters'
import './AgentHome.css'

export default function AgentHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const [requesting, setRequesting] = useState(false)
  const [agentName, setAgentName] = useState('Agent')
  const [agentId, setAgentId] = useState(null)
  
  // Persistent Cache Initialization
  const getCached = (key, fallback) => {
    try {
      const val = localStorage.getItem(`ewakala_agent_${key}`)
      return val ? JSON.parse(val) : fallback
    } catch { return fallback }
  }

  const [totalFloat, setTotalFloat] = useState(() => getCached('totalFloat', 0))
  const [totalCash, setTotalCash]   = useState(() => getCached('totalCash', 0))
  const [txCount, setTxCount]       = useState(() => getCached('txCount', 0))
  const [dailyTotals, setDailyTotals] = useState(() => getCached('dailyTotals', { withdraw: 0, deposit: 0, pay: 0 }))
  const [recentTX, setRecentTX] = useState(() => getCached('recentTX', []))
  const [loading, setLoading] = useState(!localStorage.getItem('ewakala_agent_totalFloat'))

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTXCount, setTotalTXCount] = useState(0)
  const PAGE_SIZE = 10
  useEffect(() => {
    async function loadAgentStats() {
      try {
        const { data: u } = await supabase.from('users').select('agent_id').eq('id', user.id).single()
        if (u?.agent_id) {
          setAgentId(u.agent_id)
          
          // 1. Fetch Real Name
          const { data: ag } = await supabase.from('agents').select('name').eq('id', u.agent_id).single()
          if (ag) setAgentName(ag.name)

          // 2. FETCH CLOUD STATS (RPC)
          const { data: cloudStats, error: statsError } = await supabase.rpc('get_agent_dashboard_stats', { p_agent_id: u.agent_id })
          if (!statsError && cloudStats) {
            setTotalFloat(cloudStats.total_float)
            setTotalCash(cloudStats.total_cash)
            setTxCount(cloudStats.today_count)
            setDailyTotals({
              withdraw: cloudStats.today_withdraw,
              deposit: cloudStats.today_deposit,
              pay: cloudStats.today_pay
            })
            // Update Cache
            localStorage.setItem('ewakala_agent_totalFloat', JSON.stringify(cloudStats.total_float))
            localStorage.setItem('ewakala_agent_totalCash', JSON.stringify(cloudStats.total_cash))
            localStorage.setItem('ewakala_agent_txCount', JSON.stringify(cloudStats.today_count))
            localStorage.setItem('ewakala_agent_dailyTotals', JSON.stringify({
              withdraw: cloudStats.today_withdraw,
              deposit: cloudStats.today_deposit,
              pay: cloudStats.today_pay
            }))
          }

          // 3. Fetch Recent TX with Pagination
          await fetchPaginatedTX(u.agent_id, 1)
        }
      } catch (err) {
        console.error("Home load error:", err)
      } finally {
        setLoading(false)
      }
    }


    async function fetchPaginatedTX(aid, page) {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data: recent, count } = await supabase
        .from('transactions')
        .select('*, wallet_schemes(code)', { count: 'exact' })
        .eq('from_agent_id', aid)
        .order('created_at', { ascending: false })
        .range(from, to)
      
      setRecentTX(recent || [])
      localStorage.setItem('ewakala_agent_recentTX', JSON.stringify(recent || []))
      if (count !== null) setTotalTXCount(count)
    }

    if (user?.id) {
        loadAgentStats()
    }
  }, [user])

  // Realtime Subscriptions
  useEffect(() => {
    if (!agentId) return

    const channel = supabase
      .channel(`agent_ops_${agentId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'transactions', 
        filter: `from_agent_id=eq.${agentId}` 
      }, () => {
        // Refresh everything on transaction change
        loadAgentStats()
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'agent_wallet_accounts', 
        filter: `agent_id=eq.${agentId}` 
      }, () => {
        // Refresh balance on wallet change
        loadAgentStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [agentId])

  // Handle Page Change
  const handlePageChange = async (newPage) => {
    setCurrentPage(newPage)
    const { data: u } = await supabase.from('users').select('agent_id').eq('id', user.id).single()
    if (u?.agent_id) {
      setLoading(true)
      const from = (newPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data: recent } = await supabase
        .from('transactions')
        .select('*, wallet_schemes(code)')
        .eq('from_agent_id', u.agent_id)
        .order('created_at', { ascending: false })
        .range(from, to)
      setRecentTX(recent || [])
      setLoading(false)
    }
  }

  const handleRefloat = async () => {
    setRequesting(true)
    try {
      // Find supervisor_id to alert
      const { data: u } = await supabase.from('users').select('supervisor_id, id').eq('id', user.id).single()
      if (!u?.supervisor_id) throw new Error("No attached supervisor network to alert.")
      
      // Fetch the supervisor user record. 
      // We check two patterns to be resilient:
      // 1. Direct Link: The user whose ID matches our supervisor_id (Seeded case)
      // 2. Entity Link: The user who is a SUPERVISOR and shares our supervisor_id (Refactored case)
      const { data: supers, error: superErr } = await supabase
        .from('users')
        .select('id')
        .or(`id.eq.${u.supervisor_id},and(role.eq.SUPERVISOR,supervisor_id.eq.${u.supervisor_id})`)
      
      if (superErr || !supers?.length) throw new Error("Could not find your network supervisor.")

      const payloads = supers.map(target => ({
        user_id: target.id,
        type: 'LIQUIDITY',
        title: 'Network Refloat Request',
        message: `${user?.name} is requesting a refloat for their agent terminal.`,
        is_read: false,
        metadata: { agent_id: user.id, flow: 'inbound_request' }
      }))
      
      const { error } = await supabase.from('notifications').insert(payloads)
      if (error) throw error
      
      success('Refloat Requested', 'Your network hierarchy has been successfully alerted.')
    } catch (err) {
      toastError('Request Failed', err.message)
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="agent-home animate-fadeIn">
      {/* Greeting */}
      <div className="agent-home__greeting">
        <div>
          <p className="agent-home__greeting-sub">Good morning,</p>
          <h1 className="agent-home__greeting-name">{agentName}</h1>
        </div>
        <div className="agent-home__online-badge">
          <Wifi size={12} />
          <span>Online</span>
        </div>
      </div>

      <div className="agent-home__grid">
        <div className="agent-home__main">
          {/* Dual Balances Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <StatCard 
              label="Float Balance" 
              value={formatCurrencyCompact(totalFloat)} 
              icon={<Wallet size={16} />}
              color="primary"
            />
            <StatCard 
              label="Cash Balance" 
              value={formatCurrencyCompact(totalCash)} 
              icon={<TrendingUp size={16} />}
              color="accent"
              subvalue="Cash at hand"
            />
          </div>

          {/* Daily Volume Card */}
          <Card padding="sm" className="agent-home__stats">
            <div className="agent-home__stat-item">
              <div className="agent-home__stat-label">Withdrawals</div>
              <div className="agent-home__stat-value" style={{ color: '#FF4D4D' }}>{formatCurrencyCompact(dailyTotals.withdraw)}</div>
            </div>
            
            <div className="agent-home__stat-divider" />
            
            <div className="agent-home__stat-item">
              <div className="agent-home__stat-label">Deposits</div>
              <div className="agent-home__stat-value" style={{ color: '#00C853' }}>{formatCurrencyCompact(dailyTotals.deposit)}</div>
            </div>
            
            <div className="agent-home__stat-divider" />
            
            <div className="agent-home__stat-item">
              <div className="agent-home__stat-label">Payments</div>
              <div className="agent-home__stat-value" style={{ color: '#9D4EDD' }}>{formatCurrencyCompact(dailyTotals.pay)}</div>
            </div>
          </Card>

          {/* Primary Actions */}
          <div className="agent-home__actions">
            <button className="agent-action-btn agent-action-btn--withdraw" onClick={() => navigate('/withdraw')}>
              <div className="agent-action-btn__icon">
                <ArrowUpRight size={20} />
              </div>
              <div className="agent-action-btn__text">
                <span className="agent-action-btn__label">Withdraw</span>
                <span className="agent-action-btn__sub">Cash out</span>
              </div>
            </button>

            <button className="agent-action-btn agent-action-btn--deposit" onClick={() => navigate('/deposit')}>
              <div className="agent-action-btn__icon">
                <ArrowDownLeft size={20} />
              </div>
              <div className="agent-action-btn__text">
                <span className="agent-action-btn__label">Deposit</span>
                <span className="agent-action-btn__sub">Cash in</span>
              </div>
            </button>

            <button className="agent-action-btn agent-action-btn--pay" onClick={() => navigate('/pay')}>
              <div className="agent-action-btn__icon">
                <CreditCard size={20} />
              </div>
              <div className="agent-action-btn__text">
                <span className="agent-action-btn__label">Pay</span>
                <span className="agent-action-btn__sub">Merchant</span>
              </div>
            </button>
          </div>
        </div>

        <div className="agent-home__side">
          {/* Transaction History with Pagination */}
          <Card padding="none" className="agent-home__history-card">
            <div className="card-header-flex">
              <h2 className="section-title">Recent Activity</h2>
            </div>
            <div className="transaction-list-paginated">
              {recentTX.map(tx => (
                <div key={tx.id} className="transaction-row-mobile">
                   <div className="tx-icon">
                     {tx.type === 'DEPOSIT' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                   </div>
                   <div className="tx-details">
                     <span className="tx-name">{tx.type}</span>
                     <span className="tx-sub">{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {tx.wallet_schemes?.code}</span>
                   </div>
                   <div className="tx-amount">
                     {formatCurrencyCompact(tx.amount)}
                   </div>
                </div>
              ))}
              {recentTX.length === 0 && !loading && (
                <div className="empty-state">No transactions found</div>
              )}
            </div>
            <Pagination 
              currentPage={currentPage} 
              totalCount={totalTXCount} 
              pageSize={PAGE_SIZE} 
              onPageChange={handlePageChange}
              loading={loading}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
