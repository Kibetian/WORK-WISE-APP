/**
 * One HTTP layer for the whole client.
 *
 * Every request goes through `request()`, so the bearer token, error shape and
 * base URL are decided in exactly one place. The original codebase had three
 * different hardcoded API hosts scattered across components.
 */

import type {
  AdminDocument,
  AdminEmployer,
  AdminStats,
  AdminUser,
  Application,
  ApplicationStatus,
  AuthSession,
  EmployerProfile,
  Job,
  JobDocument,
  JobSeekerProfile,
  Page,
  TokenResponse,
  UserRole,
} from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'workwise.token'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private browsing; the session simply won't survive a reload */
  }
}

/** Fired when the server rejects our token, so the app can sign out. */
export const UNAUTHORIZED_EVENT = 'workwise:unauthorized'

type QueryValue = string | number | boolean | null | undefined

export function toQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

interface RequestOptions {
  method?: string
  body?: unknown
  formData?: FormData
  signal?: AbortSignal
  /** Set false for endpoints that are fine without a token. */
  auth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, signal, auth = true } = options

  const headers: Record<string, string> = {}
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    signal,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })

  if (response.status === 401 && token) {
    setToken(null)
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload = text ? safeParse(text) : null

  if (!response.ok) {
    throw new ApiError(extractMessage(payload, response.status), response.status)
  }
  return payload as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { detail: text }
  }
}

function extractMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          item && typeof item === 'object' && 'msg' in item
            ? String((item as { msg: unknown }).msg)
            : String(item),
        )
        .join('; ')
    }
  }
  if (status >= 500) return 'The server ran into a problem. Please try again.'
  return `Request failed (${status})`
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const auth = {
  register: (input: {
    username: string
    email: string
    password: string
    role: Exclude<UserRole, 'admin'>
  }) => request<TokenResponse>('/auth/register', { method: 'POST', body: input, auth: false }),

  login: (input: { email: string; password: string }) =>
    request<TokenResponse>('/auth/login', { method: 'POST', body: input, auth: false }),

  me: () => request<AuthSession>('/auth/me'),

  changePassword: (input: { current_password: string; new_password: string }) =>
    request<{ message: string }>('/auth/change-password', { method: 'POST', body: input }),
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
export interface JobQuery {
  q?: string
  location?: string
  employment_type?: string
  salary_min?: number
  employer_id?: number
  job_status?: string
  sort?: string
  page?: number
  page_size?: number
}

export const jobs = {
  list: (query: JobQuery = {}, signal?: AbortSignal) =>
    request<Page<Job>>(`/jobs${toQuery(query as Record<string, QueryValue>)}`, { signal }),

  get: (id: number) => request<Job>(`/jobs/${id}`),

  create: (input: Record<string, unknown>) =>
    request<Job>('/jobs', { method: 'POST', body: input }),

  update: (id: number, input: Record<string, unknown>) =>
    request<Job>(`/jobs/${id}`, { method: 'PATCH', body: input }),

  remove: (id: number) => request<{ message: string }>(`/jobs/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------
export const applications = {
  apply: (input: { job_id: number; cover_letter?: string }) =>
    request<Application>('/applications', { method: 'POST', body: input }),

  mine: (query: { page?: number; page_size?: number; application_status?: string } = {}) =>
    request<Page<Application>>(
      `/applications/me${toQuery(query as Record<string, QueryValue>)}`,
    ),

  withdraw: (id: number) =>
    request<{ message: string }>(`/applications/${id}`, { method: 'DELETE' }),

  received: (
    query: {
      job_id?: number
      application_status?: string
      page?: number
      page_size?: number
    } = {},
  ) =>
    request<Page<Application>>(
      `/applications/received${toQuery(query as Record<string, QueryValue>)}`,
    ),

  setStatus: (id: number, status: ApplicationStatus) =>
    request<Application>(`/applications/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export const jobSeekers = {
  createMine: (input: Record<string, unknown>) =>
    request<JobSeekerProfile>('/jobseekers/me', { method: 'POST', body: input }),

  mine: () => request<JobSeekerProfile>('/jobseekers/me'),

  updateMine: (input: Record<string, unknown>) =>
    request<JobSeekerProfile>('/jobseekers/me', { method: 'PATCH', body: input }),

  myDocuments: () => request<JobDocument[]>('/jobseekers/me/documents'),

  list: (query: { q?: string; verified?: boolean; page?: number; page_size?: number } = {}) =>
    request<Page<JobSeekerProfile>>(
      `/jobseekers${toQuery(query as Record<string, QueryValue>)}`,
    ),

  get: (id: number) => request<JobSeekerProfile>(`/jobseekers/${id}`),

  documentsFor: (id: number) => request<JobDocument[]>(`/jobseekers/${id}/documents`),
}

export const employers = {
  createMine: (input: Record<string, unknown>) =>
    request<EmployerProfile>('/employers/me', { method: 'POST', body: input }),

  mine: () => request<EmployerProfile>('/employers/me'),

  updateMine: (input: Record<string, unknown>) =>
    request<EmployerProfile>('/employers/me', { method: 'PATCH', body: input }),

  myJobs: (query: { job_status?: string; page?: number; page_size?: number } = {}) =>
    request<Page<Job>>(`/employers/me/jobs${toQuery(query as Record<string, QueryValue>)}`),

  list: (query: { q?: string; verified?: boolean; page?: number; page_size?: number } = {}) =>
    request<Page<EmployerProfile>>(
      `/employers${toQuery(query as Record<string, QueryValue>)}`,
    ),

  get: (id: number) => request<EmployerProfile>(`/employers/${id}`),
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------
export const files = {
  uploadProfileImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ url: string; message: string }>('/files/profile-image', {
      method: 'POST',
      formData: form,
    })
  },

  uploadCompanyLogo: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ url: string; message: string }>('/files/company-logo', {
      method: 'POST',
      formData: form,
    })
  },

  uploadDocument: (file: File, documentType: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('document_type', documentType)
    return request<JobDocument>('/files/documents', { method: 'POST', formData: form })
  },

  deleteDocument: (id: number) =>
    request<{ message: string }>(`/files/documents/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const admin = {
  stats: () => request<AdminStats>('/admin/stats'),

  users: (
    query: { role?: string; q?: string; is_active?: boolean; page?: number } = {},
  ) => request<Page<AdminUser>>(`/admin/users${toQuery(query as Record<string, QueryValue>)}`),

  setUserActive: (id: number, isActive: boolean) =>
    request<{ message: string }>(`/admin/users/${id}/active?is_active=${isActive}`, {
      method: 'PATCH',
    }),

  employers: (query: { verified?: boolean; page?: number } = {}) =>
    request<Page<AdminEmployer>>(
      `/admin/employers${toQuery(query as Record<string, QueryValue>)}`,
    ),

  setEmployerVerified: (id: number, verified: boolean) =>
    request<{ message: string }>(
      `/admin/employers/${id}/verification?verified=${verified}`,
      { method: 'PATCH' },
    ),

  jobSeekers: (query: { verified?: boolean; page?: number } = {}) =>
    request<Page<JobSeekerProfile>>(
      `/admin/jobseekers${toQuery(query as Record<string, QueryValue>)}`,
    ),

  setJobSeekerVerified: (id: number, verified: boolean) =>
    request<{ message: string }>(
      `/admin/jobseekers/${id}/verification?verified=${verified}`,
      { method: 'PATCH' },
    ),

  documents: (query: { document_status?: string; page?: number } = {}) =>
    request<Page<AdminDocument>>(
      `/admin/documents${toQuery(query as Record<string, QueryValue>)}`,
    ),

  reviewDocument: (id: number, status: 'approved' | 'rejected', note?: string) =>
    request<AdminDocument>(`/admin/documents/${id}/review`, {
      method: 'PATCH',
      body: { status, review_note: note ?? null },
    }),
}
