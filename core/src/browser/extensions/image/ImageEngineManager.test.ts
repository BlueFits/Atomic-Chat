import { beforeEach, describe, expect, it } from 'vitest'
import { ImageEngineManager } from './ImageEngineManager'
import type { ImageEngine } from './ImageEngine'

describe('ImageEngineManager', () => {
  let manager: ImageEngineManager
  beforeEach(() => { manager = new ImageEngineManager() })

  it('registers image engines independently by provider', () => {
    const engine = { provider: 'atomic-image' } as ImageEngine
    manager.register(engine)
    expect(manager.get('atomic-image')).toBe(engine)
    expect(manager.list()).toEqual([engine])
  })

  it('returns undefined for an unknown provider', () => {
    expect(manager.get('missing')).toBeUndefined()
  })
})
