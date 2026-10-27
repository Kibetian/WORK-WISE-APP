import { useState } from 'react'

import { VerifiedBadge } from '../../components/StatusBadge'
import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
  PageHeader,
  Pagination,
} from '../../components/ui'
import { jobSeekers } from '../../lib/api'
import { splitSkills } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'

export default function EmployerCandidates() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const result = useAsync(
    () => jobSeekers.list({ q: query || undefined, page, page_size: 12 }),
    [query, page],
  )

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    setQuery(input.trim())
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        title="Candidates"
        description="Search the profiles of everyone looking for work on WorkWise."
      />

      <form onSubmit={search} className="mb-6 flex max-w-md gap-2">
        <label htmlFor="candidate-search" className="sr-only">
          Search candidates
        </label>
        <Input
          id="candidate-search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Name, headline or skill"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <Alert tone="danger">{result.error}</Alert>
      ) : result.data && result.data.items.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.items.map((candidate) => {
              const skills = splitSkills(candidate.skills)
              return (
                <Card key={candidate.id} className="flex h-full flex-col">
                  <div className="flex items-center gap-3">
                    <Avatar name={candidate.full_name} src={candidate.profile_image_url} />
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-ink-950">
                        {candidate.full_name}
                      </h2>
                      <p className="truncate text-sm text-ink-600">
                        {candidate.headline ?? 'No headline'}
                      </p>
                    </div>
                  </div>

                  {candidate.summary && (
                    <p className="mt-3 line-clamp-3 text-sm text-ink-600">{candidate.summary}</p>
                  )}

                  {skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {skills.slice(0, 6).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-md bg-ink-100 px-2 py-0.5 text-xs text-ink-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4 text-sm">
                    <VerifiedBadge verified={candidate.verified} />
                    <span className="text-ink-500">
                      {candidate.address ?? 'Location not set'}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
          <Pagination page={result.data.page} pages={result.data.pages} onChange={setPage} />
        </>
      ) : (
        <EmptyState
          title="No candidates found"
          description={
            query
              ? 'Nobody matches that search yet.'
              : 'Job seeker profiles will appear here as people sign up.'
          }
        />
      )}
    </div>
  )
}
