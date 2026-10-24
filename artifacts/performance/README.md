# Performance evidence

The run used the optimized Vite build and Playwright Chromium headless on Windows, Chrome for Testing 156.0.8078.4, at 1365 × 900 CSS pixels and device scale factor 1. The game ran in real time for 180 seconds with seed 20261023 and a 2 second base spawn interval. Chromium was launched with GPU enabled and ANGLE D3D11 requested. CDP confirmed that the active renderer was `ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 ... Direct3D11)` and GPU compositing/WebGL were enabled. See [profile.json](profile.json) for raw GPU, frame, entity, heap, and lifecycle measurements. The HTML Playwright report is at [report/index.html](report/index.html).

## Results

- 10,714 animation frame intervals; measured mean 59.39 FPS and p95 interval 16.70 ms. This is 1.0% under the strict 60 FPS average target, and near the target in this run.
- Peak entity count was 33 (31 enemies); 34 total spawns occurred during combat.
- The hot loop previously allocated three temporary arrays per frame while counting active projectiles and explosions. It now counts in place. Entity collision and Shooter range checks also avoid square roots. These changes keep inputs, collision outcomes, and Pixi rendering intact.
- The ticker does not call React state setters each frame. The UI callback updates React state once per timer tick and for score, health, pause, and game-over events. The boss health indicator consists of two `Sprite`s: their positions follow the boss each frame; texture and fill width change on damage. No per-frame `Graphics` or `Text` objects are rebuilt.
- Sailing audio now requests playback only at a movement transition and writes volume only when it changes. The low-health audio state also skips unchanged frames.
- Heap after forced collection increased from 6.49 MB at start to 8.44 MB after combat. After five start, play, and exit cycles, post-collection heap values were 6.56, 6.66, 6.86, 6.93, and 7.02 MB (about 0.46 MB net increase). DOM counters rose from 155 nodes / 205 listeners after the first two cycles to 161 / 215 after the third, then stayed flat for the remaining cycles. This rules out continued DOM/listener growth in these samples but leaves the V8 heap increase unresolved; a retained-object heap snapshot is the next diagnostic. V8 heap does not include all GPU resources and this measurement alone does not establish a leak.
- The production bundle emitted a 602.38 kB main JavaScript chunk (179.56 kB gzip).

An earlier run without explicit GPU flags measured 25.27 FPS and 50.10 ms p95, but it did not capture the active GPU backend. That result cannot be attributed conclusively to software rendering. The GPU-confirmed run plus the loop changes reached 59.39 FPS; because both the launch mode and code changed, the performance gain cannot be assigned to either factor alone.

## Reference environment and limits

Chromium reported 12 logical cores; `navigator.deviceMemory` was unavailable. The GPU was an NVIDIA GeForce RTX 4060 using driver 32.0.16.1656. Host CPU and RAM identification through Windows WMI was denied in this environment, so the CPU model and physical memory are not known. This was a headless browser run inside the current managed environment, not a physical device benchmark. Headless scheduling and available CPU can materially affect frame intervals. Treat the figures as reproducible environment evidence, not a certification of desktop or mobile hardware performance.
