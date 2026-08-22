import { apiFetch } from './client'

export type StatsByGroup = {
  group: string
  total_spent: string
  remaining_g: number
  count: number
  avg_rating: number | null
}

export type StatsByRating = {
  rating: number | null
  count: number
}

export type InvestedByCurrency = {
  currency: string
  total: string
}

export type StatsSummary = {
  remaining_kg: string
  total_invested: InvestedByCurrency[]
  avg_rating: number | null
}

export type InventoryByMaterialColor = {
  material: string
  color: string | null
  color_hex: string | null
  remaining_g: number
  spool_count: number
}

export type ReorderItem = {
  id: number
  brand: string
  material: string
  color: string | null
  color_hex: string | null
  remaining_g: number
}

export type InventoryOverview = {
  by_material_color: InventoryByMaterialColor[]
  reorder: ReorderItem[]
}

export type InventoryByBrand = {
  brand: string
  remaining_g: number
  spool_count: number
}

export function getByBrand(): Promise<StatsByGroup[]> {
  return apiFetch('/stats/by-brand')
}

export function getByMaterial(): Promise<StatsByGroup[]> {
  return apiFetch('/stats/by-material')
}

export function getByRating(): Promise<StatsByRating[]> {
  return apiFetch('/stats/by-rating')
}

export function getSummary(): Promise<StatsSummary> {
  return apiFetch('/stats/summary')
}

export type OverviewFilters = {
  brand?: string
  material?: string
  color?: string
}

export function getOverview(filters: OverviewFilters = {}): Promise<InventoryOverview> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return apiFetch(`/stats/overview${qs ? `?${qs}` : ''}`)
}

export function getOverviewByBrand(material: string, color: string): Promise<InventoryByBrand[]> {
  const query = new URLSearchParams({ material, color })
  return apiFetch(`/stats/overview/by-brand?${query.toString()}`)
}
