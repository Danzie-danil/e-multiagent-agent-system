import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const location = useLocation()
  const [theme, setTheme] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('ewakala-theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const isAuthPage = ['/login', '/signup'].includes(location.pathname)
    const activeTheme = isAuthPage ? 'dark' : theme

    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(activeTheme)
    
    // Only persist to storage if not on auth page
    if (!isAuthPage) {
      localStorage.setItem('ewakala-theme', theme)
    }
  }, [theme, location.pathname])

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
