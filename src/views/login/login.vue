<template>
  <main class="auth-page">
    <section class="auth-panel" aria-labelledby="sign-in-title">
      <div class="auth-brand"><BrandMark /></div>
      <h1 id="sign-in-title" class="auth-heading">{{ T('Sign in') }}</h1>
      <p class="auth-description">{{ T('Access your devices and address books.') }}</p>
      <div v-if="optionsLoading" class="auth-progress" role="status" aria-live="polite">{{ T('Loading sign-in options…') }}</div>
      <div v-if="optionsError" class="auth-status" role="alert">
        <p>{{ optionsError }}</p>
        <el-button @click="loadLoginOptions()" :loading="optionsLoading">{{ T('Try again') }}</el-button>
      </div>
      <div v-if="signInError" class="auth-status" role="alert"><p>{{ signInError }}</p></div>
      <template v-if="optionsReady">
        <el-form v-if="!disablePwd" ref="formRef" :model="form" :rules="rules" label-position="top" class="auth-form" @submit.prevent="login">
          <el-form-item :label="T('Username')" prop="username">
            <el-input v-model="form.username" name="username" autocomplete="username" :disabled="signingIn || !!pendingProvider" />
          </el-form-item>
          <el-form-item :label="T('Password')" prop="password">
            <el-input v-model="form.password" name="password" type="password" autocomplete="current-password" show-password :disabled="signingIn || !!pendingProvider" />
          </el-form-item>
          <el-form-item v-if="captchaRequired" :label="T('Captcha')" prop="captcha">
            <div class="auth-captcha">
              <el-input v-model="form.captcha" name="captcha" autocomplete="off" :disabled="signingIn || !!pendingProvider || captchaLoading" aria-describedby="captcha-help" />
              <button type="button" class="auth-captcha-refresh" :aria-label="T('Refresh verification image')" :title="T('Refresh verification image')" :disabled="captchaLoading || signingIn || !!pendingProvider" @click="loadCaptcha">
                <img v-if="captchaCode" :src="captchaCode.b64" :alt="T('Verification image')" />
                <span v-else>{{ captchaLoading ? T('Loading…') : T('Retry') }}</span>
              </button>
            </div>
            <p id="captcha-help" class="auth-field-help">{{ T('Enter the characters shown in the image.') }}</p>
            <p v-if="captchaError" class="auth-field-help" role="alert">{{ captchaError }}</p>
          </el-form-item>
          <el-button native-type="submit" type="primary" class="auth-submit" :loading="signingIn" :disabled="!!pendingProvider || captchaLoading || (captchaRequired && !captchaCode)">{{ T('Sign in') }}</el-button>
        </el-form>
        <div v-if="options.length && !disablePwd" class="auth-divider"><span>{{ T('Or continue with') }}</span></div>
        <div v-if="options.length" class="auth-providers">
          <el-button v-for="option in options" :key="option.name" class="auth-provider" :loading="pendingProvider === option.name" :disabled="signingIn || (!!pendingProvider && pendingProvider !== option.name)" @click="handleOIDCLogin(option.name)">
            <img :src="getProviderImage(option.name)" alt="" />
            <span>{{ T(option.name) }}</span>
          </el-button>
        </div>
        <div v-else-if="disablePwd" class="auth-status" role="status"><p>{{ T('No sign-in methods are available. Contact your administrator.') }}</p></div>
        <div v-if="allowRegister && !disablePwd" class="auth-footer">
          <span>{{ T('Need an account?') }}</span>
          <router-link to="/register">{{ T('Register') }}</router-link>
        </div>
      </template>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import BrandMark from '@/components/BrandMark.vue'
import { useUserStore } from '@/store/user'
import { useRouteStore } from '@/store/router'
import { postAuthenticationDestination } from '@/utils/navigation'
import { T } from '@/utils/i18n'
import { loginOptions, captcha } from '@/api/login'
import { getCode, removeCode } from '@/utils/auth'
import googleImage from '@/assets/google.png'
import githubImage from '@/assets/github.png'
import oidcImage from '@/assets/oidc.png'
import '@/styles/auth.scss'

const userStore = useUserStore()
const routeStore = useRouteStore()
const route = useRoute()
const router = useRouter()
const formRef = ref(null)
const options = ref([])
const optionsLoading = ref(true)
const optionsReady = ref(false)
const optionsError = ref('')
const signInError = ref('')
const signingIn = ref(false)
const pendingProvider = ref('')
const allowRegister = ref(false)
const disablePwd = ref(false)
const captchaCode = ref(null)
const captchaRequired = ref(false)
const captchaLoading = ref(false)
const captchaError = ref('')

