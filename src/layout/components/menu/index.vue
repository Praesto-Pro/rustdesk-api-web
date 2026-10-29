<template>
  <nav id="primary-navigation" class="primary-navigation" :aria-label="T('Primary navigation')" :class="{ 'is-compact': compact }">
    <section v-for="group in groups" :key="group.id" class="nav-section" :aria-label="T(group.title)">
      <h2 class="nav-section__title" :class="{ 'sr-only': compact }">{{ T(group.title) }}</h2>
      <router-link
        v-for="item in group.items"
        :key="item.name"
        :to="{ name: item.name }"
        class="nav-link"
        :class="{ 'is-active': activeName === item.name }"
        :aria-current="activeName === item.name ? 'page' : undefined"
        :aria-label="T(item.title)"
        :title="compact ? T(item.title) : undefined"
      >
        <el-icon aria-hidden="true"><component :is="'el-icon-' + (item.icon || 'Document')" /></el-icon>
        <span :class="{ 'sr-only': compact }">{{ T(item.title) }}</span>
      </router-link>
    </section>
    <p v-if="!groups.length" class="nav-empty">{{ T('No pages are available for this account.') }}</p>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRouteStore } from '@/store/router'
import { activeNavigationName, buildNavigation } from '@/utils/navigation'
import { T } from '@/utils/i18n'
defineProps({ compact: Boolean })
const route = useRoute()
const routeStore = useRouteStore()
const groups = computed(() => buildNavigation(routeStore.routes))
const activeName = computed(() => activeNavigationName(route))
</script>

<style scoped>
.primary-navigation { padding: 4px 10px 16px; }
.nav-section + .nav-section { margin-top: 20px; }
.nav-section__title { margin: 0 10px 7px; color: var(--prc-muted); font-size: 12px; line-height: 20px; font-weight: 500; }
.nav-link { display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 7px 10px; border-radius: 6px; color: var(--prc-muted); text-decoration: none; font-size: 14px; line-height: 20px; }
.nav-link .el-icon { font-size: 17px; flex: none; }
.nav-link > span { min-width: 0; overflow-wrap: anywhere; }
.nav-link:hover { color: var(--prc-text); background: var(--prc-hover); }
.nav-link.is-active { color: var(--prc-text); background: var(--prc-active); font-weight: 600; }
.is-compact { padding-inline: 8px; }
.is-compact .nav-link { justify-content: center; padding-inline: 0; }
.is-compact .nav-section + .nav-section { padding-top: 10px; margin-top: 10px; border-top: 1px solid var(--prc-border); }
.nav-empty { padding: 12px; font-size: 13px; color: var(--prc-muted); }
@media (max-width: 1100px) { .nav-link { min-height: 44px; } }
</style>
