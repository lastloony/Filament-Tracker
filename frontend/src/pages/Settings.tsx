import { useEffect, useState, type FormEvent } from 'react'
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

function NameListSection({
  title,
  items,
  onAdd,
}: {
  title: string
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
    <section className="settings-section">
      <h2>{title}</h2>
      <ul className="settings-list">
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
        {items.length === 0 && <li className="settings-empty">Пока пусто</li>}
      </ul>
      <form className="settings-add-form" onSubmit={handleSubmit}>
        <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Новое значение" />
        <button type="submit" disabled={isSubmitting}>
          Добавить
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
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

  async function handleAddCurrency(event: FormEvent) {
    event.preventDefault()
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

  async function handleSetBase(id: number) {
    const updated = await setBaseCurrency(id)
    setCurrencies((prev) => prev.map((c) => (c.id === updated.id ? updated : { ...c, is_base: false })))
  }

  if (isLoading) return <p>Загрузка...</p>

  return (
    <div className="settings-page">
      <h1>Настройки</h1>
      {error && <p role="alert">{error}</p>}

      <section className="settings-section">
        <h2>Валюта</h2>
        <ul className="settings-list">
          {currencies.map((currency) => (
            <li key={currency.id}>
              {currency.code}
              {currency.is_base ? (
                <span className="badge">базовая</span>
              ) : (
                <button type="button" className="link-button" onClick={() => handleSetBase(currency.id)}>
                  Сделать базовой
                </button>
              )}
            </li>
          ))}
        </ul>
        <form className="settings-add-form" onSubmit={handleAddCurrency}>
          <input
            type="text"
            value={newCurrency}
            onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            placeholder="Код (например USD)"
          />
          <button type="submit" disabled={isSubmittingCurrency}>
            Добавить
          </button>
        </form>
        {currencyError && <p role="alert">{currencyError}</p>}
      </section>

      <NameListSection
        title="Производители филамента"
        items={brands}
        onAdd={async (name) => {
          const created = await createBrand(name)
          setBrands((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        }}
      />

      <NameListSection
        title="Тип филамента"
        items={materials}
        onAdd={async (name) => {
          const created = await createMaterial(name)
          setMaterials((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        }}
      />
    </div>
  )
}
