// components/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import { LogOut, ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { RoleBadge } from '../ui/Badge'
import { cn } from '../../utils/cn'
import './Sidebar.css'

export function Sidebar({ navItems, accentColor, isOpen, onClose }) {
  const { user, logout } = useAuth()

  return (
    <>
      <div 
        className={cn('sidebar-overlay', isOpen && 'sidebar-overlay--open')} 
        onClick={onClose} 
      />
      <aside className={cn('sidebar', `sidebar--${accentColor || 'primary'}`, isOpen && 'sidebar--open')}>
        {/* Nav */}
        <nav className="sidebar__nav" aria-label="Main navigation">
          {navItems.map((section, si) => (
            <div key={si} className="sidebar__section">
              {section.label && <span className="sidebar__section-label">{section.label}</span>}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn('sidebar__link', isActive && 'sidebar__link--active')
                  }
                  end={item.end}
                  onClick={onClose}
                >
                  <span className="sidebar__link-icon" aria-hidden="true">{item.icon}</span>
                  <span className="sidebar__link-label">{item.label}</span>
                  {item.badge && <span className="sidebar__link-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="sidebar__user">
          <div className="sidebar__avatar" aria-hidden="true">{user?.avatar}</div>
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">{user?.name}</span>
            <RoleBadge role={user?.role} />
          </div>
          <button className="sidebar__logout" onClick={logout} aria-label="Sign out" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>
    </>
  )
}
