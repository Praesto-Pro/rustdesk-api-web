import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { T } from '@/utils/i18n'
import { timeAgo } from '@/utils/time'
import { jsonToCsv, downBlob } from '@/utils/file'
import { copyDeviceId } from '@/utils/clipboard'

export function usePeerList(fetchList, filters = {}) {
  const listRes = reactive({
    list: [], total: 0, loading: false, loaded: false, error: false,
  })
  const listQuery = reactive({
    page: 1,
    page_size: 10,
    time_ago: null,
    id: '',
    hostname: '',
    ...filters,
  })

  let latestRequest = 0
  const getList = async () => {
    const requestId = ++latestRequest
    const query = { ...listQuery }
    listRes.loading = true
    listRes.error = false
    const res = await fetchList(query).catch(_ => false)
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

  onMounted(getList)
  onActivated(() => { if (listRes.loaded) getList() })

  watch(() => listQuery.page, getList)

  watch(() => listQuery.page_size, handlerQuery)

  const timeFilters = computed(() => [
    { text: T('MinutesLess', { param: 1 }, 1), value: -60 },
    { text: T('HoursLess', { param: 1 }, 1), value: -3600 },
    { text: T('DaysLess', { param: 1 }, 1), value: -86400 },
    { text: '---------', value: 0 },
    { text: T('MinutesAgo', { param: 1 }, 1), value: 60 },
    { text: T('HoursAgo', { param: 1 }, 1), value: 3600 },
    { text: T('DaysAgo', { param: 1 }, 1), value: 86400 },
    { text: T('MonthsAgo', { param: 1 }, 1), value: 2592000 },
  ])

  const toExport = async () => {
    const res = await fetchList({ ...listQuery, page_size: 10000, page: 1 }).catch(_ => false)
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

  const multipleSelection = ref([])
  const handleSelectionChange = (val) => {
    multipleSelection.value = val
  }
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
  return {
    listRes, listQuery, getList, handlerQuery, timeFilters, toExport,
    multipleSelection, handleSelectionChange, isCompact, resultRange,
    hasFilters, clearFilters, lastSeen, lastSeenTitle, copyDeviceId,
  }
}
