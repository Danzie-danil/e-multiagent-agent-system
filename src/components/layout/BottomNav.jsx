// components/layout/BottomNav.jsx
import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn'
import './BottomNav.css'

export function BottomNav({ items }) {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map((item, idx) => {
        const isAction = !!item.onClick;
        const key = item.to || `action-${idx}`;

        if (isAction) {
          return (
            <button
              key={key}
              onClick={item.onClick}
              className={cn('bottom-nav__item', 'bottom-nav__item--action')}
              aria-label={item.label}
            >
              <div className="bottom-nav__fab">
                <span className="bottom-nav__icon">{item.icon}</span>
              </div>
              <span className="bottom-nav__label">{item.label}</span>
            </button>
          );
        }

        return (
          <NavLink
            key={key}
            to={item.to}
            className={({ isActive }) => cn('bottom-nav__item', isActive && 'bottom-nav__item--active')}
            end={item.end}
            aria-label={item.label}
          >
            <span className="bottom-nav__icon" aria-hidden="true">{item.icon}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  )
}
