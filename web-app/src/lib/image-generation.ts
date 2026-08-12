import {
  ExtensionTypeEnum,
  ImageEngine,
  ImageEngineManager,
  type ImageGenerationRequest,
  type ImageGenerationProgress,
  type ImageGenerationResult,
  type ImageModelInfo,
} from '@janhq/core'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

const IMAGE_GENERATION_PROGRESS_EVENT = 'image-generation-progress'

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

  async generate(
    request: ImageGenerationRequest,
    onProgress?: (progress: ImageGenerationProgress) => void
  ): Promise<ImageGenerationResult> {
    await this.load(request.model)
    const jobId = crypto.randomUUID()
    const createdAt = Date.now()
    const unlisten = onProgress
      ? await listen<ImageGenerationProgress>(
          IMAGE_GENERATION_PROGRESS_EVENT,
          ({ payload }) => {
            if (payload.jobId === jobId) onProgress(payload)
          }
        )
      : undefined
    let result: NativeImageResult
    try {
      result = await invoke<NativeImageResult>('generate_image', {
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
    } finally {
      unlisten?.()
    }
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

let builtInEngine: StableDiffusionCppImageEngine | undefined

function ensureBuiltInImageEngine(): void {
  if (!builtInEngine) {
    builtInEngine = new StableDiffusionCppImageEngine()
    builtInEngine.onLoad()
  }
}

/** Resolve an image provider without exposing its implementation to chat UI. */
export function getImageGenerationEngine(provider = 'atomic-image'): ImageEngine {
  ensureBuiltInImageEngine()
  const engine = ImageEngineManager.instance().get(provider)
  if (!engine) throw new Error(`Image provider '${provider}' is unavailable`)
  return engine
}
