'use client'

import { useTranslations } from 'next-intl'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item'
import { Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { ChatToolbarDialog } from './chat-toolbar-dialog'

export function ChatToolbarSettings() {
  const t = useTranslations('settings.general.tools.chatToolbar')
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Item variant="outline">
        <ItemMedia variant="icon"><Wrench className="size-4" /></ItemMedia>
        <ItemContent>
          <ItemTitle>{t('title')}</ItemTitle>
          <ItemDescription>{t('desc')}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            {t('button')}
          </Button>
        </ItemActions>
      </Item>
      
      <ChatToolbarDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
