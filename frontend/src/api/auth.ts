import { apiFetch } from './client'

export function login(username: string, password: string): Promise<{ status: string }> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout(): Promise<{ status: string }> {
  return apiFetch('/auth/logout', { method: 'POST' })
}

export function me(): Promise<{ username: string }> {
  return apiFetch('/auth/me')
}
