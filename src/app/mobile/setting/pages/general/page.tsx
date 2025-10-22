'use client'

import { useTranslations } from 'next-intl'
import { InterfaceSettings } from '@/app/core/setting/general/interface-settings'

export default function GeneralSettingsPage() {
  const t = useTranslations('settings.general')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('desc')}</p>
      </div>
      <InterfaceSettings />
    </div>
  )
}
