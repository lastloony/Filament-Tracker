import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOverview, getSummary, type InventoryOverview, type StatsSummary } from '../api/stats'
import { ApiError } from '../api/client'
import { ColorSwatch } from '../components/ColorSwatch'

function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${grams} г (${(grams / 1000).toFixed(2)} кг)`
  }
  return `${grams} г`
}

export function Overview() {
  const [overview, setOverview] = useState<InventoryOverview | null>(null)
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getOverview(), getSummary()])
      .then(([o, s]) => {
        setOverview(o)
        setSummary(s)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить остатки'))
  }, [])

  if (error) return <p role="alert">{error}</p>
  if (!overview || !summary) return <p>Загрузка...</p>

  return (
    <div className="overview-page">
      <h1>Остатки</h1>

      <div className="kpi-row">
        <div className="stat-tile">
          <div className="stat-tile-label">Остаток всего</div>
          <div className="stat-tile-value">{formatWeight(Math.round(Number(summary.remaining_kg) * 1000))}</div>
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
                    Пока нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="chart-card">
          <h2>Пора дозаказать</h2>
          {overview.reorder.length === 0 ? (
            <p className="chart-empty">Всё в достатке</p>
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
