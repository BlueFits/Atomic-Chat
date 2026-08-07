---
date: 2026-08-05
title: "Add a separate local image-generation engine boundary"
---

# 2026-08-05 — Add a separate local image-generation engine boundary

- **Context:** Atomic Chat has conversational engines and image message parts, but no contract for producing image artifacts. Adding generation methods to every language engine would couple unrelated providers.
- **Decision:** Model generation as a separate `ImageEngine` extension type. Use a pinned `stable-diffusion.cpp` native runtime for the first SDXL provider; Rust owns its process, cancellation, and managed outputs while Chat invokes it explicitly.
- **Consequences:** Image providers remain independent from chat inference and generated PNGs reuse message persistence. Runtime flags remain provider-specific. Editing, remote providers, automatic intent routing, and the public image API are deferred.
- **Owner:** team
- **Links:** `core/src/browser/extensions/image/`, `web-app/src/lib/extension.ts`
