import { useState, useEffect, useCallback } from 'react'
import { Radio, Power, PowerOff, Pencil, Trash2, Plus, Clock, Users, AlertTriangle, Info, ShieldAlert, Send } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { formatDistanceToNow } from 'date-fns'
import './PlatformBroadcasts.css'

const TYPE_CONFIG = {
  INFO:    { icon: <Info size={16} />,           color: 'var(--color-primary)', label: 'Informational' },
  WARNING: { icon: <AlertTriangle size={16} />,  color: 'var(--color-warning)', label: 'Warning' },
  ERROR:   { icon: <ShieldAlert size={16} />,    color: 'var(--color-error)',   label: 'Critical' }
}

const TARGET_LABELS = {
  ALL: 'Everyone',
  SUPERVISOR: 'Supervisors',
  AGENT: 'Agents'
}

export default function PlatformBroadcasts() {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingBanner, setEditingBanner] = useState(null)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [formTarget, setFormTarget] = useState('ALL')
  const [formType, setFormType] = useState('INFO')
  const [formDuration, setFormDuration] = useState('24')
  const [isSaving, setIsSaving] = useState(false)

  const fetchBanners = useCallback(async () => {
    const { data } = await supabase
      .from('system_banners')
      .select('*')
      .order('created_at', { ascending: false })
    setBanners(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchBanners()

    const channel = supabase.channel('admin_banners')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_banners' }, () => {
        fetchBanners()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchBanners])

  const resetForm = () => {
    setFormTitle('')
    setFormMessage('')
    setFormTarget('ALL')
    setFormType('INFO')
    setFormDuration('24')
    setEditingBanner(null)
    setShowForm(false)
  }

  const openEditForm = (banner) => {
    setEditingBanner(banner)
    setFormTitle(banner.title)
    setFormMessage(banner.message)
    setFormTarget(banner.target_role)
    setFormType(banner.type)
    setFormDuration('24')
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formTitle.trim() || !formMessage.trim()) return
    setIsSaving(true)

    try {
      if (editingBanner) {
        const { error: err } = await supabase
          .from('system_banners')
          .update({ 
            title: formTitle.trim(), 
            message: formMessage.trim(), 
            target_role: formTarget, 
            type: formType 
          })
          .eq('id', editingBanner.id)
        if (err) throw err
        success('Banner Updated', 'Changes have been saved.')
      } else {
        let expiresAt = null
        if (formDuration !== 'FOREVER') {
          expiresAt = new Date(Date.now() + parseInt(formDuration) * 60 * 60 * 1000).toISOString()
        }
        const { error: err } = await supabase
          .from('system_banners')
          .insert({
            title: formTitle.trim(),
            message: formMessage.trim(),
            target_role: formTarget,
            type: formType,
            expires_at: expiresAt,
            created_by: user.id
          })
        if (err) throw err
        success('Banner Deployed', 'Sticky banner is now live across the network.')
      }
      resetForm()
    } catch (err) {
      console.error(err)
      error('Operation Failed', 'Could not save the banner.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleActive = async (banner) => {
    try {
      await supabase
        .from('system_banners')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id)
      success(banner.is_active ? 'Banner Deactivated' : 'Banner Activated', 
        banner.is_active ? 'Banner has been hidden from users.' : 'Banner is now visible again.')
    } catch (err) {
      error('Toggle Failed', 'Could not update banner status.')
    }
  }

  const deleteBanner = async (id) => {
    try {
      await supabase.from('system_banners').delete().eq('id', id)
      success('Banner Deleted', 'Banner has been permanently removed.')
    } catch (err) {
      error('Delete Failed', 'Could not delete the banner.')
    }
  }

  const isExpired = (banner) => {
    if (!banner.expires_at) return false
    return new Date(banner.expires_at) < new Date()
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-screen__content">
        <div className="loading-screen__spinner" />
        <span className="loading-screen__text">Loading Broadcasts...</span>
      </div>
    </div>
  )

  return (
    <div className="platform-broadcasts animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Broadcasts</h1>
          <p className="page-subtitle">Manage system-wide sticky banners visible to all users</p>
        </div>
        <Button 
          variant="primary" 
          label="New Banner" 
          icon={<Plus size={16}/>} 
          onClick={() => { resetForm(); setShowForm(true) }}
        />
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="card card--pad-md broadcasts__form-card animate-fadeIn">
          <h3 className="broadcasts__form-title">
            {editingBanner ? 'Edit Banner' : 'Deploy New Banner'}
          </h3>
          <form onSubmit={handleSave} className="broadcasts__form">
            <div className="broadcasts__form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Alert Level</label>
                <select className="form-input" value={formType} onChange={e => setFormType(e.target.value)}>
                  <option value="INFO">Informational</option>
                  <option value="WARNING">Warning</option>
                  <option value="ERROR">Critical Incident</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Target</label>
                <select className="form-input" value={formTarget} onChange={e => setFormTarget(e.target.value)}>
                  <option value="ALL">Entire Network</option>
                  <option value="SUPERVISOR">Supervisors Only</option>
                  <option value="AGENT">Agents Only</option>
                </select>
              </div>
              {!editingBanner && (
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Duration</label>
                  <select className="form-input" value={formDuration} onChange={e => setFormDuration(e.target.value)}>
                    <option value="1">1 Hour</option>
                    <option value="24">24 Hours</option>
                    <option value="168">7 Days</option>
                    <option value="FOREVER">Until Revoked</option>
                  </select>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Title</label>
              <input required type="text" className="form-input" placeholder="e.g. Scheduled Maintenance" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea required className="form-input" placeholder="Banner content..." rows={2} value={formMessage} onChange={e => setFormMessage(e.target.value)} />
            </div>

            <div className="broadcasts__form-actions">
              <Button type="button" variant="secondary" label="Cancel" onClick={resetForm} />
              <Button type="submit" variant="primary" label={isSaving ? 'Saving...' : (editingBanner ? 'Save Changes' : 'Deploy Banner')} icon={!isSaving && <Send size={14}/>} disabled={isSaving || !formTitle || !formMessage} />
            </div>
          </form>
        </div>
      )}

      {/* Banner List */}
      <div className="broadcasts__list">
        {banners.length === 0 ? (
          <div className="broadcasts__empty">
            <Radio size={40} />
            <h3>No Broadcasts Yet</h3>
            <p>Create your first system-wide banner to notify all users.</p>
          </div>
        ) : (
          banners.map(banner => {
            const conf = TYPE_CONFIG[banner.type] || TYPE_CONFIG.INFO
            const expired = isExpired(banner)
            
            return (
              <div key={banner.id} className={`broadcasts__item ${!banner.is_active || expired ? 'broadcasts__item--inactive' : ''}`}>
                <div className="broadcasts__item-header">
                  <div className="broadcasts__item-meta">
                    <span className="broadcasts__item-icon" style={{ color: conf.color }}>
                      {conf.icon}
                    </span>
                    <h4 className="broadcasts__item-title">{banner.title}</h4>
                    <span className={`broadcasts__item-status ${banner.is_active && !expired ? 'broadcasts__item-status--live' : 'broadcasts__item-status--off'}`}>
                      {expired ? 'Expired' : banner.is_active ? 'Live' : 'Inactive'}
                    </span>
                  </div>
                  <div className="broadcasts__item-actions">
                    <button className="broadcasts__action-btn" title="Edit" onClick={() => openEditForm(banner)}>
                      <Pencil size={14}/>
                    </button>
                    <button className="broadcasts__action-btn" title={banner.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(banner)}>
                      {banner.is_active ? <PowerOff size={14}/> : <Power size={14}/>}
                    </button>
                    <button className="broadcasts__action-btn broadcasts__action-btn--danger" title="Delete" onClick={() => deleteBanner(banner.id)}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>

                <p className="broadcasts__item-message">{banner.message}</p>

                <div className="broadcasts__item-footer">
                  <span className="broadcasts__item-tag"><Users size={12}/> {TARGET_LABELS[banner.target_role] || banner.target_role}</span>
                  <span className="broadcasts__item-tag"><Clock size={12}/> {formatDistanceToNow(new Date(banner.created_at), { addSuffix: true })}</span>
                  {banner.expires_at && (
                    <span className="broadcasts__item-tag">
                      {expired ? '⏰ Expired' : `⏰ Expires ${formatDistanceToNow(new Date(banner.expires_at), { addSuffix: true })}`}
                    </span>
                  )}
                  {!banner.expires_at && <span className="broadcasts__item-tag">♾️ Permanent</span>}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
