/** Mirrors the response models in `server/app/schemas.py`. */

export type UserRole = 'job_seeker' | 'employer' | 'admin'
export type JobStatus = 'open' | 'closed'
export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'temporary'
export type ApplicationStatus =
  | 'applied'
  | 'reviewing'
  | 'shortlisted'
  | 'rejected'
  | 'hired'
export type DocumentType = 'resume' | 'cover_letter' | 'certificate' | 'other'
export type DocumentStatus = 'pending' | 'approved' | 'rejected'

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface User {
  id: number
  username: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface JobSeekerProfile {
  id: number
  user_id: number
  full_name: string
  headline: string | null
  phone: string | null
  address: string | null
  salary_expectation: number | null
  summary: string | null
  skills: string | null
  education: string | null
  experience: string | null
  profile_image_url: string | null
  verified: boolean
  created_at: string
  updated_at: string
}

export interface EmployerProfile {
  id: number
  user_id: number
  company_name: string
  company_description: string | null
  industry: string | null
  website: string | null
  location: string | null
  logo_url: string | null
  verified: boolean
  created_at: string
}

export interface AuthSession {
  user: User
  job_seeker_profile: JobSeekerProfile | null
  employer_profile: EmployerProfile | null
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface JobEmployerSummary {
  id: number
  company_name: string
  industry: string | null
  location: string | null
  logo_url: string | null
  verified: boolean
}

export interface Job {
  id: number
  title: string
  description: string
  requirements: string | null
  location: string | null
  employment_type: EmploymentType
  salary_min: number | null
  salary_max: number | null
  status: JobStatus
  created_at: string
  employer: JobEmployerSummary
  application_count: number
  has_applied: boolean
}

export interface ApplicantSummary {
  id: number
  full_name: string
  headline: string | null
  skills: string | null
  address: string | null
  salary_expectation: number | null
  profile_image_url: string | null
  verified: boolean
}

export interface Application {
  id: number
  status: ApplicationStatus
  cover_letter: string | null
  created_at: string
  updated_at: string
  job: {
    id: number
    title: string
    location: string | null
    employment_type: EmploymentType
    company_name: string
  }
  applicant: ApplicantSummary | null
}

export interface JobDocument {
  id: number
  job_seeker_id: number
  document_type: DocumentType
  original_name: string
  content_type: string
  size_bytes: number
  url: string
  status: DocumentStatus
  review_note: string | null
  uploaded_at: string
}

export interface AdminDocument extends JobDocument {
  job_seeker_name: string
  job_seeker_email: string
}

export interface AdminEmployer extends EmployerProfile {
  username: string
  email: string
  job_count: number
}

export interface AdminUser extends User {
  display_name: string | null
  verified: boolean | null
  profile_id: number | null
}

export interface AdminStats {
  total_users: number
  job_seekers: number
  employers: number
  verified_employers: number
  verified_job_seekers: number
  total_jobs: number
  open_jobs: number
  total_applications: number
  pending_documents: number
}
