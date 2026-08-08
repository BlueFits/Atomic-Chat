---
date: 2026-08-07
title: "Default local image generation to 512² with VAE tiling"
---

# 2026-08-07 — Default local image generation to 512² with VAE tiling

- **Context:** The first local `sd-cli` path defaulted to 1024×1024. With SD 1.5 weights and a chat model already on the GPU, sampling could finish and then die in VAE decode with Vulkan `ErrorOutOfDeviceMemory` (~8.5 GB single allocation). SD 1.5 is also trained for 512².
- **Decision:** Default width/height to 512 when the request omits them, always pass `--vae-tiling` to `sd-cli`, and run the process with cwd set to the backends directory. Explicit larger sizes remain allowed (256–2048, multiples of 64).
- **Consequences:** First-run Create Image is much less likely to OOM beside a loaded LLM and finishes faster on SD 1.5. True SDXL 1024² still requires an explicit request (no UI for that yet). Supersedes the implicit 1024 default from [2026-08-05](2026-08-05-add-local-image-generation-engine-boundary.md) without changing the ImageEngine boundary.
- **Owner:** team
- **Links:** `src-tauri/src/core/image_generation/commands.rs`
