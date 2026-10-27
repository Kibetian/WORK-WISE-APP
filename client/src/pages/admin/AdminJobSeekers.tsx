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
import { formatDate, splitSkills } from '../../lib/format'
import { errorMessage, useAsync } from '../../lib/useAsync'

export default function AdminJobSeekers() {
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const result = useAsync(
    () =>
      admin.jobSeekers({
        verified: filter === '' ? undefined : filter === 'true',
        page,
      }),
    [filter, page],
  )

  const setVerified = async (id: number, verified: boolean) => {
    setBusyId(id)
    setError(null)
    try {
      await admin.setJobSeekerVerified(id, verified)
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
        title="Job seekers"
        description="Verification adds a badge employers can see on an applicant's profile."
      />

      <div className="mb-4 max-w-xs">
        <label htmlFor="seeker-filter" className="mb-1 block text-sm text-ink-600">
          Show
        </label>
        <Select
          id="seeker-filter"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value)
            setPage(1)
          }}
        >
          <option value="">All job seekers</option>
          <option value="false">Not verified</option>
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
              {result.data.items.map((seeker) => {
                const skills = splitSkills(seeker.skills)
                return (
                  <li key={seeker.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <Avatar name={seeker.full_name} src={seeker.profile_image_url} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-ink-950">
                          {seeker.full_name}
                        </h2>
                        <VerifiedBadge verified={seeker.verified} />
                      </div>
                      <p className="mt-0.5 text-sm text-ink-600">
                        {seeker.headline ?? 'No headline'}
                        {seeker.address ? ` · ${seeker.address}` : ''}
                      </p>
                      {skills.length > 0 && (
                        <p className="mt-0.5 text-xs text-ink-500">
                          {skills.slice(0, 6).join(' · ')}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-ink-500">
                        Joined {formatDate(seeker.created_at)}
                      </p>
                    </div>

                    <Button
                      variant={seeker.verified ? 'ghost' : 'primary'}
                      size="sm"
                      loading={busyId === seeker.id}
                      onClick={() => setVerified(seeker.id, !seeker.verified)}
                    >
                      {seeker.verified ? 'Remove verification' : 'Verify'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </Card>
          <Pagination page={result.data.page} pages={result.data.pages} onChange={setPage} />
        </>
      ) : (
        <EmptyState title="No job seekers match that filter" />
      )}
    </div>
  )
}
