import { Store } from '@tauri-apps/plugin-store'
import { create } from 'zustand'
import { check, Update } from '@tauri-apps/plugin-updater'
import { logUpdaterError, logUpdaterInfo } from '@/lib/updater-debug-log'

function getObjectKeys(value: unknown) {
  if (!value || typeof value !== 'object') return []
  return Object.keys(value)
}

function summarizeUpdate(update: Update) {
  const platformKeys = getObjectKeys(update.rawJson.platforms)

  return {
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date ?? null,
    bodyLength: update.body?.length ?? 0,
    rawJsonKeys: getObjectKeys(update.rawJson),
    platformKeys,
  }
}

interface UpdateState {
  hasUpdate: boolean
  setHasUpdate: (hasUpdate: boolean) => void
  
  update: Update | null
  setUpdate: (update: Update | null) => void
  
  latestVersion: string
  setLatestVersion: (version: string) => void
  
  ignoredVersion: string
  setIgnoredVersion: (version: string) => Promise<void>
  clearIgnoredVersion: () => Promise<void>
  
  checkForUpdates: () => Promise<void>
  ignoreCurrentVersion: () => Promise<void>
  
  initUpdateStore: () => Promise<void>
}

const useUpdateStore = create<UpdateState>((set, get) => ({
  hasUpdate: false,
  setHasUpdate: (hasUpdate) => set({ hasUpdate }),
  
  update: null,
  setUpdate: (update) => set({ update }),
  
  latestVersion: '',
  setLatestVersion: (version) => set({ latestVersion: version }),
  
  ignoredVersion: '',
  setIgnoredVersion: async (version) => {
    const store = await Store.load('store.json')
    await store.set('ignoredVersion', version)
    await store.save()
    set({ ignoredVersion: version })
  },
  clearIgnoredVersion: async () => {
    const store = await Store.load('store.json')
    await store.set('ignoredVersion', '')
    await store.save()

    const { update } = get()
    set({ ignoredVersion: '', hasUpdate: Boolean(update) })
  },
  
  checkForUpdates: async () => {
    const startedAt = Date.now()

    try {
      logUpdaterInfo('check started', {
        timeoutMs: 5000,
      })

      const update = await check({
        timeout: 5000,
      })
      
      if (update) {
        const { ignoredVersion } = get()
        const hasUpdate = update.version !== ignoredVersion

        logUpdaterInfo('check completed: update found', {
          ...summarizeUpdate(update),
          ignoredVersion: ignoredVersion || null,
          hasUpdate,
          elapsedMs: Date.now() - startedAt,
        })

        set({ 
          update,
          latestVersion: update.version,
          hasUpdate
        })
      } else {
        logUpdaterInfo('check completed: no update', {
          elapsedMs: Date.now() - startedAt,
        })

        set({ 
          update: null,
          hasUpdate: false
        })
      }
    } catch (error) {
      logUpdaterError('check failed', error)
      // 检查更新失败，忽略错误
    }
  },
  
  ignoreCurrentVersion: async () => {
    const { latestVersion } = get()
    if (latestVersion) {
      await get().setIgnoredVersion(latestVersion)
      set({ hasUpdate: false })
    }
  },
  
  initUpdateStore: async () => {
    const store = await Store.load('store.json')
    const ignoredVersion = await store.get('ignoredVersion') as string
    if (ignoredVersion) {
      set({ ignoredVersion })
    }
  }
}))

export default useUpdateStore
