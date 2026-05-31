---
name: SINGULARITY GARDEN — Projektstatus
description: PC Demo für Assembly Summer 2026 — aktueller Stand, Architektur, nächste Schritte
type: project
---

PC Demo für Assembly Summer 2026 Helsinki. Kategorie: PC Demo (unlimited), 4:00min.

**Music:** Concrete-Syncope.wav @ 133 BPM (assets/music/)
**Engine:** OpenGL 4.6 Core, C++20, GLFW + glad2 + GLM + miniaudio

**Architektur (Stand 29.5.2026):**
- `/src/core/` — Shader, Framebuffer, Mesh, Camera
- `/src/audio/` — miniaudio-basiertes Audio + BPM-Sync
- `/src/scene/` — Timeline (8 Szenen), Scene-Basisklasse
- `/src/scenes/` — Scene01Boot…SceneFinal (je .h + .cpp)
- `/src/postfx/` — Bloom (6-MIP Dual-Kawase), Composite, ACES Tonemap
- `/shaders/common/` — noise.glsl, sdf.glsl, pbr.glsl, fullscreen.vert
- `/shaders/scenes/` — 1 Shader pro Szene (GLSL 4.60)
- `/shaders/postfx/` — bloom_prefilter, bloom_blur, composite, temporal_aa
- `/shaders/particles/` — particles_update.comp (2 Mio Partikel, GPU Compute)

**8 Szenen mit BPM-Timing:**
1. BOOT 0:00-0:20 — CRT-Startup, Hex-Grid
2. AWAKENING 0:20-0:45 — SDF Monolith + Raymarching, PBR
3. CITY 0:45-1:15 — GPU Instancing Brutalist-City + Geometry-Corruption
4. FRACTURE 1:15-1:45 — Temporal Feedback, Julia Sets, Kaleidoskop
5. BLOOM 1:45-2:30 — SDF Flowers + Fractal Temples, Volumetric Scattering
6. IMPOSSIBLE 2:30-3:00 — Mandelbulb Raymarching, Holy-Shit-Moment
7. SINGULARITY 3:00-3:50 — 2 Mio Partikel (Galaxy → Collapse), Volumetric Nebulae
8. FINAL 3:50-4:00 — Logo-Reveal, Light-Impulse, Fade-to-Black

**Nächste Schritte:**
- Windows RTX-Compilation (MSVC)
- Performance-Tuning (Partikelzahl, Raymarch-Steps)
- Audio-Format: WAV → OGG für Submission
- Screenshot/Video captures für Submission

**Build:**
- Linux: ./build.sh
- Windows: .\build_windows.ps1
