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

export type StatsSummary = {
  remaining_kg: string
  total_invested: string
  avg_rating: number | null
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
