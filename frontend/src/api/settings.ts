import { apiFetch } from './client'

export type Brand = { id: number; name: string }
export type Material = { id: number; name: string }
export type Currency = { id: number; code: string; is_base: boolean }

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
