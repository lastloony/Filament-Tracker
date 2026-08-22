import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOverview, type InventoryOverview } from '../api/stats'
import { listBrands, listMaterials, type Brand, type Material } from '../api/settings'
import { ApiError } from '../api/client'
import { ColorSwatch } from '../components/ColorSwatch'

function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${grams} г (${(grams / 1000).toFixed(2)} кг)`
  }
  return `${grams} г`
}

type ColorOption = { color: string; color_hex: string | null }

export function Overview() {
  const [overview, setOverview] = useState<InventoryOverview | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [colorOptions, setColorOptions] = useState<ColorOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [brandFilter, setBrandFilter] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')
  const [colorFilter, setColorFilter] = useState('')

  useEffect(() => {
    Promise.all([listBrands(), listMaterials(), getOverview()]).then(([b, m, unfiltered]) => {
      setBrands(b)
      setMaterials(m)

      const seen = new Map<string, string | null>()
      for (const row of unfiltered.by_material_color) {
        if (row.color && !seen.has(row.color)) seen.set(row.color, row.color_hex)
      }
      setColorOptions(
        Array.from(seen, ([color, color_hex]) => ({ color, color_hex })).sort((a, b) =>
          a.color.localeCompare(b.color),
        ),
      )
    })
  }, [])

  useEffect(() => {
    setError(null)
    getOverview({ brand: brandFilter, material: materialFilter, color: colorFilter })
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить остатки'))
  }, [brandFilter, materialFilter, colorFilter])

  const hasFilters = brandFilter !== '' || materialFilter !== '' || colorFilter !== ''

  function resetFilters() {
    setBrandFilter('')
    setMaterialFilter('')
    setColorFilter('')
  }

  if (error) return <p role="alert">{error}</p>
  if (!overview) return <p>Загрузка...</p>

  const totalGrams = overview.by_material_color.reduce((sum, row) => sum + row.remaining_g, 0)

  return (
    <div className="overview-page">
      <h1>Остатки</h1>

      <div className="filters">
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
          <option value="">Все производители</option>
          {brands.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)}>
          <option value="">Все материалы</option>
          {materials.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        <div className="color-palette">
          <button
            type="button"
            className={`color-palette-custom${colorFilter === '' ? ' selected' : ''}`}
            title="Все цвета"
            aria-label="Все цвета"
            onClick={() => setColorFilter('')}
          >
            ×
          </button>
          {colorOptions.map((c) => (
            <button
              key={c.color}
              type="button"
              className={`color-palette-swatch${colorFilter === c.color ? ' selected' : ''}`}
              style={c.color_hex ? { background: c.color_hex } : undefined}
              title={c.color}
              aria-label={c.color}
              onClick={() => setColorFilter(colorFilter === c.color ? '' : c.color)}
            >
              {!c.color_hex && '?'}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button type="button" className="link-button" onClick={resetFilters}>
            Сбросить фильтры
          </button>
        )}
      </div>

      <div className="kpi-row">
        <div className="stat-tile">
          <div className="stat-tile-label">Остаток{hasFilters ? ' (по фильтру)' : ' всего'}</div>
          <div className="stat-tile-value">{formatWeight(totalGrams)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Комбинаций тип/цвет</div>
          <div className="stat-tile-value">{overview.by_material_color.length}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Пора дозаказать</div>
          <div className="stat-tile-value">{overview.reorder.length}</div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h2>Остаток по типу и цвету</h2>
          <table>
            <thead>
              <tr>
                <th>Материал</th>
                <th>Цвет</th>
                <th>Катушек</th>
                <th>Остаток</th>
              </tr>
            </thead>
            <tbody>
              {overview.by_material_color.map((row) => (
                <tr key={`${row.material}-${row.color ?? ''}`}>
                  <td>{row.material}</td>
                  <td className="color-cell">
                    <ColorSwatch hex={row.color_hex} name={row.color} />
                    {row.color ?? '—'}
                  </td>
                  <td>{row.spool_count}</td>
                  <td>{formatWeight(row.remaining_g)}</td>
                </tr>
              ))}
              {overview.by_material_color.length === 0 && (
                <tr>
                  <td colSpan={4} className="chart-empty">
                    {hasFilters ? 'Под фильтр ничего не подошло' : 'Пока нет данных'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="chart-card">
          <h2>Пора дозаказать</h2>
          {overview.reorder.length === 0 ? (
            <p className="chart-empty">{hasFilters ? 'Под фильтр ничего не подошло' : 'Всё в достатке'}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Бренд</th>
                  <th>Материал</th>
                  <th>Цвет</th>
                  <th>Остаток</th>
                </tr>
              </thead>
              <tbody>
                {overview.reorder.map((item) => (
                  <tr key={item.id}>
                    <td>{item.brand}</td>
                    <td>{item.material}</td>
                    <td className="color-cell">
                      <ColorSwatch hex={item.color_hex} name={item.color} />
                      {item.color ?? '—'}
                    </td>
                    <td className="low-stock">{formatWeight(item.remaining_g)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="overview-hint">
        Полный список катушек — на странице «<Link to="/filaments">Филамент</Link>».
      </p>
    </div>
  )
}
