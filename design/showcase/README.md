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

The Dusk refresh uses local Manrope Medium, neutral slate, actual app cards
directly on the canvas, periwinkle captions and an apricot ownership line. The
owner-selected Fold M identity uses a periwinkle symbol and bone wordmark. The
overview contains real product captures with
fictional demo records; it contains no owner data. Factual labels sit below the
image without another product frame. Empty margins and the gap between cards
remain transparent in the captured PNG.

To refresh both editions after building the application, run from `frontend`:

```sh
npx playwright test tests/localization.spec.ts --project=chromium --grep "localized README screenshots"
```

Copy `.cache/screenshots/garage-cards-en.png` and `garage-cards-ru.png` to
`assets/garage-en.png` and `assets/garage-ru.png`, then copy the Russian image to
`ru/assets/garage-ru.png`. These paths are relative to the repository root for
the captures and to this directory for the destination assets. Run the checks
and snapshots above, inspect the 4-second frames, then copy them to
`docs/assets/en/mashina-overview.png` and `docs/assets/ru/mashina-overview.png`.
The legacy `docs/assets/mashina-overview.png` uses the Russian edition.
