import { useEffect, useState } from 'react'
import { formatCurrencyTZS } from '../../utils/formatters'
import { StatusBadge } from '../../components/ui/Badge'
import { supabase } from '../../supabase/client'

export default function PlatformSettlement() {
  const [settlements, setSettlements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSettlements() {
      try {
        setLoading(true)
        const startOfDay = new Date()
        startOfDay.setHours(0,0,0,0)

        // Fetch transactions for today
        const { data: txs } = await supabase
          .from('transactions')
          .select('amount, type, wallet_schemes(code)')
          .gte('created_at', startOfDay.toISOString())
          .eq('status', 'COMPLETED')
        
        // Aggregate
        const map = {}
        txs?.forEach(tx => {
          const code = tx.wallet_schemes.code
          if (!map[code]) map[code] = { wallet: code, total_in: 0, total_out: 0, status: 'COMPLETED' }
          
          if (tx.type === 'DEPOSIT') map[code].total_in += Number(tx.amount)
          else if (tx.type === 'WITHDRAW') map[code].total_out += Number(tx.amount)
        })

        const formatted = Object.values(map).map(s => ({
          ...s,
          id: s.wallet,
          net: s.total_in - s.total_out
        }))

        setSettlements(formatted)
      } catch (err) {
        console.error("Settlement load error:", err)
      } finally {
        setLoading(false)
      }
    }
    loadSettlements()
  }, [])

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settlement Reconciliation</h1>
          <p className="page-subtitle">Net positions per wallet scheme — today</p>
        </div>
      </div>
      <div className="card card--pad-none">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Wallet', 'Total In', 'Total Out', 'Net Position', 'Status'].map(h => (
                <th key={h} style={{ textAlign: h === 'Wallet' ? 'left' : 'right', padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Calculating daily positions...</td></tr>
            ) : settlements.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>No settled transactions today.</td></tr>
            ) : settlements.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                  <span className={`wallet-badge wallet-badge--${s.wallet.toLowerCase()}`}>{s.wallet}</span>
                </td>
                <td style={{ padding: 'var(--space-4) var(--space-5)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-success)', fontWeight: 'var(--weight-semibold)' }}>+{formatCurrencyTZS(s.total_in)}</td>
                <td style={{ padding: 'var(--space-4) var(--space-5)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>-{formatCurrencyTZS(s.total_out)}</td>
                <td style={{ padding: 'var(--space-4) var(--space-5)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-bold)', color: s.net >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {s.net >= 0 ? '+' : ''}{formatCurrencyTZS(s.net)}
                </td>
                <td style={{ padding: 'var(--space-4) var(--space-5)', textAlign: 'right' }}>
                  <StatusBadge status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
