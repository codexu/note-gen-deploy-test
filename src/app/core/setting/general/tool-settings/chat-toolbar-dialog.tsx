'use client'

import { useTranslations } from 'next-intl'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import useSettingStore, { ChatToolbarItem } from '@/stores/setting'
import { useEffect, useState } from 'react'
import { 
  BotMessageSquare, 
  Drama, 
  Languages, 
  Link2, 
  FileText, 
  ServerCrash, 
  BookOpen, 
  Lightbulb, 
  Clipboard, 
  Eraser, 
  Trash2,
  GripVertical
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ChatToolbarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// 工具配置映射
const TOOL_CONFIG_MAP: Record<string, { icon: React.ReactNode; labelKey: string }> = {
  modelSelect: { icon: <BotMessageSquare className="size-4" />, labelKey: 'modelSelect.tooltip' },
  promptSelect: { icon: <Drama className="size-4" />, labelKey: 'promptSelect.tooltip' },
  chatLanguage: { icon: <Languages className="size-4" />, labelKey: 'chatLanguage.tooltip' },
  chatLink: { icon: <Link2 className="size-4" />, labelKey: 'tagLink.on' },
  fileLink: { icon: <FileText className="size-4" />, labelKey: 'fileLink.tooltip' },
  mcpButton: { icon: <ServerCrash className="size-4" />, labelKey: 'mcp.tooltip' },
  ragSwitch: { icon: <BookOpen className="size-4" />, labelKey: 'rag.enabled' },
  chatPlaceholder: { icon: <Lightbulb className="size-4" />, labelKey: 'placeholder.on' },
  clipboardMonitor: { icon: <Clipboard className="size-4" />, labelKey: 'clipboardMonitor.enable' },
  clearContext: { icon: <Eraser className="size-4" />, labelKey: 'clearContext.tooltip' },
  clearChat: { icon: <Trash2 className="size-4" />, labelKey: 'clearChat' },
}

export function ChatToolbarDialog({ open, onOpenChange }: ChatToolbarDialogProps) {
  const t = useTranslations()
  const tChat = useTranslations('record.chat.input')
  const { chatToolbarConfig, setChatToolbarConfig } = useSettingStore()
  const [localConfig, setLocalConfig] = useState<ChatToolbarItem[]>([])

  useEffect(() => {
    if (open) {
      // 打开抽屉时，加载当前配置
      setLocalConfig([...chatToolbarConfig].sort((a, b) => a.order - b.order))
    }
  }, [open, chatToolbarConfig])

  // 自动保存配置
  const autoSave = async (newConfig: ChatToolbarItem[]) => {
    await setChatToolbarConfig(newConfig)
  }

  const handleToggle = (id: string) => {
    setLocalConfig(prev => {
      const newConfig = prev.map(item => 
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
      // 自动保存
      autoSave(newConfig)
      return newConfig
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setLocalConfig((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        
        const newItems = arrayMove(items, oldIndex, newIndex)
        // 更新 order
        const updatedItems = newItems.map((item, index) => ({
          ...item,
          order: index
        }))
        // 自动保存
        autoSave(updatedItems)
        return updatedItems
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="!w-full sm:!w-[520px] !max-w-none overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('settings.general.tools.chatToolbar.dialogTitle')}</SheetTitle>
          <SheetDescription>
            {t('settings.general.tools.chatToolbar.dialogDesc')}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 mt-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localConfig.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              {localConfig.map((item) => (
                <SortableToolItem
                  key={item.id}
                  item={item}
                  config={TOOL_CONFIG_MAP[item.id]}
                  onToggle={handleToggle}
                  tChat={tChat}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface SortableToolItemProps {
  item: ChatToolbarItem
  config: { icon: React.ReactNode; labelKey: string } | undefined
  onToggle: (id: string) => void
  tChat: any
}

function SortableToolItem({ item, config, onToggle, tChat }: SortableToolItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (!config) return null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 border rounded-lg ${
        isDragging ? 'bg-accent opacity-50' : 'bg-background'
      }`}
    >
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </div>
      
      <div className="flex items-center gap-2 flex-1">
        {config.icon}
        <span className="text-sm">
          {tChat(config.labelKey as any)}
        </span>
      </div>

      <Switch
        checked={item.enabled}
        onCheckedChange={() => onToggle(item.id)}
      />
    </div>
  )
}
