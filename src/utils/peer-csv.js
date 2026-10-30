import Papa from 'papaparse'

const allowed = ['id', 'cpu', 'hostname', 'memory', 'os', 'username', 'uuid', 'version', 'group_id']
export function parsePeerCsv(text) {
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy' })
  const fields = parsed.meta.fields || []
  if (parsed.errors.length || !fields.includes('id') || parsed.meta.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length) {
    throw new Error('Invalid device CSV: check headers, quotes, and column counts.')
  }
  return parsed.data.map(row => {
    if (!row.id?.trim()) throw new Error('Every device must have an ID.')
    const device = Object.fromEntries(allowed.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]))
    if (device.group_id) {
      if (!/^\d+$/.test(device.group_id) || !Number.isSafeInteger(Number(device.group_id))) throw new Error('Invalid device group ID.')
      device.group_id = Number(device.group_id)
    } else delete device.group_id
    return device
  })
}
