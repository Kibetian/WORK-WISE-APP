import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { homePathForRole, useAuth } from '../context/AuthContext'
import type { UserRole } from '../lib/types'
import { Loading } from './ui'

/**
 * Gate a branch of the route tree behind authentication and, optionally, a set
 * of roles. While the session is still being restored we render a spinner
 * rather than bouncing the user to /login and losing their destination.
 */
export default function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { isAuthenticated, loading, role } = useAuth()
  const location = useLocation()

  if (loading) return <Loading label="Checking your session…" />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && role && !roles.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />
  }

  return <Outlet />
}
