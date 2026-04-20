import { useState, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Home, ArrowDownLeft, ArrowUpRight, Clock, User, Wallet, CreditCard, BarChart3, Plus, X } from 'lucide-react'
import { Sidebar } from '../../components/layout/Sidebar'
import { TopNav } from '../../components/layout/TopNav'
import { BottomNav } from '../../components/layout/BottomNav'
import { useAuth } from '../../context/AuthContext'
import { ScrollHint } from '../../components/ui/ScrollHint'
import { cn } from '../../utils/cn'
import './AgentPOSShell.css'

const NAV_ITEMS = [
  { 
    label: 'Operations', 
    items: [
      { to: '/',         label: 'Home',     icon: <Home size={16}/>,          end: true },
      { to: '/withdraw', label: 'Withdraw', icon: <ArrowUpRight size={16}/> },
      { to: '/deposit',  label: 'Deposit',  icon: <ArrowDownLeft size={16}/> },
      { to: '/pay',      label: 'Pay',      icon: <CreditCard size={16}/> },
      { to: '/wallets',  label: 'My Wallets',icon: <Wallet size={16}/> },
    ]
  },
  { 
    label: 'Account', 
    items: [
      { to: '/history',    label: 'History',  icon: <Clock size={16}/> },
      { to: '/reports',    label: 'Reports',  icon: <BarChart3 size={16}/> },
      { to: '/profile',    label: 'My Profile',icon: <User size={16}/> },
    ]
  }
]

export default function AgentPOSShell() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const containerRef = useRef(null)

  const MOBILE_NAV = [
    { to: '/',           label: 'Home',     icon: <Home size={20}/>,           end: true },
    { to: '/wallets',    label: 'Wallets',  icon: <Wallet size={20}/> },
    { 
      label: 'Transact', 
      icon: <Plus style={{ transform: isQuickMenuOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} size={24}/>, 
      onClick: () => setIsQuickMenuOpen(!isQuickMenuOpen) 
    },
    { to: '/history',    label: 'History',  icon: <Clock size={20}/> },
    { to: '/profile',    label: 'Profile',  icon: <User size={20}/> },
  ]

  const handleQuickAction = (path) => {
    navigate(path)
    setIsQuickMenuOpen(false)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-screen__content">
        <div className="loading-screen__spinner" />
        <span className="loading-screen__text">Verifying POS Session...</span>
      </div>
    </div>
  )

  if (!user || user.role !== 'AGENT') {
    window.location.replace('/index.html')
    return null
  }

  return (
    <div className="app-shell-root">
      <TopNav 
        logoLabel="Agent POS" 
        onMenuClick={() => setIsMobileMenuOpen(true)}
      />
      
      <div className="app-shell">
        <Sidebar 
          navItems={NAV_ITEMS} 
          accentColor="agent" 
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main className="main-content page-body">
          <div className="agent-mobile-container" ref={containerRef}>
            <ScrollHint targetRef={containerRef} />
            <Outlet />
          </div>
        </main>
      </div>

      {/* Quick Action Overlay */}
      <div className={cn('quick-actions-overlay', isQuickMenuOpen && 'quick-actions-overlay--open')} onClick={() => setIsQuickMenuOpen(false)}>
        <div className="quick-actions-menu" onClick={e => e.stopPropagation()}>
          <div className="quick-actions-menu__header">
            <h3>Quick Operations</h3>
            <p>Select a transaction to begin</p>
          </div>
          <div className="quick-actions-menu__grid">
            <button className="quick-action-item" onClick={() => handleQuickAction('/withdraw')}>
              <div className="quick-action-item__icon quick-action-item__icon--withdraw">
                <ArrowUpRight size={24} />
              </div>
              <span>Withdraw</span>
            </button>
            <button className="quick-action-item" onClick={() => handleQuickAction('/deposit')}>
              <div className="quick-action-item__icon quick-action-item__icon--deposit">
                <ArrowDownLeft size={24} />
              </div>
              <span>Deposit</span>
            </button>
            <button className="quick-action-item" onClick={() => handleQuickAction('/pay')}>
              <div className="quick-action-item__icon quick-action-item__icon--pay">
                <CreditCard size={24} />
              </div>
              <span>Pay Merchant</span>
            </button>
          </div>
        </div>
      </div>

      <BottomNav items={MOBILE_NAV} />
    </div>
  )
}
