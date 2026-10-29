<template>
  <main class="auth-page">
    <section class="auth-panel" aria-labelledby="not-found-title">
      <div class="auth-brand"><BrandMark /></div>
      <h1 id="not-found-title" class="auth-heading">{{ T('Page not found') }}</h1>
      <p class="auth-description">{{ T('This page may have moved, or your account may not have access.') }}</p>
      <el-button class="auth-submit" type="primary" @click="router.replace(destination)">{{ destination.name ? T('Open workspace') : T('Sign in') }}</el-button>
    </section>
  </main>
</template>
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BrandMark from '@/components/BrandMark.vue'
import { useRouteStore } from '@/store/router'
import { defaultDestination } from '@/utils/navigation'
import { T } from '@/utils/i18n'
import '@/styles/auth.scss'
const router = useRouter()
const routeStore = useRouteStore()
const destination = computed(() => defaultDestination(routeStore.routes) || { path: '/login' })
</script>
