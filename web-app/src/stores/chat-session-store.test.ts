import type { Chat, UIMessage } from '@ai-sdk/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomChatTransport } from '@/lib/custom-chat-transport'
import { useChatSessions } from '@/stores/chat-session-store'

function createChat(messages: UIMessage[]): Chat<UIMessage> {
  return {
    messages,
    status: 'ready',
    stop: vi.fn(),
  } as unknown as Chat<UIMessage>
}

describe('chat session message routing', () => {
  beforeEach(() => {
    useChatSessions.getState().clearSessions()
  })

  it('updates only the addressed thread session', () => {
    const threadAMessage: UIMessage = {
      id: 'thread-a-user',
      role: 'user',
      parts: [{ type: 'text', text: 'Thread A' }],
    }
    const threadBMessage: UIMessage = {
      id: 'thread-b-user',
      role: 'user',
      parts: [{ type: 'text', text: 'Thread B' }],
    }
    const agentMessage: UIMessage = {
      id: 'agent-run-a',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Finished in thread A' }],
    }
    const transport = {} as CustomChatTransport
    const chatA = createChat([threadAMessage])
    const chatB = createChat([threadBMessage])

    useChatSessions
      .getState()
      .ensureSession('thread-a', transport, () => chatA)
    useChatSessions
      .getState()
      .ensureSession('thread-b', transport, () => chatB)

    useChatSessions.getState().upsertMessage('thread-a', agentMessage)

    expect(chatA.messages).toEqual([threadAMessage, agentMessage])
    expect(chatB.messages).toEqual([threadBMessage])
  })

  it('replaces an existing message in place without reshuffling', () => {
    const userMessage: UIMessage = {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'draw a cat' }],
    }
    const pending: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Generating image…' }],
    }
    const ready: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'file',
          mediaType: 'image/png',
          url: 'asset://localhost/generated.png',
        },
      ],
    }
    const trailing: UIMessage = {
      id: 'user-2',
      role: 'user',
      parts: [{ type: 'text', text: 'thanks' }],
    }
    const transport = {} as CustomChatTransport
    const chat = createChat([userMessage, pending, trailing])

    useChatSessions
      .getState()
      .ensureSession('thread-img', transport, () => chat)

    useChatSessions.getState().upsertMessage('thread-img', ready)

    expect(chat.messages).toEqual([userMessage, ready, trailing])
  })
})
