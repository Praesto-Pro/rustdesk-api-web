export function httpUrl(value, base = window.location.origin) {
  const url = new URL(value, base)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Invalid external URL')
  }
  return url
}

// API configuration can contain a server-local address behind a reverse proxy.
// Browsers must use the public site instead of connecting to their own machine.
export function webClientUrl(apiServer, origin = window.location.origin) {
  let base = httpUrl(apiServer || origin, origin)
  const hostname = base.hostname.toLowerCase().replace(/\.$/, '')
  const serverLocal = hostname === 'localhost' || hostname.endsWith('.localhost') ||
    /^127\./.test(hostname) || ['0.0.0.0', '[::1]', '[::]'].includes(hostname)
  if (serverLocal) base = httpUrl(origin)
  base.search = ''
  base.hash = ''
  base.pathname = base.pathname.replace(/\/+$/, '') + '/webclient2/'
  return base
}
