import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}))

describe('resolveSupportsVision', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('uses catalog vision for non-llama providers', async () => {
    const { resolveSupportsVision } = await import('../session-vision')
    await expect(
      resolveSupportsVision({
        providerName: 'mlx',
        modelId: 'vision-model',
        capabilities: ['vision'],
      })
    ).resolves.toBe(true)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('prefers live session mmproj over catalog vision', async () => {
    invoke.mockResolvedValueOnce({ sessions: [{ model_id: 'gemma', mmproj_path: undefined }] })
    const { resolveSupportsVision } = await import('../session-vision')
    await expect(
      resolveSupportsVision({
        providerName: 'llamacpp-upstream',
        modelId: 'gemma',
        capabilities: ['vision'],
      })
    ).resolves.toBe(false)
    expect(invoke).toHaveBeenCalledWith(
      'atomic_core_call',
      { method: 'GET', path: '/sessions', body: null }
    )
  })

  it('reports vision when the live session has mmproj', async () => {
    invoke.mockResolvedValueOnce({ sessions: [{ model_id: 'gemma', provider: 'llamacpp', mmproj_path: '/models/mmproj.gguf' }] })
    const { resolveSupportsVision } = await import('../session-vision')
    await expect(
      resolveSupportsVision({
        providerName: 'llamacpp',
        modelId: 'gemma',
        capabilities: [],
      })
    ).resolves.toBe(true)
  })

  it('falls back to catalog vision when no session is loaded', async () => {
    invoke.mockResolvedValueOnce({ sessions: [] })
    const { resolveSupportsVision } = await import('../session-vision')
    await expect(
      resolveSupportsVision({
        providerName: 'llamacpp-upstream',
        modelId: 'gemma',
        capabilities: ['vision'],
      })
    ).resolves.toBe(true)
  })
})
