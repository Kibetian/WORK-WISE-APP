import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { DocumentStatusBadge } from '../../components/StatusBadge'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  PageHeader,
  Select,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { files, jobSeekers } from '../../lib/api'
import { formatBytes, formatDate } from '../../lib/format'
import type { DocumentType } from '../../lib/types'
import { errorMessage, useAsync } from '../../lib/useAsync'

const DOCUMENT_TYPES: Record<DocumentType, string> = {
  resume: 'CV / résumé',
  cover_letter: 'Cover letter',
  certificate: 'Certificate',
  other: 'Other',
}

export default function SeekerDocuments() {
  const { session } = useAuth()
  const hasProfile = session?.job_seeker_profile != null

  const documents = useAsync(
    () => (hasProfile ? jobSeekers.myDocuments() : Promise.resolve([])),
    [hasProfile],
  )

  const [documentType, setDocumentType] = useState<DocumentType>('resume')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    setNotice(null)
    try {
      await files.uploadDocument(file, documentType)
      setNotice(`${file.name} uploaded and queued for review.`)
      documents.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const remove = async (id: number, name: string) => {
    setError(null)
    setNotice(null)
    try {
      await files.deleteDocument(id)
      setNotice(`${name} deleted.`)
      documents.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  if (!hasProfile) {
    return (
      <div>
        <PageHeader title="Documents" />
        <EmptyState
          title="Create your profile first"
          description="Documents are attached to your job seeker profile."
          action={
            <Link to="/profile">
              <Button>Create my profile</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Documents"
        description="Upload your CV and any supporting files. An administrator reviews each one before it is marked approved."
      />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Document type" htmlFor="document-type">
            <Select
              id="document-type"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentType)}
            >
              {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.doc,.docx,.txt,image/png,image/jpeg"
              className="sr-only"
              onChange={upload}
            />
            <Button loading={uploading} onClick={() => fileInput.current?.click()}>
              Choose a file
            </Button>
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-500">
          PDF, Word, plain text or an image, up to 10MB.
        </p>
      </Card>

      {error && (
        <div className="mb-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      {documents.loading ? (
        <Loading />
      ) : documents.error ? (
        <Alert tone="danger">{documents.error}</Alert>
      ) : documents.data && documents.data.length > 0 ? (
        <Card className="p-0">
          <ul className="divide-y divide-ink-100">
            {documents.data.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                  >
                    {document.original_name}
                  </a>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {DOCUMENT_TYPES[document.document_type]} ·{' '}
                    {formatBytes(document.size_bytes)} · {formatDate(document.uploaded_at)}
                  </p>
                  {document.review_note && (
                    <p className="mt-1 text-sm text-ink-600">Note: {document.review_note}</p>
                  )}
                </div>
                <DocumentStatusBadge status={document.status} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(document.id, document.original_name)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState
          title="No documents yet"
          description="Upload a CV so employers can read it alongside your application."
        />
      )}
    </div>
  )
}
