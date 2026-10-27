import { Link } from 'react-router-dom'

import { EMPLOYMENT_TYPE_LABELS, formatRelative, formatSalary } from '../lib/format'
import type { Job } from '../lib/types'
import { Badge } from './ui'

export default function JobCard({ job }: { job: Job }) {
  return (
    <article className="group flex h-full flex-col rounded-xl bg-white p-5 shadow-card ring-1 ring-ink-100 transition hover:ring-brand-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink-950">
            <Link to={`/jobs/${job.id}`} className="hover:text-brand-700">
              <span className="absolute inset-0 hidden" aria-hidden="true" />
              {job.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-sm text-ink-600">
            {job.employer.company_name}
            {job.employer.verified && <span className="ml-1 text-brand-600">✓</span>}
          </p>
        </div>
        {job.status === 'closed' && <Badge tone="neutral">Closed</Badge>}
        {job.has_applied && <Badge tone="success">Applied</Badge>}
      </div>

      <p className="mt-3 line-clamp-3 text-sm text-ink-600">{job.description}</p>

      <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
        <div className="flex items-center gap-1">
          <dt className="sr-only">Location</dt>
          <dd>{job.location ?? 'Location flexible'}</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="sr-only">Employment type</dt>
          <dd>{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-ink-100 pt-4">
        <p className="text-sm font-medium text-ink-900">
          {formatSalary(job.salary_min, job.salary_max)}
        </p>
        <p className="text-xs text-ink-500">{formatRelative(job.created_at)}</p>
      </div>

      <Link
        to={`/jobs/${job.id}`}
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-ink-50 px-4 py-2 text-sm font-medium text-ink-800 transition group-hover:bg-brand-600 group-hover:text-white"
      >
        View role
      </Link>
    </article>
  )
}
