import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

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
import { files, jobSeekers } from '../../lib/api'
import { errorMessage } from '../../lib/useAsync'

interface FormState {
  full_name: string
  headline: string
  phone: string
  address: string
  salary_expectation: string
  summary: string
  skills: string
  education: string
  experience: string
}

const EMPTY: FormState = {
  full_name: '',
  headline: '',
  phone: '',
  address: '',
  salary_expectation: '',
  summary: '',
  skills: '',
  education: '',
  experience: '',
}

export default function SeekerProfile() {
  const { session, setJobSeekerProfile } = useAuth()
  const profile = session?.job_seeker_profile ?? null
  const isNew = profile === null

  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!profile) return
    setForm({
      full_name: profile.full_name ?? '',
      headline: profile.headline ?? '',
      phone: profile.phone ?? '',
      address: profile.address ?? '',
      salary_expectation:
        profile.salary_expectation === null ? '' : String(profile.salary_expectation),
      summary: profile.summary ?? '',
      skills: profile.skills ?? '',
      education: profile.education ?? '',
      experience: profile.experience ?? '',
    })
  }, [profile])

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
      full_name: form.full_name.trim(),
      headline: form.headline.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      salary_expectation: form.salary_expectation ? Number(form.salary_expectation) : null,
      summary: form.summary.trim() || null,
      skills: form.skills.trim() || null,
      education: form.education.trim() || null,
      experience: form.experience.trim() || null,
    }

    try {
      const next = isNew
        ? await jobSeekers.createMine(payload)
        : await jobSeekers.updateMine(payload)
      setJobSeekerProfile(next)
      setSaved(true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await files.uploadProfileImage(file)
      const next = await jobSeekers.mine()
      setJobSeekerProfile(next)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isNew ? 'Create your profile' : 'My profile'}
        description={
          isNew
            ? 'Employers see this when you apply. You can refine it at any time.'
            : 'Keep this current — it is what employers read alongside your application.'
        }
        actions={
          !isNew ? (
            <Link to="/documents">
              <Button variant="secondary">Documents</Button>
            </Link>
          ) : undefined
        }
      />

      {!isNew && profile && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={profile.full_name} src={profile.profile_image_url} size={64} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink-900">{profile.full_name}</p>
              <p className="text-sm text-ink-600">{profile.headline ?? 'No headline yet'}</p>
              <div className="mt-2">
                <VerifiedBadge verified={profile.verified} />
              </div>
            </div>
            <div>
              <input
                ref={fileInput}
                id="avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={uploadImage}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={uploading}
                onClick={() => fileInput.current?.click()}
              >
                Change photo
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="full_name" required>
              <Input
                id="full_name"
                required
                minLength={2}
                value={form.full_name}
                onChange={update('full_name')}
              />
            </Field>

            <Field label="Headline" htmlFor="headline" hint="One line: what you do.">
              <Input
                id="headline"
                value={form.headline}
                onChange={update('headline')}
                placeholder="Backend engineer, Python and Go"
              />
            </Field>

            <Field label="Phone" htmlFor="phone">
              <Input id="phone" value={form.phone} onChange={update('phone')} />
            </Field>

            <Field label="Location" htmlFor="address">
              <Input
                id="address"
                value={form.address}
                onChange={update('address')}
                placeholder="City, country"
              />
            </Field>

            <Field
              label="Salary expectation"
              htmlFor="salary_expectation"
              hint="Annual, in USD. Leave blank if you would rather not say."
            >
              <Input
                id="salary_expectation"
                type="number"
                min={0}
                step={1000}
                value={form.salary_expectation}
                onChange={update('salary_expectation')}
              />
            </Field>

            <Field label="Skills" htmlFor="skills" hint="Comma separated.">
              <Input
                id="skills"
                value={form.skills}
                onChange={update('skills')}
                placeholder="Python, PostgreSQL, Docker"
              />
            </Field>
          </div>

          <Field label="About you" htmlFor="summary">
            <Textarea id="summary" rows={4} value={form.summary} onChange={update('summary')} />
          </Field>

          <Field label="Education" htmlFor="education">
            <Textarea
              id="education"
              rows={3}
              value={form.education}
              onChange={update('education')}
            />
          </Field>

          <Field label="Experience" htmlFor="experience">
            <Textarea
              id="experience"
              rows={5}
              value={form.experience}
              onChange={update('experience')}
            />
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}
          {saved && <Alert tone="success">Profile saved.</Alert>}

          <div className="flex justify-end gap-2">
            <Button type="submit" loading={saving}>
              {isNew ? 'Create profile' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
