import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ApplicationStatusBadge } from '../../components/StatusBadge'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Loading,
  PageHeader,
  Pagination,
  Select,
} from '../../components/ui'
import { applications } from '../../lib/api'
import { APPLICATION_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, formatDate } from '../../lib/format'
import { errorMessage, useAsync } from '../../lib/useAsync'

export default function SeekerApplications() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const result = useAsync(
    () =>
      applications.mine({
        application_status: status || undefined,
        page,
        page_size: 10,
      }),
    [status, page],
  )

  const withdraw = async (id: number) => {
    setError(null)
    try {
      await applications.withdraw(id)
      result.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div>
      <PageHeader
        title="My applications"
        description="Every role you have applied for, and where each one stands."
        actions={
          <Link to="/jobs">
            <Button variant="secondary">Find more roles</Button>
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="status-filter" className="text-sm text-ink-600">
          Status
        </label>
        <Select
          id="status-filter"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          className="max-w-[14rem]"
        >
          <option value="">All</option>
          {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

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
              {result.data.items.map((application) => (
                <li key={application.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/jobs/${application.job.id}`}
                        className="text-sm font-semibold text-ink-900 hover:text-brand-700"
                      >
                        {application.job.title}
                      </Link>
                      <p className="mt-0.5 text-sm text-ink-600">
                        {application.job.company_name} ·{' '}
                        {EMPLOYMENT_TYPE_LABELS[application.job.employment_type]}
                        {application.job.location ? ` · ${application.job.location}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        Applied {formatDate(application.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ApplicationStatusBadge status={application.status} />
                      {application.status === 'applied' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => withdraw(application.id)}
                        >
                          Withdraw
                        </Button>
                      )}
                    </div>
                  </div>

                  {application.cover_letter && (
                    <p className="mt-3 line-clamp-2 rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
                      {application.cover_letter}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={result.data.page} pages={result.data.pages} onChange={setPage} />
        </>
      ) : (
        <EmptyState
          title={status ? 'Nothing with that status' : 'No applications yet'}
          description={
            status
              ? 'Try a different status filter.'
              : 'When you apply for a role it will show up here.'
          }
          action={
            <Link to="/jobs">
              <Button>Browse jobs</Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
