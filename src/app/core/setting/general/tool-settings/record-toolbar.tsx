'use client'

import { useTranslations } from 'next-intl'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item'
import { Highlighter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { RecordToolbarDialog } from './record-toolbar-dialog'

export function RecordToolbarSettings() {
  const t = useTranslations('settings.general.tools.recordToolbar')
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Item variant="outline">
        <ItemMedia variant="icon"><Highlighter className="size-4" /></ItemMedia>
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
      
      <RecordToolbarDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
