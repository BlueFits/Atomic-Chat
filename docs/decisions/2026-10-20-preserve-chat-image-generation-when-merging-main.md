---
date: 2026-10-20
title: "Preserve chat image generation when merging main"
---

# 2026-10-20 — Preserve chat image generation when merging main

- **Context:** Official main at cdaa177f3 introduces an image workspace hook with the same name as this branch's chat image hook, and moves llama sessions into the core.
- **Decision:** Keep main's useImageGeneration for its image workspace and name the existing chat hook useChatImageGeneration. Read live vision sessions through atomic_core_call GET /sessions, preserving provider and model matching and the branch's image history filtering.
- **Consequences:** Both image entry points remain available. Legacy llama plugin session and process commands are not restored. The core owns model loading and fallback behavior; the branch's old TurboQuant fallback emitter is superseded by that ownership.
- **Owner:** team.
- **Links:** web-app/src/hooks/useChatImageGeneration.ts, web-app/src/hooks/useImageGeneration.ts, web-app/src/lib/session-vision.ts.
