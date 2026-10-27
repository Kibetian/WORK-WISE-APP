import {
  APPLICATION_STATUS_LABELS,
  DOCUMENT_STATUS_LABELS,
} from '../lib/format'
import type { ApplicationStatus, DocumentStatus } from '../lib/types'
import { Badge } from './ui'

const APPLICATION_TONES: Record<ApplicationStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  applied: 'neutral',
  reviewing: 'info',
  shortlisted: 'warning',
  rejected: 'danger',
  hired: 'success',
}

const DOCUMENT_TONES: Record<DocumentStatus, 'neutral' | 'success' | 'danger'> = {
  pending: 'neutral',
  approved: 'success',
  rejected: 'danger',
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={APPLICATION_TONES[status]}>{APPLICATION_STATUS_LABELS[status]}</Badge>
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={DOCUMENT_TONES[status]}>{DOCUMENT_STATUS_LABELS[status]}</Badge>
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <Badge tone={verified ? 'success' : 'warning'}>
      {verified ? 'Verified' : 'Awaiting verification'}
    </Badge>
  )
}
