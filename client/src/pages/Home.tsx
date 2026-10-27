import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import JobCard from '../components/JobCard'
import { Alert, Button, Input, Loading } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { jobs } from '../lib/api'
import { useAsync } from '../lib/useAsync'

export default function Home() {
  const navigate = useNavigate()
  const { isAuthenticated, role } = useAuth()
  const [query, setQuery] = useState('')

  const recent = useAsync(() => jobs.list({ page_size: 6, sort: 'newest' }), [])

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    navigate(`/jobs?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="space-y-12">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-6 py-14 text-center text-white sm:px-12">
        <h1 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Find work that fits, or find the person who fits the work
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-brand-100">
          WorkWise connects candidates and employers. Build a profile, publish a role,
          and keep track of every application in one place.
        </p>

        <form onSubmit={search} className="mx-auto mt-8 flex max-w-xl gap-2">
          <label htmlFor="home-search" className="sr-only">
            Search jobs
          </label>
          <Input
            id="home-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Job title, skill or company"
            className="flex-1"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {!isAuthenticated && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link to="/register" className="font-semibold underline underline-offset-4">
              Create an account
            </Link>
            <span className="text-brand-200">or</span>
            <Link to="/login" className="font-semibold underline underline-offset-4">
              sign in
            </Link>
          </div>
        )}
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink-950">
              Recently posted
            </h2>
            <p className="mt-1 text-sm text-ink-600">The newest roles on the board.</p>
          </div>
          <Link
            to="/jobs"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            See all jobs →
          </Link>
        </div>

        {recent.loading ? (
          <Loading />
        ) : recent.error ? (
          <Alert tone="danger" title="Could not load jobs">
            {recent.error}
          </Alert>
        ) : recent.data && recent.data.items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.data.items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <Alert tone="neutral" title="No jobs yet">
            Once an employer publishes a role it will appear here. If you are setting this
            up for the first time, run <code className="font-mono">python seed.py</code> in
            the server folder to load sample data.
          </Alert>
        )}
      </section>

      {role === 'employer' && (
        <section className="rounded-xl bg-white p-6 shadow-card ring-1 ring-ink-100">
          <h2 className="text-lg font-semibold text-ink-950">Hiring?</h2>
          <p className="mt-1 text-sm text-ink-600">
            Publish a role and review applicants from your employer dashboard.
          </p>
          <Link to="/employer/jobs/new" className="mt-4 inline-block">
            <Button>Post a job</Button>
          </Link>
        </section>
      )}
    </div>
  )
}
