import { useState } from 'react'

export function DesktopBackups() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch('/api/desktop/backups/download', { credentials: 'include' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.detail ?? 'Не удалось создать резервную копию')
      }
      const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
        ?? 'Filament-Tracker-backup.db'
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      try {
        link.click()
      } finally {
        link.remove()
        // Leave time for the webview to start its native download.
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
      setMessage(`Файл ${filename} подготовлен для скачивания. Проверьте папку «Загрузки» или выбранное место сохранения.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать резервную копию')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="chart-card">
      <h2>Резервная копия</h2>
      <p>Сохраните катушки, справочники и настройки отдельным файлом на компьютер. Интернет не нужен.</p>
      <button type="button" onClick={download} disabled={busy}>
        {busy ? 'Создаём копию…' : 'Скачать резервную копию'}
      </button>
      <p className="overview-hint">Эти файлы сохраняются отдельно от пяти автоматических копий и не удаляются приложением.</p>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
