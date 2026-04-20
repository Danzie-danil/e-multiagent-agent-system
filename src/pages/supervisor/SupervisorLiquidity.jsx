import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { useToast } from '../../context/ToastContext'
import { formatCurrencyTZS, formatCurrencyCompact } from '../../utils/formatters'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../context/AuthContext'
import { useEffect, useState, useCallback } from 'react'

export default function SupervisorLiquidity() {
  const { user } = useAuth()
  const { success: toastSuccess, warning: toastWarning } = useToast()
  const [liquidityData, setLiquidityData] = useState([])
  const [loading, setLoading] = useState(true)

  const [supervisorId, setSupervisorId] = useState(null)

  const loadLiquidity = useCallback(async (sid) => {
    const resolvedSid = sid || supervisorId
    if (!resolvedSid) return
    try {
      setLoading(true)
      const { data: agents } = await supabase
        .from('agents')
        .select('agent_wallet_accounts(balance, wallet_schemes(code))')
        .eq('supervisor_id', resolvedSid)
      
      const aggregation = {}
      agents?.forEach(ag => {
        ag.agent_wallet_accounts?.forEach(w => {
          const code = w.wallet_schemes.code
          aggregation[code] = (aggregation[code] || 0) + Number(w.balance)
        })
      })

      const formatted = Object.entries(aggregation).map(([wallet, balance]) => {
        const threshold = 1000000
        let status = 'HEALTHY'
        if (balance < threshold) status = 'CRITICAL'
        else if (balance < threshold * 2) status = 'LOW'
        return { wallet, balance, threshold, status }
      })
      setLiquidityData(formatted)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supervisorId])

  useEffect(() => {
    async function init() {
      try {
        const { data: userData } = await supabase.from('users').select('supervisor_id').eq('id', user.id).single()
        if (userData?.supervisor_id) {
          setSupervisorId(userData.supervisor_id)
          await loadLiquidity(userData.supervisor_id)
        }
      } catch (err) {
        console.error(err)
      }
    }
    if (user?.id) init()
  }, [user])

  // Realtime: live liquidity updates on any balance change
  useEffect(() => {
    if (!supervisorId) return
    const channel = supabase
      .channel(`super_liquidity_${supervisorId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agent_wallet_accounts' }, () => loadLiquidity())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [supervisorId, loadLiquidity])

  const handleRebalance = (wallet) => {
    toastSuccess('Rebalance Requested', `Liquidity rebalance initiated for ${wallet}.`)
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div><h1 className="page-title">Liquidity Alerts</h1><p className="page-subtitle">Monitor and rebalance wallet float levels</p></div>
        <Button id="rebalance-all.button.header" label="Rebalance All" variant="secondary" size="sm" icon={<RefreshCw size={14}/>}
          onClick={() => warning('Rebalancing', 'Auto-balancing engine is redistributing float...')} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {loading ? (
          <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>Monitoring network liquidity...</div>
        ) : liquidityData.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>No wallets provisioned in your network.</div>
        ) : liquidityData.map(w => {
          const pct = Math.min(100, Math.round((w.balance / (w.threshold * 3)) * 100))
          const isLow = w.status !== 'HEALTHY'
          return (
            <div key={w.wallet} className="card card--pad-md" style={{ borderLeft: `4px solid ${w.status === 'HEALTHY' ? 'var(--color-success)' : w.status === 'LOW' ? 'var(--color-warning)' : 'var(--color-error)'}` }}>
              {/* Row 1: Badges & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <span className={`wallet-badge wallet-badge--${w.wallet.toLowerCase()}`}>{w.wallet}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <StatusBadge status={w.status} />
                  {isLow && (
                    <Button id={`rebalance-${w.wallet}.button.liquidity`} label="Rebalance" variant="accent" size="sm" icon={<RefreshCw size={13}/>} onClick={() => handleRebalance(w.wallet)} />
                  )}
                </div>
              </div>

              {/* Row 2: Amounts */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-3)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xl)' }}>{formatCurrencyTZS(w.balance)}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Min Target: {formatCurrencyTZS(w.threshold)}</span>
              </div>

              {/* Row 3: Health Line */}
              <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: w.status === 'HEALTHY' ? 'var(--color-success)' : w.status === 'LOW' ? 'var(--color-warning)' : 'var(--color-error)', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{pct}% of network safety threshold</div>

              {/* Row 4: Alert Message */}
              {isLow && (
                <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: w.status === 'CRITICAL' ? 'var(--color-error-light)' : 'var(--color-warning-light)', borderRadius: 'var(--radius-md)' }}>
                  <AlertTriangle size={14} style={{ color: w.status === 'CRITICAL' ? 'var(--color-error)' : 'var(--color-warning)', flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                    {w.status === 'CRITICAL' ? 'Critical: High failure risk. Immediate network rebalancing required.' : 'Low float across network. Consider redistribution.'}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
