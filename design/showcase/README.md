# GitHub infographic source

Generated with [Hyperframes](https://github.com/heygen-com/hyperframes), pinned in package.json. The published image is a static snapshot of this deterministic HTML composition at 4 seconds. All displayed app data comes from the isolated demo, never a personal garage.

Requirements: Node 22.12+, Chromium and FFmpeg for optional video work. Run from this directory:

```sh
npx hyperframes@0.8.149 telemetry disable
npx hyperframes@0.8.149 check --snapshots
npx hyperframes@0.8.149 snapshot --at 4
```

Local GSAP is the animation runtime; its upstream license header is retained in `assets/gsap.min.js` ([GSAP standard license](https://gsap.com/standard-license/)). Manrope is SIL OFL, with license in `assets/OFL.txt`. The demo screenshot and MASHINA artwork are local repository assets. No production app dependency is added.

The primary deliverable is a GitHub PNG. No MP4 has been requested or approved. For future motion export, review the complete local Studio preview before rendering.

English source is `index.html`; Russian source is `ru/index.html`, with self-contained local assets. Run the same check/snapshot commands with `ru` as the project argument. Published snapshots live in `docs/assets/en/` and `docs/assets/ru/`. Recreate app screens with `frontend/tests/localization.spec.ts`; analytics deliberately selects Volvo XC60.
