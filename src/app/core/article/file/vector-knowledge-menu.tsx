import { ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from "@/components/ui/enhanced-context-menu"
import { Switch } from "@/components/ui/switch"
import { Database, Trash2 } from "lucide-react"
import { Store } from '@tauri-apps/plugin-store'
import { toast } from "@/hooks/use-toast"
import useArticleStore from "@/stores/article"
import useVectorStore from "@/stores/vector"
import { readTextFile } from "@tauri-apps/plugin-fs"
import { computedParentPath } from "@/lib/path"
import { useState, useEffect } from "react"

interface VectorKnowledgeMenuProps {
  item: {
    name: string
    isFile: boolean
  }
  hasVector: boolean
  onVectorUpdated: () => void
}

export function VectorKnowledgeMenu({ item, hasVector, onVectorUpdated }: VectorKnowledgeMenuProps) {
  const { vectorIndexedFiles, clearFileVector, checkFileVectorIndexed } = useArticleStore()
  const [autoCalcEnabled, setAutoCalcEnabled] = useState(true)
  const [excludeFromKB, setExcludeFromKB] = useState(false)

  // 加载向量配置状态
  useEffect(() => {
    async function loadVectorSettings() {
      const store = await Store.load('store.json')
      const disabledFiles = await store.get<string[]>('vectorAutoCalcDisabled') || []
      const excludedFiles = await store.get<string[]>('vectorExcludedFiles') || []

      setAutoCalcEnabled(!disabledFiles.includes(item.name))
      setExcludeFromKB(excludedFiles.includes(item.name))
    }
    loadVectorSettings()
  }, [item.name])

  async function handleVectorCalculation() {
    if (!item.isFile) return

    try {
      // 读取文件内容
      const { getFilePathOptions, getWorkspacePath } = await import('@/lib/workspace')
      const workspace = await getWorkspacePath()
      const path = computedParentPath(item)
      const pathOptions = await getFilePathOptions(path)

      let content = ''
      if (workspace.isCustom) {
        content = await readTextFile(pathOptions.path)
      } else {
        content = await readTextFile(pathOptions.path, { baseDir: pathOptions.baseDir })
      }

      // 执行向量计算
      const vectorStore = useVectorStore.getState()
      if (vectorStore.isVectorDbEnabled) {
        await vectorStore.processDocument(path, content)

        // 更新向量索引状态
        await checkFileVectorIndexed(item.name)
        onVectorUpdated()

        toast({ title: hasVector ? '向量已更新' : '向量计算完成' })
      }
    } catch (error) {
      console.error('向量计算失败:', error)
      toast({ title: '向量计算失败', variant: 'destructive' })
    }
  }

  async function handleDeleteVector() {
    if (!item.isFile) return

    try {
      await clearFileVector(item.name)
      onVectorUpdated()
      toast({ title: '向量已删除' })
    } catch (error) {
      console.error('删除向量失败:', error)
      toast({ title: '删除向量失败', variant: 'destructive' })
    }
  }

  async function handleToggleAutoCalc(checked: boolean) {
    const store = await Store.load('store.json')
    const disabledFiles = await store.get<string[]>('vectorAutoCalcDisabled') || []

    if (checked) {
      const index = disabledFiles.indexOf(item.name)
      if (index > -1) {
        disabledFiles.splice(index, 1)
      }
    } else {
      if (!disabledFiles.includes(item.name)) {
        disabledFiles.push(item.name)
      }
    }

    await store.set('vectorAutoCalcDisabled', disabledFiles)
    setAutoCalcEnabled(checked)
  }

  async function handleToggleExcludeFromKB(checked: boolean) {
    const store = await Store.load('store.json')
    const excludedFiles = await store.get<string[]>('vectorExcludedFiles') || []

    if (checked) {
      const index = excludedFiles.indexOf(item.name)
      if (index > -1) {
        excludedFiles.splice(index, 1)
      }
    } else {
      if (!excludedFiles.includes(item.name)) {
        excludedFiles.push(item.name)
      }
      if (hasVector) {
        await clearFileVector(item.name)
        onVectorUpdated()
      }
    }

    await store.set('vectorExcludedFiles', excludedFiles)
    setExcludeFromKB(!checked)
  }

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger inset menuType="file">
        <Database className="mr-2 h-4 w-4" />
        知识库
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuItem inset onClick={handleVectorCalculation} menuType="file">
          <Database className="mr-2 h-4 w-4" />
          {hasVector ? '更新向量' : '计算向量'}
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasVector} inset onClick={(e) => { e.stopPropagation(); handleDeleteVector(); }} menuType="file" className="text-red-600">
          <Trash2 className="mr-2 h-4 w-4" />
          删除向量
        </ContextMenuItem>
        <ContextMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 text-sm" onClick={(e) => e.stopPropagation()}>
          <span>自动向量计算</span>
          <Switch
            checked={autoCalcEnabled}
            onCheckedChange={handleToggleAutoCalc}
            className="ml-4"
          />
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 text-sm" onClick={(e) => e.stopPropagation()}>
          <span>包含在知识库中</span>
          <Switch
            checked={!excludeFromKB}
            onCheckedChange={handleToggleExcludeFromKB}
            className="ml-4"
          />
        </div>
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}
