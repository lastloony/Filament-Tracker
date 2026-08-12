import { useEffect, useState, type ReactElement } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getByBrand, getByMaterial, getByRating, getSummary, type StatsByGroup, type StatsByRating, type StatsSummary } from '../api/stats'
import { ApiError } from '../api/client'

const tooltipStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 13,
}
const axisTick = { fill: 'var(--text-muted)', fontSize: 12 }

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
    </div>
  )
}

function ChartCard({
  title,
  tableRows,
  children,
}: {
  title: string
  tableRows: { label: string; value: string }[]
  children: ReactElement
}) {
  return (
    <div className="chart-card">
      <h2>{title}</h2>
      {tableRows.length === 0 ? (
        <p className="chart-empty">Нет данных</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            {children}
          </ResponsiveContainer>
          <details>
            <summary>Показать таблицей</summary>
            <table>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  )
}

export function Stats() {
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [byBrand, setByBrand] = useState<StatsByGroup[]>([])
  const [byMaterial, setByMaterial] = useState<StatsByGroup[]>([])
  const [byRating, setByRating] = useState<StatsByRating[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getSummary(), getByBrand(), getByMaterial(), getByRating()])
      .then(([summaryData, brandData, materialData, ratingData]) => {
        setSummary(summaryData)
        setByBrand(brandData)
        setByMaterial(materialData)
        setByRating(ratingData)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить статистику'))
  }, [])

  if (error) return <p role="alert">{error}</p>
  if (!summary) return <p>Загрузка...</p>

  const brandData = byBrand.map((g) => ({ name: g.group, spent: Number(g.total_spent) }))
  const materialData = byMaterial.map((g) => ({ name: g.group, remaining_kg: Math.round((g.remaining_g / 1000) * 100) / 100 }))
  const ratingData = byRating.map((r) => ({ label: r.rating === null ? 'не пробовал' : String(r.rating), count: r.count }))

  return (
    <div className="stats-page">
      <h1>Статистика</h1>

      <div className="kpi-row">
        <StatTile label="Остаток" value={`${summary.remaining_kg} кг`} />
        <StatTile label="Вложено" value={summary.total_invested} />
        <StatTile label="Средний рейтинг" value={summary.avg_rating === null ? '—' : summary.avg_rating.toFixed(1)} />
      </div>

      <div className="chart-grid">
        <ChartCard title="Расходы по брендам" tableRows={brandData.map((d) => ({ label: d.name, value: d.spent.toFixed(2) }))}>
          <BarChart data={brandData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--border)', opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(value) => [Number(value).toFixed(2), 'Потрачено']} />
            <Bar dataKey="spent" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Распределение рейтингов" tableRows={ratingData.map((d) => ({ label: d.label, value: String(d.count) }))}>
          <BarChart data={ratingData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--border)', opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(value) => [Number(value), 'Катушек']} />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Остаток по материалам, кг"
          tableRows={materialData.map((d) => ({ label: d.name, value: `${d.remaining_kg} кг` }))}
        >
          <BarChart data={materialData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'var(--border)', opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(value) => [`${Number(value)} кг`, 'Остаток']} />
            <Bar dataKey="remaining_kg" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  )
}
