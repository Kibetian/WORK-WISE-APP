import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { auth, setToken, getToken, UNAUTHORIZED_EVENT } from '../lib/api'
import type { AuthSession, EmployerProfile, JobSeekerProfile, UserRole } from '../lib/types'

interface AuthContextValue {
  session: AuthSession | null
  loading: boolean
  role: UserRole | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<AuthSession>
  register: (input: {
    username: string
    email: string
    password: string
    role: Exclude<UserRole, 'admin'>
  }) => Promise<AuthSession>
  logout: () => void
  refresh: () => Promise<AuthSession | null>
  setJobSeekerProfile: (profile: JobSeekerProfile) => void
  setEmployerProfile: (profile: EmployerProfile) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<AuthSession | null> => {
    if (!getToken()) {
      setSession(null)
      setLoading(false)
      return null
    }
    try {
      const next = await auth.me()
      setSession(next)
      return next
    } catch {
      setToken(null)
      setSession(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // The API layer broadcasts this when a request comes back 401.
  useEffect(() => {
    const onUnauthorized = () => setSession(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const token = await auth.login({ email, password })
      setToken(token.access_token)
      const next = await auth.me()
      setSession(next)
      return next
    },
    [],
  )

  const register = useCallback(
    async (input: {
      username: string
      email: string
      password: string
      role: Exclude<UserRole, 'admin'>
    }) => {
      const token = await auth.register(input)
      setToken(token.access_token)
      const next = await auth.me()
      setSession(next)
      return next
    },
    [],
  )

  const logout = useCallback(() => {
    setToken(null)
    setSession(null)
  }, [])

  const setJobSeekerProfile = useCallback((profile: JobSeekerProfile) => {
    setSession((current) =>
      current ? { ...current, job_seeker_profile: profile } : current,
    )
  }, [])

  const setEmployerProfile = useCallback((profile: EmployerProfile) => {
    setSession((current) => (current ? { ...current, employer_profile: profile } : current))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      role: session?.user.role ?? null,
      isAuthenticated: session !== null,
      login,
      register,
      logout,
      refresh,
      setJobSeekerProfile,
      setEmployerProfile,
    }),
    [session, loading, login, register, logout, refresh, setJobSeekerProfile, setEmployerProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}

/** Where a signed-in user belongs after login. */
// eslint-disable-next-line react-refresh/only-export-components
export function homePathForRole(role: UserRole | null): string {
  switch (role) {
    case 'employer':
      return '/employer'
    case 'admin':
      return '/admin'
    case 'job_seeker':
      return '/dashboard'
    default:
      return '/'
  }
}
