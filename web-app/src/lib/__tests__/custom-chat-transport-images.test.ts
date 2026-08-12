import type { UIMessage } from '@ai-sdk/react'
import { describe, expect, it } from 'vitest'
import { projectImagesForInference } from '../custom-chat-transport'

const generatedImage = (includeInInference = false): UIMessage => ({
  id: 'generated-image',
  role: 'assistant',
  metadata: {
    generationMode: 'image',
    artifactKind: 'generated_image',
    includeInInference,
  },
  parts: [
    {
      type: 'file',
      mediaType: 'image/png',
      url: 'asset://localhost/generated.png',
    },
  ],
})

const userImage: UIMessage = {
  id: 'user-image',
  role: 'user',
  parts: [
    { type: 'text', text: 'Describe this image' },
    {
      type: 'file',
      mediaType: 'image/png',
      url: 'data:image/png;base64,fixture',
    },
  ],
}

describe('projectImagesForInference', () => {
  it('removes all image inputs for a text-only model', () => {
    expect(projectImagesForInference([generatedImage(), userImage], false)).toEqual([
      { ...userImage, parts: [{ type: 'text', text: 'Describe this image' }] },
    ])
  })

  it('keeps user image attachments for a vision model', () => {
    expect(projectImagesForInference([userImage], true)).toEqual([userImage])
  })

  it('excludes generated assistant images from vision context by default', () => {
    expect(projectImagesForInference([generatedImage()], true)).toEqual([])
  })

  it('includes a generated image after explicit opt-in on a vision model', () => {
    const message = generatedImage(true)
    expect(projectImagesForInference([message], true)).toEqual([message])
  })
})
