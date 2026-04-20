// pages/Signup.jsx
import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase/client'
import { Button } from '../components/ui/Button'
import { ShieldCheck, User, Users, Briefcase, ChevronRight, ArrowLeft } from 'lucide-react'
import './Signup.css'

export default function Signup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isJoinMode = searchParams.get('mode') === 'join'

  const [step, setStep] = useState(isJoinMode ? 2 : 1) // 1: Role Selection, 2: Form
  const [role, setRole] = useState('AGENT') // SUPERVISOR or AGENT
  const [isIndividual, setIsIndividual] = useState(isJoinMode ? false : true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    bizName: '',
    joinCode: ''
  })

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const isJoining = role === 'AGENT' && !isIndividual;
      
      const metaData = {
        role: role,
        join_code: isJoining ? formData.joinCode : null,
        biz_name: role === 'SUPERVISOR' ? formData.bizName : null
      }
      
      if (!isJoining) {
        metaData.name = formData.name;
        metaData.phone = formData.phone;
      }

      const { data, error: signupError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: metaData
        }
      })

      if (signupError) throw signupError

      if (data.user) {
        navigate('/login', { state: { message: 'Registration successful! Please check your email or sign in.' } })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="signup-page">
      <div className="signup-page__bg" aria-hidden="true">
        <div className="signup-page__grid" />
        <div className="signup-page__glow signup-page__glow--1" />
        <div className="signup-page__glow signup-page__glow--2" />
      </div>

      <div className="signup-page__content">
        <div className="signup-page__header">
          <div className="signup-page__logo-mark"><span>eW</span></div>
          <h1 className="signup-page__title">Create Account</h1>
          <p className="signup-page__tagline">Join the e-WAKALA regulated payment network</p>
        </div>

        {step === 1 ? (
          <div className="role-selection animate-fadeIn">
            <h2 className="role-selection__title">How will you use e-WAKALA?</h2>
            
            <div className="role-cards">
              <button 
                className={`role-card ${role === 'SUPERVISOR' ? 'role-card--active' : ''}`}
                onClick={() => { setRole('SUPERVISOR'); setStep(2); }}
              >
                <div className="role-card__icon"><Briefcase size={24} /></div>
                <div className="role-card__info">
                  <div className="role-card__name">Supervisor</div>
                  <div className="role-card__desc">Manage a network of agents and earn commissions</div>
                </div>
                <ChevronRight className="role-card__arrow" size={18} />
              </button>

              <button 
                className={`role-card ${role === 'AGENT' ? 'role-card--active' : ''}`}
                onClick={() => { setRole('AGENT'); setStep(2); }}
              >
                <div className="role-card__icon"><User size={24} /></div>
                <div className="role-card__info">
                  <div className="role-card__name">Agent</div>
                  <div className="role-card__desc">Perform cash-in/out services for customers</div>
                </div>
                <ChevronRight className="role-card__arrow" size={18} />
              </button>
            </div>

            <p className="role-selection__footer">
              Already have an account? <Link to="/login">Sign In</Link>
            </p>
          </div>
        ) : (
          <form className="signup-form animate-slideUp" onSubmit={handleSignup}>
            <button type="button" className="signup-form__back" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back to roles
            </button>

            <h2 className="signup-form__title">
              {role === 'SUPERVISOR' ? 'Supervisor Registration' : 'Agent Registration'}
            </h2>

            {role === 'AGENT' && (
              <div className="onboarding-toggle">
                <button 
                  type="button" 
                  className={`onboarding-toggle__btn ${isIndividual ? 'active' : ''}`}
                  onClick={() => setIsIndividual(true)}
                >
                  Individual Business
                </button>
                <button 
                  type="button" 
                  className={`onboarding-toggle__btn ${!isIndividual ? 'active' : ''}`}
                  onClick={() => setIsIndividual(false)}
                >
                  Join a Network
                </button>
              </div>
            )}

            <div className="signup-form__grid">
              {role === 'SUPERVISOR' && (
                <div className="signup-form__group signup-form__group--full">
                  <label>Business / Company Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Serengeti Global Ltd"
                    value={formData.bizName}
                    onChange={(e) => setFormData({...formData, bizName: e.target.value})}
                    required
                  />
                </div>
              )}

              {!isIndividual && role === 'AGENT' && (
                <div className="signup-form__group signup-form__group--full signup-form__group--accent">
                  <label>Join Code (From your Supervisor)</label>
                  <input 
                    type="text" 
                    placeholder="Enter 8-digit code"
                    value={formData.joinCode}
                    onChange={(e) => setFormData({...formData, joinCode: e.target.value})}
                    required
                  />
                </div>
              )}

              {!(role === 'AGENT' && !isIndividual) && (
                <>
                  <div className="signup-form__group">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      placeholder="Juma Hassan"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="signup-form__group">
                    <label>Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="0712345678"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required
                    />
                  </div>
                </>
              )}

              <div className="signup-form__group signup-form__group--full">
                <label>Email Address</label>
                <input 
                  type="email" 
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>

              <div className="signup-form__group signup-form__group--full">
                <label>Password</label>
                <input 
                  type="password" 
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  minLength={8}
                />
              </div>
            </div>

            {error && <div className="signup-form__error">{error}</div>}

            <Button 
              type="submit" 
              variant="primary" 
              size="lg" 
              className="signup-form__submit"
              loading={loading}
            >
              Create {role === 'SUPERVISOR' ? 'Supervisor' : 'Agent'} Account
            </Button>

            <div className="signup-form__help">
              By clicking "Create Account", you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
            </div>
          </form>
        )}

        <p className="signup-page__footer">
          e-WAKALA &copy; 2026 · Integrated Financial Network · Tanzania
        </p>
      </div>
    </div>
  )
}
