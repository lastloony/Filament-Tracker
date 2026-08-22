import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  type Brand,
  type Currency,
  type Material,
  createBrand,
  createCurrency,
  createMaterial,
  listBrands,
  listCurrencies,
  listMaterials,
  setBaseCurrency,
} from '../api/settings'
import { ApiError } from '../api/client'

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

export function Settings() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCurrency, setNewCurrency] = useState('')
  const [isSubmittingCurrency, setIsSubmittingCurrency] = useState(false)
  const [currencyError, setCurrencyError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([listBrands(), listMaterials(), listCurrencies()])
      .then(([b, m, c]) => {
        setBrands(b)
        setMaterials(m)
        setCurrencies(c)
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
    </div>
  )
}
