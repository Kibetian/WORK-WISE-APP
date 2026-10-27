import { Link } from 'react-router-dom'

import { ApplicationStatusBadge, VerifiedBadge } from '../../components/StatusBadge'
import { Alert, Button, Card, EmptyState, Loading, PageHeader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { applications, employers } from '../../lib/api'
import { formatRelative } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink-950">{value}</p>
    </Card>
  )
}

export default function EmployerOverview() {
  const { session } = useAuth()
  const company = session?.employer_profile ?? null

  const myJobs = useAsync(
    () => (company ? employers.myJobs({ page_size: 100 }) : Promise.resolve(null)),
    [company?.id],
  )
  const inbox = useAsync(
    () => (company ? applications.received({ page_size: 5 }) : Promise.resolve(null)),
    [company?.id],
  )

  if (!company) {
    return (
      <div>
        <PageHeader title="Employer dashboard" />
        <EmptyState
          title="Set up your company profile"
          description="Candidates see your company name and description on every role you publish."
          action={
            <Link to="/employer/company">
              <Button>Create company profile</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const jobs = myJobs.data?.items ?? []
  const openJobs = jobs.filter((job) => job.status === 'open').length
  const totalApplicants = jobs.reduce((sum, job) => sum + job.application_count, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.company_name}
        description={company.industry ?? 'Your hiring workspace.'}
        actions={
          <Link to="/employer/jobs/new">
            <Button disabled={!company.verified}>Post a job</Button>
          </Link>
        }
      />

      {!company.verified && (
        <Alert tone="warning" title="Awaiting verification">
          An administrator needs to verify this company before you can publish roles.
          Everything else on your account works in the meantime.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Open roles" value={myJobs.loading ? '—' : openJobs} />
        <Stat label="Total roles" value={myJobs.loading ? '—' : jobs.length} />
        <Stat label="Applicants" value={myJobs.loading ? '—' : totalApplicants} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-950">Your roles</h2>
            <Link
              to="/employer/jobs"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Manage →
            </Link>
          </div>

          {myJobs.loading ? (
            <Loading label="Loading roles…" />
          ) : jobs.length > 0 ? (
            <ul className="mt-4 divide-y divide-ink-100">
              {jobs.slice(0, 5).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{job.title}</p>
                    <p className="text-sm text-ink-500">
                      {job.application_count}{' '}
                      {job.application_count === 1 ? 'applicant' : 'applicants'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-500">
                    {job.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-600">No roles published yet.</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-950">Recent applicants</h2>
            <Link
              to="/employer/applicants"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Review →
            </Link>
          </div>

          {inbox.loading ? (
            <Loading label="Loading applicants…" />
          ) : inbox.data && inbox.data.items.length > 0 ? (
            <ul className="mt-4 divide-y divide-ink-100">
              {inbox.data.items.map((application) => (
                <li key={application.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {application.applicant?.full_name ?? 'Candidate'}
                    </p>
                    <p className="truncate text-sm text-ink-500">
                      {application.job.title} · {formatRelative(application.created_at)}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={application.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-600">No applications received yet.</p>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-950">Company profile</h2>
            <div className="mt-2">
              <VerifiedBadge verified={company.verified} />
            </div>
          </div>
          <Link to="/employer/company">
            <Button variant="secondary">Edit company</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
