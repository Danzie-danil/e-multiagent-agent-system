// pages/Login.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { Button } from '../components/ui/Button'
import './Login.css'

export default function Login() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__bg" aria-hidden="true">
        <div className="login-page__grid" />
        <div className="login-page__glow login-page__glow--1" />
        <div className="login-page__glow login-page__glow--2" />
      </div>

      <div className="login-page__content">
        {/* Header */}
        <div className="login-page__header">
          <div className="login-page__logo-mark">
            <span>eW</span>
          </div>
          <div className="login-page__badge">Unified Portal Gateway</div>
          <h1 className="login-page__title">e-WAKALA</h1>
          <p className="login-page__tagline">
            Secure access for Platform, Tenant, and Agent networks
          </p>
        </div>

        {/* Login Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form__group">
            <label htmlFor="email">Email Address</label>
            <input 
              id="email"
              type="email" 
              placeholder="admin@ewakala.co.tz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="login-form__group">
            <label htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-form__error">{error}</div>}

          <Button 
            type="submit" 
            variant="primary" 
            size="lg" 
            className="login-form__submit"
            loading={loading}
          >
            Sign In to Dashboard
          </Button>

          <p className="login-form__info">
            Automated routing will take you to your assigned network portal.
          </p>

          <div className="login-form__signup-link" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', margin: 'var(--space-6) 0' }}>
            <div>
              Don't have an account? <Link to="/signup">Create one now</Link>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-primary)', textAlign: 'left' }}>
              <span style={{ display: 'block', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 4, fontSize: 13 }}>Have a Join Code?</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>If your Supervisor invited you, <Link to="/signup?mode=join" style={{ fontWeight: 600, textDecoration: 'underline' }}>activate your account here</Link>.</span>
            </div>
          </div>

          <div className="login-form__help">
            <a href="#">Forgot password?</a>
            <span>Contact system administrator if you lost access.</span>
          </div>
        </form>

        <p className="login-page__footer">
          e-WAKALA &copy; 2026 · Regulated Payment Network · Tanzania
        </p>
      </div>
    </div>
  )
}
