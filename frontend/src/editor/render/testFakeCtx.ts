export type RecordedCall = { op: string; args: unknown[]; fillStyle: string }

export interface FakeCtx {
  canvas: { width: number; height: number }
  fillStyle: string
  globalAlpha: number
  strokeStyle: string
  lineWidth: number
  imageSmoothingEnabled: boolean
  fillRect(...args: unknown[]): void
  beginPath(): void
  arc(...args: unknown[]): void
  fill(): void
  closePath(): void
  moveTo(...args: unknown[]): void
  lineTo(...args: unknown[]): void
  stroke(): void
  strokeRect(...args: unknown[]): void
  setTransform(...args: unknown[]): void
  drawImage(...args: unknown[]): void
  save(): void
  restore(): void
  clip(...args: unknown[]): void
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
    imageSmoothingEnabled: true,
    fillRect(...args: unknown[]) {
      calls.push({ op: 'fillRect', args, fillStyle: this.fillStyle })
    },
    beginPath() {
      calls.push({ op: 'beginPath', args: [], fillStyle: this.fillStyle })
    },
    arc(...args: unknown[]) {
      calls.push({ op: 'arc', args, fillStyle: this.fillStyle })
    },
    fill() {
      calls.push({ op: 'fill', args: [], fillStyle: this.fillStyle })
    },
    closePath() {
      calls.push({ op: 'closePath', args: [], fillStyle: this.fillStyle })
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
    strokeRect(...args: unknown[]) {
      calls.push({ op: 'strokeRect', args, fillStyle: this.fillStyle })
    },
    setTransform(...args: unknown[]) {
      calls.push({ op: 'setTransform', args, fillStyle: this.fillStyle })
    },
    drawImage(...args: unknown[]) {
      calls.push({ op: 'drawImage', args, fillStyle: this.fillStyle })
    },
    save() {
      calls.push({ op: 'save', args: [], fillStyle: this.fillStyle })
    },
    restore() {
      calls.push({ op: 'restore', args: [], fillStyle: this.fillStyle })
    },
    clip(...args: unknown[]) {
      calls.push({ op: 'clip', args, fillStyle: this.fillStyle })
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, raw: ctx }
}
