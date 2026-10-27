import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Alert, Button, Card, Field, Input, cx } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../lib/useAsync'

type Role = 'job_seeker' | 'employer'

const ROLE_COPY: Record<Role, { title: string; blurb: string }> = {
  job_seeker: {
    title: 'I am looking for work',
    blurb: 'Build a profile, upload your CV and apply to roles.',
  },
  employer: {
    title: 'I am hiring',
    blurb: 'Publish roles and review applicants. An admin verifies you first.',
  },
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [role, setRole] = useState<Role>('job_seeker')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      })
      // A fresh account has no profile yet, so send them straight to it.
      navigate(role === 'employer' ? '/employer/company' : '/profile', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <h1 className="text-xl font-semibold tracking-tight text-ink-950">Create your account</h1>
        <p className="mt-1 text-sm text-ink-600">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Sign in
          </Link>
          .
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <fieldset>
            <legend className="text-sm font-medium text-ink-800">I am here to…</legend>
            <div className="mt-2 grid gap-2">
              {(Object.keys(ROLE_COPY) as Role[]).map((value) => (
                <label
                  key={value}
                  className={cx(
                    'cursor-pointer rounded-lg border p-3 transition',
                    role === value
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-ink-200 hover:border-ink-300',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium text-ink-900">
                    {ROLE_COPY[value].title}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-600">
                    {ROLE_COPY[value].blurb}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Username" htmlFor="register-username" required>
            <Input
              id="register-username"
              autoComplete="username"
              required
              minLength={3}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </Field>

          <Field label="Email" htmlFor="register-email" required>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="register-password"
            hint="At least 8 characters."
            required
          >
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}

          <Button type="submit" className="w-full" loading={submitting}>
            Create account
          </Button>
        </form>
      </Card>
    </div>
  )
}
