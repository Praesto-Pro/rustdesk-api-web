<template>
  <el-button type="primary" :disabled="!enabled" :title="enabled ? 'Invite a user to choose their own password' : 'Enable SMTP and email invitations under Server settings'" @click="open = true">Invite by email</el-button>
  <el-dialog v-model="open" title="Invite a user" width="520px" :close-on-click-modal="false">
    <p>The recipient will receive a link to choose their own password. Invitations create standard user accounts and expire after 48 hours.</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <el-form label-position="top" @submit.prevent="send">
      <el-form-item label="Username"><el-input v-model="username" autocomplete="off" :disabled="busy" /></el-form-item>
      <el-form-item label="Email"><el-input v-model="email" type="email" autocomplete="off" :disabled="busy" /></el-form-item>
      <el-button native-type="submit" type="primary" :loading="busy">Send invitation</el-button>
      <el-button :disabled="busy" @click="open = false">Close</el-button>
    </el-form>
  </el-dialog>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import { accountOptions, inviteUser } from '@/api/account'
const open = ref(false), enabled = ref(false), busy = ref(false), username = ref(''), email = ref(''), error = ref(''), notice = ref('')
onMounted(async () => { try { enabled.value = !!(await accountOptions()).data.invite_enabled } catch { enabled.value = false } })
async function send() {
  if (busy.value) return
  error.value = notice.value = ''
  if (!username.value.trim() || !email.value.trim()) { error.value = 'Enter a username and email address.'; return }
  busy.value = true
  try { const res = await inviteUser({ username: username.value.trim(), email: email.value.trim() }); notice.value = res.data.message; username.value = email.value = '' }
  catch (e) { error.value = e?.message || 'The invitation could not be sent.' }
  finally { busy.value = false }
}
</script>
