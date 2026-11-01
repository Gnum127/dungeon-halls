import { describe, expect, it } from 'vitest'
import { doorHitTest } from './doorHitTest'
import { createDoor } from '../model/doors'

const door = createDoor({ x: 5, y: 0 }, { x: 6, y: 0 }, { id: 'd1' })

describe('doorHitTest', () => {
  it('returns the door id when the point is within the radius of the opening', () => {
    expect(doorHitTest({ x: 5.5, y: 0.1 }, [door], 0.3)).toBe('d1')
  })

  it('returns null when the point is beyond the radius', () => {
    expect(doorHitTest({ x: 5.5, y: 2 }, [door], 0.3)).toBeNull()
  })

  it('treats a point exactly at the hit radius as a hit (inclusive boundary)', () => {
    expect(doorHitTest({ x: 5.5, y: 0.3 }, [door], 0.3)).toBe('d1')
  })

  it('picks the nearest door when several are close', () => {
    const near = createDoor({ x: 4, y: 0 }, { x: 5, y: 0 }, { id: 'a' })
    const closest = createDoor({ x: 6, y: 0 }, { x: 7, y: 0 }, { id: 'b' })
    expect(doorHitTest({ x: 6.2, y: 0 }, [near, closest], 2)).toBe('b')
  })

  it('handles an empty list and a distant query', () => {
    expect(doorHitTest({ x: 0, y: 0 }, [], 1)).toBeNull()
    expect(doorHitTest({ x: 0, y: 0 }, [door], 1)).toBeNull()
  })
})
