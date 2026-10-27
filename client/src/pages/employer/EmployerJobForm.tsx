import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  Textarea,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { jobs as jobsApi } from '../../lib/api'
import { EMPLOYMENT_TYPE_LABELS } from '../../lib/format'
import type { EmploymentType } from '../../lib/types'
import { errorMessage } from '../../lib/useAsync'

interface FormState {
  title: string
  description: string
  requirements: string
  location: string
  employment_type: EmploymentType
  salary_min: string
  salary_max: string
  status: 'open' | 'closed'
}

const EMPTY: FormState = {
  title: '',
  description: '',
  requirements: '',
  location: '',
  employment_type: 'full_time',
  salary_min: '',
  salary_max: '',
  status: 'open',
}

export default function EmployerJobForm() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const company = session?.employer_profile ?? null

  const isEdit = jobId !== undefined
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    jobsApi
      .get(Number(jobId))
      .then((job) => {
        if (cancelled) return
        setForm({
          title: job.title,
          description: job.description,
          requirements: job.requirements ?? '',
          location: job.location ?? '',
          employment_type: job.employment_type,
          salary_min: job.salary_min === null ? '' : String(job.salary_min),
          salary_max: job.salary_max === null ? '' : String(job.salary_max),
          status: job.status,
        })
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(errorMessage(caught))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, jobId])

  const update = (key: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()

    const salaryMin = form.salary_min ? Number(form.salary_min) : null
    const salaryMax = form.salary_max ? Number(form.salary_max) : null
    if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
      setError('The maximum salary cannot be lower than the minimum.')
      return
    }

    setSaving(true)
    setError(null)

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      requirements: form.requirements.trim() || null,
      location: form.location.trim() || null,
      employment_type: form.employment_type,
      salary_min: salaryMin,
      salary_max: salaryMax,
    }
    if (isEdit) payload.status = form.status

    try {
      if (isEdit) await jobsApi.update(Number(jobId), payload)
      else await jobsApi.create(payload)
      navigate('/employer/jobs')
    } catch (caught) {
      setError(errorMessage(caught))
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isEdit ? 'Edit role' : 'Post a role'}
        description="Candidates see everything on this page, so be specific about the work."
      />

      {!company?.verified && !isEdit && (
        <div className="mb-4">
          <Alert tone="warning" title="Verification required">
            An administrator must verify your company before a role can be published.
          </Alert>
        </div>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-5">
          <Field label="Job title" htmlFor="title" required>
            <Input
              id="title"
              required
              minLength={3}
              value={form.title}
              onChange={update('title')}
              placeholder="Senior Backend Engineer"
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            hint="What the person will actually work on."
            required
          >
            <Textarea
              id="description"
              rows={7}
              required
              minLength={10}
              value={form.description}
              onChange={update('description')}
            />
          </Field>

          <Field label="Requirements" htmlFor="requirements">
            <Textarea
              id="requirements"
              rows={4}
              value={form.requirements}
              onChange={update('requirements')}
              placeholder="Experience, skills, anything non-negotiable."
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Location" htmlFor="location">
              <Input
                id="location"
                value={form.location}
                onChange={update('location')}
                placeholder="City, country or 'Remote'"
              />
            </Field>

            <Field label="Employment type" htmlFor="employment_type">
              <Select
                id="employment_type"
                value={form.employment_type}
                onChange={update('employment_type')}
              >
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Salary from" htmlFor="salary_min">
              <Input
                id="salary_min"
                type="number"
                min={0}
                step={1000}
                value={form.salary_min}
                onChange={update('salary_min')}
              />
            </Field>

            <Field label="Salary to" htmlFor="salary_max">
              <Input
                id="salary_max"
                type="number"
                min={0}
                step={1000}
                value={form.salary_max}
                onChange={update('salary_max')}
              />
            </Field>

            {isEdit && (
              <Field label="Status" htmlFor="status">
                <Select id="status" value={form.status} onChange={update('status')}>
                  <option value="open">Open — accepting applications</option>
                  <option value="closed">Closed</option>
                </Select>
              </Field>
            )}
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/employer/jobs')}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Publish role'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
