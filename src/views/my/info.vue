<template>
  <div class="account-settings">
    <section class="account-section" aria-labelledby="account-details-title">
      <div class="account-section-label"><h2 id="account-details-title">{{ T('Account details') }}</h2><p>{{ T('Your Praesto Remote Control account.') }}</p></div>
      <div class="account-panel">
        <dl class="account-details">
          <div><dt>{{ T('Username') }}</dt><dd>{{ userStore.username || '—' }}</dd></div>
          <div><dt>{{ T('Email') }}</dt><dd :class="{ 'missing-value': !userStore.email }">{{ userStore.email || T('Not provided') }}</dd></div>
        </dl>
        <div class="account-password"><span>{{ T('Password') }}</span><el-button @click="changePwdVisible = true">{{ T('ChangePassword') }}</el-button></div>
      </div>
    </section>
    <section class="account-section" aria-labelledby="account-providers-title">
      <div class="account-section-label"><h2 id="account-providers-title">{{ T('Connected sign-in providers') }}</h2><p>{{ T('Manage the providers linked to your account.') }}</p></div>
      <div class="account-panel" :aria-busy="providersLoading">
        <p v-if="providersLoading && !oidcData.length" class="account-state" role="status">{{ T('Loading sign-in providers…') }}</p>
        <div v-if="providersError" class="account-state" role="alert"><p>{{ providersError }}</p><el-button :loading="providersLoading" @click="getMyOauth">{{ T('Retry') }}</el-button></div>
        <p v-if="!providersLoading && !providersError && !oidcData.length" class="account-state">{{ T('No sign-in providers are available.') }}</p>
        <ul v-if="oidcData.length" class="provider-list">
          <li v-for="provider in oidcData" :key="provider.op" class="provider-row">
            <div class="provider-identity"><span class="provider-name">{{ provider.op }}</span><span class="provider-status">{{ provider.status === 1 ? T('Connected') : T('Not connected') }}</span></div>
            <el-button v-if="provider.status === 1" type="danger" plain :loading="busyProvider === provider.op" :disabled="!!busyProvider && busyProvider !== provider.op" :aria-label="T('Disconnect') + ' ' + provider.op" @click="toUnBind(provider)">{{ T('Disconnect') }}</el-button>
            <el-button v-else :loading="busyProvider === provider.op" :disabled="!!busyProvider && busyProvider !== provider.op" :aria-label="T('Connect') + ' ' + provider.op" @click="toBind(provider)">{{ T('Connect') }}</el-button>
          </li>
        </ul>
        <p v-if="providerActionError" class="account-state" role="alert">{{ providerActionError }}</p>
      </div>
    </section>
    <section v-if="hasAdminMessage" class="account-section" aria-labelledby="account-message-title">
      <div class="account-section-label"><h2 id="account-message-title">{{ T('Message from your administrator') }}</h2></div>
      <div class="account-panel account-message" v-html="html"></div>
    </section>
    <changePwdDialog v-model:visible="changePwdVisible" />
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { marked } from 'marked'
import changePwdDialog from '@/components/changePwdDialog.vue'
import { useUserStore } from '@/store/user'
import { useAppStore } from '@/store/app'
import { bind, unbind } from '@/api/oauth'
import { myOauth } from '@/api/user'
import { T } from '@/utils/i18n'
const appStore = useAppStore()
const userStore = useUserStore()
const changePwdVisible = ref(false)
const oidcData = ref([])
const providersLoading = ref(false)
const providersError = ref('')
const providerActionError = ref('')
const busyProvider = ref('')
const getMyOauth = async () => {
  if (providersLoading.value) return
  providersLoading.value = true
  providersError.value = ''
  try {
    const res = await myOauth()
    if (!Array.isArray(res?.data)) throw new Error('Missing sign-in providers')
    oidcData.value = res.data
  } catch {
    providersError.value = T('Sign-in providers could not load. Try again.')
  } finally { providersLoading.value = false }
}
getMyOauth()
const toBind = async (row) => {
  if (busyProvider.value) return
  busyProvider.value = row.op
  providerActionError.value = ''
  try {
    const res = await bind({ op: row.op })
    if (!res?.data?.url) throw new Error('Missing authorization URL')
    window.open(res.data.url)
  } catch { providerActionError.value = T('The provider could not be connected. Try again.') }
  finally { busyProvider.value = '' }
}
const toUnBind = async (row) => {
  if (busyProvider.value) return
  busyProvider.value = row.op
  providerActionError.value = ''
  try {
    const confirmed = await ElMessageBox.confirm(
      T('Confirm?', { param: T('Disconnect') + ' ' + row.op }),
      { confirmButtonText: T('Disconnect'), cancelButtonText: T('Cancel'), type: 'warning' },
    ).catch(() => false)
    if (!confirmed) return
    await unbind({ op: row.op })
    await getMyOauth()
  } catch { providerActionError.value = T('The provider could not be disconnected. Try again.') }
  finally { busyProvider.value = '' }
}
const hasAdminMessage = computed(() => typeof appStore.setting.hello === 'string' && !!appStore.setting.hello.trim())
const html = computed(() => marked(appStore.setting.hello || ''))
</script>
<style scoped lang="scss">
.account-settings { width: 100%; }
.account-section { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(0, 2fr); gap: 24px; padding: 24px 0; &:first-child { padding-top: 0; } & + & { border-top: 1px solid var(--prc-border); } }
.account-section-label { h2 { margin: 4px 0 8px; font-size: 16px; font-weight: 600; line-height: 1.4; } p { margin: 0; max-width: 32ch; color: var(--prc-muted); font-size: 14px; line-height: 1.6; } }
.account-panel { min-width: 0; padding: 20px; border-radius: 8px; background: var(--prc-surface-muted); }
.account-details { margin: 0; display: grid; gap: 20px; div { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 16px; } dt { color: var(--prc-muted); } dd { margin: 0; overflow-wrap: anywhere; color: var(--prc-text); } .missing-value { color: var(--prc-muted); } }
.account-password { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 20px; margin-top: 20px; border-top: 1px solid var(--prc-border); > span { color: var(--prc-muted); } }
.provider-list { list-style: none; margin: 0; padding: 0; }
.provider-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; &:first-child { padding-top: 0; } &:last-child { padding-bottom: 0; } & + & { border-top: 1px solid var(--prc-border); } .el-button { flex: none; } }
.provider-identity { min-width: 0; display: grid; gap: 4px; }
.provider-name { color: var(--prc-text); overflow-wrap: anywhere; }
.provider-status { color: var(--prc-muted); font-size: 12px; line-height: 1.5; }
.account-state { margin: 0; color: var(--prc-muted); font-size: 14px; line-height: 1.6; p { margin: 0 0 8px; } }
.provider-list + .account-state { margin-top: 16px; }
.account-message { overflow-wrap: anywhere; line-height: 1.6; :deep(> :first-child) { margin-top: 0; } :deep(> :last-child) { margin-bottom: 0; } :deep(img) { max-width: 100%; height: auto; } :deep(pre) { overflow-x: auto; } }
@media (max-width: 900px) { .account-section { grid-template-columns: minmax(0, 1fr); gap: 16px; } .account-section-label p { max-width: none; } }
@media (max-width: 480px) { .account-panel { padding: 16px; } .account-details div { grid-template-columns: minmax(0, 1fr); gap: 6px; } .account-panel .el-button { min-height: 44px; white-space: normal; } }
</style>
