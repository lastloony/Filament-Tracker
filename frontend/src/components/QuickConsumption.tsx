import { useEffect, useState } from 'react'
import { listFilaments, type Filament } from '../api/filaments'
import { FilamentConsumption } from './FilamentConsumption'

const spoolFilters = [
  { field: 'material', label: 'Тип пластика', all: 'Все типы' },
  { field: 'brand', label: 'Бренд', all: 'Все бренды' },
  { field: 'color', label: 'Цвет', all: 'Все цвета' },
] as const

const emptyFilters = { material: '', brand: '', color: '' }
const noColor = 'Без цвета'

export function QuickConsumption({ onSaved }: { onSaved: () => void }) {
  const [spools, setSpools] = useState<Filament[]>([])
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const rows: Filament[] = []
      for (let offset = 0; ; offset += 200) {
        const page = await listFilaments({ limit: 200, offset })
        if (cancelled) return
        rows.push(...page.filter((spool) => spool.weight_remaining_g > 0))
        if (page.length < 200) break
      }
      setSpools(rows)
    }
    load().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить катушки')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const searchTerms = search.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const visibleSpools = spools.filter((spool) => {
    if (!spoolFilters.every(({ field }) => !filters[field] || (spool[field] ?? noColor) === filters[field])) return false
    const text = `#${spool.id} ${spool.material} ${spool.brand} ${spool.color ?? noColor}`.toLocaleLowerCase()
    return searchTerms.every((term) => text.includes(term))
  })
  const filament = visibleSpools.find((spool) => String(spool.id) === selected)
  const hasFilters = searchTerms.length > 0 || Object.values(filters).some(Boolean)

  function resetFilters() {
    setSearch('')
    setFilters(emptyFilters)
    setSelected('')
  }

  return <section className="chart-card quick-consumption">
    <h2>Добавить расход пластика</h2>
    {loading ? <p>Загрузка катушек...</p> : error ? <p role="alert">{error}</p> : spools.length === 0 ?
      <p>Нет катушек с доступным остатком. Добавьте новую катушку.</p> : <>
        <div className="filters quick-consumption-filters">
          <label>Поиск катушки
            <input type="search" placeholder="Номер, тип, бренд или цвет" value={search} onChange={(event) => {
              setSearch(event.target.value)
              setSelected('')
            }} />
          </label>
          {spoolFilters.map(({ field, label, all }) => {
            const options = [...new Set(spools.map((spool) => spool[field] ?? noColor))]
              .sort((a, b) => a.localeCompare(b, 'ru'))
            return <label key={field}>{label}
              <select value={filters[field]} onChange={(event) => {
                setFilters({ ...filters, [field]: event.target.value })
                setSelected('')
              }}>
                <option value="">{all}</option>
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          })}
          {hasFilters && <button type="button" className="link-button" onClick={resetFilters}>Сбросить фильтры</button>}
        </div>
        {visibleSpools.length === 0 ? <p role="status">Катушки по заданным фильтрам не найдены.</p> : <label>Катушка
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Выберите катушку</option>
            {visibleSpools.map((spool) => <option key={spool.id} value={spool.id}>
              #{spool.id} · {spool.brand} · {spool.material} · {spool.color ?? noColor} · {spool.weight_remaining_g} г
            </option>)}
          </select>
        </label>}
        {filament && <FilamentConsumption key={filament.id} filament={filament} initiallyOpen onSaved={(updated) => {
          setSpools((rows) => rows.map((row) => row.id === updated.id ? updated : row)
            .filter((row) => row.weight_remaining_g > 0))
          setSelected('')
          onSaved()
        }} />}
      </>}
  </section>
}
