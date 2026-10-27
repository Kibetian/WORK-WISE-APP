import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { VerifiedBadge } from '../components/StatusBadge'
import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
  Pagination,
} from '../components/ui'
import { employers } from '../lib/api'
import { useAsync } from '../lib/useAsync'

export default function Companies() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const page = Number(params.get('page') ?? '1')

  const result = useAsync(
    () => employers.list({ q: params.get('q') ?? undefined, page, page_size: 12 }),
    [params.toString()],
  )

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    const next = new URLSearchParams()
    if (query.trim()) next.set('q', query.trim())
    setParams(next)
  }

  const goToPage = (next: number) => {
    const updated = new URLSearchParams(params)
    updated.set('page', String(next))
    setParams(updated)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Companies</h1>
          <p className="mt-1 text-sm text-ink-600">Everyone currently hiring on WorkWise.</p>
        </div>
        <form onSubmit={search} className="flex gap-2">
          <label htmlFor="company-search" className="sr-only">
            Search companies
          </label>
          <Input
            id="company-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or industry"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <Alert tone="danger" title="Could not load companies">
          {result.error}
        </Alert>
      ) : result.data && result.data.items.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.items.map((company) => (
              <Card key={company.id} className="flex h-full flex-col">
                <div className="flex items-center gap-3">
                  <Avatar name={company.company_name} src={company.logo_url} />
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-ink-950">
                      {company.company_name}
                    </h2>
                    <p className="truncate text-sm text-ink-600">
                      {company.industry ?? 'Industry not listed'}
                    </p>
                  </div>
                </div>

                {company.company_description && (
                  <p className="mt-3 line-clamp-3 text-sm text-ink-600">
                    {company.company_description}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4">
                  <VerifiedBadge verified={company.verified} />
                  <Link
                    to={`/jobs?employer_id=${company.id}`}
                    className="text-sm font-medium text-brand-700 hover:text-brand-800"
                  >
                    Open roles →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={result.data.page} pages={result.data.pages} onChange={goToPage} />
        </>
      ) : (
        <EmptyState
          title="No companies found"
          description="No employer profiles match that search yet."
        />
      )}
    </div>
  )
}
