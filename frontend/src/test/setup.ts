import i18n from '@/app/i18n'
import '@testing-library/jest-dom/vitest'

beforeAll(async () => {
  await i18n.changeLanguage('en')
})
