import { useState } from 'react'
import { consumeAllFilament, consumeFilament, type Filament } from '../api/filaments'

export function FilamentConsumption({ filament, onSaved, initiallyOpen = false }: {
  filament: Filament; onSaved: (updated: Filament) => void; initiallyOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen)
  const [grams, setGrams] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (filament.weight_remaining_g === 0) return <span>Израсходована</span>

  const amount = Number(grams)
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= filament.weight_remaining_g

  async function save(consumeAll: boolean) {
    if (isSaving || (!consumeAll && !valid)) return
    if (consumeAll && !confirm(`Списать весь остаток катушки #${filament.id}?`)) return
    setIsSaving(true)
    setError('')
    try {
      const updated = consumeAll
        ? await consumeAllFilament(filament.id)
        : await consumeFilament(filament.id, amount)
      onSaved(updated)
      setIsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить расход')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return <>
    <button type="button" disabled={isSaving}
      onClick={() => { setGrams(''); setError(''); setIsOpen(true) }}>Добавить расход</button>
    <button type="button" disabled={isSaving} onClick={() => save(true)}>Израсходована</button>
    {error && <p role="alert">{error}</p>}
  </>

  return <form onSubmit={(event) => {
    event.preventDefault()
    void save(false)
  }}>
    <label>Расход, г
      <input type="number" min={1} max={filament.weight_remaining_g} step={1} required
        autoFocus value={grams} disabled={isSaving} onChange={(e) => setGrams(e.target.value)} />
    </label>
    <small>Доступно: {filament.weight_remaining_g} г{valid ? ` · Останется: ${filament.weight_remaining_g - amount} г` : ''}</small>
    <button type="submit" disabled={!valid || isSaving}>{isSaving ? 'Сохранение…' : 'Добавить расход'}</button>
    <button type="button" disabled={isSaving} onClick={() => save(true)}>Весь остаток</button>
    <button type="button" disabled={isSaving} onClick={() => setIsOpen(false)}>Отмена</button>
    {error && <p role="alert">{error}</p>}
  </form>
}
