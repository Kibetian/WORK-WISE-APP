import { Link } from 'react-router-dom'

import { Alert, Card, Loading, PageHeader } from '../../components/ui'
import { admin } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'

function Stat({
  label,
  value,
  hint,
  to,
}: {
  label: string
  value: number
  hint?: string
  to?: string
}) {
  const body = (
    <Card className="h-full transition hover:ring-brand-200">
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-ink-950">{value}</p>
      {hint && <p className="mt-1 text-sm text-ink-500">{hint}</p>}
    </Card>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export default function AdminOverview() {
  const stats = useAsync(() => admin.stats(), [])

  if (stats.loading) return <Loading />
  if (stats.error || !stats.data) {
    return <Alert tone="danger">{stats.error ?? 'Could not load platform statistics.'}</Alert>
  }

  const data = stats.data

  return (
    <div>
      <PageHeader
        title="Platform overview"
        description="Everything happening on WorkWise at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total users" value={data.total_users} to="/admin/users" />
        <Stat
          label="Employers"
          value={data.employers}
          hint={`${data.verified_employers} verified`}
          to="/admin/employers"
        />
        <Stat
          label="Job seekers"
          value={data.job_seekers}
          hint={`${data.verified_job_seekers} verified`}
          to="/admin/jobseekers"
        />
        <Stat
          label="Documents to review"
          value={data.pending_documents}
          hint="Awaiting approval"
          to="/admin/documents"
        />
        <Stat label="Jobs posted" value={data.total_jobs} hint={`${data.open_jobs} open`} />
        <Stat label="Applications" value={data.total_applications} />
      </div>

      {data.pending_documents > 0 && (
        <div className="mt-6">
          <Alert tone="warning" title="Review queue">
            {data.pending_documents}{' '}
            {data.pending_documents === 1 ? 'document is' : 'documents are'} waiting for a
            decision.{' '}
            <Link to="/admin/documents" className="font-medium underline">
              Open the queue
            </Link>
            .
          </Alert>
        </div>
      )}

      {data.employers > data.verified_employers && (
        <div className="mt-4">
          <Alert tone="info" title="Unverified employers">
            {data.employers - data.verified_employers} employer
            {data.employers - data.verified_employers === 1 ? '' : 's'} cannot post jobs until
            verified.{' '}
            <Link to="/admin/employers" className="font-medium underline">
              Review them
            </Link>
            .
          </Alert>
        </div>
      )}
    </div>
  )
}
