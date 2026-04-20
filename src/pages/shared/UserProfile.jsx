import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase/client'
import { RoleBadge, StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { User, Mail, Phone, MapPin, ShieldCheck, Save, Clock, Lock, ShieldAlert } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../context/ToastContext'

export default function UserProfile() {
  const { user } = useAuth()
  const { success: toastSuccess, error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: ''
  })
  const [saving, setSaving] = useState(false)

  // Password Change State
  const [showPassModal, setShowPassModal] = useState(false)
  const [passData, setPassData] = useState({ new: '', confirm: '' })
  const [passLoading, setPassLoading] = useState(false)
  const [passError, setPassError] = useState('')
  
  // Transaction PIN State
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinData, setPinData] = useState({ new: '', confirm: '' })
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState('')
  const [agentId, setAgentId] = useState(null)

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true)
        // 1. Fetch the user's role bridge
        const { data: userData } = await supabase
          .from('users')
          .select('agent_id, supervisor_id')
          .eq('id', user.id)
          .maybeSingle()
        
        if (userData?.agent_id) setAgentId(userData.agent_id)

        if (user.role === 'AGENT' && userData?.agent_id) {
          // 2. Fetch supervisor-recorded info for the agent
          const { data: agentData } = await supabase
            .from('agents')
            .select('name, phone')
            .eq('id', userData.agent_id)
            .maybeSingle()
          
          if (agentData) {
            setFormData({
              name: agentData.name,
              phone: agentData.phone || 'Not provided'
            })
          }
        } else {
          setFormData({
            name: user?.name || 'User',
            phone: user?.phone || 'Not provided'
          })
        }
      } catch (err) {
        console.error("Profile load error:", err)
      } finally {
        setLoading(false)
      }
    }

    if (user?.id) loadProfile()
  }, [user])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await new Promise(r => setTimeout(r, 800))
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !formData.name) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-muted)' }}>
      Loading Profile...
    </div>
  )

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">Personal Profile</h1>
          <p className="page-subtitle">Manage your integrated identity and platform settings</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 2fr', gap: 'var(--space-6)' }}>
        {/* Left Column: Identity Card */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-6)', textAlign: 'center', height: 'max-content' }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--color-primary-dark)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, margin: '0 auto var(--space-4)' }}>
            {formData.name?.charAt(0).toUpperCase() || <User size={40} />}
          </div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, marginBottom: 4 }}>{formData.name}</h2>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <RoleBadge role={user?.role} />
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Mail size={14} /> {user?.email}
          </div>
        </div>

        {/* Right Column: Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>Account Details</h3>
              {!isEditing && <Button variant="ghost" label="Edit Info" onClick={() => setIsEditing(true)} />}
            </div>

            {isEditing ? (
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Full Name</label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Phone Number</label>
                  <Input 
                    type="tel" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                  <Button variant="primary" label="Save Changes" icon={<Save size={16} />} type="submit" loading={saving} />
                  <Button variant="ghost" label="Cancel" onClick={() => setIsEditing(false)} />
                </div>
              </form>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                 <div>
                   <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, display: 'block', marginBottom: 4 }}>SECURITY CLEARANCE</span>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600 }}><ShieldCheck size={16} color="var(--color-success)" /> Level 2 Verified</div>
                 </div>
                 <div>
                   <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, display: 'block', marginBottom: 4 }}>PHONE NUMBER</span>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600 }}><Phone size={16} color="var(--color-primary-light)" /> {formData.phone}</div>
                 </div>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, marginBottom: 'var(--space-4)' }}>Session Security</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 'var(--space-2)', borderRadius: '50%' }}><Clock size={16} /></div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Last Login</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Dar es Salaam, TZ (IP: 197.xxx)</div>
                </div>
              </div>
              <StatusBadge status="ACTIVE" />
            </div>
            <div style={{ marginTop: 'var(--space-5)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
               <Button variant="ghost" label="Change Password" icon={<Lock size={14} />} onClick={() => setShowPassModal(true)} />
            </div>
          </div>

          {user.role === 'AGENT' && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, marginBottom: 'var(--space-4)' }}>Transaction Security</h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
                Your Transaction PIN is required to authorize all financial movements.
              </p>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <ShieldCheck size={18} color="var(--color-primary-light)" />
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>4-Digit Secure PIN</span>
                </div>
                <Button variant="outline" size="sm" label="Set / Change PIN" onClick={() => setShowPinModal(true)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={showPassModal} onClose={() => setShowPassModal(false)} title="Change Password" size="sm"
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-3)', width: '100%' }}>
            <Button label="Cancel" variant="ghost" fullWidth onClick={() => setShowPassModal(false)} />
            <Button label="Update Password" variant="primary" fullWidth loading={passLoading} onClick={async () => {
              if (passData.new !== passData.confirm) return setPassError('Passwords do not match')
              setPassLoading(true)
              try {
                const { error } = await supabase.auth.updateUser({ password: passData.new })
                if (error) throw error
                toastSuccess('Success', 'Password changed.')
                setShowPassModal(false)
              } catch (err) {
                setPassError(err.message)
              } finally {
                setPassLoading(false)
              }
            }} />
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="New Password" type="password" value={passData.new} onChange={e => setPassData({ ...passData, new: e.target.value })} />
          <Input label="Confirm New Password" type="password" value={passData.confirm} onChange={e => setPassData({ ...passData, confirm: e.target.value })} error={passError} />
        </div>
      </Modal>

      <Modal isOpen={showPinModal} onClose={() => setShowPinModal(false)} title="Transaction PIN" size="sm"
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-3)', width: '100%' }}>
            <Button label="Cancel" variant="ghost" fullWidth onClick={() => setShowPinModal(false)} />
            <Button label="Save PIN" variant="primary" fullWidth loading={pinLoading} onClick={async () => {
              if (pinData.new !== pinData.confirm) return setPinError('PINs do not match')
              if (!/^\d{4}$/.test(pinData.new)) return setPinError('Must be 4 digits')
              setPinLoading(true)
              try {
                const { error } = await supabase.rpc('set_agent_pin', { p_agent_id: agentId, p_pin: pinData.new })
                if (error) throw error
                toastSuccess('Success', 'PIN updated.')
                setShowPinModal(false)
              } catch (err) {
                setPinError(err.message)
              } finally {
                setPinLoading(false)
              }
            }} />
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input 
            label="New PIN" 
            type="text" 
            autoComplete="one-time-code" 
            inputMode="numeric" 
            maxLength={4} 
            value={pinData.new} 
            onChange={e => setPinData({ ...pinData, new: e.target.value.replace(/\D/g, '').slice(0, 4) })} 
            style={{ WebkitTextSecurity: 'disc', textAlign: 'center', letterSpacing: '8px', fontSize: '20px' }}
          />
          <Input 
            label="Confirm PIN" 
            type="text" 
            autoComplete="one-time-code" 
            inputMode="numeric" 
            maxLength={4} 
            value={pinData.confirm} 
            onChange={e => setPinData({ ...pinData, confirm: e.target.value.replace(/\D/g, '').slice(0, 4) })} 
            error={pinError} 
            style={{ WebkitTextSecurity: 'disc', textAlign: 'center', letterSpacing: '8px', fontSize: '20px' }}
          />
        </div>
      </Modal>
    </div>
  )
}
