export function httpUrl(value, base = window.location.origin) {
  const url = new URL(value, base)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Invalid external URL')
  }
  return url
}
