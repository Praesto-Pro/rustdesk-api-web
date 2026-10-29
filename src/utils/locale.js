const supported = new Set(['en', 'fr', 'ko', 'ru', 'es', 'zh-CN', 'zh-TW'])
export function normalizeLanguage(value) {
  if (supported.has(value)) return value
  const language = String(value || '').toLowerCase().replaceAll('_', '-')
  if (language.startsWith('zh')) return /hant|tw|hk|mo/.test(language) ? 'zh-TW' : 'zh-CN'
  const base = language.split('-')[0]
  return supported.has(base) ? base : 'en'
}
