import { useRef, useEffect, useState } from 'react'
import { formatCurrencyTZS, formatDateTime } from '../../utils/formatters'
import { TrendingUp } from 'lucide-react'
import { ScrollHint } from '../../components/ui/ScrollHint'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../context/AuthContext'

export default function SupervisorCommissions() {
  const { user } = useAuth()
  const tableRef = useRef(null)
  
  // Persistent Cache Initialization
  const getCached = (key, fallback) => {
    try {
      const val = localStorage.getItem(`ewakala_super_${key}`)
      return val ? JSON.parse(val) : fallback
    } catch { return fallback }
  }

  const [commissions, setCommissions] = useState(() => getCached('commissions', []))
  const [loading, setLoading] = useState(!localStorage.getItem('ewakala_super_commissions'))

  useEffect(() => {
    async function loadCommissions() {
      try {
        setLoading(true)
        const { data: userData } = await supabase.from('users').select('supervisor_id').eq('id', user.id).single()
        if (userData?.supervisor_id) {
          // Get all transactions for agents of this supervisor
          const { data: txs } = await supabase
            .from('transactions')
            .select('*, agents:from_agent_id(name)')
            .not('fee', 'is', null) // Only txs with fees generate commissions
            .order('created_at', { ascending: false })
            .limit(100)
          
          // Verify agent link (simple client-side filter for now, or use join if schema allows)
          const { data: myAgents } = await supabase.from('agents').select('id').eq('supervisor_id', userData.supervisor_id)
          const agentIds = new Set(myAgents?.map(a => a.id) || [])

          const formatted = txs?.filter(tx => agentIds.has(tx.from_agent_id)).map(tx => ({
            id: tx.id,
            tx_ref: tx.idempotency_key.slice(0, 10).toUpperCase(),
            type: tx.type,
            agent: tx.agents?.name || 'Unknown Agent',
            tx_fee: Number(tx.fee),
            SUPERVISOR_fee: Math.round(Number(tx.fee) * 0.3),
            created_at: tx.created_at
          })) || []

          setCommissions(formatted)
          localStorage.setItem('ewakala_super_commissions', JSON.stringify(formatted))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (user?.id) loadCommissions()
  }, [user])

  const totalEarned = commissions.reduce((s, c) => s + c.SUPERVISOR_fee, 0)

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div><h1 className="page-title">Commission Earnings</h1><p className="page-subtitle">30% of transaction fees distributed to you</p></div>
      </div>

      <div className="card card--pad-md" style={{ marginBottom: 'var(--space-4)', background: 'linear-gradient(135deg, var(--color-accent) 0%, #b8890f 100%)', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={24} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(0,0,0,0.6)', fontWeight: 'var(--weight-semibold)' }}>TODAY'S EARNINGS</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-extrabold)', color: '#1a0a00', letterSpacing: '-0.02em' }}>
              {loading ? '...' : formatCurrencyTZS(totalEarned)}
            </div>
          </div>
        </div>
      </div>

      <div className="card card--pad-none">
        <div className="section-header" style={{ padding: 'var(--space-5) var(--space-5) 0', alignItems: 'center' }}>
          <h2 className="section-title">Commissions & Earnings</h2>
          <ScrollHint targetRef={tableRef} />
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }} ref={tableRef}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Reference', 'Type', 'Agent', 'Tx Fee', 'Your Share (30%)', 'Time'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Reference' || h === 'Type' || h === 'Agent' ? 'left' : 'right', padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Calculating commissions...</td></tr>
              ) : commissions.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>No commissions earned today.</td></tr>
              ) : commissions.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3) var(--space-5)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{c.tx_ref}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-5)', fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap' }}>{c.type}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-5)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{c.agent}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{c.tx_fee ? formatCurrencyTZS(c.tx_fee) : '—'}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-semibold)', color: c.SUPERVISOR_fee > 0 ? 'var(--color-success)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {c.SUPERVISOR_fee > 0 ? `+${formatCurrencyTZS(c.SUPERVISOR_fee)}` : '—'}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
