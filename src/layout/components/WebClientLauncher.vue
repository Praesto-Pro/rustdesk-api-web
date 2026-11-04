<template>
  <el-dialog v-model="open" title="Browser remote connection" width="640px" :close-on-click-modal="false">
    <p v-if="loading" role="status">Loading browser connection settings…</p>
    <div v-if="error" role="alert"><p>{{ error }}</p><el-button @click="load">Retry</el-button></div>
    <template v-if="ready">
      <p>Connect to device <strong>{{ deviceID }}</strong> using the browser client.</p>
      <p>First time in this browser? Open the web client, enter these values in its ID/relay server settings, and save. Enable WebRTC P2P connections if supported. Then return here and choose Connect to device.</p>
      <dl class="browser-settings">
        <dt>Device ID</dt><dd>{{ deviceID }}</dd>
        <dt>ID server</dt><dd>{{ config.id_server }}</dd>
        <dt>Relay server</dt><dd>{{ config.relay_server }}</dd>
        <dt>Public key</dt><dd>{{ config.key || 'No key provided — ask your administrator.' }}</dd>
      </dl>
      <p>The hosted client keeps its own server preferences. Your Praesto sign-in and device password are not included in these links. Enter the device password or approve the request when prompted.</p>
      <p v-if="copied" role="status">{{ copied }}</p>
      <div class="browser-actions">
        <el-button @click="copySettings">Copy connection settings</el-button>
        <a :href="config.client_url" target="_blank" rel="noopener noreferrer">Open web client settings</a>
        <a class="browser-connect" :href="connectionURL" target="_blank" rel="noopener noreferrer">Connect to device</a>
      </div>
    </template>
  </el-dialog>
</template>
<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { browserConnectionSettings } from '@/api/account'
import { hostedClientLink, httpUrl } from '@/utils/safe-url'
const open = ref(false), loading = ref(false), ready = ref(false), error = ref(''), copied = ref(''), deviceID = ref('')
const config = reactive({ client_url: 'https://rustdesk.com/web/', id_server: '', relay_server: '', key: '' })
const connectionURL = computed(() => ready.value ? hostedClientLink(config.client_url, deviceID.value) : '')
let requestVersion = 0
async function load() {
  const version = ++requestVersion
  loading.value = true; ready.value = false; error.value = copied.value = ''
  try {
    const { data } = await browserConnectionSettings()
    if (version !== requestVersion) return
    const url = httpUrl(data.client_url)
    if (url.protocol !== 'https:') throw new Error('Browser client must use HTTPS.')
    const publicHost = window.location.host
    Object.assign(config, data, { client_url: url.href, id_server: data.id_server || `wss://${publicHost}/ws/id`, relay_server: data.relay_server || `wss://${publicHost}/ws/relay` })
    ready.value = true
  } catch { if (version === requestVersion) error.value = 'Browser settings could not load. Ask your administrator to deploy the updated API and check Server settings.' }
  finally { if (version === requestVersion) loading.value = false }
}
function show(event) { deviceID.value = String(event.detail.id); open.value = true; load() }
async function copySettings() {
  try {
    await navigator.clipboard.writeText(`Device ID: ${deviceID.value}\nID server: ${config.id_server}\nRelay server: ${config.relay_server}\nPublic key: ${config.key}`)
    copied.value = 'Connection settings copied.'
  } catch { copied.value = 'Clipboard access is unavailable. Select and copy the settings above.' }
}
onMounted(() => window.addEventListener('praesto:web-client', show))
onBeforeUnmount(() => { requestVersion++; window.removeEventListener('praesto:web-client', show) })
</script>
<style scoped>
.browser-settings { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 10px; padding: 16px; background: var(--prc-surface-soft); }
.browser-settings dt { color: var(--prc-muted); }
.browser-settings dd { margin: 0; overflow-wrap: anywhere; user-select: text; }
.browser-actions { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.browser-connect { padding: 10px 14px; color: #fff; background: var(--prc-accent, #007da8); border-radius: 6px; }
</style>
