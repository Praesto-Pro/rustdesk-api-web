<template>
  <div class="device-cards" v-loading="loading" :aria-busy="loading">
    <el-checkbox v-if="rows.length" class="device-select-all" :model-value="allSelected" :indeterminate="someSelected" @change="selectAll">
      {{ T('Select all devices on this page') }}
    </el-checkbox>
    <article v-for="row in rows" :key="keyOf(row)" class="device-card" :aria-label="row.hostname || row.alias || row.id">
      <div class="device-card__heading">
        <el-checkbox :model-value="isSelected(row)" @change="value => select(row, value)">
          <span class="sr-only">{{ T('Select device') }} {{ row.id }}</span>
        </el-checkbox>
        <div class="device-card__identity">
          <h2>{{ row.hostname || row.alias || row.id }}</h2>
          <p v-if="row.alias && row.alias !== row.hostname">{{ row.alias }}</p>
        </div>
      </div>
      <div class="device-card__id">
        <span>{{ T('Device ID') }}</span><code>{{ row.id }}</code>
        <button type="button" class="icon-button" :aria-label="T('Copy device ID') + ' ' + row.id" @click="$emit('copy', row.id, $event)">
          <el-icon aria-hidden="true"><CopyDocument /></el-icon>
        </button>
      </div>
      <p class="device-card__meta">
        <span>{{ row.os || '—' }}</span>
        <span :title="lastSeenTitle(row.last_online_time)">{{ T('LastOnlineTime') }}: {{ lastSeen(row.last_online_time) }}</span>
      </p>
      <div class="device-card__actions"><slot name="actions" :row="row" /></div>
      <details class="device-card__details">
        <summary>{{ T('Technical details') }}</summary>
        <dl>
          <template v-for="field in detailFields" :key="field.key">
            <dt>{{ T(field.label) }}</dt><dd>{{ row[field.key] ?? '—' }}</dd>
          </template>
        </dl>
      </details>
    </article>
    <div v-if="!rows.length" class="device-cards__empty" role="status">
      <strong v-if="loading">{{ T('Loading devices…') }}</strong>
      <strong v-else-if="error">{{ T('No device data loaded') }}</strong>
      <template v-else>
        <strong>{{ T('No devices found') }}</strong>
        <p>{{ hasFilters ? T('Try a different filter or clear the filters.') : T('Devices will appear here when they are available to your account.') }}</p>
        <el-button v-if="hasFilters" @click="$emit('clear')">{{ T('Clear filters') }}</el-button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { CopyDocument } from '@element-plus/icons'
import { T } from '@/utils/i18n'
const props = defineProps({
  rows: { type: Array, required: true },
  selected: { type: Array, default: () => [] },
  loading: Boolean,
  error: Boolean,
  hasFilters: Boolean,
  lastSeen: { type: Function, required: true },
  lastSeenTitle: { type: Function, required: true },
})
const emit = defineEmits(['update:selected', 'copy', 'clear'])
const keyOf = row => row.row_id ?? row.uuid ?? row.id
const isSelected = row => props.selected.some(item => keyOf(item) === keyOf(row))
const selectedCount = computed(() => props.rows.filter(isSelected).length)
const allSelected = computed(() => props.rows.length > 0 && selectedCount.value === props.rows.length)
const someSelected = computed(() => selectedCount.value > 0 && !allSelected.value)
function selectAll(value) { emit('update:selected', value ? [...props.rows] : []) }
function select(row, value) {
  const others = props.selected.filter(item => keyOf(item) !== keyOf(row))
  emit('update:selected', value ? [...others, row] : others)
}
const detailFields = [
  { key: 'cpu', label: 'CPU' }, { key: 'memory', label: 'Memory' },
  { key: 'username', label: 'Username' }, { key: 'version', label: 'Version' },
  { key: 'last_online_ip', label: 'LastOnlineIp' }, { key: 'uuid', label: 'Uuid' },
  { key: 'created_at', label: 'CreatedAt' }, { key: 'updated_at', label: 'UpdatedAt' },
]
</script>

<style scoped>
.device-cards { min-width: 0; }
.device-select-all { min-height: 44px; margin: 0 0 8px; white-space: normal; }
.device-select-all :deep(.el-checkbox__label) { white-space: normal; font-size: 12px; }
.device-card { min-width: 0; padding: 18px 0; border-top: 1px solid var(--prc-border); }
.device-card__heading { display: flex; gap: 10px; align-items: flex-start; }
.device-card__heading > .el-checkbox { margin: -10px 0 0 -10px; min-height: 44px; min-width: 36px; justify-content: center; }
.device-card__heading :deep(.el-checkbox__label) { padding: 0; }
.device-card__identity { min-width: 0; flex: 1; }
.device-card__identity h2 { margin: 0; font-size: 16px; line-height: 23px; font-weight: 600; overflow-wrap: anywhere; }
.device-card__identity p { margin: 4px 0 0; color: var(--prc-muted); font-size: 12px; overflow-wrap: anywhere; }
.device-card__id { display: flex; align-items: center; gap: 10px; margin-top: 8px; min-width: 0; color: var(--prc-muted); font-size: 12px; }
.device-card__id code { color: var(--prc-text); font-size: 13px; overflow-wrap: anywhere; }
.device-card__id .icon-button { width: 44px; height: 44px; margin-left: auto; font-size: 17px; }
.device-card__meta { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0 0 16px; color: var(--prc-muted); font-size: 12px; line-height: 18px; }
.device-card__actions :deep(.row-actions) { display: flex; width: 100%; gap: 8px; }
.device-card__actions :deep(.row-actions > .el-button) { flex: 1; }
.device-card__details { margin-top: 12px; color: var(--prc-muted); font-size: 12px; }
.device-card__details summary { min-height: 44px; padding-block: 13px; cursor: pointer; }
.device-card__details dl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 8px 12px; margin: 8px 0 0; }
.device-card__details dt, .device-card__details dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.device-card__details dd { color: var(--prc-text); }
.device-cards__empty { padding: 36px 12px; text-align: center; color: var(--prc-muted); }
.device-cards__empty strong { color: var(--prc-text); font-size: 14px; font-weight: 500; }
</style>
