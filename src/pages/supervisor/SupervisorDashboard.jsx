// pages/supervisor/SuperAgentDashboard.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { Wallet, Users, TrendingUp, AlertCircle } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { StatCard } from '../../components/ui/Card'
import { TransactionTable } from '../../components/ui/TransactionTable'
import { Pagination } from '../../components/ui/Pagination'
import { ScrollHint } from '../../components/ui/ScrollHint'
import { StatusBadge } from '../../components/ui/Badge'
import { formatCurrencyTZS, formatCurrencyCompact } from '../../utils/formatters'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../context/AuthContext'
import { useRealtimeSync } from '../../hooks/useRealtimeSync'

const COLORS = ['#00A651', '#E40000', '#003580', '#F5A623', '#7B2FBE', '#00897B']

export default function SupervisorDashboard() {
  const { user } = useAuth()
  const tableRef = useRef(null)
  const [supervisorId, setSupervisorId] = useState(null)
  const supervisorIdRef = useRef(null)  // stable ref for callbacks
  
  // Persistent Cache Initialization
  const getCached = (key, fallback) => {
    try {
      const val = localStorage.getItem(`ewakala_super_${key}`)
      return val ? JSON.parse(val) : fallback
    } catch { return fallback }
  }

  const [agents, setAgents] = useState(() => getCached('agents', []))
  const [walletStats, setWalletStats] = useState(() => getCached('walletStats', []))
  const [recentTX, setRecentTX] = useState(() => getCached('recentTX', []))
  const [dailyEarnings, setDailyEarnings] = useState(() => getCached('dailyEarnings', 0))
  const [totalCash, setTotalCash] = useState(() => getCached('totalCash', 0))
  const [loading, setLoading] = useState(!localStorage.getItem('ewakala_super_agents'))
  const [liveRefresh, setLiveRefresh] = useState(false)
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTXCount, setTotalTXCount] = useState(0)
  const PAGE_SIZE = 10

  // ─── Stable fetch functions ─────────────────────────────────────────────────

  const fetchStats = useCallback(async (sid) => {
    const { data: cloudStats, error: statsError } = await supabase.rpc('get_supervisor_dashboard_stats', { p_supervisor_id: sid })
    if (!statsError && cloudStats) {
      setDailyEarnings(cloudStats.today_earnings)
      setWalletStats(cloudStats.wallet_breakdown || [])
      setTotalCash(cloudStats.network_cash || 0)
      localStorage.setItem('ewakala_super_dailyEarnings', JSON.stringify(cloudStats.today_earnings))
      localStorage.setItem('ewakala_super_walletStats', JSON.stringify(cloudStats.wallet_breakdown || []))
      localStorage.setItem('ewakala_super_totalCash', JSON.stringify(cloudStats.network_cash || 0))
    }
  }, [])

  const fetchAgents = useCallback(async (sid) => {
    const { data: dbAgents } = await supabase
      .from('agents')
      .select(`id, name, phone, agent_wallet_accounts (balance, cash_balance, wallet_schemes (name, code))`)
      .eq('supervisor_id', sid)
    setAgents(dbAgents || [])
    localStorage.setItem('ewakala_super_agents', JSON.stringify(dbAgents || []))
  }, [])

  const fetchTransactions = useCallback(async (sid, page = 1) => {
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data: txData, count } = await supabase
      .from('transactions')
      .select('*, wallet_schemes(name, code), agents:from_agent_id(name, supervisor_id)', { count: 'exact' })
      .eq('agents.supervisor_id', sid)
      .order('created_at', { ascending: false })
      .range(from, to)
    
    setRecentTX(txData?.filter(tx => tx.agents?.supervisor_id === sid).map(tx => ({
      ...tx,
      wallet: tx.wallet_schemes?.code,
      agent: tx.agents?.name
    })) || [])
    localStorage.setItem('ewakala_super_recentTX', JSON.stringify(recentTX))
    if (count !== null) setTotalTXCount(count)
  }, [])

  const fetchDashboardData = useCallback(async (sid, page = 1) => {
    const resolvedSid = sid || supervisorIdRef.current
    if (!resolvedSid) return
    try {
      await Promise.all([
        fetchStats(resolvedSid),
        fetchAgents(resolvedSid),
        fetchTransactions(resolvedSid, page)
      ])
    } catch (err) {
      console.error("Dashboard fetch error:", err)
    }
  }, [fetchStats, fetchAgents, fetchTransactions])

  // ─── Initial Load ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        setLoading(true)
        const { data: userData } = await supabase.from('users').select('supervisor_id').eq('id', user.id).maybeSingle()
        if (!userData?.supervisor_id) return
        setSupervisorId(userData.supervisor_id)
        supervisorIdRef.current = userData.supervisor_id
        await fetchDashboardData(userData.supervisor_id, 1)
      } catch (err) {
        console.error("Init error:", err)
      } finally {
        setLoading(false)
      }
    }
    if (user?.id) init()
  }, [user])

  // ─── Realtime Subscriptions ──────────────────────────────────────────────────

  const handleLiveRefresh = useCallback(async () => {
    setLiveRefresh(true)
    setTimeout(() => setLiveRefresh(false), 2000)
    await fetchDashboardData(supervisorId, currentPage)
  }, [supervisorId, currentPage, fetchDashboardData])

  // Use the refined hook for signal-based sync
  useRealtimeSync('TX_ACTIVITY', handleLiveRefresh)
  useRealtimeSync('BALANCE_UPDATE', handleLiveRefresh)
  useRealtimeSync('BANNER_UPDATE', handleLiveRefresh)

  // Handle Page Change
  const handlePageChange = async (newPage) => {
    setCurrentPage(newPage)
    if (supervisorId) {
      setLoading(true)
      await fetchTransactions(supervisorId, newPage)
      setLoading(false)
    }
  }

  const totalFloat = walletStats.reduce((s, d) => s + d.value, 0)
  const lowFloatCount = agents.filter(ag => {
    const total = ag.agent_wallet_accounts?.reduce((s,w) => s + Number(w.balance), 0) || 0
    return total < 200000 
  }).length

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">{user?.user_metadata?.biz_name || 'My Network'}</h1>
          <p className="page-subtitle">Supervisor Operations Dashboard</p>
        </div>
        <div className={`status-badge-live${liveRefresh ? ' status-badge-live--flash' : ''}`}>
          <span className="status-badge-live__dot" />
          <span>{liveRefresh ? 'Data Updated' : 'Live Ops'}</span>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
        <StatCard label="Total Float"      value={formatCurrencyCompact(totalFloat)} icon={<Wallet size={16}/>}     trend={totalFloat > 0 ? 6 : 0}  color="primary" />
        <StatCard label="Total Cash"       value={formatCurrencyCompact(totalCash)}  icon={<TrendingUp size={16}/>} trend={0} color="accent" />
        <StatCard label="Daily Target"    value={formatCurrencyCompact(dailyEarnings)} icon={<TrendingUp size={16}/>} trend={dailyEarnings > 0 ? 12 : 0} color="success" />
        <StatCard label="Low Float"       value={lowFloatCount}                     icon={<AlertCircle size={16}/>}            color={lowFloatCount > 0 ? "error" : "success"} />
      </div>

      <div className="analytics-grid">
        {/* Float Distribution Pie */}
        <div className="card card--pad-md">
          <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>Float by Wallet</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={walletStats} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {walletStats.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip 
                formatter={(v) => [formatCurrencyTZS(v)]} 
                contentStyle={{ 
                  background: 'var(--color-surface)', 
                  border: '1px solid var(--color-border)', 
                  borderRadius: 10, 
                  fontSize: 12,
                  color: 'var(--color-text-primary)'
                }} 
                itemStyle={{ color: 'var(--color-text-primary)' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Agent Cash Status */}
        <div className="card card--pad-md">
          <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>Agent Liquidity Health</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
            gap: 'var(--space-3)' 
          }}>
            {agents.slice(0, 8).map(ag => {
              const float = ag.agent_wallet_accounts?.reduce((s, w) => s + Number(w.balance), 0) || 0
              const cash  = ag.agent_wallet_accounts?.reduce((s, w) => s + Number(w.cash_balance), 0) || 0
              const total = float + cash
              const floatPct = total > 0 ? Math.round((float / total) * 100) : 50

              return (
                <div key={ag.id} style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ag.name}</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                        <span>FLOAT</span>
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrencyCompact(float)}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${floatPct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 2 }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                        <span>CASH</span>
                        <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{formatCurrencyCompact(cash)}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${100 - floatPct}%`, height: '100%', background: 'var(--color-accent)', borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {agents.length === 0 && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', py: 4 }}>No agents linked to your network.</p>}
        </div>
      </div>

      <div className="card card--pad-none">
        <div className="section-header" style={{ padding: 'var(--space-5) var(--space-5) 0', alignItems: 'center' }}>
          <h2 className="section-title">Cash Movement Log</h2>
          <ScrollHint targetRef={tableRef} />
        </div>
        <TransactionTable ref={tableRef} transactions={recentTX} compact />
        <Pagination 
          currentPage={currentPage}
          totalCount={totalTXCount}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          loading={loading}
        />
      </div>
    </div>
  )
}
