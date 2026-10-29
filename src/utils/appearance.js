import { ref } from 'vue'

// Keep the existing theme preference key so the redesign respects saved choices.
const media = window.matchMedia('(prefers-color-scheme: dark)')
let preference = 'auto'
try { preference = localStorage.getItem('vueuse-color-scheme') || 'auto' } catch {}
export const isDark = ref(preference === 'dark' || (preference === 'auto' && media.matches))
function applyTheme() {
  document.documentElement.classList.toggle('dark', isDark.value)
  document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark.value ? '#111111' : '#f1f4f5')
}
applyTheme()
media.addEventListener('change', event => {
  if (preference === 'auto') { isDark.value = event.matches; applyTheme() }
})
export function toggleTheme() {
  isDark.value = !isDark.value
  preference = isDark.value ? 'dark' : 'light'
  try { localStorage.setItem('vueuse-color-scheme', preference) } catch {}
  applyTheme()
}
