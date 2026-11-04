<template>
  <section class="account-settings" aria-labelledby="account-settings-title">
    <h2 id="account-settings-title">Account and email settings</h2>
    <p>Manage the message shown on My account and email-based account access.</p>
    <p v-if="loading" role="status">Loading settings…</p>
    <div v-if="loadError" role="alert"><p>{{ loadError }}</p><el-button @click="load">Retry</el-button></div>
    <template v-if="loaded">
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="notice" role="status">{{ notice }}</p>
      <el-form label-position="top" @submit.prevent="save">
        <el-form-item label="Message from your administrator">
          <el-input v-model="form.message" type="textarea" :rows="4" :maxlength="20000" />
          <p class="setting-help">Markdown is supported. Use <span v-pre>{{username}}</span> for the signed-in username. Leave empty to hide the message.</p>
        </el-form-item>
        <el-form-item label="Public admin URL">
          <el-input v-model="form.public_url" placeholder="https://remote.praesto.pro/_admin" type="url" />
          <p class="setting-help">The HTTPS address of this admin app, including /_admin if used. Email links use this address.</p>
        </el-form-item>
        <h3>Browser remote connections</h3>
        <el-form-item label="Browser client URL"><el-input v-model="form.browser_client_url" type="url" placeholder="https://rustdesk.com/web/" /></el-form-item>
        <el-form-item label="Browser ID server"><el-input v-model="form.browser_id_server" placeholder="wss://remote.praesto.pro/ws/id" /></el-form-item>
        <el-form-item label="Browser relay server"><el-input v-model="form.browser_relay_server" placeholder="wss://remote.praesto.pro/ws/relay" /></el-form-item>
        <p class="setting-help">Blank browser server addresses use the public admin URL's hostname with /ws/id and /ws/relay. These settings are shown when opening a browser connection; first configure them in the hosted client. Native desktop server settings stay separate.</p>
        <h3>SMTP server</h3>
        <el-form-item label="Enable outgoing email"><el-switch v-model="form.smtp_enabled" /></el-form-item>
        <template v-if="form.smtp_enabled">
          <div class="smtp-grid">
            <el-form-item label="SMTP hostname"><el-input v-model="form.smtp_host" autocomplete="off" /></el-form-item>
            <el-form-item label="SMTP port"><el-input-number v-model="form.smtp_port" :min="1" :max="65535" /></el-form-item>
          </div>
          <el-form-item label="Encryption">
            <el-select v-model="form.smtp_mode"><el-option label="STARTTLS (usually port 587)" value="starttls" /><el-option label="TLS (usually port 465)" value="tls" /></el-select>
          </el-form-item>
          <el-form-item label="SMTP username"><el-input v-model="form.smtp_username" autocomplete="off" /></el-form-item>
          <el-form-item label="SMTP password">
            <el-input v-model="password" type="password" autocomplete="new-password" show-password :placeholder="passwordSet ? 'Saved password — leave blank to keep it' : 'SMTP password'" />
            <el-checkbox v-model="clearPassword">Clear the saved password</el-checkbox>
          </el-form-item>
          <el-form-item label="Sender email"><el-input v-model="form.smtp_from" type="email" /></el-form-item>
        </template>
        <el-form-item label="Email password resets"><el-switch v-model="form.reset_enabled" :disabled="!form.smtp_enabled" /></el-form-item>
        <el-form-item label="Email account invitations"><el-switch v-model="form.invite_enabled" :disabled="!form.smtp_enabled" /></el-form-item>
        <p class="setting-help">Reset links expire after 30 minutes. Invitations expire after 48 hours and create a standard user account when accepted. Both can be used once.</p>
        <el-button native-type="submit" type="primary" :loading="saving">Save account settings</el-button>
      </el-form>
      <el-form v-if="form.smtp_enabled" label-position="top" class="mail-test" @submit.prevent="sendTest">
        <h3>Test saved mail settings</h3>
        <el-form-item label="Test recipient email"><el-input v-model="testEmail" type="email" /></el-form-item>
        <el-button native-type="submit" :loading="testing">Send test email</el-button>
      </el-form>
    </template>
  </section>
</template>
<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { getServerSettings, saveServerSettings, testMail } from '@/api/account'
import { useAppStore } from '@/store/app'
const app = useAppStore()
const form = reactive({ message: '', public_url: '', browser_client_url: 'https://rustdesk.com/web/', browser_id_server: '', browser_relay_server: '', smtp_enabled: false, smtp_host: '', smtp_port: 587, smtp_mode: 'starttls', smtp_username: '', smtp_from: '', reset_enabled: false, invite_enabled: false })
const password = ref(''), passwordSet = ref(false), clearPassword = ref(false), testEmail = ref('')
const loading = ref(false), loaded = ref(false), loadError = ref(''), saving = ref(false), testing = ref(false), error = ref(''), notice = ref('')
async function load() {
  loading.value = true; loadError.value = ''
  try { const res = await getServerSettings(); Object.assign(form, res.data.settings); passwordSet.value = res.data.smtp_password_set; loaded.value = true }
  catch { loadError.value = 'Account settings could not load. Check that the updated Praesto API image is deployed.' }
  finally { loading.value = false }
}
async function save() {
  if (saving.value) return
  saving.value = true; error.value = notice.value = ''
  try {
    const res = await saveServerSettings({ ...form, smtp_password: password.value, clear_smtp_password: clearPassword.value })
    Object.assign(form, res.data.settings); passwordSet.value = res.data.smtp_password_set
    password.value = ''; clearPassword.value = false; notice.value = 'Account settings saved.'
    await app.getAdminConfig()
  } catch (e) { error.value = e?.message || 'Settings could not be saved.' }
  finally { saving.value = false }
}
async function sendTest() {
  if (testing.value) return
  testing.value = true; error.value = notice.value = ''
  try { await testMail(testEmail.value.trim()); notice.value = 'Test email accepted by the SMTP server. Check the recipient inbox.' }
  catch (e) { error.value = e?.message || 'Test email could not be sent.' }
  finally { testing.value = false }
}
watch(() => form.smtp_enabled, enabled => { if (!enabled) { form.reset_enabled = false; form.invite_enabled = false } })
onMounted(load)
</script>
<style scoped>
.account-settings { padding: 24px; margin-bottom: 24px; border: 1px solid var(--prc-border); border-radius: 12px; background: var(--prc-surface); }
.account-settings .el-form { max-width: 760px; }
.setting-help { color: var(--prc-muted); font-size: 13px; line-height: 1.5; margin: 8px 0; }
.smtp-grid { display: grid; grid-template-columns: minmax(0, 1fr) 160px; gap: 16px; }
.mail-test { margin-top: 24px; }
@media (max-width: 600px) { .smtp-grid { grid-template-columns: 1fr; } .account-settings { padding: 16px; } }
</style>
