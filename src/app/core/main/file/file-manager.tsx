'use client'
import React, { useEffect, useState, useMemo, useRef } from "react"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import useArticleStore, { DirTree } from "@/stores/article"
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs"
import { FileItem } from './file-item'
import { FolderItem } from "./folder-item"
import { computedParentPath } from "@/lib/path"
import { writeDroppedFileToRoot } from "./root-drop"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { useTranslations } from "next-intl"
import {
  getFileManagerDragPath,
  getPathAfterMove,
  hasExternalFilesDragData,
  hasFileManagerDragData,
  moveFileManagerEntry,
} from "./file-dnd"

// 递归过滤文件树，移除云端文件（如果 showCloudFiles 为 false）
function filterFileTree(tree: DirTree[], showCloud: boolean): DirTree[] {
  if (showCloud) return tree

  return tree
    .filter(item => item.isLocale)
    .map(item => ({
      ...item,
      children: item.children ? filterFileTree(item.children, showCloud) : undefined
    }))
}

function Tree({ item, focusSidebar }: { item: DirTree; focusSidebar: () => void }) {
  const { collapsibleList, setCollapsibleList, loadCollapsibleFiles } = useArticleStore()
  const path = computedParentPath(item)

  function handleCollapse(isOpen: boolean) {
    setCollapsibleList(path, isOpen)
    if (isOpen) {
      loadCollapsibleFiles(path)
    }
  }

  return (
    item.isFile ?
    <FileItem item={item} focusSidebar={focusSidebar} /> :
    <li>
      <Collapsible
        onOpenChange={handleCollapse}
        className="group/collapsible [&[data-state=open]>button>.file-manange-item>svg:first-child]:rotate-90"
        open={collapsibleList.includes(path)}
      >
        <FolderItem item={item} focusSidebar={focusSidebar} />
        <CollapsibleContent className="pl-1">
          <ul className="pl-2">
            {item.children?.map((subItem) => (
              <Tree key={`${subItem.name}-${subItem.parent?.name}-${subItem.sha || ''}-${subItem.isLocale}`} item={subItem} focusSidebar={focusSidebar} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

export function FileManager({ focusSidebar }: { focusSidebar: () => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const dragDepthRef = useRef(0)
  const t = useTranslations('article.file')
  const {
    activeFilePath,
    fileTree,
    loadFileTree,
    setActiveFilePath,
    addFile,
    showCloudFiles,
    moveLocalEntry,
    syncOpenTabsForPathChange,
  } = useArticleStore()

  function resetRootDropState() {
    dragDepthRef.current = 0
    setIsDragging(false)
  }

  function canDropOnRoot(dataTransfer: DataTransfer) {
    return hasFileManagerDragData(dataTransfer) || hasExternalFilesDragData(dataTransfer)
  }

  async function moveEntryToRoot(sourcePath: string) {
    const result = await moveFileManagerEntry(sourcePath, '')

    if (!result.moved) {
      if (result.reason === 'invalid-target') {
        toast({
          title: t('context.invalidMoveTarget'),
          variant: 'destructive',
        })
      }
      return
    }

    const movedInTree = moveLocalEntry(result.sourcePath, result.targetPath)
    if (!movedInTree) {
      await loadFileTree()
    }

    const nextActiveFilePath = getPathAfterMove(activeFilePath, result.sourcePath, result.targetPath)
    if (nextActiveFilePath !== activeFilePath) {
      setActiveFilePath(nextActiveFilePath)
    }

    await syncOpenTabsForPathChange(result.sourcePath, result.targetPath)
  }

  async function handleDrop (e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const renamePath = hasFileManagerDragData(e.dataTransfer)
      ? getFileManagerDragPath(e.dataTransfer)
      : ''

    try {
      if (renamePath) {
        await moveEntryToRoot(renamePath)
      } else {
        const files = e.dataTransfer.files
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i]
          // 接受 markdown 和图片文件
          if (file.name.endsWith('.md')) {
            const text = await file.text()
            const { getFilePathOptions } = await import('@/lib/workspace')
            const sanitizedFileName = await writeDroppedFileToRoot({
              fileName: file.name,
              getFilePathOptions,
              writeTextFile,
            }, {
              kind: 'text',
              content: text,
            })

            addFile({
              name: sanitizedFileName,
              isEditing: false,
              isLocale: true,
              isDirectory: false,
              isFile: true,
              isSymlink: false
            })
          } else if (file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
            // 处理图片文件，同样需要处理文件名以保持一致性
            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            const { getFilePathOptions } = await import('@/lib/workspace')
            const sanitizedImageFileName = await writeDroppedFileToRoot({
              fileName: file.name,
              getFilePathOptions,
              writeFile,
            }, {
              kind: 'binary',
              content: uint8Array,
            })

            addFile({
              name: sanitizedImageFileName,
              isEditing: false,
              isLocale: true,
              isDirectory: false,
              isFile: true,
              isSymlink: false
            })
          }
        }
      }
    } catch (error) {
      console.error('File manager drop failed:', error)
      toast({
        title: renamePath ? t('context.moveFailed') : t('toolbar.importError'),
        variant: 'destructive',
      })
    } finally {
      resetRootDropState()
    }
  }
  
  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (!canDropOnRoot(e.dataTransfer)) {
      return
    }

    e.preventDefault()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!canDropOnRoot(e.dataTransfer)) {
      return
    }

    e.preventDefault()
    e.dataTransfer.dropEffect = hasExternalFilesDragData(e.dataTransfer) ? 'copy' : 'move'
    setIsDragging(true)
  }

  function handleDragleave(e: React.DragEvent<HTMLDivElement>) {
    if (!canDropOnRoot(e.dataTransfer)) {
      return
    }

    e.preventDefault()
    const nextTarget = e.relatedTarget as Node | null
    if (nextTarget && e.currentTarget.contains(nextTarget)) {
      return
    }

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragging(false)
    }
  }

  useEffect(() => {
    function handleGlobalDragFinish() {
      dragDepthRef.current = 0
      setIsDragging(false)
    }

    window.addEventListener('drop', handleGlobalDragFinish)
    window.addEventListener('dragend', handleGlobalDragFinish)

    return () => {
      window.removeEventListener('drop', handleGlobalDragFinish)
      window.removeEventListener('dragend', handleGlobalDragFinish)
    }
  }, [])

  useEffect(() => {
    if (fileTree.length === 0) {
      loadFileTree()
    }
  }, [loadFileTree])

  // 根据开关状态过滤文件树 - 使用 useMemo 缓存结果
  const filteredFileTree = useMemo(
    () => filterFileTree(fileTree, showCloudFiles),
    [fileTree, showCloudFiles]
  )

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto transition-colors",
        isDragging && "bg-primary/5 outline-2 outline-dashed -outline-offset-4 outline-primary/60"
      )}
      onDrop={(e) => handleDrop(e)}
      onDragEnter={(e) => handleDragEnter(e)}
      onDragOver={e => handleDragOver(e)}
      onDragLeave={(e) => handleDragleave(e)}
    >
      <div className="flex min-h-full flex-col p-0">
        <ul className="shrink-0">
          {filteredFileTree.map((item) => (
            <Tree key={`${item.name}-${item.parent?.name || ''}-${item.sha || ''}-${item.isLocale}`} item={item} focusSidebar={focusSidebar} />
          ))}
        </ul>
        <div
          aria-label={t('mobile.root')}
          className={cn(
            "min-h-24 flex-1 transition-colors",
            isDragging && "bg-primary/5"
          )}
        />
      </div>
    </div>
  )
}
