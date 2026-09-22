export interface PasswordRecoveryRequest {
  requested: boolean
  error: string
}

const callbackKeys = [
  'access_token',
  'refresh_token',
  'expires_at',
  'expires_in',
  'token_type',
  'type',
  'error',
  'error_code',
  'error_description',
]

const fragmentParams = (url: URL) => new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : '')

export const buildPasswordRecoveryRedirect = (origin: string, basePath: string) => {
  const url = new URL(basePath, origin)
  url.searchParams.set('recovery', '1')
  return url.toString()
}

export const readPasswordRecoveryRequest = (href: string): PasswordRecoveryRequest => {
  const url = new URL(href)
  const fragment = fragmentParams(url)
  const requested = url.searchParams.get('recovery') === '1'
    || url.searchParams.get('type') === 'recovery'
    || fragment.get('type') === 'recovery'
  const error = url.searchParams.get('error_description')
    || fragment.get('error_description')
    || ''
  return { requested, error }
}

export const clearPasswordRecoveryRequest = (href: string) => {
  const url = new URL(href)
  url.searchParams.delete('recovery')
  callbackKeys.forEach((key) => url.searchParams.delete(key))
  const fragment = fragmentParams(url)
  if (callbackKeys.some((key) => fragment.has(key))) url.hash = ''
  return `${url.pathname}${url.search}${url.hash}`
}
