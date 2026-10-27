import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from './api'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Run an async loader on mount and whenever `deps` change, with the usual
 * loading/error bookkeeping and protection against setting state after the
 * component has unmounted.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> & { reload: () => void; setData: (value: T) => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  })
  const [nonce, setNonce] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setState((previous) => ({ ...previous, loading: true, error: null }))

    loader()
      .then((data) => {
        if (!cancelled && mounted.current) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled || !mounted.current) return
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Something went wrong'
        setState({ data: null, loading: false, error: message })
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])
  const setData = useCallback(
    (value: T) => setState({ data: value, loading: false, error: null }),
    [],
  )

  return { ...state, reload, setData }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}
