<template>

  <section class="device-page" :aria-label="T('Device inventory')">
    <el-card class="device-filters" shadow="never">
      <el-form inline label-position="top" @submit.prevent="handlerQuery">
        <el-form-item :label="T('Device ID')">
          <el-input v-model="listQuery.id" :aria-label="T('Device ID')" :placeholder="T('Any device ID')" clearable />
        </el-form-item>
        <el-form-item :label="T('Hostname')">
          <el-input v-model="listQuery.hostname" :aria-label="T('Hostname')" :placeholder="T('Any hostname')" clearable />
        </el-form-item>
        <el-form-item :label="T('LastOnlineTime')">
          <el-select v-model="listQuery.time_ago" :aria-label="T('LastOnlineTime')" :placeholder="T('Any time')" clearable>
            <el-option v-for="item in timeFilters" :key="item.value" :label="item.text" :value="item.value" :disabled="item.value === 0" />
          </el-select>
        </el-form-item>
        
        <el-form-item class="filter-buttons">
          <el-button native-type="submit" :loading="listRes.loading">{{ T('Filter') }}</el-button>
          <el-button :disabled="!hasFilters" @click="clearFilters">{{ T('Clear filters') }}</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="list-body device-list" shadow="never">

      <div class="table-toolbar">
        <p class="device-count" role="status" aria-live="polite">
          <strong>{{ listRes.loaded ? listRes.total : '—' }}</strong> {{ T('devices') }}
          <span v-if="resultRange" class="result-range">{{ resultRange }} {{ T('shown') }}</span>
          <span v-if="listRes.loading" class="result-range">{{ T('Refreshing…') }}</span>
          <span v-else-if="listRes.error && listRes.loaded" class="result-range">{{ T('Previous results') }}</span>
        </p>

        <div class="toolbar-actions">
          <el-checkbox v-if="!isCompact" v-model="showTechnicalColumns">{{ T('Technical details') }}</el-checkbox>
          <el-button @click="getList" :loading="listRes.loading">{{ T('Refresh') }}</el-button>
          <el-button @click="toExport">{{ T('Export') }}</el-button>
        </div>
      </div>
      <div v-if="multipleSelection.length" class="selection-bar">
        <span>{{ multipleSelection.length }} {{ T('selected') }}</span>
        <el-button @click="toBatchAddToAB">{{ T('BatchAddToAB') }}</el-button>
      </div>

      <div v-if="listRes.error" class="load-error" role="alert">
        <div>
          <strong>{{ T('Devices could not be loaded.') }}</strong>
          <p v-if="listRes.loaded">{{ T('Previous results are shown. Retry to get current data.') }}</p>
          <p v-else>{{ T('Check your connection and try again.') }}</p>
        </div>
        <el-button @click="getList" :loading="listRes.loading">{{ T('Retry') }}</el-button>
      </div>

      <DeviceCards v-if="isCompact" v-model:selected="multipleSelection" :rows="listRes.list" :loading="listRes.loading"
        :error="listRes.error" :has-filters="hasFilters" :last-seen="lastSeen" :last-seen-title="lastSeenTitle" @copy="copyDeviceId" @clear="clearFilters">
        <template #actions="{ row }">
            <div class="row-actions">
              <el-button type="primary" size="small" @click="connectByClient(row.id)" :aria-label="T('Connect') + ' ' + row.id">{{ T('Connect') }}</el-button>
              <el-button v-if="appStore.setting.appConfig.web_client && !isCompact" size="small" @click="toWebClientLink(row)">{{ T('Web client') }}</el-button>
              <el-dropdown trigger="click">
                <el-button size="small" :aria-label="T('More actions for') + ' ' + row.id">
                  {{ T('More') }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="appStore.setting.appConfig.web_client && isCompact" @click="toWebClientLink(row)">{{ T('Web client') }}</el-dropdown-item>
                    <el-dropdown-item @click="toView(row)">{{ T('View') }}</el-dropdown-item>
                    <el-dropdown-item @click="toAddressBook(row)">{{ T('AddToAddressBook') }}</el-dropdown-item>
                    
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
        </template>
      </DeviceCards>

      <div v-else class="table-scroll" :aria-busy="listRes.loading">
        <el-table :data="listRes.list" v-loading="listRes.loading" @selection-change="handleSelectionChange" :aria-label="T('Device inventory')">
          <el-table-column type="selection" width="44" align="center" />
          <el-table-column prop="hostname" :label="T('Hostname')" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="device-name">{{ row.hostname || row.alias || row.id }}</span>
              <span v-if="row.alias && row.alias !== row.hostname" class="device-subtitle">{{ row.alias }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="id" :label="T('Device ID')" width="170">
            <template #default="{ row }">
              <div class="device-id">
                <code>{{ row.id }}</code>
                <button type="button" class="copy-device" :aria-label="T('Copy device ID') + ' ' + row.id" :title="T('Copy device ID')" @click="copyDeviceId(row.id, $event)">
                  <el-icon aria-hidden="true"><CopyDocument /></el-icon>
                </button>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="os" :label="T('Os')" min-width="140" show-overflow-tooltip />
          <el-table-column prop="last_online_time" :label="T('LastOnlineTime')" min-width="150">
            <template #default="{ row }">
              <span class="last-seen" :title="lastSeenTitle(row.last_online_time)">{{ lastSeen(row.last_online_time) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="showTechnicalColumns" prop="cpu" label="CPU" width="160" show-overflow-tooltip />
          <el-table-column v-if="showTechnicalColumns" prop="memory" :label="T('Memory')" width="120" show-overflow-tooltip />
          <el-table-column v-if="showTechnicalColumns" prop="last_online_ip" :label="T('LastOnlineIp')" width="150" />
          <el-table-column v-if="showTechnicalColumns" prop="username" :label="T('Username')" width="140" />
          <el-table-column v-if="showTechnicalColumns" prop="uuid" :label="T('Uuid')" width="180" show-overflow-tooltip />
          <el-table-column v-if="showTechnicalColumns" prop="version" :label="T('Version')" width="100" />
          <el-table-column v-if="showTechnicalColumns" prop="alias" :label="T('Alias')" width="160" show-overflow-tooltip />
          <el-table-column v-if="showTechnicalColumns" prop="created_at" :label="T('CreatedAt')" width="180" show-overflow-tooltip />
          <el-table-column v-if="showTechnicalColumns" prop="updated_at" :label="T('UpdatedAt')" width="180" show-overflow-tooltip />

        <el-table-column :label="T('Actions')" align="right" :width="isCompact ? 166 : 280" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button type="primary" size="small" @click="connectByClient(row.id)" :aria-label="T('Connect') + ' ' + row.id">{{ T('Connect') }}</el-button>
              <el-button v-if="appStore.setting.appConfig.web_client && !isCompact" size="small" @click="toWebClientLink(row)">{{ T('Web client') }}</el-button>
              <el-dropdown trigger="click">
                <el-button size="small" :aria-label="T('More actions for') + ' ' + row.id">
                  {{ T('More') }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="appStore.setting.appConfig.web_client && isCompact" @click="toWebClientLink(row)">{{ T('Web client') }}</el-dropdown-item>
                    <el-dropdown-item @click="toView(row)">{{ T('View') }}</el-dropdown-item>
                    <el-dropdown-item @click="toAddressBook(row)">{{ T('AddToAddressBook') }}</el-dropdown-item>
                    
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>


        <template #empty>
          <div class="table-empty">
            <strong v-if="listRes.loading">{{ T('Loading devices…') }}</strong>
            <strong v-else-if="listRes.error">{{ T('No device data loaded') }}</strong>
            <template v-else>
              <strong>{{ T('No devices found') }}</strong>
              <p>{{ hasFilters ? T('Try a different filter or clear the filters.') : T('Devices will appear here when they are available to your account.') }}</p>
              <el-button v-if="hasFilters" @click="clearFilters">{{ T('Clear filters') }}</el-button>
            </template>
          </div>
        </template>

        </el-table>
      </div>

      <div class="device-pagination">
        <el-pagination
          :layout="isCompact ? 'prev, pager, next' : 'prev, pager, next, sizes, jumper'"
          :pager-count="5"
          :page-sizes="[10,20,50,100]"
          v-model:page-size="listQuery.page_size"
          v-model:current-page="listQuery.page"
          :total="listRes.total"
          :disabled="listRes.loading"
        />
      </div>
    </el-card>

    <el-dialog v-model="formVisible" :title="T('Information')" width="min(800px, calc(100vw - 32px))" :style="{ textAlign: 'center' }">
      <el-form class="dialog-form" ref="form" :model="formData" label-width="120px">
        <el-form-item label="ID" prop="id">
          <el-input v-model="formData.id" disabled></el-input>
        </el-form-item>
        <el-form-item :label="T('Username')" prop="username">
          <el-input v-model="formData.username" disabled></el-input>
        </el-form-item>
        <el-form-item :label="T('Hostname')" prop="hostname">
          <el-input v-model="formData.hostname" disabled></el-input>
        </el-form-item>
        <el-form-item label="CPU" prop="cpu">
          <el-input v-model="formData.cpu" disabled></el-input>
        </el-form-item>
        <el-form-item :label="T('Memory')" prop="memory">
          <el-input v-model="formData.memory" disabled></el-input>
        </el-form-item>
        <el-form-item :label="T('Os')" prop="os">
          <el-input v-model="formData.os" disabled></el-input>
        </el-form-item>
        <el-form-item :label="T('Uuid')" prop="uuid">
          <el-input v-model="formData.uuid" disabled></el-input>
        </el-form-item>
        <el-form-item :label="T('Version')" prop="version">
          <el-input v-model="formData.version" disabled></el-input>
        </el-form-item>
      </el-form>
    </el-dialog>

    <el-dialog v-model="ABFormVisible" width="min(800px, calc(100vw - 32px))" :title="T('Create')">
      <el-form class="dialog-form" ref="form" :model="ABFormData" label-width="120px">
        <el-form-item :label="T('AddressBookName')" required prop="collection_id">
          <el-select v-model="ABFormData.collection_id" clearable @change="changeCollectionForUpdate">
            <el-option :value="0" :label="T('MyAddressBook')"></el-option>
            <el-option v-for="c in collectionListResForUpdate.list" :key="c.id" :label="c.name" :value="c.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="ID" prop="id" required>
          <el-input v-model="ABFormData.id"></el-input>
        </el-form-item>
        <el-form-item :label="T('Username')" prop="username">
          <el-input v-model="ABFormData.username"></el-input>
        </el-form-item>
        <el-form-item :label="T('Alias')" prop="alias">
          <el-input v-model="ABFormData.alias"></el-input>
        </el-form-item>
        <el-form-item :label="T('Hostname')" prop="hostname">
          <el-input v-model="ABFormData.hostname"></el-input>
        </el-form-item>
        <el-form-item :label="T('Platform')" prop="platform">
          <el-select v-model="ABFormData.platform">
            <el-option
                v-for="item in ABPlatformList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            ></el-option>
          </el-select>
        </el-form-item>

        <el-form-item :label="T('Tags')" prop="tags">
          <el-select v-model="ABFormData.tags" multiple>
            <el-option
                v-for="item in tagListRes.list"
                :key="item.name"
                :label="item.name"
                :value="item.name"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="ABFormVisible = false">{{ T('Cancel') }}</el-button>
          <el-button @click="ABSubmit" type="primary">{{ T('Submit') }}</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>

    <el-dialog v-model="batchABFormVisible" width="min(800px, calc(100vw - 32px))" :title="T('Create')">
      <el-form class="dialog-form" ref="form" :model="batchABFormData" label-width="120px">
        <el-form-item :label="T('AddressBookName')" required prop="collection_id">
          <el-select v-model="batchABFormData.collection_id" clearable @change="changeCollectionForBatchCreateAB">
            <el-option :value="0" :label="T('MyAddressBook')"></el-option>
            <el-option v-for="c in collectionListResForUpdate.list" :key="c.id" :label="c.name" :value="c.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="T('Tags')" prop="tags">
          <el-select v-model="batchABFormData.tags" multiple>
            <el-option
                v-for="item in tagListRes.list"
                :key="item.name"
                :label="item.name"
                :value="item.name"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="batchABFormVisible = false">{{ T('Cancel') }}</el-button>
          <el-button @click="submitBatchAddToAB" type="primary">{{ T('Submit') }}</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </section>
</template>

<script setup>
  import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import { list } from '@/api/my/peer'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { toWebClientLink } from '@/utils/webclient'
  import { T } from '@/utils/i18n'
  import { timeAgo } from '@/utils/time'
  import { jsonToCsv, downBlob } from '@/utils/file'
  import { useRepositories as useABRepositories } from '@/views/address_book/index'
  import { useAppStore } from '@/store/app'
  import { connectByClient } from '@/utils/peer'
  import { ArrowDown, CopyDocument } from '@element-plus/icons'
  import DeviceCards from '@/components/DeviceCards.vue'
  import { batchCreateFromPeers } from '@/api/my/address_book'

  const appStore = useAppStore()
  const listRes = reactive({
    list: [], total: 0, loading: false, loaded: false, error: false,
  })
  const listQuery = reactive({
    page: 1,
    page_size: 10,
    time_ago: null,
    id: '',
    hostname: '',
  })


  let latestRequest = 0
  const getList = async () => {
    const requestId = ++latestRequest
    const query = { ...listQuery }
    listRes.loading = true
    listRes.error = false
    const res = await list(query).catch(_ => false)
    if (requestId !== latestRequest) return
    listRes.loading = false
    if (res) {
      listRes.list = res.data.list
      listRes.total = res.data.total
      listRes.loaded = true
      loadedQuery.value = query
    } else {
      listRes.error = true
    }
  }
  const handlerQuery = () => {
    if (listQuery.page === 1) {
      getList()
    } else {
      listQuery.page = 1
    }
  }

  /*const del = async (row) => {
    const cf = await ElMessageBox.confirm(T('Confirm?', { param: T('Delete') }), {
      confirmButtonText: T('Confirm'),
      cancelButtonText: T('Cancel'),
      type: 'warning',
    }).catch(_ => false)
    if (!cf) {
      return false
    }

    const res = await remove({ row_id: row.row_id }).catch(_ => false)
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      getList()
    }
  }*/
  onMounted(getList)
  onActivated(() => { if (listRes.loaded) getList() })

  watch(() => listQuery.page, getList)

  watch(() => listQuery.page_size, handlerQuery)

  const formVisible = ref(false)
  const formData = reactive({
    row_id: 0,
    cpu: '',
    hostname: '',
    id: '',
    memory: '',
    os: '',
    username: '',
    uuid: '',
    version: '',
  })

  const toView = (row) => {
    formVisible.value = true
    //将row中的数据赋值给formData
    Object.keys(formData).forEach(key => {
      formData[key] = row[key]
    })
  }

  const timeDis = (time) => {
    let now = new Date().getTime()
    let after = new Date(time * 1000).getTime()
    return (now - after) / 1000
  }

  const timeFilters = computed(() => [
    { text: T('MinutesLess', { param: 1 }, 1), value: -60 },
    { text: T('HoursLess', { param: 1 }, 1), value: -3600 },
    { text: T('DaysLess', { param: 1 }, 1), value: -86400 },
    { text: '---------', value: 0 },
    { text: T('MinutesAgo', { param: 1 }, 1), value: 60 },
    { text: T('HoursAgo', { param: 1 }, 1), value: 3600 },
    { text: T('DaysAgo', { param: 1 }, 1), value: 86400 },
    { text: T('MonthsAgo', { param: 1 }, 1), value: 2592000 },
    // { text: T('YearsAgo', { param: 1 }, 1), value: 31536000 },
  ])

  const toExport = async () => {
    const q = { ...listQuery }
    q.page_size = 10000
    q.page = 1
    const res = await list(q).catch(_ => false)
    if (res) {
      const data = res.data.list.map(item => {
        item.last_online_time = item.last_online_time ? new Date(item.last_online_time * 1000).toLocaleString() : '-'
        delete item.user_id
        delete item.user
        return item
      })
      const csv = jsonToCsv(data)
      downBlob(csv, 'peers.csv')
    }
  }

  const {
    platformList: ABPlatformList,
    formVisible: ABFormVisible,
    formData: ABFormData,
    collectionListResForUpdate,
    getCollectionListForUpdate,
    tagListRes,
    changeCollectionForUpdate,
    submit: ABSubmit,
    fromPeer,
  } = useABRepositories('my')
  onMounted(getCollectionListForUpdate)
  const toAddressBook = (peer) => {
    fromPeer(peer)
    ABFormVisible.value = true
  }

  const multipleSelection = ref([])
  const handleSelectionChange = (val) => {
    multipleSelection.value = val
  }
  /*const toBatchDelete = async () => {
    if (!multipleSelection.value.length) {
      ElMessage.warning(T('PleaseSelectData'))
      return false
    }
    const cf = await ElMessageBox.confirm(T('Confirm?', { param: T('BatchDelete') }), {
      confirmButtonText: T('Confirm'),
      cancelButtonText: T('Cancel'),
      type: 'warning',
    }).catch(_ => false)
    if (!cf) {
      return false
    }

    const res = await batchRemove({ row_ids: multipleSelection.value.map(i => i.row_id) }).catch(_ => false)
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      getList()
    }
  }*/

  const batchABFormVisible = ref(false)
  const toBatchAddToAB = () => {
    batchABFormVisible.value = true
  }
  const batchABFormData = ref({
    collection_id: 0,
    tags: [],
    peer_ids: [],
  })
  const changeCollectionForBatchCreateAB = (val) => {
    batchABFormData.value.tags = []
    changeCollectionForUpdate(val)
  }
  const submitBatchAddToAB = async () => {
    if (multipleSelection.value.length === 0) {
      ElMessage.warning(T('PleaseSelectData'))
      return false
    }
    batchABFormData.value.peer_ids = multipleSelection.value.map(i => i.row_id)
    if (!batchABFormData.value.peer_ids.length) {
      ElMessage.warning(T('PleaseSelectData'))
      return false
    }

    const res = await batchCreateFromPeers(batchABFormData.value).catch(_ => false)
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      batchABFormVisible.value = false
    }
  }


  const showTechnicalColumns = ref(false)

  const isCompact = ref(false)
  const viewportQuery = window.matchMedia('(max-width: 767px)')
  const updateViewport = () => {
    if (isCompact.value !== viewportQuery.matches) multipleSelection.value = []
    isCompact.value = viewportQuery.matches
  }
  watch(() => listRes.list, () => { multipleSelection.value = [] })
  updateViewport()
  onMounted(() => viewportQuery.addEventListener('change', updateViewport))
  onBeforeUnmount(() => viewportQuery.removeEventListener('change', updateViewport))

  const loadedQuery = ref({ page: 1, page_size: 10 })
  const resultRange = computed(() => {
    if (!listRes.loaded || !listRes.list.length) return ''
    const start = (loadedQuery.value.page - 1) * loadedQuery.value.page_size + 1
    return start + '–' + Math.min(start + listRes.list.length - 1, listRes.total)
  })
  const hasFilters = computed(() => Object.entries(listQuery).some(([key, value]) =>
    !['page', 'page_size'].includes(key) && value !== '' && value !== null && value !== undefined
  ))
  const clearFilters = () => {
    Object.keys(listQuery).forEach(key => {
      if (!['page', 'page_size'].includes(key)) listQuery[key] = key === 'time_ago' ? null : ''
    })
    handlerQuery()
  }
  const lastSeen = (value) => {
    const timestamp = Number(value)
    return Number.isFinite(timestamp) && timestamp > 0 ? timeAgo(timestamp * 1000) : T('Unknown')
  }
  const lastSeenTitle = (value) => {
    const timestamp = Number(value)
    return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toLocaleString() : T('Unknown')
  }
  const copyDeviceId = async (id, event) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(String(id))
      } else {
        const input = document.createElement('textarea')
        input.value = String(id)
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        let copied
        try { copied = document.execCommand('copy') } finally {
          input.remove()
          event?.currentTarget?.focus()
        }
        if (!copied) throw new Error('Clipboard unavailable')
      }
      ElMessage.success(T('CopySuccess'))
    } catch (_) {
      ElMessage.error(T('CopyFailed'))
    }
  }

</script>


<style scoped lang="scss">
.device-page { min-width: 0; color: var(--prc-text); }
.device-page :deep(.el-card) { box-shadow: none; border-color: var(--prc-border); background: var(--prc-surface); }
.device-page :deep(.el-card__body) { min-width: 0; }
.device-filters { margin-bottom: 16px; }
.device-filters :deep(.el-form) { display: flex; align-items: flex-end; gap: 12px 16px; flex-wrap: wrap; }
.device-filters :deep(.el-form-item) { margin: 0; width: 170px; }
.device-filters :deep(.el-form-item__label) { color: var(--prc-muted); font-size: 12px; padding: 0 0 6px; line-height: 1.4; }
.device-filters :deep(.el-select) { width: 100%; --el-select-width: 100%; }
.device-filters :deep(.filter-buttons) { width: auto; }
.table-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.device-count { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; margin: 0; font-size: 14px; color: var(--prc-muted); }
.device-count strong { color: var(--prc-text); font-variant-numeric: tabular-nums; }
.result-range { margin-left: 6px; font-size: 12px; }
.toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.toolbar-actions :deep(.el-button + .el-button) { margin-left: 0; }
.selection-bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 12px; margin-bottom: 12px; background: var(--prc-surface-muted); border: 1px solid var(--prc-border); border-radius: 6px; }
.selection-bar span { margin-right: auto; font-size: 13px; color: var(--prc-muted); }
.load-error { display: flex; gap: 16px; align-items: center; justify-content: space-between; margin: 0 0 12px; padding: 12px 14px; border: 1px solid var(--el-color-danger-light-5); border-radius: 6px; background: var(--prc-surface); font-size: 13px; }
.load-error p { margin: 4px 0 0; color: var(--prc-muted); }
.table-scroll { min-width: 0; width: 100%; overflow-x: auto; }
.table-scroll :deep(.el-table) { width: 100%; --el-table-header-bg-color: var(--prc-surface); --el-table-border-color: var(--prc-border); --el-table-tr-bg-color: var(--prc-surface); }
.table-scroll :deep(.el-table__cell) { padding-top: 12px; padding-bottom: 12px; }
.table-scroll :deep(.el-table th.el-table__cell) { font-weight: 500; font-size: 12px; color: var(--prc-muted); }
.device-name { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
.device-subtitle { display: block; margin-top: 3px; color: var(--prc-muted); font-size: 12px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.device-id { display: flex; gap: 6px; align-items: center; white-space: nowrap; }
.device-id code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; font-variant-numeric: tabular-nums; }
.copy-device { border: 0; border-radius: 4px; background: transparent; color: var(--prc-muted); display: inline-flex; align-items: center; justify-content: center; padding: 6px; cursor: pointer; }
.copy-device:hover { color: var(--prc-accent); background: var(--prc-surface-muted); }
.copy-device:focus-visible { outline: 2px solid var(--prc-accent); outline-offset: 2px; }
.row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; white-space: nowrap; }
.row-actions :deep(.el-button + .el-button) { margin-left: 0; }
.last-seen { color: var(--prc-muted); font-size: 12px; white-space: nowrap; }
.table-empty { padding: 32px 16px; color: var(--prc-muted); line-height: 1.6; }
.table-empty strong { display: block; color: var(--prc-text); font-weight: 500; }
.table-empty p { margin: 6px 0 12px; }
.device-pagination { margin-top: 14px; overflow-x: auto; padding: 2px 0; }
.device-pagination :deep(.el-pagination) { justify-content: flex-end; }
.column-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--prc-border); }
.column-row :deep(.el-checkbox) { margin-right: auto; }
.column-row :deep(.el-button + .el-button) { margin-left: 0; }
.import-columns { display: block; margin: 6px 0; overflow-wrap: anywhere; }
@media (max-width: 767px) {
  .device-filters :deep(.el-form-item) { width: calc(50% - 8px); }
  .device-filters :deep(.filter-buttons) { width: 100%; }
  .device-page :deep(.el-card__body) { padding: 14px; }
  .table-toolbar { align-items: stretch; }
  .toolbar-actions { width: 100%; }
  .toolbar-actions :deep(.el-button), .selection-bar :deep(.el-button), .row-actions :deep(.el-button), .copy-device { min-height: 44px; }
  .row-actions :deep(.el-button) { padding: 8px 10px; }
  .copy-device { min-width: 44px; }
  .device-pagination :deep(.el-pagination) { justify-content: center; }
  .load-error { align-items: flex-start; }
}
</style>
