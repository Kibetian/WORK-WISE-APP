import { Link } from 'react-router-dom'

import { Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-950">
        We could not find that page
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
        The link may be out of date, or the page may have moved.
      </p>
      <Link to="/" className="mt-6 inline-block">
        <Button>Back to the job board</Button>
      </Link>
    </div>
  )
}
