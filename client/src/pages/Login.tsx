import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Alert, Button, Card, Field, Input } from '../components/ui'
import { homePathForRole, useAuth } from '../context/AuthContext'
import { errorMessage } from '../lib/useAsync'

interface LocationState {
  from?: { pathname: string }
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const session = await login(email.trim(), password)
      const state = location.state as LocationState | null
      navigate(state?.from?.pathname ?? homePathForRole(session.user.role), { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <h1 className="text-xl font-semibold tracking-tight text-ink-950">Sign in</h1>
        <p className="mt-1 text-sm text-ink-600">
          New here?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
            Create an account
          </Link>
          .
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email" htmlFor="login-email" required>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Password" htmlFor="login-password" required>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}

          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
        </form>
      </Card>

      <div className="mt-4 rounded-xl bg-white/60 p-4 text-sm text-ink-600 ring-1 ring-ink-100">
        <p className="font-medium text-ink-800">Demo accounts (after running the seed script)</p>
        <ul className="mt-2 space-y-1 font-mono text-xs">
          <li>admin@workwise.dev / admin1234</li>
          <li>hiring@northwind.dev / employer1234</li>
          <li>ada@example.com / seeker1234</li>
        </ul>
      </div>
    </div>
  )
}
