import i18n from '@/app/i18n'
import '@testing-library/jest-dom/vitest'

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

// jsdom не знает ResizeObserver: сразу отдаём текущий размер элемента.
class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element): void {
    const entry = { target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry
    this.callback([entry], this as unknown as ResizeObserver)
  }

  unobserve(): void {}

  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
