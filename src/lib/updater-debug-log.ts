import { Store } from '@tauri-apps/plugin-store'

export const UPDATER_LOG_PREFIX = '[updater]'

const DEBUG_STORE_FILE = 'updater-debug.json'
const DEBUG_STORE_KEY = 'entries'
const MAX_DEBUG_LOG_ENTRIES = 200
const MAX_SERIALIZE_DEPTH = 4

type UpdaterDebugLogLevel = 'info' | 'error'

interface UpdaterDebugLogEntry {
  timestamp: string
  level: UpdaterDebugLogLevel
  message: string
  details?: Record<string, unknown>
}

let pendingPersist = Promise.resolve()
let didReportPersistFailure = false

export function getUpdaterErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown updater error'
}

function toSerializableValue(value: unknown, depth = 0): unknown {
  if (depth >= MAX_SERIALIZE_DEPTH) return '[MaxDepth]'
  if (value === null || typeof value === 'undefined') return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => toSerializableValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        toSerializableValue(item, depth + 1),
      ])
    )
  }

  return String(value)
}

function toSerializableDetails(details?: Record<string, unknown>) {
  if (!details) return undefined
  return toSerializableValue(details) as Record<string, unknown>
}

function reportPersistFailure(error: unknown) {
  if (didReportPersistFailure) return
  didReportPersistFailure = true
  console.error(UPDATER_LOG_PREFIX, 'debug log persist failed', {
    message: getUpdaterErrorMessage(error),
    error,
  })
}

function persistUpdaterDebugLog(entry: UpdaterDebugLogEntry) {
  pendingPersist = pendingPersist
    .catch(() => undefined)
    .then(async () => {
      const store = await Store.load(DEBUG_STORE_FILE)
      const existingEntries = await store.get<UpdaterDebugLogEntry[]>(DEBUG_STORE_KEY)
      const entries = Array.isArray(existingEntries) ? existingEntries : []

      entries.push(entry)
      await store.set(DEBUG_STORE_KEY, entries.slice(-MAX_DEBUG_LOG_ENTRIES))
      await store.save()
    })
    .catch(reportPersistFailure)
}

function logUpdater(level: UpdaterDebugLogLevel, message: string, details?: Record<string, unknown>) {
  if (details) {
    console[level](UPDATER_LOG_PREFIX, message, details)
  } else {
    console[level](UPDATER_LOG_PREFIX, message)
  }

  persistUpdaterDebugLog({
    timestamp: new Date().toISOString(),
    level,
    message,
    details: toSerializableDetails(details),
  })
}

export function logUpdaterInfo(message: string, details?: Record<string, unknown>) {
  logUpdater('info', message, details)
}

export function logUpdaterError(message: string, error: unknown) {
  logUpdater('error', message, {
    message: getUpdaterErrorMessage(error),
    error,
  })
}

export async function flushUpdaterDebugLog() {
  await pendingPersist.catch(() => undefined)
}
