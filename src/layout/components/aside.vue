<template>
  <div class="sidebar-content">
    <div class="sidebar-brand">
      <router-link v-if="home" :to="home" class="brand-link" aria-label="Praesto Remote Control"><BrandMark :compact="compact" /></router-link>
      <BrandMark v-else :compact="compact" />
      <button v-if="mobile" type="button" class="icon-button" :aria-label="T('Close navigation')" @click="$emit('close')">
        <el-icon aria-hidden="true"><el-icon-close /></el-icon>
      </button>
    </div>
    <div v-if="!compact" class="sidebar-scope">
      <span class="sidebar-scope__label">{{ T('Signed in as') }}</span>
      <span class="sidebar-scope__name">{{ user.username || user.nickname || '—' }}</span>
    </div>
    <div class="sidebar-scroll"><Menus :compact="compact" /></div>
    <div v-if="mobile" class="sidebar-utilities"><Setting /></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BrandMark from '@/components/BrandMark.vue'
import Menus from '@/layout/components/menu/index.vue'
import Setting from '@/layout/components/setting/index.vue'
import { useRouteStore } from '@/store/router'
import { useUserStore } from '@/store/user'
import { defaultDestination } from '@/utils/navigation'
import { T } from '@/utils/i18n'
defineProps({ compact: Boolean, mobile: Boolean })
defineEmits(['close'])
const routes = useRouteStore()
const user = useUserStore()
const home = computed(() => defaultDestination(routes.routes))
</script>

<style scoped>
.sidebar-content { height: 100%; min-height: 0; display: flex; flex-direction: column; }
.sidebar-brand { min-height: 76px; display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; flex: none; }
.brand-link { text-decoration: none; border-radius: 4px; min-width: 0; }
.sidebar-scope { display: flex; flex-direction: column; gap: 4px; margin: 0 20px 20px; min-width: 0; }
.sidebar-scope__label { font-size: 12px; color: var(--prc-muted); }
.sidebar-scope__name { font-size: 13px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-scroll { overflow-y: auto; min-height: 0; flex: 1; scrollbar-width: thin; }
.sidebar-utilities { padding: 12px 16px; border-top: 1px solid var(--prc-border); }
:global(.app-shell.is-collapsed) .sidebar-brand { padding: 14px 17px; }
</style>
