import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../lib/types'
import { Avatar, Button, cx } from './ui'

interface NavItem {
  to: string
  label: string
  roles?: UserRole[] | 'public'
}

const NAV: NavItem[] = [
  { to: '/jobs', label: 'Browse jobs', roles: 'public' },
  { to: '/companies', label: 'Companies', roles: 'public' },
  { to: '/dashboard', label: 'Dashboard', roles: ['job_seeker'] },
  { to: '/applications', label: 'My applications', roles: ['job_seeker'] },
  { to: '/profile', label: 'My profile', roles: ['job_seeker'] },
  { to: '/employer', label: 'Dashboard', roles: ['employer'] },
  { to: '/employer/jobs', label: 'My jobs', roles: ['employer'] },
  { to: '/employer/applicants', label: 'Applicants', roles: ['employer'] },
  { to: '/employer/candidates', label: 'Candidates', roles: ['employer'] },
  { to: '/employer/company', label: 'Company', roles: ['employer'] },
  { to: '/admin', label: 'Overview', roles: ['admin'] },
  { to: '/admin/employers', label: 'Employers', roles: ['admin'] },
  { to: '/admin/jobseekers', label: 'Job seekers', roles: ['admin'] },
  { to: '/admin/documents', label: 'Documents', roles: ['admin'] },
  { to: '/admin/users', label: 'Users', roles: ['admin'] },
]

function visibleNav(role: UserRole | null): NavItem[] {
  return NAV.filter((item) => {
    if (item.roles === 'public' || item.roles === undefined) {
      // Hide the public browse links from admins, who have their own workspace.
      return role !== 'admin'
    }
    return role !== null && item.roles.includes(role)
  })
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="WorkWise home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
        W
      </span>
      <span className="text-lg font-semibold tracking-tight text-ink-950">WorkWise</span>
    </Link>
  )
}

export default function Layout() {
  const { session, role, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const items = visibleNav(role)
  const displayName =
    session?.job_seeker_profile?.full_name ??
    session?.employer_profile?.company_name ??
    session?.user.username ??
    ''

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/employer' || item.to === '/admin'}
                  className={({ isActive }) =>
                    cx(
                      'rounded-lg px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="hidden items-center gap-3 md:flex">
                <span className="flex items-center gap-2 text-sm text-ink-700">
                  <Avatar
                    name={displayName}
                    src={session?.job_seeker_profile?.profile_image_url ?? undefined}
                    size={32}
                  />
                  <span className="max-w-[12rem] truncate font-medium">{displayName}</span>
                </span>
                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Create account</Button>
                </Link>
              </div>
            )}

            <button
              type="button"
              className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 md:hidden"
              aria-expanded={menuOpen}
              aria-label="Toggle navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? (
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-ink-200 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/employer' || item.to === '/admin'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'rounded-lg px-3 py-2 text-sm font-medium',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
              {isAuthenticated ? (
                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  Sign out
                </Button>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMenuOpen(false)}>
                    <Button variant="secondary" size="sm">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)}>
                    <Button size="sm">Create account</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>WorkWise — a job board built with FastAPI and React.</p>
          <a
            href="/docs"
            className="font-medium text-brand-700 hover:text-brand-800"
            target="_blank"
            rel="noreferrer"
          >
            API documentation
          </a>
        </div>
      </footer>
    </div>
  )
}
