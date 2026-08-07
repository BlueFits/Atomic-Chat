import { BaseExtension } from '../../extension'
import { ImageEngineManager } from './ImageEngineManager'

export type ImageGenerationRequest = {
  model: string
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  steps?: number
  guidanceScale?: number
  seed?: number
  n?: number
}

export type ImageGenerationProgress = {
  jobId: string
  completedSteps: number
  totalSteps: number
  previewUrl?: string
}

export type GeneratedImage = {
  path: string
  url: string
  mimeType: 'image/png'
  width: number
  height: number
  seed: number
}

export type ImageGenerationResult = {
  jobId: string
  model: string
  provider: string
  createdAt: number
  durationMs: number
  images: GeneratedImage[]
}

export type ImageModelInfo = {
  id: string
  name?: string
  path: string
  family: 'sdxl'
  capabilities: ['image_generation']
}

/** A local or remote engine capable of producing image artifacts. */
export abstract class ImageEngine extends BaseExtension {
  abstract readonly provider: string

  override onLoad(): void {
    ImageEngineManager.instance().register(this)
  }

  abstract list(): Promise<ImageModelInfo[]>
  abstract load(modelId: string): Promise<void>
  abstract unload(modelId: string): Promise<void>
  abstract getLoadedModels(): Promise<string[]>
  abstract generate(
    request: ImageGenerationRequest,
    onProgress?: (progress: ImageGenerationProgress) => void
  ): Promise<ImageGenerationResult>
  abstract cancel(jobId: string): Promise<void>
}
