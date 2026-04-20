import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        if (session) {
          const metadata = session.user.user_metadata || {}
          const baseUser = {
            ...session.user,
            role: metadata.role || 'AGENT',
            name: metadata.name || 'User',
            avatar: metadata.name?.charAt(0) || 'U',
            tenant_name: metadata.tenant_name || 'E-Wakala'
          }

          // Hydrate with real profile name from DB
          let realName = baseUser.name
          if (baseUser.role === 'AGENT' && metadata.agent_id) {
            const { data } = await supabase.from('agents').select('name').eq('id', metadata.agent_id).maybeSingle()
            if (data?.name) realName = data.name
          } else if ((baseUser.role === 'SUPER_AGENT' || baseUser.role === 'SUPERVISOR') && (metadata.super_agent_id || metadata.supervisor_id)) {
            const sid = metadata.supervisor_id || metadata.super_agent_id
            if (sid) {
              const { data } = await supabase.from('supervisors').select('name').eq('id', sid).maybeSingle()
              if (data?.name) realName = data.name
            }
          }

          setUser({ ...baseUser, name: realName, avatar: realName.charAt(0) })
        }
      } catch (err) {
        console.error("Auth session sync error:", err)
      } finally {
        setLoading(false)
      }
    })

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const metadata = session.user.user_metadata || {}
        
        // 0. Check for cached real name to avoid flicker
        const cachedName = localStorage.getItem(`ew_name_${session.user.id}`)
        
        const baseUser = {
          ...session.user,
          role: metadata.role || 'AGENT',
          name: cachedName || metadata.name || 'User',
          avatar: (cachedName || metadata.name || 'U').charAt(0).toUpperCase(),
          tenant_name: metadata.tenant_name || 'E-Wakala'
        }

        // 1. Set base user IMMEDIATELY (using cache if available)
        setUser(baseUser)

        // 2. Hydrate/Verify real name from DB
        const hydrate = async () => {
          try {
            const { data: profile, error: pError } = await supabase.from('users').select('agent_id, supervisor_id, role').eq('id', session.user.id).maybeSingle()
            if (pError || !profile) return
            
            let realName = baseUser.name
            
            if (profile.role === 'AGENT' && profile.agent_id) {
              const { data: agent } = await supabase.from('agents').select('name').eq('id', profile.agent_id).maybeSingle()
              if (agent?.name) realName = agent.name
            } else if ((profile.role === 'SUPERVISOR' || profile.role === 'SUPER_AGENT') && (profile.supervisor_id)) {
              const { data: supervisor } = await supabase.from('supervisors').select('name').eq('id', profile.supervisor_id).maybeSingle()
              if (supervisor?.name) realName = supervisor.name
            }
            
            // Save to cache for next load
            localStorage.setItem(`ew_name_${session.user.id}`, realName)
            
            setUser(prev => ({ ...prev, name: realName, avatar: realName.charAt(0) }))
          } catch (e) {
            console.error("Identity synchronization failed:", e)
          }
        }
        hydrate()
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    // Fail-safe: Force hide loading screen after 5 seconds no matter what
    const timer = setTimeout(() => {
      setLoading(false)
    }, 5000)
    
    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      setLoading(false)
      throw error
    }
    
    return data
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('ewakala_user') // Also cleanup the legacy key we added
    window.location.href = '/index.html'
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
