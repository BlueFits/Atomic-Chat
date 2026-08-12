---
date: 2026-08-11
title: "Drive image generation through a provider-neutral composer"
---

# 2026-08-11 — Drive image generation through a provider-neutral composer

- **Context:** Create Image immediately consumed the existing chat prompt and the chat UI called the built-in stable-diffusion.cpp adapter directly. The `ImageEngine` contract already allowed progress callbacks and multiple providers, but neither capability was used.
- **Decision:** Make Create Image an explicit composer mode submitted with Enter, resolve generation through the `ImageEngineManager`, and surface structured provider progress in the pending assistant message. The local adapter translates native sampling output into step progress; raw backend logs remain internal.
- **Consequences:** Image prompts behave like an intentional chat action, users see live progress when a provider supplies it, and future local or OpenAI-compatible image providers can implement the same engine contract without adding provider branches to `ChatInput`. Provider/model selection UI and the public `/v1/images/generations` API remain separate follow-ups.
- **Owner:** team
- **Links:** `core/src/browser/extensions/image/`, `web-app/src/lib/image-generation.ts`, `web-app/src/containers/ChatInput.tsx`, `src-tauri/src/core/image_generation/commands.rs`
