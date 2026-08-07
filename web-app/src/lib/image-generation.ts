import {
  ExtensionTypeEnum,
  ImageEngine,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageModelInfo,
} from '@janhq/core'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'

type NativeImageModel = {
  id: string
  path: string
  family: 'sdxl'
}

type NativeImageResult = {
  jobId: string
  path: string
  width: number
  height: number
  seed: number
  durationMs: number
}

/** Built-in adapter for the managed stable-diffusion.cpp CLI runtime. */
export class StableDiffusionCppImageEngine extends ImageEngine {
  readonly provider = 'atomic-image'
  private loaded = new Set<string>()

  constructor() {
    super('', 'atomic-image', 'Atomic Image', true, 'Local image generation')
  }

  override type(): ExtensionTypeEnum {
    return ExtensionTypeEnum.ImageEngine
  }

  override onUnload(): void {
    this.loaded.clear()
  }

  async list(): Promise<ImageModelInfo[]> {
    const models = await invoke<NativeImageModel[]>('list_image_models')
    return models.map((model) => ({
      ...model,
      name: model.id.replace(/\.(safetensors|ckpt|gguf)$/i, ''),
      capabilities: ['image_generation'],
    }))
  }

  async load(modelId: string): Promise<void> {
    const models = await this.list()
    if (!models.some((model) => model.id === modelId))
      throw new Error(`Image model '${modelId}' is not installed`)
    this.loaded.add(modelId)
  }

  async unload(modelId: string): Promise<void> {
    this.loaded.delete(modelId)
  }

  async getLoadedModels(): Promise<string[]> {
    return [...this.loaded]
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    await this.load(request.model)
    const jobId = crypto.randomUUID()
    const createdAt = Date.now()
    const result = await invoke<NativeImageResult>('generate_image', {
      request: {
        jobId,
        model: request.model,
        prompt: request.prompt,
        negativePrompt: request.negativePrompt,
        width: request.width,
        height: request.height,
        steps: request.steps,
        guidanceScale: request.guidanceScale,
        seed: request.seed,
      },
    })
    return {
      jobId,
      model: request.model,
      provider: this.provider,
      createdAt,
      durationMs: result.durationMs,
      images: [{
        path: result.path,
        url: convertFileSrc(result.path),
        mimeType: 'image/png',
        width: result.width,
        height: result.height,
        seed: result.seed,
      }],
    }
  }

  async cancel(jobId: string): Promise<void> {
    await invoke('cancel_image_generation', { jobId })
  }
}

let engine: StableDiffusionCppImageEngine | undefined

export function getImageGenerationEngine(): StableDiffusionCppImageEngine {
  if (!engine) {
    engine = new StableDiffusionCppImageEngine()
    engine.onLoad()
  }
  return engine
}
