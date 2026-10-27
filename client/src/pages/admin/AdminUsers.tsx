import { useState } from 'react'

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
  PageHeader,
  Pagination,
  Select,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { admin } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { UserRole } from '../../lib/types'
import { errorMessage, useAsync } from '../../lib/useAsync'

const ROLE_LABELS: Record<UserRole, string> = {
  job_seeker: 'Job seeker',
  employer: 'Employer',
  admin: 'Administrator',
}

export default function AdminUsers() {
  const { session } = useAuth()
  const [role, setRole] = useState('')
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const result = useAsync(
    () => admin.users({ role: role || undefined, q: query || undefined, page }),
    [role, query, page],
  )

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    setQuery(input.trim())
    setPage(1)
  }

  const setActive = async (id: number, isActive: boolean) => {
    setBusyId(id)
    setError(null)
    try {
      await admin.setUserActive(id, isActive)
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
        title="Users"
        description="Every account on the platform. Deactivating one signs it out immediately."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem]">
          <label htmlFor="user-role" className="mb-1 block text-sm text-ink-600">
            Role
          </label>
          <Select
            id="user-role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value)
              setPage(1)
            }}
          >
            <option value="">All roles</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <form onSubmit={search} className="flex gap-2">
          <div>
            <label htmlFor="user-search" className="mb-1 block text-sm text-ink-600">
              Search
            </label>
            <Input
              id="user-search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Username or email"
            />
          </div>
          <Button type="submit" variant="secondary" className="self-end">
            Search
          </Button>
        </form>
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
          <Card className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead>
                <tr className="text-left text-ink-500">
                  <th scope="col" className="px-5 py-3 font-medium">
                    Account
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Joined
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {result.data.items.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-900">
                        {user.display_name ?? user.username}
                      </p>
                      <p className="text-ink-500">{user.email}</p>
                    </td>
                    <td className="px-5 py-3 text-ink-700">{ROLE_LABELS[user.role]}</td>
                    <td className="px-5 py-3 text-ink-600">{formatDate(user.created_at)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? 'Active' : 'Deactivated'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {user.id === session?.user.id ? (
                        <span className="text-ink-400">You</span>
                      ) : (
                        <Button
                          variant={user.is_active ? 'ghost' : 'secondary'}
                          size="sm"
                          loading={busyId === user.id}
                          onClick={() => setActive(user.id, !user.is_active)}
                        >
                          {user.is_active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={result.data.page} pages={result.data.pages} onChange={setPage} />
        </>
      ) : (
        <EmptyState title="No users match that filter" />
      )}
    </div>
  )
}
