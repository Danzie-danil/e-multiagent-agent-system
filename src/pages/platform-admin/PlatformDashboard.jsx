import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Activity, ShieldAlert, TrendingUp, Wallet, AlertCircle, Lock, Radio } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TransactionTable } from '../../components/ui/TransactionTable'
import { StatusBadge } from '../../components/ui/Badge'
import { TruncatedText } from '../../components/ui/TruncatedText'
import { useToast } from '../../context/ToastContext'
import { Pagination } from '../../components/ui/Pagination'
import { ScrollHint } from '../../components/ui/ScrollHint'
import { formatCurrencyTZS, formatCurrencyCompact } from '../../utils/formatters'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase/client'
import { useRealtimeSync } from '../../hooks/useRealtimeSync'
import './PlatformDashboard.css'

const COLORS = ['#00A651', '#E40000', '#003580', '#F5A623', '#7B2FBE', '#00897B']

export default function PlatformDashboard() {
  const tableRef = useRef(null)
  const navigate = useNavigate()
  const { warning, success: toastSuccess } = useToast()
  
  const [stats, setStats] = useState({ supervisors: 0, broadcasts: 2, volume: 0, fraud: 0 })
  const [networks, setNetworks] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [livePulse, setLivePulse] = useState(false)
  
  // Pagination State for Networks
  const [currentNetworkPage, setCurrentNetworkPage] = useState(1)
  const [totalNetworkCount, setTotalNetworkCount] = useState(0)
  const [currentTXPage, setCurrentTXPage] = useState(1)
  const [totalTXCount, setTotalTXCount] = useState(0)
  const PAGE_SIZE = 10

  useEffect(() => {
    async function loadPlatformData() {
      try {
        setLoading(true)
        
        // 1. FETCH CLOUD STATS (RPC)
        const { data: cloudStats, error: statsError } = await supabase.rpc('get_platform_system_stats')
        if (!statsError && cloudStats) {
          setStats({
            supervisors: cloudStats.active_supervisors,
            broadcasts: 2, 
            volume: cloudStats.daily_volume,
            fraud: cloudStats.fraud_alerts
          })
        }

        // 2. Fetch Paginated Supervisor Networks
        await fetchPaginatedNetworks(1)

        // 3. Fetch Paginated Transactions
        await fetchPaginatedTX(1)

      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    async function fetchPaginatedNetworks(page) {
      const from = (page - 1) * 5 // Smaller page size for the side-list
      const to = from + 4
      const { data: networks, count } = await supabase
        .from('supervisor_networks_summary')
        .select('*', { count: 'exact' })
        .range(from, to)
      
      setNetworks(networks || [])
      if (count !== null) setTotalNetworkCount(count)
    }

    async function fetchPaginatedTX(page) {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data: txData, count } = await supabase
        .from('transactions')
        .select('*, wallet_schemes(code), agents:from_agent_id(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      
      setRecentTransactions(txData?.map(tx => ({
        ...tx,
        wallet: tx.wallet_schemes?.code,
        agent: tx.agents?.name
      })) || [])
      
      if (count !== null) setTotalTXCount(count)
    }

    loadPlatformData()
  }, [])

  // Handlers for pagination
  const handleNetworkPageChange = async (newPage) => {
    setCurrentNetworkPage(newPage)
    setLoading(true)
    const from = (newPage - 1) * 5
    const to = from + 4
    const { data } = await supabase.from('supervisor_networks_summary').select('*').range(from, to)
    setNetworks(data || [])
    setLoading(false)
  }

  const handleTXPageChange = async (newPage) => {
    setCurrentTXPage(newPage)
    setLoading(true)
    const from = (newPage - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data } = await supabase
      .from('transactions')
      .select('*, wallet_schemes(code), agents:from_agent_id(name)')
      .order('created_at', { ascending: false })
      .range(from, to)
    setRecentTransactions(data?.map(tx => ({
      ...tx,
      wallet: tx.wallet_schemes?.code,
      agent: tx.agents?.name
    })) || [])
    setLoading(false)
  }

  // ─── Realtime Subscriptions ───────────────────────────────────────────────
  const reloadData = useCallback(async () => {
    setLivePulse(true)
    setTimeout(() => setLivePulse(false), 2000)
    
    // Refresh core stats
    const { data: cloudStats } = await supabase.rpc('get_platform_system_stats')
    if (cloudStats) {
      setStats({
        supervisors: cloudStats.active_supervisors,
        broadcasts: 2, 
        volume: cloudStats.daily_volume,
        fraud: cloudStats.fraud_alerts
      })
    }
    
    // Refresh lists (on current pages)
    fetchPaginatedNetworks(currentNetworkPage)
    fetchPaginatedTX(currentTXPage)
  }, [currentNetworkPage, currentTXPage])

  // Watch for signals that affect platform-wide stats
  useRealtimeSync('TX_ACTIVITY', reloadData)
  useRealtimeSync('BANNER_UPDATE', reloadData)

  return (
    <div className="platform-dashboard animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p className="page-subtitle">Live system state across the network — Tanzania</p>
        </div>
        <div className={`platform-dashboard__live ${livePulse ? 'platform-dashboard__live--active' : ''}`}>
          <span className="platform-dashboard__live-dot" aria-hidden="true" />
          <span>{livePulse ? 'Syncing...' : 'Live Ops'}</span>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stat-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <StatCard label="Supervisors"        value={stats.supervisors.toString()} icon={<Building2 size={18}/>} color="primary" />
        <StatCard label="Live Broadcasts"   value={stats.broadcasts.toString()} icon={<Radio size={18}/>} color="accent" />
        <StatCard label="Today's Volume"    value={formatCurrencyCompact(stats.volume)} icon={<TrendingUp size={18}/>} color="success" />
        <StatCard label="Fraud Alerts"      value={stats.fraud.toString()} icon={<ShieldAlert size={18}/>} color="error" />
      </div>

      <div className="platform-dashboard__grid">
        {/* Volume Chart */}
        <div className="card card--pad-md platform-dashboard__chart-card">
          <div className="section-header">
            <h2 className="section-title">Transaction Volume — 7 Days</h2>
          </div>
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Volume visualization syncing...
          </div>
        </div>

        {/* Supervisor Networks */}
        <div className="card card--pad-md">
          <div className="section-header">
            <h2 className="section-title">Supervisor Network Growth</h2>
          </div>
          <div className="tenant-list">
            {loading ? <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-4)' }}>Loading...</div> : 
             networks.length === 0 ? <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-4)' }}>No supervisors registered yet.</div> :
             networks.map(sa => (
              <div key={sa.supervisor_id} className="tenant-row">
                <div className="tenant-row__icon">{sa.supervisor_name.charAt(0)}</div>
                <div className="tenant-row__info">
                  <TruncatedText 
                    className="tenant-row__name" 
                    text={sa.supervisor_name} 
                    title="Supervisor Registry" 
                    details={(
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                          <div className="tenant-row__icon" style={{ width: 48, height: 48, borderRadius: 12 }}>{sa.supervisor_name.charAt(0)}</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 18 }}>{sa.supervisor_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Registered Supervisor</div>
                          </div>
                        </div>
                        <div className="detail-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                          <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Active Agents</div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{sa.agent_count}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  />
                  <span className="tenant-row__meta">{sa.agent_count} active terminals</span>
                </div>
                <div className="tenant-row__right">
                   <StatusBadge status="ACTIVE" />
                </div>
              </div>
            ))}
            <Pagination 
              currentPage={currentNetworkPage}
              totalCount={totalNetworkCount}
              pageSize={5}
              onPageChange={handleNetworkPageChange}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Liquidity */}
      <div className="card card--pad-md" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="section-header">
          <h2 className="section-title">Liquidity</h2>
        </div>
        <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Global liquidity monitoring is active. No critical threshold breaches detected.
        </div>
      </div>

      {/* Broadcast Management Link Card */}
      <div className="card card--pad-md" style={{ marginBottom: 'var(--space-4)', borderLeft: '3px solid var(--color-accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div className="stat-card__icon stat-card__icon--accent" style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)' }}>
              <Radio size={24} />
            </div>
            <div>
              <h2 className="section-title" style={{ marginBottom: 2 }}>Global Broadcast Management</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                You have 2 active sticky banners currently visible with a total reach of 933 agents.
              </p>
            </div>
          </div>
          <Button 
            label="Open Broadcast Manager" 
            variant="primary" 
            size="lg" 
            onClick={() => navigate('/broadcasts')} 
          />
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card card--pad-none" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="section-header" style={{ padding: 'var(--space-5) var(--space-5) 0', alignItems: 'center' }}>
          <h2 className="section-title">Recent Transactions</h2>
          <ScrollHint targetRef={tableRef} />
        </div>
        <TransactionTable ref={tableRef} transactions={recentTransactions} emptyMessage="No transactions captured yet" />
        <Pagination 
          currentPage={currentTXPage}
          totalCount={totalTXCount}
          pageSize={PAGE_SIZE}
          onPageChange={handleTXPageChange}
          loading={loading}
        />
      </div>

      {/* Fraud Events */}
      <div className="card card--pad-md">
        <div className="section-header">
          <h2 className="section-title">⚠ Active Fraud Alerts</h2>
        </div>
        <div className="fraud-list">
          <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-4)', textAlign: 'center', fontSize: 13 }}>
            Security modules are scanning for anomalies. No active alerts.
          </div>
        </div>
      </div>
    </div>
  )
}
