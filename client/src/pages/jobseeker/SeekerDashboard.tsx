import { Link } from 'react-router-dom'

import { ApplicationStatusBadge, VerifiedBadge } from '../../components/StatusBadge'
import { Alert, Button, Card, EmptyState, Loading, PageHeader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { applications, jobSeekers } from '../../lib/api'
import { formatRelative, splitSkills } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink-950">{value}</p>
    </Card>
  )
}

export default function SeekerDashboard() {
  const { session } = useAuth()
  const profile = session?.job_seeker_profile ?? null

  const recent = useAsync(() => applications.mine({ page_size: 5 }), [])
  const documents = useAsync(
    () => (profile ? jobSeekers.myDocuments() : Promise.resolve([])),
    [profile?.id],
  )

  if (!profile) {
    return (
      <div>
        <PageHeader
          title={`Welcome, ${session?.user.username ?? 'there'}`}
          description="One step before you can apply for roles."
        />
        <EmptyState
          title="Your profile is empty"
          description="Employers see your profile when you apply, so it is worth filling in before your first application."
          action={
            <Link to="/profile">
              <Button>Create my profile</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const skills = splitSkills(profile.skills)
  const pendingDocuments =
    documents.data?.filter((document) => document.status === 'pending').length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${profile.full_name.split(' ')[0]}`}
        description={profile.headline ?? 'Keep your profile current so employers see your latest work.'}
        actions={
          <Link to="/jobs">
            <Button>Browse jobs</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Applications sent" value={recent.data?.total ?? '—'} />
        <Stat label="Documents uploaded" value={documents.data?.length ?? '—'} />
        <Stat label="Awaiting review" value={pendingDocuments} />
      </div>

      {!profile.verified && (
        <Alert tone="warning" title="Profile not yet verified">
          An administrator reviews new profiles. You can apply for roles in the meantime —
          verification simply adds a badge employers can see.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-950">Recent applications</h2>
            <Link
              to="/applications"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              See all →
            </Link>
          </div>

          {recent.loading ? (
            <Loading label="Loading applications…" />
          ) : recent.error ? (
            <Alert tone="danger">{recent.error}</Alert>
          ) : recent.data && recent.data.items.length > 0 ? (
            <ul className="mt-4 divide-y divide-ink-100">
              {recent.data.items.map((application) => (
                <li key={application.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      to={`/jobs/${application.job.id}`}
                      className="block truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                    >
                      {application.job.title}
                    </Link>
                    <p className="truncate text-sm text-ink-500">
                      {application.job.company_name} · {formatRelative(application.created_at)}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={application.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-600">
              No applications yet.{' '}
              <Link to="/jobs" className="font-medium text-brand-700">
                Find a role to apply for
              </Link>
              .
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-base font-semibold text-ink-950">Your profile</h2>
            <div className="mt-3 space-y-2 text-sm">
              <VerifiedBadge verified={profile.verified} />
              <p className="text-ink-600">{profile.address ?? 'Location not set'}</p>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skills.slice(0, 8).map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md bg-ink-100 px-2 py-0.5 text-xs text-ink-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Link to="/profile" className="mt-4 block">
              <Button variant="secondary" className="w-full">
                Edit profile
              </Button>
            </Link>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-ink-950">Documents</h2>
            <p className="mt-1 text-sm text-ink-600">
              {documents.data?.length
                ? `${documents.data.length} on file`
                : 'No CV or certificates uploaded yet.'}
            </p>
            <Link to="/documents" className="mt-4 block">
              <Button variant="secondary" className="w-full">
                Manage documents
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
