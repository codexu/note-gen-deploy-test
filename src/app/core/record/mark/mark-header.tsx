"use client"
import { useTranslations } from 'next-intl'
import * as React from "react"
import { initMarksDb } from "@/db/marks"
import { ControlScan } from "./control-scan"
import { ControlText } from "./control-text"
import { ControlImage } from "./control-image"
import { ControlFile } from "./control-file"
import { ControlLink } from "./control-link"
import { ControlRecording } from "./control-recording"
import useMarkStore from "@/stores/mark"
import useChatStore from "@/stores/chat"
import useSettingStore from "@/stores/setting"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from '@/components/ui/tooltip'
import { DownloadCloud, LoaderCircle, Menu, Trash2, UploadCloud, XCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import useTagStore from '@/stores/tag'
import { useState } from 'react'
import useUsername from '@/hooks/use-username'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function MarkHeader() {
  const [syncState, setSyncState] = useState(false)
  const t = useTranslations('record.mark');
  const { trashState, setTrashState, fetchAllTrashMarks, fetchMarks, uploadMarks, downloadMarks } = useMarkStore()
  const { uploadTags, downloadTags, fetchTags, currentTagId } = useTagStore()
  const { uploadChats, downloadChats, init } = useChatStore()
  const { recordToolbarConfig, setRecordToolbarConfig } = useSettingStore()
  const username = useUsername()
  const isMobile = useIsMobile()

  // 拖拽传感器配置（仅桌面端）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 500, // 按住500ms后才开始拖拽，避免误触点击事件
        tolerance: 5, // 允许5px的移动误差
      },
    })
  )

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = recordToolbarConfig.findIndex((item) => item.id === active.id)
      const newIndex = recordToolbarConfig.findIndex((item) => item.id === over.id)
      
      const newItems = arrayMove(recordToolbarConfig, oldIndex, newIndex)
      // 更新 order
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        order: index
      }))
      setRecordToolbarConfig(updatedItems)
    }
  }

  async function upload() {
    setSyncState(true)
    const tagRes = await uploadTags()
    const markRes = await uploadMarks()
    const chatRes = await uploadChats()
    if (tagRes && markRes && chatRes) {
      toast({
        description: t('uploadSuccess'),
      })
    }
    setSyncState(false)
  }

  async function download() {
    setSyncState(true)
    const tagRes = await downloadTags()
    const markRes = await downloadMarks()
    const chatRes = await downloadChats()
    if (tagRes && markRes && chatRes) {
      await fetchTags()
      await fetchMarks()
      init(currentTagId)
      toast({
        description: t('downloadSuccess'),
      })
    }
    setSyncState(false)
  }

  React.useEffect(() => {
    initMarksDb()
  }, [])

  React.useEffect(() => {
    if (trashState) {
      fetchAllTrashMarks()
    } else {
      fetchMarks()
    }
  }, [trashState])

  return (
    <div className="flex justify-between items-center h-12 border-b px-2">
      <div className="flex">
        <TooltipProvider>
          {/* 可拖拽排序的按钮容器（桌面端）或普通容器（移动端） */}
          {!isMobile ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={recordToolbarConfig.filter(item => item.enabled).map(item => item.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex">
                  {recordToolbarConfig
                    .filter(item => item.enabled)
                    .sort((a, b) => a.order - b.order)
                    .map(item => (
                      <SortableToolbarItem key={item.id} id={item.id} />
                    ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="flex">
              {recordToolbarConfig
                .filter(item => item.enabled)
                .sort((a, b) => a.order - b.order)
                .map(item => {
                  switch (item.id) {
                    case 'text':
                      return <ControlText key={item.id} />
                    case 'recording':
                      return <ControlRecording key={item.id} />
                    case 'scan':
                      return <ControlScan key={item.id} />
                    case 'image':
                      return <ControlImage key={item.id} />
                    case 'link':
                      return <ControlLink key={item.id} />
                    case 'file':
                      return <ControlFile key={item.id} />
                    default:
                      return null
                  }
                })}
            </div>
          )}
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-1">
        {
          trashState ? 
          <Button variant="ghost" size="icon" onClick={() => setTrashState(false)}><XCircle /></Button> :
          syncState ? 
            <Button variant="ghost" size="icon" disabled><LoaderCircle className="animate-spin size-4" /></Button> :
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTrashState(true)}>
                  <Trash2 />{t('toolbar.trash')}
                </DropdownMenuItem>
                {username ? (
                  <>
                    <DropdownMenuItem onClick={upload}>
                      <UploadCloud />{t('type.upload')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={download}>
                      <DownloadCloud />{t('type.download')}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
        }
      </div>
    </div>
  )
}

// 可排序的工具栏项组件
interface SortableToolbarItemProps {
  id: string
}

function SortableToolbarItem({ id }: SortableToolbarItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // 渲染对应的工具栏组件
  const renderToolbarItem = () => {
    switch (id) {
      case 'text':
        return <ControlText />
      case 'recording':
        return <ControlRecording />
      case 'scan':
        return <ControlScan />
      case 'image':
        return <ControlImage />
      case 'link':
        return <ControlLink />
      case 'file':
        return <ControlFile />
      default:
        return null
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      {renderToolbarItem()}
    </div>
  )
}
