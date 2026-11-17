# Wind Island implementation plan

Goal: Ship the approved 风屿 single-player browser 3D exploration game for desktop and mobile, with public GitHub source and a verified free Pages URL.

Approved spec: third person finite ~400m low-poly island with beach, woods and hills; 12 crystals, four per ruin; activate three ruins to complete, continue exploring or reset. Walking/running/jumping, safe collision and respawn, desktop and touch controls, Chinese menus, pause/settings, minimap, local save with safe recovery. TypeScript + Vite + Three.js, no backend or external runtime assets. No multiplayer/combat/building.

Task 1: Progress/save/terrain rules. Write tests for duplicate collection, ruin gating, completion, safe storage, reset, safe island positions and solid collisions. Run failing tests, implement and run green suite.
Task 2: Procedural scene, explorer physics and camera. Mesh terrain and analytic height agree, environmental geometry is instanced, landmarks and collectibles remain reachable. Check browser rendering, movement, recovery.
Task 3: Responsive interface and input. Landing overlay, goals, minimap, pause/reset, audio/quality and multitouch controls; real browser start/move/jump/pause/save/reload/touch tests. Cap rendering resolution on mobile.
Task 4: Fresh branch review, fix important findings, run unit/type/build/browser checks. Create public juily2/wind-island, configure official Pages Actions workflow, push main and verify deployment and real live rendering. Return actual URL and source URL.

Default choices: deterministic hand-placed objectives, procedural original geometry and audio, no network API. Browser-local versioned state stores safe position, collected IDs, active ruin IDs and settings. Desktop WASD/arrows, drag camera, Space, Shift, E. Mobile virtual joystick and look region plus jump/sprint/activate controls. Aim at desktop 60fps/mobile 30fps; do not claim hardware benchmark from emulation. Expected URL only until deployment: https://juily2.github.io/wind-island/.
