import { useCallback } from 'react'
import type { ThreadMessage } from '@janhq/core'
import { toast } from 'sonner'
import { useMessages } from '@/hooks/useMessages'
import { useChatSessions } from '@/stores/chat-session-store'
import { convertThreadMessageToUIMessage } from '@/lib/messages'
import { getImageGenerationEngine } from '@/lib/image-generation'
import {
  createGeneratedImageMessage,
  createImageErrorMessage,
  createImageProgressMessage,
  createImagePromptMessage,
  createPendingImageMessage,
} from '@/lib/image-generation-messages'

function publishImageMessage(message: ThreadMessage, operation: 'add' | 'update') {
  const messageStore = useMessages.getState()
  if (operation === 'add') messageStore.addMessage(message)
  else messageStore.updateMessage(message)

  useChatSessions.getState().upsertMessage(
    message.thread_id,
    convertThreadMessageToUIMessage(message)
  )
}

export function useChatImageGeneration(threadId?: string) {
  const generateImage = useCallback(async (prompt: string): Promise<void> => {
    if (!threadId) throw new Error('Open a chat before generating an image')

    const now = Date.now()
    const userMessage = createImagePromptMessage(threadId, prompt, now)
    const pendingMessage = createPendingImageMessage(threadId, now)
    publishImageMessage(userMessage, 'add')
    publishImageMessage(pendingMessage, 'add')

    try {
      const engine = getImageGenerationEngine()
      const models = await engine.list()
      const model = models[0]
      if (!model) {
        throw new Error(
          'No image model is installed. Install an image checkpoint before generating an image.'
        )
      }
      const identity = { model: model.id, provider: engine.provider }
      publishImageMessage(
        createImageProgressMessage(pendingMessage, identity),
        'update'
      )
      const result = await engine.generate(
        { model: model.id, prompt },
        (progress) => publishImageMessage(
          createImageProgressMessage(pendingMessage, identity, progress),
          'update'
        )
      )
      publishImageMessage(
        createGeneratedImageMessage(pendingMessage, result),
        'update'
      )
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error)
      publishImageMessage(
        createImageErrorMessage(pendingMessage, description),
        'update'
      )
      toast.error('Image generation failed', { description })
    }
  }, [threadId])

  return { generateImage }
}
