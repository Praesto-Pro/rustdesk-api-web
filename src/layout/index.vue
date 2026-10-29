<template>
  <div class="app-shell" :class="{ 'is-collapsed': !isMobile && app.setting.sideIsCollapse }"
    :style="{ '--prc-sidebar-width': app.setting.sideIsCollapse ? '68px' : '240px' }">
    <a class="skip-link" href="#main-content">{{ T('Skip to content') }}</a>
    <aside v-if="!isMobile" class="app-sidebar"><GAside :compact="app.setting.sideIsCollapse" /></aside>
    <div class="app-workspace">
      <header class="app-header"><GHeader :mobile="isMobile" :navigation-open="navigationOpen" @toggle-navigation="toggleNavigation" @search="searchOpen = true" /></header>
      <div class="app-sheet">
        <Tags />
        <main id="main-content" ref="mainContent" class="app-main" tabindex="-1">
          <div class="page-heading">
            <h1>{{ T(context.title) }}</h1>
            <p v-if="context.description">{{ T(context.description) }}</p>
          </div>
          <router-view v-slot="{ Component }">
            <keep-alive :include="tags.cached"><component :is="Component" /></keep-alive>
          </router-view>
        </main>
      </div>
    </div>
    <el-drawer v-if="isMobile" v-model="navigationOpen" direction="ltr" size="min(320px, 100vw)" :with-header="false"
      :show-close="false" :title="T('Navigation')" :aria-label="T('Navigation')" class="prc-nav-drawer" destroy-on-close @closed="restoreNavigationFocus">
      <GAside mobile @close="navigationOpen = false" />
    </el-drawer>
    <PageSearch v-model="searchOpen" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/store/app'
import { useRouteStore } from '@/store/router'
import { useTagsStore } from '@/store/tags'
import { buildNavigation, navigationContext } from '@/utils/navigation'
import { T } from '@/utils/i18n'
import GAside from '@/layout/components/aside.vue'
import GHeader from '@/layout/components/header.vue'
import Tags from '@/layout/components/tags/index.vue'
import PageSearch from '@/layout/components/PageSearch.vue'
const app = useAppStore()
const routeStore = useRouteStore()
const tags = useTagsStore()
const route = useRoute()
const media = window.matchMedia('(max-width: 1100px)')
const isMobile = ref(media.matches)
const navigationOpen = ref(false)
const searchOpen = ref(false)
const mainContent = ref(null)
let navigationTrigger = null
let navigatedFromDrawer = false
const context = computed(() => navigationContext(route, buildNavigation(routeStore.routes)))
function toggleNavigation(event) {
  if (isMobile.value) {
    navigationTrigger = event?.currentTarget
    navigatedFromDrawer = false
    navigationOpen.value = !navigationOpen.value
  } else app.sideCollapse()
}
function restoreNavigationFocus() {
  const target = navigatedFromDrawer ? mainContent.value : navigationTrigger
  target?.focus({ preventScroll: true })
  navigatedFromDrawer = false
}
function resize(event) { isMobile.value = event.matches; navigationOpen.value = false }
function shortcut(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.altKey && !event.isComposing) {
    event.preventDefault()
    navigationOpen.value = false
    searchOpen.value = !searchOpen.value
  }
}
watch(() => route.name, async () => {
  if (navigationOpen.value) { navigatedFromDrawer = true; navigationOpen.value = false }
  else { await nextTick(); mainContent.value?.focus({ preventScroll: true }) }
  mainContent.value?.scrollTo({ top: 0 })
})
onMounted(() => { media.addEventListener('change', resize); window.addEventListener('keydown', shortcut) })
onBeforeUnmount(() => { media.removeEventListener('change', resize); window.removeEventListener('keydown', shortcut) })
</script>

<style scoped>
/* 1440 = 240px navigation + 1200px workspace; the sheet is inset 8px and uses 24px gutters. */
.app-shell { height: 100dvh; min-height: 320px; display: grid; grid-template-columns: var(--prc-sidebar-width) minmax(0, 1fr); background: var(--prc-canvas); }
.app-sidebar { min-height: 0; min-width: 0; }
.app-workspace { display: grid; grid-template-rows: 60px minmax(0, 1fr); min-width: 0; min-height: 0; }
.app-header { display: flex; gap: 12px; align-items: center; padding: 0 20px 0 12px; min-width: 0; }
.app-sheet { display: flex; flex-direction: column; min-width: 0; min-height: 0; margin: 0 8px 8px 0; border: 1px solid var(--prc-border); border-radius: 12px; background: var(--prc-surface); overflow: hidden; }
.app-main { flex: 1; min-width: 0; min-height: 0; padding: 24px; overflow: auto; }
.page-heading { margin-bottom: 24px; }
.page-heading h1 { margin: 0; font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -.45px; color: var(--prc-text); }
.page-heading p { margin: 6px 0 0; color: var(--prc-muted); font-size: 14px; line-height: 21px; }
@media (max-width: 1100px) {
  .app-shell { grid-template-columns: minmax(0, 1fr); }
  .app-workspace { grid-template-rows: 56px minmax(0, 1fr); }
  .app-header { padding-inline: 12px; gap: 10px; }
  .app-sheet { margin-left: 8px; }
  .app-main { padding: 20px; }
}
@media (max-width: 600px) {
  .app-sheet { margin: 0; border: 0; border-radius: 0; }
  .app-main { padding: 20px 16px; }
  .page-heading { margin-bottom: 20px; }
  .page-heading h1 { font-size: 22px; line-height: 30px; }
}
</style>
