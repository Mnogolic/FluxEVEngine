export type Locale = 'en' | 'ru'

export const DEFAULT_LOCALE: Locale = 'ru'

export function getIntlLocale(locale: Locale): string {
  return locale === 'ru' ? 'ru-RU' : 'en-US'
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'ru' || value === 'en'
}
