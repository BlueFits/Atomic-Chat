import {
  ChatCompletionRole,
  ContentType,
  MessageStatus,
  type ImageGenerationProgress,
  type ImageGenerationResult,
  type ThreadMessage,
} from '@janhq/core'

type ImageGenerationIdentity = {
  model: string
  provider: string
}

const textContent = (value: string) => [{
  type: ContentType.Text,
  text: { value, annotations: [] },
}]

export function createImagePromptMessage(
  threadId: string,
  prompt: string,
  now = Date.now()
): ThreadMessage {
  return {
    id: crypto.randomUUID(),
    object: 'thread.message',
    thread_id: threadId,
    role: ChatCompletionRole.User,
    content: textContent(prompt),
    status: MessageStatus.Ready,
    created_at: now,
    completed_at: now,
    metadata: { generationMode: 'image' },
  }
}

export function createPendingImageMessage(
  threadId: string,
  now = Date.now()
): ThreadMessage {
  return {
    id: crypto.randomUUID(),
    object: 'thread.message',
    thread_id: threadId,
    role: ChatCompletionRole.Assistant,
    content: textContent('Preparing image generation…'),
    status: MessageStatus.Pending,
    created_at: now,
    completed_at: 0,
    metadata: { generationMode: 'image' },
  }
}

export function createImageProgressMessage(
  pendingMessage: ThreadMessage,
  identity: ImageGenerationIdentity,
  progress?: ImageGenerationProgress
): ThreadMessage {
  const detail = progress && progress.totalSteps > 0
    ? ` ${progress.completedSteps}/${progress.totalSteps} (${Math.round(
        (progress.completedSteps / progress.totalSteps) * 100
      )}%)`
    : ''
  return {
    ...pendingMessage,
    content: textContent(`Generating image…${detail}`),
    metadata: {
      generationMode: 'image',
      model: identity.model,
      provider: identity.provider,
    },
  }
}

export function createGeneratedImageMessage(
  pendingMessage: ThreadMessage,
  result: ImageGenerationResult,
  now = Date.now()
): ThreadMessage {
  const image = result.images[0]
  if (!image) throw new Error('Image provider completed without an image')
  return {
    ...pendingMessage,
    content: [{ type: ContentType.Image, image_url: { url: image.url } }],
    status: MessageStatus.Ready,
    completed_at: now,
    metadata: {
      generationMode: 'image',
      artifactKind: 'generated_image',
      includeInInference: false,
      model: result.model,
      provider: result.provider,
      seed: image.seed,
      width: image.width,
      height: image.height,
      path: image.path,
      durationMs: result.durationMs,
    },
  }
}

export function createImageErrorMessage(
  pendingMessage: ThreadMessage,
  description: string,
  now = Date.now()
): ThreadMessage {
  return {
    ...pendingMessage,
    content: textContent(description),
    status: MessageStatus.Error,
    completed_at: now,
  }
}
