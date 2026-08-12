import { apiFetch } from './client'

export type Filament = {
  id: number
  brand: string
  material: string
  color: string | null
  weight_total_g: number
  weight_remaining_g: number
  price: string
  currency: string
  price_per_kg: string
  rating: number | null
  vendor: string | null
  purchase_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type FilamentInput = {
  brand: string
  material: string
  color: string | null
  weight_total_g: number
  weight_remaining_g: number
  price: string
  currency: string
  rating: number | null
  vendor: string | null
  purchase_date: string | null
  notes: string | null
}

export type ListFilamentsParams = {
  brand?: string
  material?: string
  rating_min?: number
  sort?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export function listFilaments(params: ListFilamentsParams = {}): Promise<Filament[]> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const qs = query.toString()
  return apiFetch(`/filaments${qs ? `?${qs}` : ''}`)
}

export function getFilament(id: number): Promise<Filament> {
  return apiFetch(`/filaments/${id}`)
}

export function createFilament(data: FilamentInput): Promise<Filament> {
  return apiFetch('/filaments', { method: 'POST', body: JSON.stringify(data) })
}

export function updateFilament(id: number, data: Partial<FilamentInput>): Promise<Filament> {
  return apiFetch(`/filaments/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteFilament(id: number): Promise<void> {
  return apiFetch(`/filaments/${id}`, { method: 'DELETE' })
}
