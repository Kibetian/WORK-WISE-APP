import { useEffect, useRef, useState } from 'react'

import { VerifiedBadge } from '../../components/StatusBadge'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Textarea,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { employers, files } from '../../lib/api'
import { errorMessage } from '../../lib/useAsync'

interface FormState {
  company_name: string
  industry: string
  website: string
  location: string
  company_description: string
}

const EMPTY: FormState = {
  company_name: '',
  industry: '',
  website: '',
  location: '',
  company_description: '',
}

export default function EmployerCompany() {
  const { session, setEmployerProfile } = useAuth()
  const company = session?.employer_profile ?? null
  const isNew = company === null

  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!company) return
    setForm({
      company_name: company.company_name ?? '',
      industry: company.industry ?? '',
      website: company.website ?? '',
      location: company.location ?? '',
      company_description: company.company_description ?? '',
    })
  }, [company])

  const update = (key: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    setSaved(false)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const payload = {
      company_name: form.company_name.trim(),
      industry: form.industry.trim() || null,
      website: form.website.trim() || null,
      location: form.location.trim() || null,
      company_description: form.company_description.trim() || null,
    }

    try {
      const next = isNew
        ? await employers.createMine(payload)
        : await employers.updateMine(payload)
      setEmployerProfile(next)
      setSaved(true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await files.uploadCompanyLogo(file)
      setEmployerProfile(await employers.mine())
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setUploading(false)
      if (logoInput.current) logoInput.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isNew ? 'Create your company profile' : 'Company profile'}
        description={
          isNew
            ? 'Candidates see this on every role you publish.'
            : 'This appears on each of your job listings.'
        }
      />

      {!isNew && company && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={company.company_name} src={company.logo_url} size={64} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink-900">{company.company_name}</p>
              <p className="text-sm text-ink-600">{company.industry ?? 'Industry not set'}</p>
              <div className="mt-2">
                <VerifiedBadge verified={company.verified} />
              </div>
            </div>
            <div>
              <input
                ref={logoInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={uploadLogo}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={uploading}
                onClick={() => logoInput.current?.click()}
              >
                Change logo
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company name" htmlFor="company_name" required>
              <Input
                id="company_name"
                required
                minLength={2}
                value={form.company_name}
                onChange={update('company_name')}
              />
            </Field>

            <Field label="Industry" htmlFor="industry">
              <Input
                id="industry"
                value={form.industry}
                onChange={update('industry')}
                placeholder="Logistics software"
              />
            </Field>

            <Field label="Website" htmlFor="website">
              <Input
                id="website"
                type="url"
                value={form.website}
                onChange={update('website')}
                placeholder="https://example.com"
              />
            </Field>

            <Field label="Location" htmlFor="location">
              <Input
                id="location"
                value={form.location}
                onChange={update('location')}
                placeholder="City, country or 'Remote'"
              />
            </Field>
          </div>

          <Field
            label="About the company"
            htmlFor="company_description"
            hint="What you build, how the team works, anything a candidate would want to know."
          >
            <Textarea
              id="company_description"
              rows={6}
              value={form.company_description}
              onChange={update('company_description')}
            />
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}
          {saved && <Alert tone="success">Company profile saved.</Alert>}

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              {isNew ? 'Create profile' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
