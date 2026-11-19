import { Fragment, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QuickConsumption } from '../components/QuickConsumption'
import { getOverview, getOverviewByBrand, type InventoryByBrand, type InventoryOverview } from '../api/stats'
import { disableReorder, listMaterials, type Material } from '../api/settings'
import { ApiError } from '../api/client'
import { ColorSwatch } from '../components/ColorSwatch'
import { ColorInventoryChart } from '../components/ColorInventoryChart'

function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${grams} г (${(grams / 1000).toFixed(2)} кг)`
  }
  return `${grams} г`
}

type ColorOption = { color: string; color_hex: string | null }

export function Overview() {
  const navigate = useNavigate()
  const [showConsumption, setShowConsumption] = useState(false)
  const [revision, setRevision] = useState(0)
  const [overview, setOverview] = useState<InventoryOverview | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [colorOptions, setColorOptions] = useState<ColorOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [isDisabling, setIsDisabling] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [colorFilter, setColorFilter] = useState('')

  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [brandBreakdown, setBrandBreakdown] = useState<InventoryByBrand[]>([])
  const [brandBreakdownError, setBrandBreakdownError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listMaterials(), getOverview()]).then(([m, unfiltered]) => {
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
    }).catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить справочники'))
  }, [revision])

  useEffect(() => {
    setError(null)
    let cancelled = false
    getOverview({ color: colorFilter })
      .then((data) => { if (!cancelled) setOverview(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить остатки') })
    return () => { cancelled = true }
  }, [colorFilter, revision])

  const allMaterials = selectedMaterials.length === 0
  const hasFilters = !allMaterials || colorFilter !== ''

  async function hideRecommendation(material: string, color: string) {
    setIsDisabling(true)
    setReorderError(null)
    try {
      await disableReorder(material, color)
      setRevision((value) => value + 1)
    } catch (err) {
      setReorderError(err instanceof ApiError ? err.message : 'Не удалось отключить рекомендацию')
    } finally {
      setIsDisabling(false)
    }
  }

  function resetFilters() {
    setSelectedMaterials([])
    setColorFilter('')
  }

  function toggleMaterial(material: string) {
    setSelectedMaterials((selected) => selected.includes(material)
      ? selected.filter((name) => name !== material)
      : [...selected, material])
  }

  function toggleBrandBreakdown(material: string, color: string | null) {
    if (!color) return
    const key = `${material}|${color}`
    if (expandedKey === key) {
      setExpandedKey(null)
      return
    }
    setExpandedKey(key)
    setBrandBreakdown([])
    setBrandBreakdownError(null)
    getOverviewByBrand(material, color)
      .then(setBrandBreakdown)
      .catch((err) => setBrandBreakdownError(err instanceof ApiError ? err.message : 'Не удалось загрузить остаток'))
  }

  if (error) return <p role="alert">{error}</p>
  if (!overview) return <p>Загрузка...</p>

  const inventory = overview.by_material_color.filter((row) => allMaterials || selectedMaterials.includes(row.material))
  const reorder = overview.reorder.filter((row) => allMaterials || selectedMaterials.includes(row.material))
  const totalGrams = inventory.reduce((sum, row) => sum + row.remaining_g, 0)

  return (
    <div className="overview-page">
      <div className="list-header overview-header">
        <h1>Остатки</h1>
        <div className="form-actions">
          <button type="button" onClick={() => navigate('/filaments/new')}>Добавить катушку</button>
          <button type="button" aria-expanded={showConsumption}
            onClick={() => setShowConsumption((open) => !open)}>Добавить расход пластика</button>
        </div>
      </div>
      {showConsumption && <QuickConsumption onSaved={() => {
        setRevision((value) => value + 1)
        setExpandedKey(null)
      }} />}

      <div className="overview-filters">
        <div className="material-tabs" role="group" aria-label="Типы пластика">
          <button
            type="button"
            aria-pressed={allMaterials}
            className={`material-tab${allMaterials ? ' selected' : ''}`}
            onClick={() => setSelectedMaterials([])}
          >
            Все материалы
          </button>
          {materials.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={selectedMaterials.includes(m.name)}
              className={`material-tab${selectedMaterials.includes(m.name) ? ' selected' : ''}`}
              onClick={() => toggleMaterial(m.name)}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="color-palette-row">
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
      </div>

      <div className="kpi-row">
        <div className="stat-tile">
          <div className="stat-tile-label">Остаток{hasFilters ? ' (по фильтру)' : ' всего'}</div>
          <div className="stat-tile-value">{formatWeight(totalGrams)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Комбинаций тип/цвет</div>
          <div className="stat-tile-value">{inventory.length}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Пора дозаказать</div>
          <div className="stat-tile-value">{reorder.length}</div>
        </div>
      </div>

      <ColorInventoryChart rows={inventory} filtered={hasFilters} />

      <div className="chart-grid">
        <div className="chart-card">
          <h2>Остаток по типу и цвету</h2>
          <p className="overview-hint">Клик по цвету — остаток по производителям</p>
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
              {inventory.map((row) => {
                const key = `${row.material}|${row.color ?? ''}`
                const isExpanded = expandedKey === key
                return (
                  <Fragment key={key}>
                    <tr>
                      <td>{row.material}</td>
                      <td
                        className={`color-cell${row.color ? ' color-cell-clickable' : ''}`}
                        onClick={() => toggleBrandBreakdown(row.material, row.color)}
                      >
                        <ColorSwatch hex={row.color_hex} name={row.color} />
                        {row.color ?? '—'}
                      </td>
                      <td>{row.spool_count}</td>
                      <td>{formatWeight(row.remaining_g)}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="overview-brand-breakdown">
                          {brandBreakdownError && <p role="alert">{brandBreakdownError}</p>}
                          {!brandBreakdownError && brandBreakdown.length === 0 && <p className="chart-empty">Загрузка...</p>}
                          {brandBreakdown.length > 0 && (
                            <table>
                              <thead>
                                <tr>
                                  <th>Производитель</th>
                                  <th>Катушек</th>
                                  <th>Остаток</th>
                                </tr>
                              </thead>
                              <tbody>
                                {brandBreakdown.map((b) => (
                                  <tr key={b.brand}>
                                    <td>{b.brand}</td>
                                    <td>{b.spool_count}</td>
                                    <td>{formatWeight(b.remaining_g)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {inventory.length === 0 && (
                <tr>
                  <td colSpan={4} className="chart-empty">
                    {hasFilters ? 'Под фильтр ничего не подошло' : 'Пока нет данных'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="chart-card reorder-card">
          <h2>Пора дозаказать</h2>
          <p className="overview-hint">«Больше не заказывать» отключает рекомендации этого материала и цвета для всех брендов. Включить обратно можно в настройках порогов.</p>
          {reorderError && <p role="alert">{reorderError}</p>}
          <p className="overview-hint">Сравниваем суммарный запас материала и цвета с порогом. Правила для бренда учитывают только его катушки.</p>
          {reorder.length === 0 ? (
            <p className="chart-empty">{hasFilters ? 'Под фильтр ничего не подошло' : 'Всё в достатке'}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Бренд</th>
                  <th>Материал</th>
                  <th>Цвет</th>
                  <th>Остаток</th>
                  <th>Порог</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {reorder.map((item) => (
                  <tr key={`${item.id}|${item.brand ?? ''}`}>
                    <td>{item.brand ?? 'Все бренды'}</td>
                    <td>{item.material}</td>
                    <td className="color-cell">
                      <ColorSwatch hex={item.color_hex} name={item.color} />
                      {item.color ?? '—'}
                    </td>
                    <td className="low-stock">{formatWeight(item.remaining_g)}</td>
                    <td>{formatWeight(item.threshold_g)}</td>
                    <td><button type="button" className="link-button"
                      disabled={isDisabling || !item.color}
                      onClick={() => { if (item.color) void hideRecommendation(item.material, item.color) }}>
                      Больше не заказывать
                    </button></td>
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
