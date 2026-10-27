import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Loading,
  PageHeader,
  Pagination,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { employers, jobs as jobsApi } from '../../lib/api'
import { EMPLOYMENT_TYPE_LABELS, formatDate, formatSalary } from '../../lib/format'
import { errorMessage, useAsync } from '../../lib/useAsync'

export default function EmployerJobs() {
  const { session } = useAuth()
  const company = session?.employer_profile ?? null

  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const result = useAsync(
    () => (company ? employers.myJobs({ page, page_size: 10 }) : Promise.resolve(null)),
    [company?.id, page],
  )

  const toggleStatus = async (id: number, current: 'open' | 'closed') => {
    setBusyId(id)
    setError(null)
    try {
      await jobsApi.update(id, { status: current === 'open' ? 'closed' : 'open' })
      result.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: number, title: string) => {
    if (!window.confirm(`Delete "${title}"? Its applications are removed too.`)) return
    setBusyId(id)
    setError(null)
    try {
      await jobsApi.remove(id)
      result.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusyId(null)
    }
  }

  if (!company) {
    return (
      <div>
        <PageHeader title="My jobs" />
        <EmptyState
          title="Set up your company profile first"
          action={
            <Link to="/employer/company">
              <Button>Create company profile</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="My jobs"
        description="Everything you have published, open or closed."
        actions={
          <Link to="/employer/jobs/new">
            <Button disabled={!company.verified}>Post a job</Button>
          </Link>
        }
      />

      {!company.verified && (
        <div className="mb-4">
          <Alert tone="warning">
            Your company is awaiting verification, so new roles cannot be published yet.
          </Alert>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <Alert tone="danger">{result.error}</Alert>
      ) : result.data && result.data.items.length > 0 ? (
        <>
          <Card className="p-0">
            <ul className="divide-y divide-ink-100">
              {result.data.items.map((job) => (
                <li key={job.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="text-sm font-semibold text-ink-900 hover:text-brand-700"
                        >
                          {job.title}
                        </Link>
                        <Badge tone={job.status === 'open' ? 'success' : 'neutral'}>
                          {job.status === 'open' ? 'Open' : 'Closed'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink-600">
                        {EMPLOYMENT_TYPE_LABELS[job.employment_type]}
                        {job.location ? ` · ${job.location}` : ''} ·{' '}
                        {formatSalary(job.salary_min, job.salary_max)}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        Posted {formatDate(job.created_at)} · {job.application_count}{' '}
                        {job.application_count === 1 ? 'applicant' : 'applicants'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link to={`/employer/applicants?job_id=${job.id}`}>
                        <Button variant="secondary" size="sm">
                          Applicants
                        </Button>
                      </Link>
                      <Link to={`/employer/jobs/${job.id}/edit`}>
                        <Button variant="secondary" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busyId === job.id}
                        onClick={() => toggleStatus(job.id, job.status)}
                      >
                        {job.status === 'open' ? 'Close' : 'Reopen'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => remove(job.id, job.title)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={result.data.page} pages={result.data.pages} onChange={setPage} />
        </>
      ) : (
        <EmptyState
          title="No roles yet"
          description="Publish your first role and it will appear on the public job board."
          action={
            <Link to="/employer/jobs/new">
              <Button disabled={!company.verified}>Post a job</Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
