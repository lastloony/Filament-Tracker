import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createFilament, getFilament, updateFilament, type FilamentInput } from '../api/filaments'
import { ApiError } from '../api/client'
import { listBrands, listCurrencies, listMaterials, type Brand, type Currency, type Material } from '../api/settings'
import { COLOR_PALETTE, nearestColorName } from '../colors'

const EMPTY_FORM: FilamentInput = {
  brand: '',
  material: '',
  color: '',
  color_hex: null,
  weight_total_g: 1000,
  weight_remaining_g: 1000,
  price: null,
  currency: 'RUB',
  rating: null,
  vendor: '',
  purchase_date: '',
  notes: '',
}

export function FilamentForm() {
  const { id } = useParams()
  const isEditing = id !== undefined
  const navigate = useNavigate()

  const [form, setForm] = useState<FilamentInput>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(isEditing)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const colorInputRef = useRef<HTMLInputElement>(null)
  const remainingEdited = useRef(false)

  useEffect(() => {
    Promise.all([listBrands(), listMaterials(), listCurrencies()]).then(([b, m, c]) => {
      setBrands(b)
      setMaterials(m)
      setCurrencies(c)
      if (!isEditing) {
        const base = c.find((currency) => currency.is_base)
        if (base) setForm((prev) => ({ ...prev, currency: base.code }))
      }
    }).catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить справочники'))
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) return
    getFilament(Number(id))
      .then((filament) =>
        setForm({
          brand: filament.brand,
          material: filament.material,
          color: filament.color ?? '',
          color_hex: filament.color_hex,
          weight_total_g: filament.weight_total_g,
          weight_remaining_g: filament.weight_remaining_g,
          price: filament.price,
          currency: filament.currency,
          rating: filament.rating,
          vendor: filament.vendor ?? '',
          purchase_date: filament.purchase_date ?? '',
          notes: filament.notes ?? '',
        }),
      )
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить запись'))
      .finally(() => setIsLoading(false))
  }, [id, isEditing])

  function updateField<K extends keyof FilamentInput>(key: K, value: FilamentInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!form.color.trim()) {
      setError('Укажите цвет: выберите его в палитре или введите название')
      return
    }
    setIsSubmitting(true)

    const payload: FilamentInput = {
      ...form,
      brand: form.brand.trim() || 'Нонейм',
      price: form.price === '' ? null : form.price,
      color: form.color.trim(),
      vendor: form.vendor || null,
      purchase_date: form.purchase_date || null,
      notes: form.notes || null,
    }

    try {
      if (isEditing) {
        await updateFilament(Number(id), payload)
      } else {
        await createFilament(payload)
      }
      navigate('/filaments')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить запись')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <p>Загрузка...</p>

  const isCustomColor = form.color_hex !== null && !COLOR_PALETTE.some((c) => c.hex === form.color_hex)

  return (
    <form className="filament-form" onSubmit={handleSubmit}>
      <h1>{isEditing ? 'Редактировать катушку' : 'Новая катушка'}</h1>
      <p className="overview-hint">Укажите материал, цвет и вес. Если бренд не выбран, сохраним «Нонейм».</p>

      <label>
        Бренд
        <select
          value={form.brand}
          onChange={(e) => updateField('brand', e.target.value)}
        >
          <option value="">Бренд неизвестен — Нонейм</option>
          {form.brand && !brands.some((b) => b.name === form.brand) && (
            <option value={form.brand}>{form.brand}</option>
          )}
          {brands.map((b) => (
            <option key={b.id} value={b.name}>{b.name}</option>
          ))}
        </select>
      </label>
      <p className="overview-hint">
        Не нашли нужный бренд? Можно оставить «Нонейм» или{' '}
        <Link to="/settings">Добавить бренд в настройках</Link>
      </p>

      <label>
        Материал
        <select
          value={form.material}
          onChange={(e) => updateField('material', e.target.value)}
          required
        >
          <option value="" disabled>Выберите материал</option>
          {form.material && !materials.some((m) => m.name === form.material) && (
            <option value={form.material}>{form.material}</option>
          )}
          {materials.map((m) => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>
      </label>

      <label>
        Цвет
        <div className="color-palette">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              className={`color-palette-swatch${form.color_hex === c.hex ? ' selected' : ''}`}
              style={{ background: c.hex }}
              title={c.name}
              aria-label={c.name}
              onClick={() => setForm((prev) => ({ ...prev, color: c.name, color_hex: c.hex }))}
            />
          ))}
          <button
            type="button"
            className={`color-palette-custom${isCustomColor ? ' selected' : ''}`}
            style={isCustomColor ? { background: form.color_hex ?? undefined } : undefined}
            title="Свой оттенок"
            aria-label="Свой оттенок"
            onClick={() => colorInputRef.current?.click()}
          >
            {!isCustomColor && '+'}
          </button>
          <input
            ref={colorInputRef}
            type="color"
            className="color-hidden-input"
            value={form.color_hex ?? '#808080'}
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const hex = e.target.value
              setForm((prev) => ({ ...prev, color_hex: hex, color: nearestColorName(hex) }))
            }}
          />
        </div>
        <input
          type="text"
          className="color-name-input"
          value={form.color ?? ''}
          onChange={(e) => updateField('color', e.target.value)}
          placeholder="Название цвета"
          required
        />
      </label>

      <div className="form-row">
        <label>
          Вес катушки, г
          <input
            type="number"
            min={1}
            value={form.weight_total_g}
            onChange={(e) => {
              const total = Number(e.target.value)
              setForm((prev) => ({ ...prev, weight_total_g: total,
                ...(!isEditing && !remainingEdited.current ? { weight_remaining_g: total } : {}) }))
            }}
            required
          />
        </label>

        <label>
          Остаток, г
          <input
            type="number"
            min={0}
            value={form.weight_remaining_g}
            onChange={(e) => {
              remainingEdited.current = true
              updateField('weight_remaining_g', Number(e.target.value))
            }}
            required
          />
        </label>
      </div>

      <details className="optional-details" open={isEditing}>
        <summary>Дополнительно: покупка, рейтинг и заметки</summary>
        <p className="overview-hint">Все поля ниже необязательны. Пустая цена — неизвестна, 0 — получено бесплатно.</p>
      <div className="form-row">
        <label>
          Цена
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.price ?? ''}
            placeholder="Не указана"
            onChange={(e) => updateField('price', e.target.value === '' ? null : e.target.value)}
          />
        </label>

        <label>
          Валюта
          <select value={form.currency} onChange={(e) => updateField('currency', e.target.value)}
            disabled={form.price === null || form.price === ''}>
            {form.currency && !currencies.some((c) => c.code === form.currency) && (
              <option value={form.currency}>{form.currency}</option>
            )}
            {currencies.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}
                {c.is_base ? ' (базовая)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Рейтинг
        <select
          value={form.rating ?? ''}
          onChange={(e) => updateField('rating', e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">— не указан</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label>
        Где куплено
        <input type="text" value={form.vendor ?? ''} onChange={(e) => updateField('vendor', e.target.value)} />
      </label>

      <label>
        Дата покупки
        <input
          type="date"
          value={form.purchase_date ?? ''}
          onChange={(e) => updateField('purchase_date', e.target.value)}
        />
      </label>

      <label>
        Заметки
        <textarea value={form.notes ?? ''} onChange={(e) => updateField('notes', e.target.value)} rows={3} />
      </label>
      </details>

      {error && <p role="alert">{error}</p>}

      <div className="form-actions">
        <button type="button" onClick={() => navigate('/filaments')}>
          Отмена
        </button>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
