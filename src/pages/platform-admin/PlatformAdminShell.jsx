import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Activity, ShieldAlert, ScrollText, BarChart3, Settings, Radio, User } from 'lucide-react'
import { Sidebar } from '../../components/layout/Sidebar'
import { TopNav } from '../../components/layout/TopNav'
import { BottomNav } from '../../components/layout/BottomNav'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase/client'
import './PlatformAdminShell.css'

export default function PlatformAdminShell() {
  const { user, loading } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [fraudCount, setFraudCount] = useState(0)

  useEffect(() => {
    async function fetchFraudCount() {
      try {
        const { count } = await supabase
          .from('fraud_events')
          .select('*', { count: 'exact', head: true })
          .eq('resolved', false)
        
        setFraudCount(count || 0)
      } catch (err) {
        console.error("Fraud count error:", err)
      }
    }
    if (user?.role === 'PLATFORM_ADMIN') {
      fetchFraudCount()
      
      const channel = supabase.channel('fraud_badges')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fraud_events' }, () => {
          fetchFraudCount()
        })
        .subscribe()
      
      return () => supabase.removeChannel(channel)
    }
  }, [user])

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-screen__content">
        <div className="loading-screen__spinner" />
        <span className="loading-screen__text">Verifying Platform Session...</span>
      </div>
    </div>
  )

  if (!user || user.role !== 'PLATFORM_ADMIN') {
    window.location.replace('/index.html')
    return null
  }

  const NAV_ITEMS = [
    {
      label: 'Overview',
      items: [
        { to: '/',                   label: 'Dashboard',     icon: <LayoutDashboard size={16} />, end: true },
        { to: '/transactions',       label: 'Transactions',  icon: <Activity size={16} /> },
      ]
    },
    {
      label: 'Management',
      items: [
        { to: '/agents',             label: 'Supervisors',  icon: <Building2 size={16} /> },
        { to: '/broadcasts',         label: 'Broadcasts',    icon: <Radio size={16} /> },
      ]
    },
    {
      label: 'Compliance',
      items: [
        { to: '/fraud',              label: 'Fraud Alerts',  icon: <ShieldAlert size={16} />, badge: fraudCount > 0 ? String(fraudCount) : null },
        { to: '/audit',              label: 'Audit Logs',    icon: <ScrollText size={16} /> },
        { to: '/settlement',         label: 'Settlement',    icon: <BarChart3 size={16} /> },
      ]
    },
    {
      label: 'System',
      items: [
        { to: '/profile',            label: 'My Profile',    icon: <User size={16} /> },
      ]
    },
  ]

  const MOBILE_NAV = [
    { to: '/',                   label: 'Dashboard', icon: <LayoutDashboard size={20} />, end: true },
    { to: '/transactions',       label: 'Txns',      icon: <Activity size={20} /> },
    { to: '/agents',             label: 'Supers',    icon: <Building2 size={20} /> },
    { to: '/fraud',              label: 'Fraud',     icon: <ShieldAlert size={20} />, badge: fraudCount > 0 ? String(fraudCount) : null },
    { to: '/profile',            label: 'Profile',   icon: <User size={20} /> },
  ]

  return (
    <div className="app-shell-root">
      <TopNav 
        logoLabel="Platform Admin" 
        onMenuClick={() => setIsMobileMenuOpen(true)}
      />
      <div className="app-shell">
        <Sidebar 
          navItems={NAV_ITEMS} 
          accentColor="platform" 
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main className="main-content page-body">
          <Outlet />
        </main>
      </div>
      <BottomNav items={MOBILE_NAV} />
    </div>
  )
}
