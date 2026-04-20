// pages/agent-pos/AgentHistory.jsx
import { useState, useEffect, useRef } from 'react'
import { ScrollHint } from '../../components/ui/ScrollHint'
import { TransactionTable } from '../../components/ui/TransactionTable'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../context/AuthContext'

const WALLETS = ['ALL', 'MPESA', 'AIRTEL', 'CRDB', 'HALOPESA']

export default function AgentHistory() {
  const { user } = useAuth()
  const [filter, setFilter] = useState('ALL')
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const filterRef = useRef(null)
  const tableRef = useRef(null)

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true)
        const { data: userData } = await supabase.from('users').select('agent_id').eq('id', user.id).single()
        if (userData?.agent_id) {
          let query = supabase
            .from('transactions')
            .select('*, wallet_schemes(code, name)')
            .eq('from_agent_id', userData.agent_id)
            .order('created_at', { ascending: false })

          if (filter !== 'ALL') {
             // We need to join correctly or use the code from wallet_schemes
             // Since we have a code in wallet_schemes, we can filter by that.
             // But it's easier to just fetch all and filter in JS if the list is small, 
             // or handle it in the query.
          }

          const { data } = await query
          
          setTransactions((data || []).map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            fee: tx.fee,
            status: tx.status,
            wallet: tx.wallet_schemes?.code,
            created_at: tx.created_at
          })))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (user?.id) loadHistory()
  }, [user, filter])

  const filtered = filter === 'ALL' ? transactions : transactions.filter(t => t.wallet === filter)

  return (
    <div className="animate-fadeIn">
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div><h1 className="page-title">Transaction History</h1></div>
      </div>

      {/* Wallet filter chips */}
      <div style={{ position: 'relative' }}>
        <ScrollHint targetRef={filterRef} />
        <div 
          ref={filterRef}
          style={{ 
            display: 'flex', 
            gap: 'var(--space-2)', 
            flexWrap: 'nowrap', 
            overflowX: 'auto', 
            paddingBottom: 'var(--space-2)', 
            marginBottom: 'var(--space-4)', 
            scrollbarWidth: 'none' 
          }}
        >
          {WALLETS.map(w => (
            <button key={w} type="button"
              onClick={() => setFilter(w)}
              style={{
                flexShrink: 0, padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                border: '1.5px solid',
                borderColor: filter === w ? 'var(--color-primary)' : 'var(--color-border)',
                background: filter === w ? 'var(--color-primary-light)' : 'var(--color-surface)',
                color: filter === w ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="card card--pad-none">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-5) var(--space-2)' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Transactions</h2>
          <ScrollHint targetRef={tableRef} />
        </div>
        <TransactionTable ref={tableRef} transactions={filtered} compact emptyMessage="No transactions for this wallet" />
      </div>
    </div>
  )
}
