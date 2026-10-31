import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

type UpdateResult = {
  current_version: string
  latest_version: string | null
  update_available: boolean
  has_release: boolean
}

export function DesktopUpdates() {
  const [version, setVersion] = useState('')
  const [result, setResult] = useState<UpdateResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ version: string }>('/version')
      .then((data) => setVersion(data.version))
      .catch(() => setError('Не удалось определить установленную версию'))
  }, [])

  async function check() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const data = await apiFetch<UpdateResult>('/desktop/updates')
      setVersion(data.current_version)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось проверить обновления')
    } finally {
      setBusy(false)
    }
  }

  async function openRelease() {
    setOpening(true)
    setError(null)
    try {
      await apiFetch('/desktop/updates/open', { method: 'POST' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть страницу релиза')
    } finally {
      setOpening(false)
    }
  }

  return (
    <section className="chart-card">
      <h2>Обновления приложения</h2>
      {version && <p>Установленная версия: {version}</p>}
      <p>Проверка выполняется через GitHub по нажатию кнопки. Обновление устанавливается вручную.</p>
      <button type="button" disabled={busy} onClick={check}>
        {busy ? 'Проверяем…' : 'Проверить обновления'}
      </button>
      <div role="status" aria-live="polite">
        {result && !result.has_release && <p>Опубликованных релизов пока нет.</p>}
        {result?.has_release && !result.update_available && (
          <p>{result.latest_version === version ? 'Установлена актуальная версия.' : 'Установленная версия новее опубликованной.'}</p>
        )}
        {result?.update_available && (
          <>
            <p>Доступна версия {result.latest_version}. Скачайте установщик, закройте приложение и установите обновление.</p>
            <button type="button" disabled={opening} onClick={openRelease}>
              {opening ? 'Открываем…' : 'Открыть страницу релиза'}
            </button>
          </>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
