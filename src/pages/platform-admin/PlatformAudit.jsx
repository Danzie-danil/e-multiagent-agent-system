import { useEffect, useState } from 'react'
import { formatDateTime } from '../../utils/formatters'
import { supabase } from '../../supabase/client'

export default function PlatformAudit() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAuditLogs() {
      try {
        setLoading(true)
        // Fetch logs and join with users/auth if needed, 
        // but for now we'll fetch direct and handle names in metadata or join
        const { data } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
        
        setLogs(data || [])
      } catch (err) {
        console.error("Audit load error:", err)
      } finally {
        setLoading(false)
      }
    }
    loadAuditLogs()
  }, [])

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Immutable event trail — append-only</p>
        </div>
      </div>
      <div className="card card--pad-md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Reading secure logs...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>No audit events recorded yet.</div>
          ) : logs.map((log, i) => (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)',
              padding: 'var(--space-4) 0',
              borderBottom: i < logs.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)',
                marginTop: 6, flexShrink: 0
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{log.action}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>on</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 'var(--weight-medium)' }}>{log.entity}</span>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                   {Object.entries(log.metadata || {}).map(([k, v]) => (
                     <span key={k} style={{ marginRight: 'var(--space-2)' }}>
                       <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{k}:</span> {String(v)}
                     </span>
                   ))}
                </div>
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', flexShrink: 0 }}>{formatDateTime(log.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
