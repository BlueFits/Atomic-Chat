import { invoke } from '@tauri-apps/api/core'

type LlamaSessionInfo = {
  provider?: string
  model_id: string
  mmproj_path?: string | null
}

/**
 * Artifact vision (YAML / catalog `capabilities`) means the GGUF *can* be
 * multimodal. Session vision means the live llama-server was started with
 * `--mmproj`. After an unsupported-projector text-only fallback those diverge.
 *
 * For llamacpp / llamacpp-upstream: when a session is running, trust
 * `mmproj_path`. When nothing is loaded yet, fall back to catalog vision so
 * attach UI can still stage images before start.
 */
export async function resolveSupportsVision(opts: {
  providerName?: string | null
  modelId?: string | null
  capabilities?: string[] | null
}): Promise<boolean> {
  const catalogVision = opts.capabilities?.includes('vision') ?? false
  const provider = opts.providerName
  const modelId = opts.modelId

  if (
    (provider !== 'llamacpp' && provider !== 'llamacpp-upstream') ||
    !modelId
  ) {
    return catalogVision
  }

  try {
    const response = await invoke<{ sessions: LlamaSessionInfo[] }>('atomic_core_call', {
      method: 'GET', path: '/sessions', body: null,
    })
    const session = response.sessions.find((entry) =>
      (entry.provider ?? 'llamacpp-upstream') === provider &&
      entry.model_id.replaceAll('.', '_') === modelId.replaceAll('.', '_')
    )
    if (session) {
      return Boolean(session.mmproj_path)
    }
  } catch {
    // Session lookup can fail outside Tauri / before plugins are ready.
  }

  return catalogVision
}
