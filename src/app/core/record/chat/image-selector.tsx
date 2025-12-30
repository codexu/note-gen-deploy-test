"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslations } from "next-intl"
import { open } from "@tauri-apps/plugin-dialog"
import { convertFileSrc } from "@tauri-apps/api/core"
import useMarkStore from "@/stores/mark"
import Image from "next/image"
import { Check } from "lucide-react"
import { ImageAttachment } from "./image-attachments"

interface ImageSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (images: ImageAttachment[]) => void
  selectedImages: ImageAttachment[]
}

export function ImageSelector({ isOpen, onClose, onSelect, selectedImages }: ImageSelectorProps) {
  const t = useTranslations()
  const { marks } = useMarkStore()
  const [recordSelectedIds, setRecordSelectedIds] = useState<string[]>([])
  
  const imageMarks = marks.filter(mark => mark.type === 'image' && !mark.deleted)

  useEffect(() => {
    if (isOpen) {
      const selected = selectedImages.filter(img => img.source === 'record').map(img => img.id)
      setRecordSelectedIds(selected)
    }
  }, [isOpen, selectedImages])

  async function handleSelectLocalFiles() {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
        }]
      })

      if (selected && Array.isArray(selected)) {
        const newImages: ImageAttachment[] = selected.map((path) => ({
          id: `local-${Date.now()}-${Math.random()}`,
          url: convertFileSrc(path),
          name: path.split('/').pop() || path,
          source: 'file' as const
        }))
        
        const allSelected = [
          ...selectedImages.filter(img => img.source !== 'file'),
          ...newImages
        ]
        onSelect(allSelected)
        onClose()
      }
    } catch (error) {
      console.error('Failed to select files:', error)
    }
  }

  function toggleRecordImage(mark: typeof imageMarks[0]) {
    const imageId = `record-${mark.id}`
    const isSelected = recordSelectedIds.includes(imageId)
    
    if (isSelected) {
      setRecordSelectedIds(prev => prev.filter(id => id !== imageId))
    } else {
      setRecordSelectedIds(prev => [...prev, imageId])
    }
  }

  function handleConfirmRecordSelection() {
    const recordImages: ImageAttachment[] = recordSelectedIds.map(id => {
      const markId = parseInt(id.replace('record-', ''))
      const mark = imageMarks.find(m => m.id === markId)
      return {
        id,
        url: convertFileSrc(mark!.url),
        name: mark?.desc || `Image ${markId}`,
        source: 'record' as const
      }
    })
    
    const allSelected = [
      ...selectedImages.filter(img => img.source !== 'record'),
      ...recordImages
    ]
    onSelect(allSelected)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t('record.chat.imageSelector.title')}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="local" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="local">{t('record.chat.imageSelector.local')}</TabsTrigger>
            <TabsTrigger value="records">{t('record.chat.imageSelector.records')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="local" className="space-y-4">
            <Button onClick={handleSelectLocalFiles} className="w-full">
              {t('record.chat.imageSelector.selectFiles')}
            </Button>
          </TabsContent>
          
          <TabsContent value="records" className="space-y-4">
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              {imageMarks.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t('record.chat.imageSelector.noRecords')}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {imageMarks.map((mark) => {
                    const imageId = `record-${mark.id}`
                    const isSelected = recordSelectedIds.includes(imageId)
                    
                    return (
                      <div
                        key={mark.id}
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected ? 'border-primary' : 'border-transparent'
                        }`}
                        onClick={() => toggleRecordImage(mark)}
                      >
                        <div className="aspect-square relative">
                          <Image
                            src={convertFileSrc(mark.url)}
                            alt={mark.desc || 'Image'}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="bg-primary rounded-full p-1">
                                <Check className="h-4 w-4 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                        </div>
                        {mark.desc && (
                          <div className="p-2 text-xs truncate bg-background">
                            {mark.desc}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                {t('record.chat.imageSelector.cancel')}
              </Button>
              <Button onClick={handleConfirmRecordSelection} disabled={recordSelectedIds.length === 0}>
                {t('record.chat.imageSelector.confirm')} ({recordSelectedIds.length})
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
