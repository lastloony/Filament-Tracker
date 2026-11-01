import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { InventoryByMaterialColor } from '../api/stats'
import { COLOR_PALETTE } from '../colors'
import { ColorSwatch } from './ColorSwatch'

function formatWeight(grams: number) {
  return grams >= 1000
    ? `${(grams / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг`
    : `${grams.toLocaleString('ru-RU')} г`
}

export function ColorInventoryChart({ rows, filtered }: { rows: InventoryByMaterialColor[]; filtered: boolean }) {
  const grouped = new Map<string | null, { name: string; remaining_g: number; hex: string | null }>()
  for (const row of rows) {
    if (row.remaining_g <= 0) continue
    const key = row.color || null
    const current = grouped.get(key) ?? { name: row.color || 'Цвет не указан', remaining_g: 0, hex: null }
    current.remaining_g += row.remaining_g
    if (!current.hex && row.color_hex && /^#[0-9a-f]{6}$/i.test(row.color_hex)) current.hex = row.color_hex
    grouped.set(key, current)
  }
  const data = Array.from(grouped.values()).map((row) => ({
    ...row,
    hex: row.hex ?? COLOR_PALETTE.find((color) => color.name === row.name)?.hex ?? '#9CA3AF',
  })).sort((a, b) => b.remaining_g - a.remaining_g || a.name.localeCompare(b.name, 'ru'))
  const total = data.reduce((sum, row) => sum + row.remaining_g, 0)

  return (
    <section className="chart-card">
      <h2>Остатки по цветам{filtered ? ' (по фильтру)' : ''}</h2>
      {data.length === 0 ? (
        <p className="chart-empty">Нет филамента с положительным остатком{filtered ? ' по выбранным фильтрам' : ''}.</p>
      ) : (
        <div className="color-inventory-layout">
          <div className="color-inventory-chart" role="img" aria-label="Кольцевая диаграмма остатков по цветам. Точные значения указаны в таблице рядом.">
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <PieChart>
                <Pie data={data} dataKey="remaining_g" nameKey="name" innerRadius="52%" outerRadius="85%"
                  paddingAngle={data.length > 1 ? 2 : 0} stroke="var(--text-muted)" strokeWidth={1} isAnimationActive={false}>
                  {data.map((row, index) => <Cell key={`${index}-${row.name}`} fill={row.hex} />)}
                </Pie>
                <Tooltip formatter={(value) => [formatWeight(Number(value)), 'Остаток']}
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6 }}
                  itemStyle={{ color: 'var(--text)' }} />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize={18} fontWeight={600}>
                  {formatWeight(total)}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <table className="color-inventory-legend">
            <caption>Доля цвета в весе оставшегося филамента</caption>
            <thead><tr><th>Цвет</th><th>Остаток</th><th>Доля</th></tr></thead>
            <tbody>
              {data.map((row, index) => {
                const percent = row.remaining_g / total * 100
                return (
                  <tr key={`${index}-${row.name}`}>
                    <td><span className="color-cell"><ColorSwatch hex={row.hex} name={row.name} />{row.name}</span></td>
                    <td>{formatWeight(row.remaining_g)}</td>
                    <td>{percent < 0.1 ? '<0,1' : percent.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="overview-hint">Одинаковые названия цветов объединяются по всем выбранным материалам. Если оттенок не задан, используется цвет палитры или серый.</p>
    </section>
  )
}
