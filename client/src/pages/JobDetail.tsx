import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Alert, Badge, Button, Card, Loading, Textarea } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { applications, jobs } from '../lib/api'
import { EMPLOYMENT_TYPE_LABELS, formatDate, formatSalary } from '../lib/format'
import { errorMessage, useAsync } from '../lib/useAsync'

export default function JobDetail() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, role, session } = useAuth()

  const id = Number(jobId)
  const job = useAsync(() => jobs.get(id), [id])

  const [coverLetter, setCoverLetter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  const hasProfile = session?.job_seeker_profile != null

  const apply = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await applications.apply({
        job_id: id,
        cover_letter: coverLetter.trim() || undefined,
      })
      setApplied(true)
      job.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  if (job.loading) return <Loading />
  if (job.error || !job.data) {
    return (
      <div className="space-y-4">
        <Alert tone="danger" title="Job unavailable">
          {job.error ?? 'That job could not be found.'}
        </Alert>
        <Button variant="secondary" onClick={() => navigate('/jobs')}>
          Back to all jobs
        </Button>
      </div>
    )
  }

  const data = job.data
  const alreadyApplied = applied || data.has_applied

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <article className="space-y-6">
        <header>
          <Link to="/jobs" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            ← All jobs
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink-950">
            {data.title}
          </h1>
          <p className="mt-1 text-ink-600">
            {data.employer.company_name}
            {data.employer.industry ? ` · ${data.employer.industry}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="info">{EMPLOYMENT_TYPE_LABELS[data.employment_type]}</Badge>
            {data.location && <Badge>{data.location}</Badge>}
            {data.status === 'closed' && <Badge tone="danger">Closed</Badge>}
            {data.employer.verified && <Badge tone="success">Verified employer</Badge>}
          </div>
        </header>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            About the role
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">
            {data.description}
          </p>
        </Card>

        {data.requirements && (
          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              What they are looking for
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">
              {data.requirements}
            </p>
          </Card>
        )}
      </article>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <p className="text-lg font-semibold text-ink-950">
            {formatSalary(data.salary_min, data.salary_max)}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Posted</dt>
              <dd className="text-ink-800">{formatDate(data.created_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Applicants</dt>
              <dd className="text-ink-800">{data.application_count}</dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-ink-100 pt-5">
            {!isAuthenticated ? (
              <>
                <p className="text-sm text-ink-600">Sign in as a job seeker to apply.</p>
                <Link to="/login" className="mt-3 block">
                  <Button className="w-full">Sign in to apply</Button>
                </Link>
              </>
            ) : role !== 'job_seeker' ? (
              <p className="text-sm text-ink-600">
                You are signed in as {role === 'employer' ? 'an employer' : 'an administrator'},
                so applying is not available on this account.
              </p>
            ) : alreadyApplied ? (
              <Alert tone="success" title="Application sent">
                Track its progress under{' '}
                <Link to="/applications" className="font-medium underline">
                  my applications
                </Link>
                .
              </Alert>
            ) : !hasProfile ? (
              <>
                <p className="text-sm text-ink-600">
                  Create your profile first so employers know who is applying.
                </p>
                <Link to="/profile" className="mt-3 block">
                  <Button className="w-full">Complete my profile</Button>
                </Link>
              </>
            ) : data.status === 'closed' ? (
              <p className="text-sm text-ink-600">This role is no longer accepting applications.</p>
            ) : (
              <div className="space-y-3">
                <label htmlFor="cover-letter" className="block text-sm font-medium text-ink-800">
                  Message to the employer <span className="text-ink-400">(optional)</span>
                </label>
                <Textarea
                  id="cover-letter"
                  rows={5}
                  value={coverLetter}
                  onChange={(event) => setCoverLetter(event.target.value)}
                  placeholder="A few lines on why this role interests you."
                />
                {error && <Alert tone="danger">{error}</Alert>}
                <Button className="w-full" loading={submitting} onClick={apply}>
                  Submit application
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-ink-900">
            About {data.employer.company_name}
          </h2>
          {data.employer.location && (
            <p className="mt-1 text-sm text-ink-600">{data.employer.location}</p>
          )}
          <Link
            to={`/jobs?employer_id=${data.employer.id}`}
            className="mt-3 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            See their other roles →
          </Link>
        </Card>
      </aside>
    </div>
  )
}
