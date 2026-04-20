// App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Pages
import Login from './pages/Login'
import Signup from './pages/Signup'

function RootRedirect() {
  const { user, loading } = useAuth()
  
  if (loading) return (
    <div className="loading-screen">
      <div className="loading-screen__content">
        <div className="loading-screen__spinner" />
        <span className="loading-screen__text">Securing Connection...</span>
      </div>
    </div>
  )
  
  if (!user) return <Navigate to="/login" replace />
  
  const routes = {
    PLATFORM_ADMIN: '/platform',
    SUPERVISOR:     '/supervisor',
    AGENT:          '/agent',
  }
  
  const target = routes[user.role] || '/login'
  window.location.replace(target)
  return null
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
