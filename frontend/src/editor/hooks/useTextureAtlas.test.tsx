import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSpriteCache } from '../render/sprites/loader'
import { useTextureAtlas } from './useTextureAtlas'

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

function jsonResponse(payload: unknown, ok = true) {
  return { ok, json: async () => payload } as unknown as Response
}

function Harness() {
  const atlas = useTextureAtlas()
  return (
    <div
      data-testid="atlas"
      data-null={String(atlas === null)}
      data-floor={atlas?.tileTextures.floor ? String(atlas.tileTextures.floor.size) : ''}
      data-element={atlas?.elementImages['table-wooden'] ? 'yes' : ''}
    />
  )
}

beforeEach(() => {
  resetSpriteCache()
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useTextureAtlas', () => {
  it('loads the texture atlas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('element-images')) {
          return jsonResponse({ version: 1, items: {} })
        }
        return jsonResponse({
          version: 2,
          tileTextures: { floor: { path: 'sprites/tiles/floor_stone.png', size: 256 } },
          objectTextures: {},
        })
      }),
    )

    render(<Harness />)

    await waitFor(() => expect(screen.getByTestId('atlas')).toHaveAttribute('data-floor', '256'))
    expect(screen.getByTestId('atlas')).toHaveAttribute('data-null', 'false')
  })

  it('stays null when no manifest is reachable', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(null, false))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    // Оба манифеста запрошены; после дренажа микрозадач цепочка хука
    // завершается на null-атласе (цветной fallback) — data-null остаётся true.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(screen.getByTestId('atlas')).toHaveAttribute('data-null', 'true')
  })

  it('keeps the element image pool when only the texture manifest is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('element-images')) {
          return jsonResponse({
            version: 1,
            items: { 'table-wooden': 'element-images/table-wooden.png' },
          })
        }
        return jsonResponse(null, false)
      }),
    )

    render(<Harness />)

    await waitFor(() =>
      expect(screen.getByTestId('atlas')).toHaveAttribute('data-element', 'yes'),
    )
    expect(screen.getByTestId('atlas')).toHaveAttribute('data-null', 'false')
  })

  it('keeps the texture atlas when only the element manifest is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('element-images')) {
          return jsonResponse(null, false)
        }
        return jsonResponse({
          version: 2,
          tileTextures: { floor: { path: 'sprites/tiles/floor_stone.png', size: 256 } },
          objectTextures: {},
        })
      }),
    )

    render(<Harness />)

    await waitFor(() => expect(screen.getByTestId('atlas')).toHaveAttribute('data-floor', '256'))
    expect(screen.getByTestId('atlas')).toHaveAttribute('data-null', 'false')
  })
})
