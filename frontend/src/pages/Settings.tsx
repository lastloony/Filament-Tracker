import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  type Brand,
  type Currency,
  type Material,
  type ReorderRule,
  createBrand,
  createCurrency,
  createMaterial,
  createReorderRule,
  deleteReorderRule,
  listBrands,
  listCurrencies,
  listMaterials,
  listReorderRules,
  setBaseCurrency,
} from '../api/settings'
import { ApiError } from '../api/client'
import { COLOR_PALETTE } from '../colors'
import { ColorSwatch } from '../components/ColorSwatch'

function NameTable({
  title,
  columnLabel,
  items,
  onAdd,
}: {
  title: string
  columnLabel: string
  items: { id: number; name: string }[]
  onAdd: (name: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!value.trim()) return
    setError(null)
    setIsSubmitting(true)
    try {
      await onAdd(value.trim())
      setValue('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="chart-card">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>{columnLabel}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="chart-empty">Пока пусто</td>
            </tr>
          )}
          <tr>
            <td>
              <form className="settings-add-row" onSubmit={handleSubmit}>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Новое значение"
                />
                <button type="submit" disabled={isSubmitting}>
                  Добавить
                </button>
              </form>
            </td>
          </tr>
        </tbody>
      </table>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

function ReorderRulesSection({
  rules,
  materials,
  brands,
  onAdd,
  onDelete,
}: {
  rules: ReorderRule[]
  materials: Material[]
  brands: Brand[]
  onAdd: (data: { material: string; color: string; brand: string | null; threshold_g: number }) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  const [material, setMaterial] = useState('')
  const [color, setColor] = useState('')
  const [brand, setBrand] = useState('')
  const [threshold, setThreshold] = useState('300')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!material || !color || !threshold) return
    setError(null)
    setIsSubmitting(true)
    try {
      await onAdd({ material, color, brand: brand || null, threshold_g: Number(threshold) })
      setMaterial('')
      setColor('')
      setBrand('')
      setThreshold('300')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить правило')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="chart-card">
      <h2>Порог «пора дозаказать»</h2>
      <p className="overview-hint">
        Правило с производителем действует только для него; без производителя — для всех катушек этого материала и
        цвета. Если подходящего правила нет, используется общий порог 300 г.
      </p>
      <table>
        <thead>
          <tr>
            <th>Материал</th>
            <th>Цвет</th>
            <th>Производитель</th>
            <th>Порог, г</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.material}</td>
              <td className="color-cell">
                <ColorSwatch hex={COLOR_PALETTE.find((c) => c.name === rule.color)?.hex ?? null} name={rule.color} />
                {rule.color}
              </td>
              <td>{rule.brand ?? <span className="badge">любой</span>}</td>
              <td>{rule.threshold_g} г</td>
              <td className="settings-action-cell">
                <button type="button" className="link-button" onClick={() => onDelete(rule.id)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
          {rules.length === 0 && (
            <tr>
              <td colSpan={5} className="chart-empty">
                Правил нет — используется общий порог 300 г для всех
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <form className="reorder-rule-form" onSubmit={handleSubmit}>
        <select value={material} onChange={(e) => setMaterial(e.target.value)} required>
          <option value="">Материал</option>
          {materials.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        <select value={color} onChange={(e) => setColor(e.target.value)} required>
          <option value="">Цвет</option>
          {COLOR_PALETTE.map((c) => (
            <option key={c.hex} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Любой производитель</option>
          {brands.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="Порог, г"
          required
        />
        <button type="submit" disabled={isSubmitting}>
          Добавить
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export function Settings() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [reorderRules, setReorderRules] = useState<ReorderRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCurrency, setNewCurrency] = useState('')
  const [isSubmittingCurrency, setIsSubmittingCurrency] = useState(false)
  const [currencyError, setCurrencyError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([listBrands(), listMaterials(), listCurrencies(), listReorderRules()])
      .then(([b, m, c, r]) => {
        setBrands(b)
        setMaterials(m)
        setCurrencies(c)
        setReorderRules(r)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить настройки'))
      .finally(() => setIsLoading(false))
  }, [])

  async function handleAddCurrency() {
    const code = newCurrency.trim().toUpperCase()
    if (code.length !== 3) {
      setCurrencyError('Код валюты — 3 буквы')
      return
    }
    setCurrencyError(null)
    setIsSubmittingCurrency(true)
    try {
      const created = await createCurrency(code)
      setCurrencies((prev) => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)))
      setNewCurrency('')
    } catch (err) {
      setCurrencyError(err instanceof ApiError ? err.message : 'Не удалось добавить валюту')
    } finally {
      setIsSubmittingCurrency(false)
    }
  }

  function handleCurrencyKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddCurrency()
    }
  }

  async function handleSetBase(id: number) {
    const updated = await setBaseCurrency(id)
    setCurrencies((prev) => prev.map((c) => (c.id === updated.id ? updated : { ...c, is_base: false })))
  }

  if (isLoading) return <p>Загрузка...</p>

  return (
    <div className="settings-page">
      <h1>Настройки</h1>
      {error && <p role="alert">{error}</p>}

      <div className="chart-grid">
        <div className="chart-card">
          <h2>Валюта</h2>
          <table>
            <thead>
              <tr>
                <th>Код</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((currency) => (
                <tr key={currency.id}>
                  <td>{currency.code}</td>
                  <td className="settings-action-cell">
                    {currency.is_base ? (
                      <span className="badge">базовая</span>
                    ) : (
                      <button type="button" className="link-button" onClick={() => handleSetBase(currency.id)}>
                        Сделать базовой
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <input
                    type="text"
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                    onKeyDown={handleCurrencyKeyDown}
                    maxLength={3}
                    placeholder="USD"
                  />
                </td>
                <td className="settings-action-cell">
                  <button type="button" onClick={handleAddCurrency} disabled={isSubmittingCurrency}>
                    Добавить
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          {currencyError && <p role="alert">{currencyError}</p>}
        </div>

        <NameTable
          title="Производители филамента"
          columnLabel="Название"
          items={brands}
          onAdd={async (name) => {
            const created = await createBrand(name)
            setBrands((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
          }}
        />

        <NameTable
          title="Тип филамента"
          columnLabel="Название"
          items={materials}
          onAdd={async (name) => {
            const created = await createMaterial(name)
            setMaterials((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
          }}
        />
      </div>

      <ReorderRulesSection
        rules={reorderRules}
        materials={materials}
        brands={brands}
        onAdd={async (data) => {
          const created = await createReorderRule(data)
          setReorderRules((prev) => [...prev, created])
        }}
        onDelete={async (id) => {
          await deleteReorderRule(id)
          setReorderRules((prev) => prev.filter((r) => r.id !== id))
        }}
      />
    </div>
  )
}
