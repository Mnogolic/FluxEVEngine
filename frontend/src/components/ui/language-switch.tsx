'use client'

import { Switch } from '@teach-in/react'
import { getDashboardCopy } from '@/components/dashboard/dashboard-copy'
import type { Locale } from '@/lib/locale'

interface LanguageSwitchProps {
  locale: Locale
  onChange: (locale: Locale) => void
}

export function LanguageSwitch({ locale, onChange }: LanguageSwitchProps) {
  const copy = getDashboardCopy(locale)
  const isRussian = locale === 'ru'

  return (
    <div className="inline-flex items-center gap-3">
      <span className={isRussian ? 'text-xs text-[#8b949e]' : 'text-xs text-[#e6edf3]'}>EN</span>
      <Switch
        aria-label={copy.languageToggleLabel}
        classNames={{
          base: 'group relative max-w-fit inline-flex items-center',
          thumb: [
            'h-5 w-5 bg-[#e6edf3] shadow-none',
            'group-data-[selected=true]:ms-[2.75rem]',
            'group-data-[pressed=true]:w-5',
            'group-data-[selected=true]:group-data-[pressed=true]:ms-[2.75rem]'
          ].join(' '),
          wrapper: [
            'h-7 w-[4.5rem] rounded-full border border-[#30363d] bg-[#161b22] px-1',
            'group-data-[hover=true]:bg-[#21262d]',
            'group-data-[selected=true]:border-[#1f6feb] group-data-[selected=true]:bg-[#1f6feb]',
            'group-data-[selected=true]:group-data-[hover=true]:bg-[#388bfd]'
          ].join(' ')
        }}
        color="primary"
        isSelected={isRussian}
        size="md"
        onValueChange={(selected) => onChange(selected ? 'ru' : 'en')}
      />
      <span className={isRussian ? 'text-xs text-[#e6edf3]' : 'text-xs text-[#8b949e]'}>RU</span>
    </div>
  )
}
