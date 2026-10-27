# Dusk visual assets

English · [Russian](visual-assets.ru.md)

The 2026-10-26 visual refresh uses local assets. No image or font service is needed
to open the application or public site. Private owner photographs are unchanged.

## Landscape

`frontend/public/dusk-landscape.webp` and `site/assets/dusk-landscape.webp` are a
resized WebP copy (2400 by 1568) of
[Vallee-brouillard.jpg](https://commons.wikimedia.org/wiki/File:Vallee-brouillard.jpg)
by Thomas Bresson, licensed under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
The image shows a fog-filled valley at sunset. Changes: resize and WebP encoding;
the interface applies its own crop and scrim. It is a real photograph.
Credits appear beside the welcome image and in the public site footer. No
endorsement of MASHINA by the photographer is implied.

## Fictional demo vehicles

`frontend/public/volvo-demo.webp` and `frontend/public/porsche-demo.webp` are
AI-assisted studio illustrations for the isolated fictional demo garage, created
using the built-in ImageGen tool from the repository's previous demo images.
They are not photographs of an owner's actual vehicles. Model names and badges
identify the fictional examples; no manufacturer endorsement is implied.

Final prompt set:

- Volvo: preserve the silver XC60, its complete body and front-left three-quarter
  view. Replace the industrial setting with a calm slate-stone studio, charcoal
  floor, soft apricot side light and restrained periwinkle reflections. Wide 16:9
  composition, full bumper/wheel clearance, no sky, people, typography or UI.
- Porsche: preserve the grey-silver 911 and front-left three-quarter view. Match
  the Volvo's slate-stone studio and apricot/periwinkle lighting, without copying
  its vehicle. Wide 16:9, complete car, no sky, people, typography or UI.

## Product captures and identity

`docs/assets/en/` and `docs/assets/ru/` show the real application with synthetic,
isolated demo data. Garage and analytics are captured through the existing
localization browser tests. `design/showcase/` contains the deterministic overview
composition; its four-second snapshot is the README overview PNG.
Root `docs/assets/` images remain synchronized with the Russian counterparts.

The owner selected the new Fold M identity on 2026-10-26 after reviewing three
vector concepts. The primary mark is periwinkle on slate, with monochrome and
daytime variants. See the [identity guide](../design/identity/usage.md).
Earlier Apex concepts and explicitly named green exports remain historical assets.
Manrope is locally bundled
under the SIL Open Font License; the public-site copy includes `assets/OFL.txt`.

Product-card captures have transparent empty margins and gutters. The glass and
photo content is rendered by the actual application; images are decoded before
capture. The public overview adds no enclosing frame or opaque blue backdrop.
