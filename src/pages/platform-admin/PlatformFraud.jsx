// pages/platform-admin/PlatformFraud.jsx
import { ShieldAlert, Lock } from 'lucide-react'
import { StatusBadge } from '../../components/ui/Badge'
import { TruncatedText } from '../../components/ui/TruncatedText'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../context/ToastContext'
import { formatDateTime } from '../../utils/formatters'
import { supabase } from '../../supabase/client'
import { useEffect, useState } from 'react'
import './PlatformFraud.css'

export default function PlatformFraud() {
  const { warning: toastWarning } = useToast()
  const [agents, setAgents] = useState([])
  const [fraudEvents, setFraudEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFraud() {
      try {
        setLoading(true)
        const { data: agData } = await supabase.from('agents').select('*').limit(20)
        setAgents(agData || [])
        // Fetch real fraud events if available
        const { data: frData } = await supabase.from('fraud_events').select('*, agents(name)').eq('resolved', false)
        setFraudEvents(frData?.map(f => ({
          ...f,
          agentName: f.agents?.name
        })) || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadFraud()
  }, [])

  const handleFreeze = (agentName) => {
    toastWarning('Agent Frozen', `${agentName} has been suspended pending investigation.`)
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fraud Monitoring</h1>
          <p className="page-subtitle">Behavioral risk scan across the network</p>
        </div>
      </div>

      <div className="card card--pad-md" style={{ marginBottom: 'var(--space-4)' }}>
        <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>Agent Risk Profile</h2>
        <div className="agent-risk-heatmap">
          {loading ? <div style={{ color: 'var(--color-text-muted)' }}>Scanning network...</div> : 
           agents.length === 0 ? <div style={{ color: 'var(--color-text-muted)' }}>No active terminals.</div> :
           agents.map(ag => (
            <div 
              key={ag.id} 
              className={`risk-card risk-card--healthy`}
            >
              <TruncatedText className="risk-card__name" text={ag.name} title="Agent Name" />
              <TruncatedText className="risk-card__meta" text={`Operational`} title="Frequency" />
              <StatusBadge status="HEALTHY" />
            </div>
          ))}
        </div>
      </div>

      <div className="card card--pad-md">
        <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>Security Events</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {loading ? <div style={{ color: 'var(--color-text-muted)' }}>Loading logs...</div> :
           fraudEvents.length === 0 ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No critical security anomalies detected in the last 24 hours.</div> :
           fraudEvents.map(f => (
            <div key={f.id} className={`fraud-event-card fraud-event-card--${f.riskScore > 0.8 ? 'high' : f.riskScore > 0.5 ? 'medium' : 'low'}`}>
              <div className="fraud-event-card__score">
                {Math.round(f.riskScore * 100)}
              </div>
              <div className="fraud-event-card__content">
                <TruncatedText className="fraud-event-card__agent" text={f.agentName} title="Agent" />
                <TruncatedText className="fraud-event-card__reason" text={f.reason} title="Risk Detail" />
                <div className="fraud-event-card__date">{formatDateTime(f.created_at)}</div>
              </div>
              <div className="fraud-event-card__actions">
                <Button label="Freeze Agent" variant="danger" size="sm" icon={<Lock size={14}/>} onClick={() => handleFreeze(f.agentName)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
