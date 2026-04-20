// pages/platform-admin/PlatformTenants.jsx
import { useState, useEffect } from 'react'
import { Plus, Search, Building2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge, WalletBadge } from '../../components/ui/Badge'
import { cn } from '../../utils/cn'
import { useToast } from '../../context/ToastContext'
import { formatCurrencyCompact } from '../../utils/formatters'
import { supabase } from '../../supabase/client'
import './PlatformTenants.css'

const WALLET_OPTIONS = [
  'MPESA', 'AIRTEL', 'CRDB', 'HALOPESA', 'MIXX',
  'NMB', 'EQUITY', 'NBC', 'KCB'
]

export default function PlatformTenants() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [supervisors, setSupervisors] = useState([])
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', wallets: [] })
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    async function loadSupervisors() {
      try {
        setFetching(true)
        const { data } = await supabase.from('supervisor_networks_summary').select('*')
        setSupervisors(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setFetching(false)
      }
    }
    loadSupervisors()
  }, [])

  const filtered = supervisors.filter(t => (t.supervisor_name || 'Unknown').toLowerCase().includes(query.toLowerCase()))

  const handleSave = async () => {
    setLoading(true)
    try {
      // Logic for creating supervisor in DB...
      await new Promise(r => setTimeout(r, 800))
      toastSuccess('Supervisor created', `${form.name} has been registered.`)
      setModalOpen(false)
    } catch (err) {
      toastError('Failed', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Supervisor Registry</h1>
          <p className="page-subtitle">Manage all active Supervisors on the e-WAKALA platform</p>
        </div>
        <Button id="add-agent.button.header" label="Add Supervisor" icon={<Plus size={16}/>} onClick={() => setModalOpen(true)} />
      </div>

      <div className="card card--pad-md">
        <div className="section-header">
          <Input
            id="search-agents-input"
            name="search-agents"
            placeholder="Search Supervisors…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            prefix={<Search size={14}/>}
            size="sm"
            className="tenants-search"
          />
        </div>

        <div className="tenants-grid">
          {fetching ? (
            <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-8)', textAlign: 'center', gridColumn: '1/-1' }}>Loading Supervisors...</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-8)', textAlign: 'center', gridColumn: '1/-1' }}>No supervisors found.</div>
          ) : filtered.map(t => (
            <div key={t.supervisor_id} className="tenant-card">
              <div className="tenant-card__header">
                <div className="tenant-card__icon">
                  <Building2 size={20} />
                </div>
                <StatusBadge status="ACTIVE" />
              </div>
              <h3 className="tenant-card__name">{t.supervisor_name}</h3>
              <div className="tenant-card__stats">
                <div className="tenant-card__stat">
                  <span className="tenant-card__stat-label">Agents</span>
                  <span className="tenant-card__stat-value">{t.agent_count}</span>
                </div>
                <div className="tenant-card__stat">
                  <span className="tenant-card__stat-label">Volume</span>
                  <span className="tenant-card__stat-value">{formatCurrencyCompact(t.total_volume || 0)}</span>
                </div>
              </div>
              <div className="tenant-card__wallets">
                <WalletBadge scheme="MPESA" />
                <WalletBadge scheme="AIRTEL" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        id="add-agent-md-modal"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Register New Supervisor"
        size="sm"
        footer={
          <>
            <Button id="cancel-agent.button.modal" label="Cancel" variant="secondary" onClick={() => setModalOpen(false)} />
            <Button id="save-agent.button.modal" label="Register Supervisor" loading={loading} onClick={handleSave} disabled={!form.name} />
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            id="agent-name-input"
            name="agent-name"
            label="Supervisor Name"
            placeholder="e.g. Victoria Delta Group"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  )
}
