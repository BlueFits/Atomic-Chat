import { describe, expect, it, vi } from 'vitest'
import { ContentType, MessageStatus } from '@janhq/core'
import {
  createGeneratedImageMessage,
  createImageErrorMessage,
  createImageProgressMessage,
  createImagePromptMessage,
  createPendingImageMessage,
} from '../image-generation-messages'

describe('image generation messages', () => {
  it('creates a prompt and pending lifecycle pair for one thread', () => {
    const randomUUID = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('user-id')
      .mockReturnValueOnce('assistant-id')

    const user = createImagePromptMessage('thread-id', 'A moonlit lake', 100)
    const pending = createPendingImageMessage('thread-id', 100)

    expect(user).toMatchObject({
      id: 'user-id',
      thread_id: 'thread-id',
      role: 'user',
      status: MessageStatus.Ready,
      completed_at: 100,
      metadata: { generationMode: 'image' },
    })
    expect(pending).toMatchObject({
      id: 'assistant-id',
      thread_id: 'thread-id',
      role: 'assistant',
      status: MessageStatus.Pending,
      completed_at: 0,
      metadata: { generationMode: 'image' },
    })
    randomUUID.mockRestore()
  })

  it('updates one pending message through progress and completion', () => {
    const pending = createPendingImageMessage('thread-id', 100)
    const progress = createImageProgressMessage(
      pending,
      { model: 'image-model', provider: 'image-provider' },
      { jobId: 'job-id', completedSteps: 5, totalSteps: 20 }
    )
    const completed = createGeneratedImageMessage(
      pending,
      {
        jobId: 'job-id',
        model: 'image-model',
        provider: 'image-provider',
        createdAt: 100,
        durationMs: 2500,
        images: [{
          path: 'generated.png',
          url: 'asset://localhost/generated.png',
          mimeType: 'image/png',
          width: 512,
          height: 512,
          seed: 42,
        }],
      },
      200
    )

    expect(progress.id).toBe(pending.id)
    expect(progress.content[0]?.text?.value).toBe(
      'Generating image… 5/20 (25%)'
    )
    expect(completed).toMatchObject({
      id: pending.id,
      status: MessageStatus.Ready,
      completed_at: 200,
      metadata: {
        artifactKind: 'generated_image',
        includeInInference: false,
        model: 'image-model',
        provider: 'image-provider',
      },
    })
    expect(completed.content[0]).toMatchObject({
      type: ContentType.Image,
      image_url: { url: 'asset://localhost/generated.png' },
    })
  })

  it('turns the pending message into a terminal error', () => {
    const pending = createPendingImageMessage('thread-id', 100)
    const failed = createImageErrorMessage(pending, 'Provider unavailable', 200)

    expect(failed).toMatchObject({
      id: pending.id,
      status: MessageStatus.Error,
      completed_at: 200,
    })
    expect(failed.content[0]?.text?.value).toBe('Provider unavailable')
  })
})
