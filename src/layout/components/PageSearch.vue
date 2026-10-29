<template>
  <el-dialog v-model="visible" :title="T('Find a page')" class="page-search-dialog" width="560px" append-to-body
    destroy-on-close @open="reset" @opened="focusSearch">
    <div class="page-search-field">
      <el-icon aria-hidden="true"><el-icon-search /></el-icon>
      <input ref="input" v-model="query" type="search" :aria-label="T('Find a page')" :placeholder="T('Find a page…')"
        autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="true"
        aria-controls="page-search-results" :aria-activedescendant="results.length ? 'page-result-' + selected : undefined"
        @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter.prevent="openSelected" />
    </div>
    <p class="sr-only" role="status">{{ results.length }} {{ T('pages found') }}</p>
    <div id="page-search-results" class="page-search-results" role="listbox" :aria-label="T('Pages')">
      <button v-for="(item, index) in results" :id="'page-result-' + index" :key="item.name" type="button"
        class="page-result" :class="{ 'is-selected': index === selected }" role="option" :aria-selected="index === selected"
        tabindex="-1" @click="openPage(item)" @mousemove="selected = index">
        <el-icon aria-hidden="true"><component :is="'el-icon-' + (item.icon || 'Document')" /></el-icon>
        <span class="page-result__title">{{ T(item.title) }}<small>{{ T(item.section) }}</small></span>
        <span v-if="index === selected" class="page-result__enter" aria-hidden="true">↵</span>
      </button>
    </div>
    <p v-if="!results.length" class="search-empty">{{ T('No matching pages. Try another name.') }}</p>
    <template #footer><p class="search-hint">{{ T('↑ ↓ to browse · Enter to open · Esc to close') }}</p></template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRouteStore } from '@/store/router'
import { buildNavigation } from '@/utils/navigation'
import { T } from '@/utils/i18n'
const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const input = ref(null)
const query = ref('')
const selected = ref(0)
const router = useRouter()
const routes = useRouteStore()
const results = computed(() => {
  const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return buildNavigation(routes.routes).flatMap(group => group.items.map(item => ({ ...item, section: group.title })))
    .filter(item => {
      const text = [T(item.title), T(item.section), T(item.description)].join(' ').toLocaleLowerCase()
      return terms.every(term => text.includes(term))
    })
})
watch(query, () => { selected.value = 0 })
watch(results, () => { selected.value = Math.min(selected.value, Math.max(0, results.value.length - 1)) })
function reset() { query.value = ''; selected.value = 0 }
function focusSearch() { input.value?.focus() }
async function move(direction) {
  if (!results.value.length) return
  selected.value = (selected.value + direction + results.value.length) % results.value.length
  await nextTick()
  document.getElementById('page-result-' + selected.value)?.scrollIntoView({ block: 'nearest' })
}
function openPage(item) { visible.value = false; router.push({ name: item.name }) }
function openSelected() { if (results.value[selected.value]) openPage(results.value[selected.value]) }
</script>

<style scoped>
.page-search-field { display: flex; align-items: center; gap: 10px; border: 1px solid var(--prc-control); border-radius: 6px; padding: 0 12px; }
.page-search-field:focus-within { outline: 2px solid var(--prc-accent); outline-offset: 2px; }
.page-search-field > .el-icon { color: var(--prc-muted); }
.page-search-field input { width: 100%; min-width: 0; height: 44px; padding: 0; border: 0; outline: 0; background: transparent; color: var(--prc-text); font-size: 14px; }
.page-search-field input::placeholder { color: var(--prc-muted); }
.page-search-results { max-height: min(430px, 52dvh); overflow-y: auto; margin-top: 12px; }
.page-result { display: flex; align-items: center; width: 100%; gap: 12px; min-height: 56px; padding: 9px 12px; text-align: left; color: var(--prc-text); background: transparent; border: 0; border-radius: 6px; cursor: pointer; }
.page-result.is-selected { background: var(--prc-active); }
.page-result > .el-icon { color: var(--prc-muted); font-size: 18px; }
.page-result__title { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
.page-result__title small { color: var(--prc-muted); font-size: 12px; }
.page-result__enter { color: var(--prc-muted); margin-left: auto; }
.search-empty { padding: 24px 12px; text-align: center; color: var(--prc-muted); font-size: 14px; }
.search-hint { margin: 0; text-align: left; font-size: 12px; color: var(--prc-muted); }
</style>
