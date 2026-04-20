import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { LayoutDashboard, Users, Wallet, TrendingUp, Bell, User, Megaphone } from 'lucide-react'
import { Sidebar } from '../../components/layout/Sidebar'
import { TopNav } from '../../components/layout/TopNav'
import { BottomNav } from '../../components/layout/BottomNav'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase/client'

export default function SupervisorShell() {
  const { user, loading } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const { data: u } = await supabase.from('users').select('supervisor_id').eq('id', user.id).single()
        if (u?.supervisor_id) {
          // Count agents with at least one wallet balance < 1,000,000
          // For simplicity in a single query:
          const { data } = await supabase
            .from('agent_wallet_accounts')
            .select('agent_id, agents!inner(supervisor_id)')
            .eq('agents.supervisor_id', u.supervisor_id)
            .lt('balance', 1000000)
          
          const uniqueAgents = new Set(data?.map(d => d.agent_id))
          setAlertCount(uniqueAgents.size)
        }
      } catch (err) {
        console.error("Alert count error:", err)
      }
    }
    if (user?.role === 'SUPERVISOR') {
      fetchAlerts()
      // Setup realtime if desired, but pull once for now
    }
  }, [user])

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-screen__content">
        <div className="loading-screen__spinner" />
        <span className="loading-screen__text">Verifying supervisor Session...</span>
      </div>
    </div>
  )

  if (!user || user.role !== 'SUPERVISOR') {
    window.location.replace('/index.html')
    return null
  }

  const NAV_ITEMS = [
    { label: 'Operations', items: [
      { to: '/',                        label: 'Dashboard',          icon: <LayoutDashboard size={16}/>, end: true },
      { to: '/agents',                  label: 'My Agents',          icon: <Users size={16}/> },
      { to: '/float',                   label: 'Float Distribution', icon: <Wallet size={16}/> },
      { to: '/wallets',                 label: 'Wallet Network',     icon: <Wallet size={16}/> },
      { to: '/broadcaster',             label: 'Broadcaster',        icon: <Megaphone size={16}/> },
    ]},
    { label: 'Finance', items: [
      { to: '/commissions',             label: 'My Commissions',  icon: <TrendingUp size={16}/> },
      { to: '/liquidity',               label: 'Liquidity Alerts',icon: <Bell size={16}/>, badge: alertCount > 0 ? String(alertCount) : null },
    ]},
    { label: 'Settings', items: [
      { to: '/profile',                 label: 'My Profile',      icon: <User size={16}/> },
    ]},
  ]

  const MOBILE_NAV = [
    { to: '/',                        label: 'Home',    icon: <LayoutDashboard size={20}/>, end: true },
    { to: '/agents',                  label: 'Agents',  icon: <Users size={20}/> },
    { to: '/float',                   label: 'Float',   icon: <Wallet size={20}/> },
    { to: '/wallets',                 label: 'Wallets', icon: <Wallet size={20}/> },
    { to: '/broadcaster',             label: 'Message', icon: <Megaphone size={20}/> },
    { to: '/commissions',             label: 'Earn',    icon: <TrendingUp size={20}/> },
    { to: '/liquidity',               label: 'Alerts',  icon: <Bell size={20}/>, badge: alertCount > 0 ? String(alertCount) : null },
    { to: '/profile',                 label: 'Profile', icon: <User size={20}/> },
  ]

  return (
    <div className="app-shell-root">
      <TopNav 
        logoLabel="Supervisor" 
        onMenuClick={() => setIsMobileMenuOpen(true)}
      />
      <div className="app-shell">
        <Sidebar 
          navItems={NAV_ITEMS} 
          accentColor="super" 
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
