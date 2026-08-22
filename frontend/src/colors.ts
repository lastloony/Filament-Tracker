export const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: 'Белый', hex: '#FFFFFF' },
  { name: 'Чёрный', hex: '#000000' },
  { name: 'Серый', hex: '#808080' },
  { name: 'Красный', hex: '#E53935' },
  { name: 'Оранжевый', hex: '#FB8C00' },
  { name: 'Жёлтый', hex: '#FDD835' },
  { name: 'Зелёный', hex: '#43A047' },
  { name: 'Голубой', hex: '#00ACC1' },
  { name: 'Синий', hex: '#1E88E5' },
  { name: 'Фиолетовый', hex: '#8E24AA' },
  { name: 'Розовый', hex: '#EC407A' },
  { name: 'Коричневый', hex: '#6D4C41' },
  { name: 'Золотой', hex: '#C9A227' },
  { name: 'Серебряный', hex: '#BDBDBD' },
]

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
}

export function nearestColorName(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  let best = COLOR_PALETTE[0]
  let bestDist = Infinity
  for (const c of COLOR_PALETTE) {
    const [cr, cg, cb] = hexToRgb(c.hex)
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = c
    }
  }
  return best.name
}
