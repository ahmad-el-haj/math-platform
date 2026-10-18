import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Profile, UserRole } from '@/lib/database.types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export type SignUpResult = {
  needsEmailConfirmation: boolean
}

export type AuthContextValue = {
  status: AuthStatus
  session: Session | null
  user: User | null
  profile: Profile | null
  role: UserRole | null
  isTeacher: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: {
    fullName: string
    email: string
    password: string
    gradeLevel?: string | undefined
  }) => Promise<SignUpResult>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[auth] failed to load profile', error)
      return null
    }
    return (data as Profile | null) ?? null
  }, [])

  const refreshProfile = useCallback(async () => {
    const currentUser = supabase.auth.getUser
      ? (await supabase.auth.getUser()).data.user
      : null
    if (!currentUser) {
      setProfile(null)
      return
    }
    setProfile(await loadProfile(currentUser.id))
  }, [loadProfile])

  useEffect(() => {
    let active = true

    // Restore an existing session on a hard reload.
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return
        const currentSession = data.session
        setSession(currentSession)
        if (currentSession) {
          const loaded = await loadProfile(currentSession.user.id)
          if (!active) return
          setProfile(loaded)
        }
        if (active) setStatus(currentSession ? 'authenticated' : 'anonymous')
      })
      .catch((error) => {
        console.error('[auth] session restore failed', error)
        if (active) setStatus('anonymous')
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return

      // TOKEN_REFRESHED keeps the same user; only refetch the profile when the
      // identity actually changed.
      if (event === 'SIGNED_OUT' || !nextSession) {
        setSession(null)
        setProfile(null)
        setStatus('anonymous')
        return
      }

      setSession(nextSession)
      setStatus('authenticated')

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        void loadProfile(nextSession.user.id).then((loaded) => {
          if (active) setProfile(loaded)
        })
      }
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw toAppError(error, 'auth')
    }
  }, [])

  const signUp = useCallback(
    async (input: {
      fullName: string
      email: string
      password: string
      gradeLevel?: string | undefined
    }): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          // Only harmless presentation data is sent. The role is never
          // accepted from the client — the database decides that.
          data: {
            full_name: input.fullName,
            grade_level: input.gradeLevel ?? '',
          },
        },
      })

      if (error) {
        throw toAppError(error, 'auth')
      }

      return { needsEmailConfirmation: !data.session }
    },
    [],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw toAppError(error, 'auth')
    }
    setSession(null)
    setProfile(null)
    setStatus('anonymous')
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      throw toAppError(error, 'auth')
    }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      throw toAppError(error, 'auth')
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      isTeacher: profile?.role === 'teacher',
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
    }),
    [status, session, profile, signIn, signUp, signOut, sendPasswordReset, updatePassword, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>.')
  }
  return context
}
