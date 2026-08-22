import { apiFetch } from './client'

export type Brand = { id: number; name: string }
export type Material = { id: number; name: string }
export type Currency = { id: number; code: string; is_base: boolean }
export type ReorderRule = { id: number; material: string; color: string; brand: string | null; threshold_g: number }

export function listBrands(): Promise<Brand[]> {
  return apiFetch('/settings/brands')
}

export function createBrand(name: string): Promise<Brand> {
  return apiFetch('/settings/brands', { method: 'POST', body: JSON.stringify({ name }) })
}

export function listMaterials(): Promise<Material[]> {
  return apiFetch('/settings/materials')
}

export function createMaterial(name: string): Promise<Material> {
  return apiFetch('/settings/materials', { method: 'POST', body: JSON.stringify({ name }) })
}

export function listCurrencies(): Promise<Currency[]> {
  return apiFetch('/settings/currencies')
}

export function createCurrency(code: string): Promise<Currency> {
  return apiFetch('/settings/currencies', { method: 'POST', body: JSON.stringify({ code }) })
}

export function setBaseCurrency(id: number): Promise<Currency> {
  return apiFetch(`/settings/currencies/${id}/set-base`, { method: 'POST' })
}

export function listReorderRules(): Promise<ReorderRule[]> {
  return apiFetch('/settings/reorder-rules')
}

export function createReorderRule(data: {
  material: string
  color: string
  brand: string | null
  threshold_g: number
}): Promise<ReorderRule> {
  return apiFetch('/settings/reorder-rules', { method: 'POST', body: JSON.stringify(data) })
}

export function deleteReorderRule(id: number): Promise<void> {
  return apiFetch(`/settings/reorder-rules/${id}`, { method: 'DELETE' })
}
