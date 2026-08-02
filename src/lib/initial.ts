export function initial(name: string | null | undefined): string {
  if (!name) return '?'
  const n = name.trim()
  return (n.split(/\s+/).pop() ?? n)[0] ?? '?'
}