let platform = navigator.platform
if (platform.indexOf('Mac') === 0) platform = 'mac'
else if (platform.indexOf('Win') === 0) platform = 'windows'
else if (platform.indexOf('Linux armv') === 0) platform = 'android'
else if (platform.indexOf('Linux') === 0) platform = 'linux'
const userAgent = navigator.userAgent
let browser = 'Unknown Browser'
if (/chrome|crios/i.test(userAgent)) browser = 'Chrome'
else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox'
else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari'
else if (/edg/i.test(userAgent)) browser = 'Edge'

const form = reactive({ username: '', password: '', platform, captcha: '', captcha_id: '' })
const rules = computed(() => ({
  username: [{ required: true, message: T('ParamRequired', { param: T('Username') }), trigger: 'blur' }],
  password: [{ required: true, message: T('ParamRequired', { param: T('Password') }), trigger: 'blur' }],
  captcha: [{ required: captchaRequired.value, message: T('ParamRequired', { param: T('Captcha') }), trigger: 'blur' }],
}))
const completeSignIn = async () => {
  ElMessage.success(T('LoginSuccess'))
  await router.replace(postAuthenticationDestination(router, routeStore.routes, route.query.redirect))
}
const login = async () => {
  if (signingIn.value || pendingProvider.value || disablePwd.value || !optionsReady.value || captchaLoading.value) return
  if (captchaRequired.value && !captchaCode.value) return
  signingIn.value = true
  signInError.value = ''
  try {
    if (!await formRef.value.validate().catch(() => false)) return
    await userStore.login(form)
    await completeSignIn()
  } catch (error) {
    signInError.value = T('Unable to sign in. Check your details and try again.')
    if (error?.code === 110) {
      captchaRequired.value = true
      await loadCaptcha()
    }
  } finally {
    signingIn.value = false
  }
}
const loadCaptcha = async () => {
  if (captchaLoading.value) return
  captchaLoading.value = true
  captchaError.value = ''
  try {
    const res = await captcha()
    if (!res?.data?.captcha?.b64 || !res.data.captcha.id) throw new Error('Missing captcha')
    captchaCode.value = res.data.captcha
    form.captcha_id = res.data.captcha.id
    form.captcha = ''
  } catch {
    captchaCode.value = null
    form.captcha_id = ''
    captchaError.value = T('The verification image could not load. Select Retry to try again.')
  } finally {
    captchaLoading.value = false
  }
}
const handleOIDCLogin = async (provider) => {
  if (pendingProvider.value) return
  pendingProvider.value = provider
  signInError.value = ''
  try {
    await userStore.oidc(provider, platform, browser)
  } catch {
    signInError.value = T('Unable to start sign-in. Try again.')
  } finally {
    pendingProvider.value = ''
  }
}
const providerImageMap = { google: googleImage, github: githubImage, oidc: oidcImage }
const getProviderImage = (provider) => providerImageMap[provider.toLowerCase()] || oidcImage
const loadLoginOptions = async (autoLogin = true) => {
  optionsLoading.value = true
  optionsError.value = ''
  try {
    const res = await loginOptions()
    if (!res?.data || !Array.isArray(res.data.ops)) throw new Error('Missing sign-in options')
    options.value = res.data.ops.map(name => ({ name }))
    disablePwd.value = !!res.data.disable_pwd
    allowRegister.value = !!res.data.register
    captchaRequired.value = !!res.data.need_captcha
    optionsReady.value = true
    if (captchaRequired.value && !disablePwd.value) void loadCaptcha()
    if (autoLogin && res.data.auto_oidc && res.data.ops.length) await handleOIDCLogin(res.data.ops[0])
  } catch {
    optionsReady.value = false
    optionsError.value = T('Sign-in options could not load. Try again.')
  } finally {
    optionsLoading.value = false
  }
}
onMounted(async () => {
  const code = getCode()
  if (code) {
    try {
      const res = await userStore.query(code)
      if (res) {
        removeCode()
        await completeSignIn()
        return
      }
    } catch {
      // Keep the form available when an external sign-in cannot be completed.
    }
    signInError.value = T('Sign-in was not completed. Try again or choose another method.')
    await loadLoginOptions(false)
  } else {
    await loadLoginOptions()
  }
})
</script>
