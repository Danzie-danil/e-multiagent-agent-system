// pages/supervisor/SupervisorBroadcaster.jsx
import { useState, useEffect } from 'react'
import { Send, Users, Search, X, Megaphone, Clock } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../context/AuthContext'

export default function SupervisorBroadcaster() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()
  
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  const [msgBody, setMsgBody] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null) // for targeted msg

  useEffect(() => {
    async function loadAgents() {
      try {
        const { data: userData } = await supabase.from('users').select('supervisor_id').eq('id', user.id).single()
        if (userData?.supervisor_id) {
          // 1. Fetch agents
          const { data: ags } = await supabase
            .from('agents')
            .select('*')
            .eq('supervisor_id', userData.supervisor_id)
            .order('name')
          
          if (!ags || ags.length === 0) {
            setAgents([]);
            return;
          }

          // 2. Fetch related user IDs for messaging
          const agentIds = ags.map(a => a.id)
          const { data: userDataList } = await supabase
            .from('users')
            .select('id, agent_id')
            .in('agent_id', agentIds)

          const userMap = {}
          userDataList?.forEach(u => { userMap[u.agent_id] = u.id })
          
          const formatted = ags.map(a => ({
            ...a,
            userId: userMap[a.id]
          }))
          
          setAgents(formatted)
        }
      } catch (err) {
        console.error("Load agents error:", err)
      } finally {
        setLoading(false)
      }
    }
    if (user?.id) loadAgents()
  }, [user])

  const handleSend = async (isBroadcast = false) => {
    if (!msgBody.trim()) { toastError('Incomplete', 'Please enter a message.'); return }
    setSending(true)
    try {
      let targets = []
      if (isBroadcast) {
        targets = agents.filter(a => a.userId).map(a => a.userId)
      } else {
        if (!selectedAgent?.userId) throw new Error("Agent account not fully linked yet.")
        targets = [selectedAgent.userId]
      }

      if (!targets.length) throw new Error("No recipients found.")

      const payloads = targets.map(tid => ({
        user_id: tid,
        type: isBroadcast ? 'BROADCAST' : 'NETWORK',
        title: isBroadcast ? 'Broadcast from Network' : 'Message from Supervisor',
        message: msgBody,
        is_read: false,
        metadata: { sender_id: user.id }
      }))

      const { error } = await supabase.from('notifications').insert(payloads)
      if (error) throw error

      const unlinkedCount = agents.length - targets.length
      if (isBroadcast && unlinkedCount > 0) {
        success('Partial Broadcast', `Sent to ${targets.length} linked terminals. ${unlinkedCount} terminals are unlinked and did not receive it.`)
      } else {
        success(isBroadcast ? 'Broadcast Sent' : 'Message Sent', `Delivery confirmed for ${targets.length} agent(s).`)
      }

      setMsgBody('')
      setSelectedAgent(null)
    } catch (err) {
      toastError('Send Failed', err.message)
    } finally {
      setSending(true) // Just to show state before reset if needed, but we'll reset
      setSending(false)
    }
  }

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.phone.includes(search)
  )

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Network Broadcaster</h1>
          <p className="page-subtitle">Communicate with your agent terminals in real-time</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-6)', alignItems: 'start' }}>
        
        {/* Main Composition Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card padding="lg">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <div style={{ background: 'var(--color-primary-dark)', padding: 'var(--space-2)', borderRadius: 'var(--radius-lg)' }}>
                <Megaphone size={20} color="var(--color-primary)" />
              </div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>
                {selectedAgent ? `Message: ${selectedAgent.name}` : 'Network Broadcast'}
              </h2>
              {selectedAgent && (
                <button 
                  onClick={() => setSelectedAgent(null)}
                  style={{ background: 'var(--color-bg)', border: 'none', color: 'var(--color-text-muted)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 'auto' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              {selectedAgent 
                ? 'Send a targeted message to this specific agent terminal.'
                : 'Broadcast an urgent update or announcement to every active terminal in your network.'
              }
            </p>

            <textarea 
              rows={8}
              placeholder={selectedAgent ? `Type message for ${selectedAgent.name}...` : "Broadcast an announcement to all agents..."}
              style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', color: 'white', resize: 'none', fontSize: 'var(--text-md)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              {msgBody && (
                <Button label="Clear" variant="ghost" onClick={() => setMsgBody('')} />
              )}
              <Button 
                label={selectedAgent ? 'Send Message' : 'Broadcast to All Agents'} 
                variant="primary" 
                size="lg"
                icon={<Send size={18} />}
                loading={sending}
                onClick={() => handleSend(!selectedAgent)}
              />
            </div>
          </Card>

          {/* Quick Tips or Last Broadcasts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="var(--color-primary)" />
                BROADCAST TIPS
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Use broadcasts for system maintenance, network-wide policy updates, or urgent fraud alerts across all terminals.
              </p>
            </div>
            <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} color="var(--color-primary)" />
                DIRECT MESSAGING
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Select an agent from the right panel to send a private instruction or float notification meant only for their terminal.
              </p>
            </div>
          </div>
        </div>

        {/* Agent Selection Sidebar */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', height: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontWeight: 800, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="var(--color-text-muted)" />
              Agent Directory
            </h3>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="var(--color-text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text"
                placeholder="Search agents..."
                style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '8px 12px 8px 32px', fontSize: 12, color: 'white' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2)' }}>
            {loading ? (
              <div style={{ padding: 'var(--space-4)', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>Loading agents...</div>
            ) : filteredAgents.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>No agents found.</div>
            ) : filteredAgents.map(ag => (
              <div 
                key={ag.id}
                onClick={() => setSelectedAgent(ag)}
                style={{ 
                  padding: '10px 12px', 
                  borderRadius: 'var(--radius-lg)', 
                  cursor: 'pointer', 
                  background: selectedAgent?.id === ag.id ? 'var(--color-primary-dark)' : 'transparent',
                  border: `1px solid ${selectedAgent?.id === ag.id ? 'var(--color-primary)' : 'transparent'}`,
                  transition: 'all 0.15s ease',
                  marginBottom: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: selectedAgent?.id === ag.id ? 'white' : 'var(--color-text-primary)' }}>{ag.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{ag.phone}</div>
                </div>
                
                {/* Reachability Indicator */}
                <div 
                  title={ag.userId ? 'Online/Linked' : 'No User Account Linked'}
                  style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: ag.userId ? 'var(--color-success)' : 'var(--color-text-muted)',
                    boxShadow: ag.userId ? '0 0 10px var(--color-success)' : 'none',
                    opacity: ag.userId ? 1 : 0.3
                  }} 
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
