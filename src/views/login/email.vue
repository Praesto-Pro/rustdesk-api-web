<template>
  <main class="auth-page">
    <section class="auth-panel" aria-labelledby="email-title">
      <div class="auth-brand"><BrandMark /></div>
      <h1 id="email-title" class="auth-heading">{{ title }}</h1>
      <p class="auth-description">{{ token ? 'Choose your own password for your Praesto account.' : 'Enter your account email address to request a password-reset link.' }}</p>
      <p v-if="error" class="auth-status" role="alert">{{ error }}</p>
      <p v-if="success" class="auth-status" role="status">{{ success }}</p>
      <el-form v-if="!success" label-position="top" class="auth-form" @submit.prevent="submit">
        <template v-if="token">
          <el-form-item label="New password">
            <el-input v-model="password" type="password" autocomplete="new-password" show-password :disabled="busy" />
          </el-form-item>
          <p class="auth-field-help">Use at least 12 characters (up to 72 UTF-8 bytes).</p>
          <el-form-item label="Confirm password">
            <el-input v-model="confirmation" type="password" autocomplete="new-password" show-password :disabled="busy" />
          </el-form-item>
        </template>
        <el-form-item v-else label="Email">
          <el-input v-model="email" type="email" autocomplete="email" :disabled="busy" />
        </el-form-item>
        <el-button native-type="submit" type="primary" class="auth-submit" :loading="busy">{{ token ? 'Set password' : 'Send reset link' }}</el-button>
      </el-form>
      <div class="auth-footer"><router-link to="/login">Back to sign in</router-link></div>
    </section>
  </main>
</template>
<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandMark from '@/components/BrandMark.vue'
import { requestPasswordReset, completeEmailAction } from '@/api/account'
import '@/styles/auth.scss'
const route = useRoute()
const router = useRouter()
// Keep the token only in memory while the form is open; remove it from history.
const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const action = route.query.action === 'invite' ? 'invite' : 'reset'
const tokenMode = !!token.value
if (token.value) router.replace({ path: '/email' })
const title = computed(() => tokenMode ? (action === 'invite' ? 'Set up your account' : 'Set a new password') : 'Reset your password')
const email = ref('')
const password = ref('')
const confirmation = ref('')
const busy = ref(false)
const error = ref('')
const success = ref('')
async function submit() {
  if (busy.value) return
  error.value = ''
  if (token.value) {
    const length = new TextEncoder().encode(password.value).length
    if (length < 12 || length > 72) { error.value = 'Use a password of 12–72 UTF-8 bytes.'; return }
    if (password.value !== confirmation.value) { error.value = 'Passwords do not match.'; return }
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { error.value = 'Enter a valid email address.'; return }
  busy.value = true
  try {
    const res = token.value
      ? await completeEmailAction({ token: token.value, action, password: password.value })
      : await requestPasswordReset(email.value.trim())
    success.value = res.data.message
    password.value = confirmation.value = ''
    token.value = ''
  } catch (e) { error.value = e?.message || 'The request could not be completed. Try again.' }
  finally { busy.value = false }
}
</script>
