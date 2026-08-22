import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOverview, type InventoryOverview } from '../api/stats'
import { listBrands, listMaterials, type Brand, type Material } from '../api/settings'
import { ApiError } from '../api/client'
import { ColorSwatch } from '../components/ColorSwatch'
import { COLOR_PALETTE } from '../colors'

function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${grams} г (${(grams / 1000).toFixed(2)} кг)`
  }
  return `${grams} г`
}

export function Overview() {
  const [overview, setOverview] = useState<InventoryOverview | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [error, setError] = useState<string | null>(null)
  const [brandFilter, setBrandFilter] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')
  const [colorFilter, setColorFilter] = useState('')

  useEffect(() => {
    Promise.all([listBrands(), listMaterials()]).then(([b, m]) => {
      setBrands(b)
      setMaterials(m)
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
        <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}>
          <option value="">Все цвета</option>
          {COLOR_PALETTE.map((c) => (
            <option key={c.hex} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
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
