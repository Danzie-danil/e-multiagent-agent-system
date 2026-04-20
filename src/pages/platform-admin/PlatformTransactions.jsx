import { useState, useEffect } from 'react'
import { Search, Filter, Download } from 'lucide-react'
import { TransactionTable } from '../../components/ui/TransactionTable'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../supabase/client'

export default function PlatformTransactions() {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTX() {
      try {
        setLoading(true)
        let queryBuilder = supabase
          .from('transactions')
          .select('*, wallet_schemes(code), agents:from_agent_id(name)')
          .order('created_at', { ascending: false })
        
        if (statusFilter !== 'ALL') queryBuilder = queryBuilder.eq('status', statusFilter)
        
        const { data } = await queryBuilder
        setTransactions(data?.map(tx => ({
          ...tx,
          wallet: tx.wallet_schemes?.code,
          agent: tx.agents?.name
        })) || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadTX()
  }, [statusFilter])

  const filtered = transactions.filter(tx => {
    const matchesQuery = (tx.agent?.toLowerCase() || '').includes(query.toLowerCase()) || 
                         tx.id.toLowerCase().includes(query.toLowerCase())
    return matchesQuery
  })

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Global Ledger</h1>
          <p className="page-subtitle">Real-time visibility across all Supervisor networks</p>
        </div>
        <Button label="Export CSV" icon={<Download size={16}/>} variant="secondary" />
      </div>

      <div className="card card--pad-md" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="flex-stack-mobile" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Input
            placeholder="Search by ID or Agent..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            prefix={<Search size={14}/>}
            className="flex-1"
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <select 
              className="select-field"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '0 var(--space-3)', height: 40, borderRadius: 'var(--radius-md)', border: '1.5px solid var(--color-border)' }}
            >
              <option value="ALL">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card card--pad-none">
        <TransactionTable transactions={filtered} />
      </div>
    </div>
  )
}
