<template>
  <el-config-provider :locale="app.setting.locale.value"><router-view /></el-config-provider>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/store/app'
import { useRouteStore } from '@/store/router'
import { PRODUCT_NAME } from '@/brand'
import { buildNavigation, navigationContext } from '@/utils/navigation'
import { T } from '@/utils/i18n'
import '@/utils/appearance'
const app = useAppStore()
const routes = useRouteStore()
const route = useRoute()
const context = computed(() => navigationContext(route, buildNavigation(routes.routes)))
watch([context, () => app.setting.lang], () => {
  const page = T(context.value.title)
  document.title = page && page !== 'Page' ? page + ' · ' + PRODUCT_NAME : PRODUCT_NAME
  document.documentElement.lang = app.setting.lang
}, { immediate: true, flush: 'post' })
</script>
