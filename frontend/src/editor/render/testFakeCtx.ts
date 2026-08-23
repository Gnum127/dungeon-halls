export type RecordedCall = { op: string; args: unknown[]; fillStyle: string }

export interface FakeCtx {
  canvas: { width: number; height: number }
  fillStyle: string
  globalAlpha: number
  strokeStyle: string
  lineWidth: number
  fillRect(...args: unknown[]): void
  beginPath(): void
  moveTo(...args: unknown[]): void
  lineTo(...args: unknown[]): void
  stroke(): void
}

/** Фейковый 2D-контекст, записывающий вызовы для ассертов в тестах рендера. */
export function makeFakeCtx(
  width = 320,
  height = 240,
): {
  ctx: CanvasRenderingContext2D
  calls: RecordedCall[]
  raw: FakeCtx
} {
  const calls: RecordedCall[] = []
  const ctx: FakeCtx = {
    canvas: { width, height },
    fillStyle: '',
    globalAlpha: 1,
    strokeStyle: '',
    lineWidth: 1,
    fillRect(...args: unknown[]) {
      calls.push({ op: 'fillRect', args, fillStyle: this.fillStyle })
    },
    beginPath() {
      calls.push({ op: 'beginPath', args: [], fillStyle: this.fillStyle })
    },
    moveTo(...args: unknown[]) {
      calls.push({ op: 'moveTo', args, fillStyle: this.fillStyle })
    },
    lineTo(...args: unknown[]) {
      calls.push({ op: 'lineTo', args, fillStyle: this.fillStyle })
    },
    stroke() {
      calls.push({ op: 'stroke', args: [], fillStyle: this.strokeStyle })
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, raw: ctx }
}
