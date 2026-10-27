import { useState } from 'react'

import { VerifiedBadge } from '../../components/StatusBadge'
import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  Loading,
  PageHeader,
  Pagination,
  Select,
} from '../../components/ui'
import { admin } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { errorMessage, useAsync } from '../../lib/useAsync'

export default function AdminEmployers() {
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const result = useAsync(
    () =>
      admin.employers({
        verified: filter === '' ? undefined : filter === 'true',
        page,
      }),
    [filter, page],
  )

  const setVerified = async (id: number, verified: boolean) => {
    setBusyId(id)
    setError(null)
    try {
      await admin.setEmployerVerified(id, verified)
      result.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Employers"
        description="Verify a company before it can publish roles on the board."
      />

      <div className="mb-4 max-w-xs">
        <label htmlFor="employer-filter" className="mb-1 block text-sm text-ink-600">
          Show
        </label>
        <Select
          id="employer-filter"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value)
            setPage(1)
          }}
        >
          <option value="">All employers</option>
          <option value="false">Awaiting verification</option>
          <option value="true">Verified</option>
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
              {result.data.items.map((employer) => (
                <li key={employer.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <Avatar name={employer.company_name} src={employer.logo_url} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-ink-950">
                        {employer.company_name}
                      </h2>
                      <VerifiedBadge verified={employer.verified} />
                    </div>
                    <p className="mt-0.5 text-sm text-ink-600">
                      {employer.email} · {employer.industry ?? 'Industry not set'}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {employer.job_count} {employer.job_count === 1 ? 'role' : 'roles'} ·
                      joined {formatDate(employer.created_at)}
                    </p>
                  </div>

                  <Button
                    variant={employer.verified ? 'ghost' : 'primary'}
                    size="sm"
                    loading={busyId === employer.id}
                    onClick={() => setVerified(employer.id, !employer.verified)}
                  >
                    {employer.verified ? 'Remove verification' : 'Verify'}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={result.data.page} pages={result.data.pages} onChange={setPage} />
        </>
      ) : (
        <EmptyState title="No employers match that filter" />
      )}
    </div>
  )
}
