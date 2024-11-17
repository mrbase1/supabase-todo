import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for changes on auth state (signed in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      
      if (event === 'SIGNED_IN') {
        navigate('/')
      }
      if (event === 'SIGNED_OUT') {
        navigate('/auth')
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  const signUp = async (data) => {
    const { error: signUpError } = await supabase.auth.signUp(data)
    if (signUpError) throw signUpError

    // Explicitly create profile after signup
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: (await supabase.auth.getUser()).data.user.id,
          email: data.email,
        }
      ])
      .single()

    if (profileError && !profileError.message.includes('duplicate key')) {
      throw profileError
    }
  }

  const value = {
    signUp,
    signIn: (data) => supabase.auth.signInWithPassword(data),
    signOut: () => supabase.auth.signOut(),
    user,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
