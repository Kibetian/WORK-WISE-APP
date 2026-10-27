import { useState } from 'react'

import { DocumentStatusBadge } from '../../components/StatusBadge'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
  PageHeader,
  Pagination,
  Select,
} from '../../components/ui'
import { admin } from '../../lib/api'
import { formatBytes, formatDate } from '../../lib/format'
import { errorMessage, useAsync } from '../../lib/useAsync'

export default function AdminDocuments() {
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const result = useAsync(
    () => admin.documents({ document_status: status || undefined, page }),
    [status, page],
  )

  const review = async (id: number, decision: 'approved' | 'rejected') => {
    setBusyId(id)
    setError(null)
    try {
      await admin.reviewDocument(id, decision, notes[id]?.trim() || undefined)
      setNotes((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
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
        title="Document review"
        description="Approve or reject the files candidates have uploaded."
      />

      <div className="mb-4 max-w-xs">
        <label htmlFor="document-status" className="mb-1 block text-sm text-ink-600">
          Show
        </label>
        <Select
          id="document-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
        >
          <option value="pending">Awaiting review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
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
          <div className="space-y-4">
            {result.data.items.map((document) => (
              <Card key={document.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-ink-950 hover:text-brand-700"
                      >
                        {document.original_name}
                      </a>
                      <DocumentStatusBadge status={document.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {document.job_seeker_name} · {document.job_seeker_email}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {document.document_type.replace('_', ' ')} ·{' '}
                      {formatBytes(document.size_bytes)} · uploaded{' '}
                      {formatDate(document.uploaded_at)}
                    </p>
                    {document.review_note && (
                      <p className="mt-2 text-sm text-ink-600">
                        Previous note: {document.review_note}
                      </p>
                    )}
                  </div>

                  <div className="w-full sm:w-80">
                    <label
                      htmlFor={`note-${document.id}`}
                      className="mb-1 block text-sm text-ink-600"
                    >
                      Note to the candidate (optional)
                    </label>
                    <Input
                      id={`note-${document.id}`}
                      value={notes[document.id] ?? ''}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [document.id]: event.target.value,
                        }))
                      }
                      placeholder="Why this was approved or rejected"
                    />
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        loading={busyId === document.id}
                        onClick={() => review(document.id, 'approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busyId === document.id}
                        onClick={() => review(document.id, 'rejected')}
                      >
                        Reject
                      </Button>
                      <a href={document.url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="secondary">
                          Open file
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={result.data.page} pages={result.data.pages} onChange={setPage} />
        </>
      ) : (
        <EmptyState
          title={status === 'pending' ? 'Nothing waiting for review' : 'No documents here'}
          description={
            status === 'pending'
              ? 'The queue is clear. New uploads will appear here automatically.'
              : 'Try a different filter.'
          }
        />
      )}
    </div>
  )
}
