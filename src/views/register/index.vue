<template>
  <main class="auth-page">
    <section class="auth-panel" aria-labelledby="register-title">
      <div class="auth-brand"><BrandMark /></div>
      <h1 id="register-title" class="auth-heading">{{ T('Create an account') }}</h1>
      <p class="auth-description">{{ T('Join Praesto Remote Control.') }}</p>
      <div v-if="submitError" class="auth-status" role="alert"><p>{{ submitError }}</p></div>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="auth-form" @submit.prevent="submit">
        <el-form-item :label="T('Username')" prop="username"><el-input v-model="form.username" name="username" autocomplete="username" :disabled="submitting" /></el-form-item>
        <el-form-item :label="T('Email')" prop="email">
          <el-input v-model="form.email" name="email" type="email" autocomplete="email" :disabled="submitting" aria-describedby="register-email-help" />
          <p id="register-email-help" class="auth-field-help">{{ T('Optional') }}</p>
        </el-form-item>
        <el-form-item :label="T('Password')" prop="password"><el-input v-model="form.password" name="password" type="password" autocomplete="new-password" show-password :disabled="submitting" /></el-form-item>
        <el-form-item :label="T('ConfirmPassword')" prop="confirm_password"><el-input v-model="form.confirm_password" name="confirm_password" type="password" autocomplete="new-password" show-password :disabled="submitting" /></el-form-item>
        <el-button native-type="submit" type="primary" class="auth-submit" :loading="submitting">{{ T('Create account') }}</el-button>
      </el-form>
      <div class="auth-footer"><span>{{ T('Already have an account?') }}</span><router-link to="/login">{{ T('Sign in') }}</router-link></div>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import BrandMark from '@/components/BrandMark.vue'
import { T } from '@/utils/i18n'
import { register } from '@/api/user'
import { useUserStore } from '@/store/user'
import { useRouteStore } from '@/store/router'
import { postAuthenticationDestination } from '@/utils/navigation'
import { useAppStore } from '@/store/app'
import '@/styles/auth.scss'
const router = useRouter()
const userStore = useUserStore()
const routeStore = useRouteStore()
const appStore = useAppStore()
const formRef = ref(null)
const submitting = ref(false)
const submitError = ref('')
const form = reactive({ username: '', email: '', password: '', confirm_password: '' })
const rules = computed(() => ({
  username: [{ required: true, message: T('ParamRequired', { param: T('Username') }), trigger: 'blur' }],
  password: [{ required: true, message: T('ParamRequired', { param: T('Password') }), trigger: 'blur' }],
  confirm_password: [
    { required: true, message: T('ParamRequired', { param: T('ConfirmPassword') }), trigger: 'blur' },
    { validator: (_rule, value, callback) => {
      if (value !== form.password) callback(new Error(T('PasswordNotMatchConfirmPassword')))
      else callback()
    }, trigger: 'blur' },
  ],
}))
const submit = async () => {
  if (submitting.value) return
  submitting.value = true
  submitError.value = ''
  try {
    if (!await formRef.value.validate().catch(() => false)) return
    const res = await register(form)
    if (!res?.data) throw new Error('Missing registration response')
    userStore.saveUserData(res.data)
    appStore.loadConfig()
    ElMessage.success(T('OperationSuccess'))
    await router.push(postAuthenticationDestination(router, routeStore.routes))
  } catch {
    submitError.value = T('Your account could not be created. Check your details and try again.')
  } finally {
    submitting.value = false
  }
}
</script>
