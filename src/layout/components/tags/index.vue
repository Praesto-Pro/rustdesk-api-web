<template>
  <nav v-if="visibleTags.length > 1" class="open-pages" :aria-label="T('Open pages')">
    <div v-for="tag in visibleTags" :key="tag.name" class="open-page" :class="{ 'is-active': tag.name === route.name }">
      <router-link :to="tag.path" :aria-current="tag.name === route.name ? 'page' : undefined">{{ T(tag.title) }}</router-link>
      <button v-if="tag.closeable" type="button" class="close-page" :aria-label="T('Close') + ' ' + T(tag.title)" @click="close(tag)">
        <el-icon aria-hidden="true"><el-icon-close /></el-icon>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTagsStore } from '@/store/tags'
import { useRouteStore } from '@/store/router'
import { permittedLeaves } from '@/utils/navigation'
import { T } from '@/utils/i18n'
const tags = useTagsStore()
const routes = useRouteStore()
const route = useRoute()
const router = useRouter()
const visibleTags = computed(() => {
  const permitted = new Set(permittedLeaves(routes.routes).map(item => item.name))
  return tags.tags.filter(tag => permitted.has(tag.name))
})
watch(() => route.fullPath, () => {
  if (route.name && !route.meta?.hide) {
    tags.addTag(route)
    const existing = tags.tags.find(tag => tag.name === route.name)
    if (existing) existing.path = route.fullPath
  }
}, { immediate: true })
function close(tag) {
  const current = visibleTags.value
  const index = current.findIndex(item => item.name === tag.name)
  const destination = current[index - 1] || current[index + 1]
  tags.removeTag(tag)
  if (tag.name === route.name && destination) router.push(destination.path)
}
</script>

<style scoped>
.open-pages { display: flex; flex: none; gap: 8px; padding: 0 16px; min-height: 40px; overflow-x: auto; border-bottom: 1px solid var(--prc-border); scrollbar-width: thin; }
.open-page { display: flex; flex: none; align-items: center; gap: 4px; border-bottom: 2px solid transparent; }
.open-page a { display: flex; align-items: center; min-height: 38px; padding: 0 6px; color: var(--prc-muted); text-decoration: none; font-size: 12px; white-space: nowrap; }
.open-page.is-active { border-bottom-color: var(--prc-text); }
.open-page.is-active a { color: var(--prc-text); font-weight: 600; }
.close-page { display: grid; place-items: center; width: 24px; height: 28px; padding: 0; border: 0; border-radius: 4px; color: var(--prc-muted); background: transparent; cursor: pointer; }
.close-page:hover { color: var(--prc-text); background: var(--prc-hover); }
@media (max-width: 1100px) { .open-page a, .close-page { min-height: 44px; } .close-page { width: 44px; } }
</style>
