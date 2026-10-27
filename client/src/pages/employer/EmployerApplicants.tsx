import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ApplicationStatusBadge } from '../../components/StatusBadge'
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
import { useAuth } from '../../context/AuthContext'
import { applications, employers } from '../../lib/api'
import { APPLICATION_STATUS_LABELS, formatDate, splitSkills } from '../../lib/format'
import type { ApplicationStatus } from '../../lib/types'
import { errorMessage, useAsync } from '../../lib/useAsync'

const NEXT_ACTIONS: ApplicationStatus[] = [
  'applied',
  'reviewing',
  'shortlisted',
  'hired',
  'rejected',
]

export default function EmployerApplicants() {
  const { session } = useAuth()
  const company = session?.employer_profile ?? null

  const [params, setParams] = useSearchParams()
  const jobFilter = params.get('job_id') ?? ''
  const statusFilter = params.get('status') ?? ''
  const page = Number(params.get('page') ?? '1')

  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const myJobs = useAsync(
    () => (company ? employers.myJobs({ page_size: 100 }) : Promise.resolve(null)),
    [company?.id],
  )

  const result = useAsync(
    () =>
      company
        ? applications.received({
            job_id: jobFilter ? Number(jobFilter) : undefined,
            application_status: statusFilter || undefined,
            page,
            page_size: 10,
          })
        : Promise.resolve(null),
    [company?.id, jobFilter, statusFilter, page],
  )

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next)
  }

  const changeStatus = async (id: number, status: ApplicationStatus) => {
    setBusyId(id)
    setError(null)
    try {
      await applications.setStatus(id, status)
      result.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusyId(null)
    }
  }

  const goToPage = (next: number) => {
    const updated = new URLSearchParams(params)
    updated.set('page', String(next))
    setParams(updated)
  }

  if (!company) {
    return (
      <div>
        <PageHeader title="Applicants" />
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
        title="Applicants"
        description="Everyone who has applied to your roles, newest first."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[14rem]">
          <label htmlFor="job-filter" className="mb-1 block text-sm text-ink-600">
            Role
          </label>
          <Select
            id="job-filter"
            value={jobFilter}
            onChange={(event) => setFilter('job_id', event.target.value)}
          >
            <option value="">All roles</option>
            {myJobs.data?.items.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[12rem]">
          <label htmlFor="applicant-status" className="mb-1 block text-sm text-ink-600">
            Status
          </label>
          <Select
            id="applicant-status"
            value={statusFilter}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
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
          <div className="space-y-4">
            {result.data.items.map((application) => {
              const applicant = application.applicant
              const skills = splitSkills(applicant?.skills ?? null)
              return (
                <Card key={application.id}>
                  <div className="flex flex-wrap items-start gap-4">
                    <Avatar
                      name={applicant?.full_name ?? 'Candidate'}
                      src={applicant?.profile_image_url}
                      size={48}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-ink-950">
                          {applicant?.full_name ?? 'Candidate'}
                        </h2>
                        {applicant?.verified && (
                          <span className="text-sm text-brand-600" title="Verified profile">
                            ✓
                          </span>
                        )}
                        <ApplicationStatusBadge status={application.status} />
                      </div>

                      <p className="mt-0.5 text-sm text-ink-600">
                        {applicant?.headline ?? 'No headline'}
                        {applicant?.address ? ` · ${applicant.address}` : ''}
                      </p>
                      <p className="mt-1 text-sm text-ink-500">
                        Applied to <span className="font-medium">{application.job.title}</span> on{' '}
                        {formatDate(application.created_at)}
                      </p>

                      {skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {skills.slice(0, 10).map((skill) => (
                            <span
                              key={skill}
                              className="rounded-md bg-ink-100 px-2 py-0.5 text-xs text-ink-700"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      {application.cover_letter && (
                        <p className="mt-3 whitespace-pre-line rounded-lg bg-ink-50 p-3 text-sm text-ink-700">
                          {application.cover_letter}
                        </p>
                      )}
                    </div>

                    <div className="w-full sm:w-48">
                      <label
                        htmlFor={`status-${application.id}`}
                        className="mb-1 block text-sm text-ink-600"
                      >
                        Move to
                      </label>
                      <Select
                        id={`status-${application.id}`}
                        value={application.status}
                        disabled={busyId === application.id}
                        onChange={(event) =>
                          changeStatus(application.id, event.target.value as ApplicationStatus)
                        }
                      >
                        {NEXT_ACTIONS.map((status) => (
                          <option key={status} value={status}>
                            {APPLICATION_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </Select>
                      {applicant && (
                        <p className="mt-2 text-sm text-ink-500">
                          {applicant.salary_expectation
                            ? `Expects ${applicant.salary_expectation.toLocaleString()}`
                            : 'No salary expectation given'}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
          <Pagination page={result.data.page} pages={result.data.pages} onChange={goToPage} />
        </>
      ) : (
        <EmptyState
          title="No applicants yet"
          description={
            jobFilter || statusFilter
              ? 'Nothing matches those filters.'
              : 'Applications to your roles will appear here.'
          }
        />
      )}
    </div>
  )
}
