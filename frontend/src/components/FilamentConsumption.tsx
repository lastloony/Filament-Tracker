import { useState } from 'react'
import { consumeFilament, type Filament } from '../api/filaments'

export function FilamentConsumption({ filament, onSaved, initiallyOpen = false }: {
  filament: Filament; onSaved: (updated: Filament) => void; initiallyOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen)
  const [grams, setGrams] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return <button type="button" disabled={filament.weight_remaining_g === 0}
    onClick={() => { setGrams(''); setError(''); setIsOpen(true) }}>Добавить расход</button>

  const amount = Number(grams)
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= filament.weight_remaining_g

  return <form onSubmit={async (event) => {
    event.preventDefault()
    if (!valid || isSaving) return
    setIsSaving(true)
    setError('')
    try {
      onSaved(await consumeFilament(filament.id, amount))
      setIsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить расход')
    } finally {
      setIsSaving(false)
    }
  }}>
    <label>Расход, г
      <input type="number" min={1} max={filament.weight_remaining_g} step={1} required
        autoFocus value={grams} disabled={isSaving} onChange={(e) => setGrams(e.target.value)} />
    </label>
    <small>Доступно: {filament.weight_remaining_g} г{valid ? ` · Останется: ${filament.weight_remaining_g - amount} г` : ''}</small>
    <button type="submit" disabled={!valid || isSaving}>{isSaving ? 'Сохранение…' : 'Добавить расход'}</button>
    <button type="button" disabled={isSaving} onClick={() => setIsOpen(false)}>Отмена</button>
    {error && <p role="alert">{error}</p>}
  </form>
}
