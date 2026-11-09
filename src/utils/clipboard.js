import Clipboard from 'clipboard'
import { ElMessage } from 'element-plus'
import { T } from '@/utils/i18n'

export function handleClipboard (text, event) {
  const clipboard = new Clipboard(event.target.toString(), {
    text: () => text,
  })
  clipboard.on('success', () => {
    ElMessage.success(T('CopySuccess'))
    clipboard.destroy()
  })
  clipboard.on('error', () => {
    ElMessage.error(T('CopyFailed'))
    clipboard.destroy()
  })
  clipboard.onClick(event)
}

export function copyImage (targetNode) {
  if (window.getSelection) {
    // Chrome and other mainstream browsers
    var selection = window.getSelection()
    selection.removeAllRanges()
    var range = document.createRange()
    range.selectNode(targetNode)
    selection.addRange(range)
  } else if (document.body.createTextRange) {
    console.log('IE')
    // ie
    const range = document.body.createTextRange()
    range.moveToElementText(targetNode)
    range.select()
  }
  document.execCommand('copy')
}

export async function copyDeviceId (id, event) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(String(id))
    } else {
      const input = document.createElement('textarea')
      input.value = String(id)
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      let copied
      try { copied = document.execCommand('copy') } finally {
        input.remove()
        event?.currentTarget?.focus()
      }
      if (!copied) throw new Error('Clipboard unavailable')
    }
    ElMessage.success(T('CopySuccess'))
  } catch (_) {
    ElMessage.error(T('CopyFailed'))
  }
}
