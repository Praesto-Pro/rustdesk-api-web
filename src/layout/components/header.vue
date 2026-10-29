<template>
  <button ref="navigationButton" type="button" class="icon-button navigation-toggle"
    :aria-label="T(mobile ? 'Open navigation' : (app.setting.sideIsCollapse ? 'Expand navigation' : 'Collapse navigation'))"
    :aria-expanded="mobile ? navigationOpen : !app.setting.sideIsCollapse"
    aria-controls="primary-navigation" @click="$emit('toggle-navigation', $event)">
    <el-icon aria-hidden="true"><el-icon-expand v-if="mobile || app.setting.sideIsCollapse" /><el-icon-fold v-else /></el-icon>
  </button>
  <nav class="header-location" :aria-label="T('Breadcrumb')">
    <span class="location-section">{{ T(context.section) }}</span>
    <span class="location-divider" aria-hidden="true">/</span>
    <span class="location-current">{{ T(context.title) }}</span>
  </nav>
  <button type="button" class="page-search-trigger" :aria-label="T('Find a page')" @click="$emit('search')">
    <el-icon aria-hidden="true"><el-icon-search /></el-icon>
    <span>{{ T('Find a page') }}</span><kbd aria-hidden="true">{{ shortcut }}</kbd>
  </button>
  <Setting v-if="!mobile" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/store/app'
import { useRouteStore } from '@/store/router'
import { buildNavigation, navigationContext } from '@/utils/navigation'
import { T } from '@/utils/i18n'
import Setting from '@/layout/components/setting/index.vue'
defineProps({ mobile: Boolean, navigationOpen: Boolean })
defineEmits(['toggle-navigation', 'search'])
const app = useAppStore()
const routes = useRouteStore()
const route = useRoute()
const context = computed(() => navigationContext(route, buildNavigation(routes.routes)))
const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K'
</script>

<style scoped>
.header-location { display: flex; align-items: center; gap: 10px; min-width: 0; font-size: 13px; }
.location-section, .location-divider { color: var(--prc-muted); }
.location-current { color: var(--prc-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-search-trigger { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 6px 10px; margin-left: auto; background: var(--prc-surface); color: var(--prc-muted); border: 1px solid var(--prc-control); border-radius: 6px; font-size: 12px; cursor: pointer; flex: none; }
.page-search-trigger:hover { color: var(--prc-text); border-color: var(--prc-muted); }
.page-search-trigger kbd { margin-left: 24px; font: inherit; color: var(--prc-muted); }
@media (max-width: 1100px) { .page-search-trigger { min-height: 44px; } }
@media (max-width: 600px) {
  .header-location { font-size: 14px; }
  .location-section, .location-divider { display: none; }
  .page-search-trigger { width: 44px; justify-content: center; padding: 0; background: transparent; border-color: transparent; }
  .page-search-trigger > span, .page-search-trigger kbd { display: none; }
}
</style>
