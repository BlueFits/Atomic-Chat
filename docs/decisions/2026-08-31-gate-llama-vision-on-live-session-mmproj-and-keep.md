---
date: 2026-08-31
title: "Gate llama vision on live session mmproj and keep generated images out of chat inference"
---

# 2026-08-31 — Gate llama vision on live session mmproj and keep generated images out of chat inference

- **Context:** Create Image (`ImageEngine` / stable-diffusion.cpp) and llama
  vision (mmproj) are separate. After image generation, assistant PNGs could
  re-enter `/v1/chat/completions` as `image_url`. Separately, unsupported-
  projector text-only fallback loads without `--mmproj` while catalog
  `capabilities` still advertised `vision`, so attach/send hit llama-server’s
  opaque “provide the mmproj” 500.
- **Decision:** Keep the ImageEngine boundary. Treat **artifact vision**
  (YAML/mmproj on disk) as catalog-only; treat **session vision** (live
  `SessionInfo.mmproj_path`) as the gate for attach, transport image
  projection, and tool-image hoist. Strip all assistant image file parts from
  model-bound history unless `includeInInference === true`. Both llama
  `chat()` paths reject `image_url` when the session has no mmproj
  (`VISION_NOT_ACTIVE`). TurboQuant emits the same
  `local_backend://multimodal_disabled_fallback` toast channel as upstream.
- **Consequences:** Generated images stay visible in the thread but are not
  vision inputs by default. Text-only fallback no longer looks like a working
  vision session once loaded. Public API / direct llama-server clients that
  bypass extension `chat()` still need their own guards; the web transport
  path is covered. Opt-in UI for `includeInInference` remains deferred.
- **Owner:** team
- **Links:** `web-app/src/lib/session-vision.ts`,
  `web-app/src/lib/custom-chat-transport.ts` (`projectImagesForInference`),
  `extensions/llamacpp-extension/src/index.ts`,
  `extensions/llamacpp-upstream-extension/src/index.ts`,
  ADRs 2026-08-05 (ImageEngine), 2026-06-04 / 2026-06-09 (mmproj fallback).
