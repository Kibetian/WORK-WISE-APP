import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import JobCard from '../components/JobCard'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Loading,
  Pagination,
  Select,
} from '../components/ui'
import { jobs } from '../lib/api'
import { EMPLOYMENT_TYPE_LABELS } from '../lib/format'
import { useAsync } from '../lib/useAsync'

export default function Jobs() {
  const [params, setParams] = useSearchParams()

  const [q, setQ] = useState(params.get('q') ?? '')
  const [location, setLocation] = useState(params.get('location') ?? '')
  const [employmentType, setEmploymentType] = useState(params.get('employment_type') ?? '')
  const [salaryMin, setSalaryMin] = useState(params.get('salary_min') ?? '')
  const [sort, setSort] = useState(params.get('sort') ?? 'newest')
  const page = Number(params.get('page') ?? '1')

  // Keep the inputs in step when the user navigates with the back button.
  useEffect(() => {
    setQ(params.get('q') ?? '')
    setLocation(params.get('location') ?? '')
    setEmploymentType(params.get('employment_type') ?? '')
    setSalaryMin(params.get('salary_min') ?? '')
    setSort(params.get('sort') ?? 'newest')
  }, [params])

  const result = useAsync(
    () =>
      jobs.list({
        q: params.get('q') ?? undefined,
        location: params.get('location') ?? undefined,
        employment_type: params.get('employment_type') ?? undefined,
        salary_min: params.get('salary_min') ? Number(params.get('salary_min')) : undefined,
        employer_id: params.get('employer_id') ? Number(params.get('employer_id')) : undefined,
        sort: params.get('sort') ?? 'newest',
        page,
        page_size: 12,
      }),
    [params.toString()],
  )

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault()
    const next = new URLSearchParams()
    if (q.trim()) next.set('q', q.trim())
    if (location.trim()) next.set('location', location.trim())
    if (employmentType) next.set('employment_type', employmentType)
    if (salaryMin) next.set('salary_min', salaryMin)
    if (sort !== 'newest') next.set('sort', sort)
    const employerId = params.get('employer_id')
    if (employerId) next.set('employer_id', employerId)
    setParams(next)
  }

  const clearFilters = () => setParams(new URLSearchParams())

  const goToPage = (next: number) => {
    const updated = new URLSearchParams(params)
    updated.set('page', String(next))
    setParams(updated)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasFilters = Array.from(params.keys()).filter((key) => key !== 'page').length > 0

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <form onSubmit={applyFilters} className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              Filter
            </h2>

            <Field label="Keywords" htmlFor="filter-q">
              <Input
                id="filter-q"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Title, skill, company"
              />
            </Field>

            <Field label="Location" htmlFor="filter-location">
              <Input
                id="filter-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="City or 'remote'"
              />
            </Field>

            <Field label="Employment type" htmlFor="filter-type">
              <Select
                id="filter-type"
                value={employmentType}
                onChange={(event) => setEmploymentType(event.target.value)}
              >
                <option value="">Any</option>
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Minimum salary" htmlFor="filter-salary">
              <Input
                id="filter-salary"
                type="number"
                min={0}
                step={1000}
                value={salaryMin}
                onChange={(event) => setSalaryMin(event.target.value)}
                placeholder="e.g. 80000"
              />
            </Field>

            <Field label="Sort by" htmlFor="filter-sort">
              <Select
                id="filter-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="salary_high">Highest salary</option>
                <option value="salary_low">Lowest salary</option>
                <option value="title">Title A–Z</option>
              </Select>
            </Field>

            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1">
                Apply
              </Button>
              {hasFilters && (
                <Button type="button" variant="secondary" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </form>
        </Card>
      </aside>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Open roles</h1>
          {result.data && (
            <p className="text-sm text-ink-600">
              {result.data.total} {result.data.total === 1 ? 'role' : 'roles'}
            </p>
          )}
        </div>

        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <Alert tone="danger" title="Could not load jobs">
            {result.error}
          </Alert>
        ) : result.data && result.data.items.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {result.data.items.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
            <Pagination page={result.data.page} pages={result.data.pages} onChange={goToPage} />
          </>
        ) : (
          <EmptyState
            title="No roles match those filters"
            description="Try widening the search, or clear the filters to see everything on the board."
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  )
}
