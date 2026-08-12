import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { deleteFilament, listFilaments, updateFilament, type Filament } from '../api/filaments'
import { ApiError } from '../api/client'
import { MATERIALS } from '../materials'

const PAGE_SIZE = 50
const SORTABLE_FIELDS = new Set(['brand', 'price', 'rating', 'weight_remaining_g', 'created_at'])

function RemainingCell({ filament, onSaved }: { filament: Filament; onSaved: (updated: Filament) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(String(filament.weight_remaining_g))
  const [isSaving, setIsSaving] = useState(false)

  if (!isEditing) {
    return (
      <button type="button" className="link-button" onClick={() => setIsEditing(true)}>
        {filament.weight_remaining_g} г
      </button>
    )
  }

  async function save() {
    setIsSaving(true)
    try {
      const updated = await updateFilament(filament.id, { weight_remaining_g: Number(value) })
      onSaved(updated)
      setIsEditing(false)
    } catch {
      setValue(String(filament.weight_remaining_g))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <input
      type="number"
      min={0}
      autoFocus
      value={value}
      disabled={isSaving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setValue(String(filament.weight_remaining_g))
          setIsEditing(false)
        }
      }}
    />
  )
}

const columnHelper = createColumnHelper<Filament>()

export function FilamentList() {
  const navigate = useNavigate()
  const [data, setData] = useState<Filament[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [brand, setBrand] = useState('')
  const [material, setMaterial] = useState('')
  const [offset, setOffset] = useState(0)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }])

  const sort = sorting[0]

  const refetch = useCallback(() => {
    setIsLoading(true)
    setError(null)
    listFilaments({
      brand: brand || undefined,
      material: material || undefined,
      sort: sort?.id,
      order: sort?.desc ? 'desc' : 'asc',
      limit: PAGE_SIZE,
      offset,
    })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить список'))
      .finally(() => setIsLoading(false))
  }, [brand, material, sort?.id, sort?.desc, offset])

  useEffect(() => {
    refetch()
  }, [refetch])

  function replaceRow(updated: Filament) {
    setData((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
  }

  async function handleDelete(filament: Filament) {
    if (!confirm(`Удалить катушку ${filament.brand} ${filament.material}?`)) return
    await deleteFilament(filament.id)
    refetch()
  }

  const columns = [
    columnHelper.accessor('brand', { header: 'Бренд' }),
    columnHelper.accessor('material', { header: 'Материал' }),
    columnHelper.accessor('color', { header: 'Цвет', cell: (c) => c.getValue() ?? '—' }),
    columnHelper.accessor('weight_remaining_g', {
      header: 'Остаток',
      cell: (c) => <RemainingCell filament={c.row.original} onSaved={replaceRow} />,
    }),
    columnHelper.accessor('price', {
      header: 'Цена',
      cell: (c) => `${c.getValue()} ${c.row.original.currency}`,
    }),
    columnHelper.accessor('price_per_kg', {
      header: '€/кг',
      cell: (c) => `${c.getValue()} ${c.row.original.currency}`,
    }),
    columnHelper.accessor('rating', { header: 'Рейтинг', cell: (c) => c.getValue() ?? '—' }),
    columnHelper.accessor('vendor', { header: 'Где куплено', cell: (c) => c.getValue() ?? '—' }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (c) => (
        <div className="row-actions">
          <button type="button" onClick={() => navigate(`/filaments/${c.row.original.id}/edit`)}>
            Изменить
          </button>
          <button type="button" onClick={() => handleDelete(c.row.original)}>
            Удалить
          </button>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="filament-list">
      <div className="list-header">
        <h1>Филамент</h1>
        <button type="button" onClick={() => navigate('/filaments/new')}>
          Добавить катушку
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Фильтр по бренду"
          value={brand}
          onChange={(e) => {
            setOffset(0)
            setBrand(e.target.value)
          }}
        />
        <select
          value={material}
          onChange={(e) => {
            setOffset(0)
            setMaterial(e.target.value)
          }}
        >
          <option value="">Все материалы</option>
          {MATERIALS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {error && <p role="alert">{error}</p>}

      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortable = SORTABLE_FIELDS.has(header.column.id)
                return (
                  <th
                    key={header.id}
                    onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    className={sortable ? 'sortable' : undefined}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? ''}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
          {!isLoading && data.length === 0 && (
            <tr>
              <td colSpan={columns.length}>Пока нет ни одной катушки</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="pagination">
        <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
          Назад
        </button>
        <button type="button" disabled={data.length < PAGE_SIZE} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
          Вперёд
        </button>
      </div>
    </div>
  )
}
