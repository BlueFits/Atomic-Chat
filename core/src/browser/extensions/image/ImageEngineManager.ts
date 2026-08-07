import type { ImageEngine } from './ImageEngine'

/** Registry kept separate from conversational engines to preserve their contract. */
export class ImageEngineManager {
  public engines = new Map<string, ImageEngine>()
  private static fallback: ImageEngineManager | undefined

  register<T extends ImageEngine>(engine: T): void {
    this.engines.set(engine.provider, engine)
  }

  get<T extends ImageEngine>(provider: string): T | undefined {
    return this.engines.get(provider) as T | undefined
  }

  list(): ImageEngine[] {
    return [...this.engines.values()]
  }

  static instance(): ImageEngineManager {
    const core = typeof window === 'undefined' ? undefined : window.core
    if (core?.imageEngineManager)
      return core.imageEngineManager as ImageEngineManager
    if (!this.fallback) this.fallback = new ImageEngineManager()
    if (core) core.imageEngineManager = this.fallback
    return this.fallback
  }
}
