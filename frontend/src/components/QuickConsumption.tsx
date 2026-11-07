import { useEffect, useState } from 'react'
import { listFilaments, type Filament } from '../api/filaments'
import { FilamentConsumption } from './FilamentConsumption'

export function QuickConsumption({ onSaved }: { onSaved: () => void }) {
  const [spools, setSpools] = useState<Filament[]>([])
  const [selected, setSelected] = useState('')
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

  const filament = spools.find((spool) => String(spool.id) === selected)
  return <section className="chart-card quick-consumption">
    <h2>Добавить расход пластика</h2>
    {loading ? <p>Загрузка катушек...</p> : error ? <p role="alert">{error}</p> : spools.length === 0 ?
      <p>Нет катушек с доступным остатком. Добавьте новую катушку.</p> : <>
        <label>Катушка
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Выберите катушку</option>
            {spools.map((spool) => <option key={spool.id} value={spool.id}>
              #{spool.id} · {spool.brand} · {spool.material} · {spool.color ?? 'Без цвета'} · {spool.weight_remaining_g} г
            </option>)}
          </select>
        </label>
        {filament && <FilamentConsumption key={filament.id} filament={filament} initiallyOpen onSaved={(updated) => {
          setSpools((rows) => rows.map((row) => row.id === updated.id ? updated : row)
            .filter((row) => row.weight_remaining_g > 0))
          setSelected('')
          onSaved()
        }} />}
      </>}
  </section>
}
