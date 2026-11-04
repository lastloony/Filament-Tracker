const moneyFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export function formatMoney(value: string | number): string {
  return moneyFormatter.format(Number(value))
}
