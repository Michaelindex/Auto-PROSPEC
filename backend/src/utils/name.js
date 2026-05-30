export function extractFirstName(fullName) {
  if (!fullName) return 'Amigo'
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  const first = parts[0] || trimmed
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}
