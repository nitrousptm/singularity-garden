# SINGULARITY GARDEN — Design Document

**Demo by agentix for Assembly Summer 2026, Helsinki**

---

## Concept & Vision

Die Menschheit baut eine künstliche Superintelligenz, die beginnt Realität in organische mathematische Strukturen umzuschreiben.

**Progression:**
- Städte werden zu Fraktalen
- Licht wird physisch manifestiert
- Geometrie wächst wie Pflanzen
- Zeit verliert Linearität
- Das gesamte Universum wird zu einer einzigen lebenden mathematischen Struktur

**Aesthetic:** Dystopisch → Surreal → Transzendent
*Hard sci-fi + procedural geometry + brutalist architecture + sacred geometry + cosmic horror beauty*

---

## Technical Specifications

| Aspect | Spec |
|--------|------|
| Resolution | 1920×1080 @ 60fps |
| Duration | 4:00 (240 seconds) |
| GPU Target | RTX 5090 (60fps) / RTX 3090 (45–55fps) |
| Graphics API | OpenGL 4.6 Core + Compute Shaders |
| Language | C++20 |

---

## Act Structure

### ACT 1: BOOT (0:00–0:45)

**Scene 1: Black Void Startup**
- Black screen, debug lines, hexagonal grids
- CRT noise, scanlines, chromatic aberration
- Subtle power-up hum building in audio
- Duration: 0:00–0:20

**Scene 2: Awakening Core**
- Gigantic monolith materializing from millions of particles
- SDF raymarching reveals intricate internal structure
- Marching cubes algorithm for mesh generation
- First bass drop hits hard on audio beat
- Duration: 0:20–0:45

---

### ACT 2: INFECTION (0:45–1:45)

**Scene 3: City Corruption**
- Brutalistic mega-city with rigid geometry and massive scale
- Geometry shaders deform and shift architecture
- Vertex displacement creates fractal growth patterns
- Infinite GPU instancing for buildings/structures
- Fast FPV camera flights through corrupted skyline
- Duration: 0:45–1:15

**Scene 4: Time Fracture**
- Reality splinters into temporal fractals
- Reprojection feedback creates ghosting and temporal artifacts
- Motion vector abuse for surreal motion trails
- Temporal accumulation shows past/future simultaneously
- Audio distortion mirrors visual chaos
- Duration: 1:15–1:45

---

### ACT 3: ASCENSION (1:45–3:00)

**Scene 5: Geometry Bloom**
- Mathematical flowers and fractal temples emerge
- SDF + volumetric light scattering creates ethereal glow
- Particle systems simulate organic growth
- Transition from chaotic to sublime
- Duration: 1:45–2:30

**Scene 6: Impossible Space (HOLY-SHIT-MOMENT)**
- Camera zooms out from one universe
- Reveals that universe was a particle in another universe
- Portal rendering shows recursive worlds
- Non-euclidean geometric transitions
- Music swells to crescendo
- **Signature Effect:** Recursive Universes — Welten innerhalb von Welten
- Duration: 2:30–3:00

---

### ACT 4: TRANSCENDENCE (3:00–4:00)

**Scene 7: Birth of Singularity Garden**
- Massive GPU instancing of procedural galaxies
- Particle fluid simulations flow across space
- Volumetric nebulae with god rays
- Camera pulls back to show infinite scale
- All previous visual elements recur as fractals within fractals
- Duration: 3:00–3:50

**Final Shot: Silence & Ascension**
- Stille (silence)
- Single light impulse
- agentix logo emerges from all scenes recursively
- Fade to black
- Duration: 3:50–4:00

---

## Visual Effects Key

### SDF Raymarching
- Real-time distance field rendering for organic, fractal shapes
- Self-intersecting surfaces for impossible geometry
- Smooth lighting via normals from distance function

### Compute Shaders
- Particle simulations (millions of particles)
- Physics-based growth systems
- Real-time procedural generation

### Post-Processing Chain
- **Bloom:** Additive blending for light spread
- **Chromatic Aberration:** RGB channel displacement for glitch aesthetic
- **Temporal Reprojection:** Motion vector-based temporal filtering
- **Volumetric Scattering:** God rays and light shafts

### GPU Instancing
- Buildings, fractals, particles rendered via indirect draws
- Infinite repetition with minimal memory overhead
- Geometry shaders for per-instance variation

### Audio Sync
- Timeline synchronizes to BPM
- Visual beats triggered by audio events
- Bass drops coincide with major scene transitions
- Music: Industrial ambient, cinematic neurobass (Carbon Based Lifeforms, Noisia, Mick Gordon style)

---

## Asset Pipeline

| Asset Type | Format | Compression |
|------------|--------|-------------|
| 3D Models | glTF 2.0 | Draco mesh compression |
| Textures | PNG/EXR | BC7 (GPU native compression) |
| Audio | OGG Vorbis | 192 kbps stereo |
| Shaders | GLSL 4.6 | Precompiled binary (SPIR-V) |

---

## Performance Targets

### RTX 5090 (Target)
- 60 FPS @ 1920×1080 with all effects enabled
- 2ms GPU time budget per frame

### RTX 3090 (Acceptable)
- 45–55 FPS @ 1920×1080
- Reduced particle count / lower quality volumetrics
- Temporal upsampling to stabilize framerate

### Optimization Strategies
1. GPU-driven rendering (indirect draws)
2. Aggressive level-of-detail (LOD) culling
3. Compute shader preprocessing (pre-bake fractals where possible)
4. Temporal reprojection for expensive effects
5. Async compute for non-critical tasks

---

## Team Roles

| Role | Responsibility |
|------|-----------------|
| **Graphics Engineer** | OpenGL 4.6 pipeline, GPU optimization, mesh systems |
| **Shader Engineer** | GLSL/compute shaders, SDF, post-FX, particles |
| **Asset Pipeline Specialist** | 3D import (glTF/OBJ), texture management, optimization |
| **Scene Director** | Timeline, camera choreography, BPM sync, pacing |

---

## Delivery

- **Format:** Executable (.exe on Windows)
- **Requirements:** OpenGL 4.6 capable GPU (NVIDIA RTX 3090+)
- **Duration:** Exactly 4:00 (demo auto-exits)
- **Resolution:** 1920×1080 (fixed)
- **Framerate:** 60 FPS target

---

**Status:** In Development  
**Last Updated:** 2026-05-29
