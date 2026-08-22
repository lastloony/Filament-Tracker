export function ColorSwatch({ hex, name }: { hex: string | null; name?: string | null }) {
  if (!hex) return null
  return <span className="color-swatch" style={{ background: hex }} title={name ?? hex} />
}
