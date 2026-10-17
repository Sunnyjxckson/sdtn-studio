# SDTN Studio PRD

Source of truth: https://claude.ai/code/artifact/5e02d44d-6e9e-465b-99a9-bb81876995ce (this file is a copy, update the doc first)
Mockups: https://claude.ai/code/artifact/b28ef709-73a3-4e4b-8033-539ea5209b70

## Overview

SDTN Studio is a free, fashion-first design tool: the canvas starts as a croquis, you sketch or build garments on the body, and the app hands back clean vector flats and a tech pack you can send to a factory.

The problem today: Illustrator and Procreate start from a blank page, mockup blanks cost money and are painful to edit, and turning a sketch into a factory-ready flat is a separate, manual job. Designers bounce between three tools and redraw the same garment twice.

SDTN Studio keeps one garment as one object. The sketch view, the flat and the spec are three views of the same thing, so a change in one shows up in the others.

## Users and goals

The first user is Sunny, designing Sedition. After that: independent streetwear and dress designers who sketch on a laptop, phone or borrowed iPad and need flats to get samples made.

Goals for V1:

- Sketch a full look on a body in one sitting, without Illustrator
- Edit any garment freely: drag points, crop, cut, add holes, distress, text
- Get front and back flats plus a one-size spec automatically
- Export SVG flats and a PDF tech pack a factory can work from
- Free to use and free to run

Not in V1:

- AI that turns a phone photo into garments (V2)
- Size grading, supplier list, collections (V2)
- 3D avatar and cloth simulation (north star)
- Accounts, sharing, real-time collaboration

## Core flow

See the core flow diagram in the doc. Every edit to a garment updates its flat and spec right away, so export is always one click from the sketch.

## V1 requirements

Every V1 feature ships when its "done when" check passes on a laptop and on an iPad with a pencil.

| Area | Requirement | Done when |
| --- | --- | --- |
| Croquis base | Male and female 9-head croquis, front and back, shown as a locked bottom layer | You can switch base and view without losing garments on the canvas |
| Garment library | Blocks for tops, outerwear, bottoms, dresses, shoes; each block has fit presets (skinny to wide, cropped to long) | Dragging a block onto the body snaps it to the right body landmarks |
| Sketch tools | Move, Edit points, Lasso, Pencil, Pen, Brush, Eraser, Shape, Seam line, Topstitch, Fill, Eyedropper, Smudge, Text, Mirror, Hand, Zoom; size, opacity, smoothing | Pencil strokes snap to clean vector paths you can edit after |
| Garment editing | Drag any point, add or delete points, cut or crop, holes in 3 sizes, distress brush, text on garment, waistband and pocket swaps, wash colors | Every edit can be undone, and the edit also shows in the flat |
| Treatments | Distress, wash, dye, bleach, stain, raw hem as layers on a garment | A treatment can be turned off or removed without redrawing the garment |
| Layers | One layer per garment and per drawing, reorder, hide, lock | Layer order on the body matches the flat callouts |
| Flats | Auto front and back flat for each garment, numbered callouts matching the sketch | Changing the sketch updates the flat within a second |
| Spec | One sample size, measured from the drawing (waist, rise, inseam, knee, opening, body length, chest, sleeve) | Cropping changes inseam; widening a hem changes leg opening |
| Export | SVG flats, PDF tech pack (flats, spec, materials, notes), materials list | A factory can open the PDF and SVG with no special software |
| Save | Projects saved on the device, auto-save every change | Closing and reopening the browser restores the exact canvas |
| Undo | Undo and redo for every action, at least 100 steps | Undo after a crop brings the full garment back |

## Data model

A garment is one editable vector object. The sketch, the flat and the spec all read from it, so they never drift apart.

| Object | Holds | Notes |
| --- | --- | --- |
| Project | Name, season, list of looks | Saved on the device |
| Look | Croquis (male or female, view), ordered layers | One look = one outfit on one body |
| Garment | Type (pant, tee, jacket), block id, fit preset, outline points, landmarks, parts, treatments, text, cut line, wash | Front and back outlines kept as separate point lists |
| Point | x, y, optional landmark key (waist, crotch, knee, hem) | Landmark points drive the spec; added points have no key |
| Part | Kind (pocket, waistband, collar, cuff, hem), option, position | Swapping an option never touches the outline |
| Treatment | Kind (hole, distress, dye, bleach, stain, raw hem), position, size | Drawn inside the garment outline only |
| Text | Words, size, font, position | Placed on a garment, moves with it |
| Drawing | Free vector paths not tied to a garment | Pencil and pen strokes, notes, arrows |
| Spec | Sample size, measurement points, units (inches) | Computed from landmarks, can be overridden by hand |

Scale: each croquis has a fixed pixels-to-inches ratio per axis, so measurements from the drawing come out in real inches.

## Tech stack

V1 is a web app with no backend: it runs in the browser on a laptop, phone or iPad, saves to the device, and costs nothing to host.

| Layer | Choice | Why |
| --- | --- | --- |
| App | React + TypeScript, built with Vite | Fast to build, types catch geometry bugs |
| Canvas | SVG rendered from the garment data | Vector by default, so flats and exports come straight from the same paths |
| Vector math | Paper.js (cut, crop, holes as boolean path ops; stroke simplify) | Handles the hard geometry instead of writing it from scratch |
| Drawing feel | perfect-freehand for pencil and brush, pointer events for pressure | Works with Apple Pencil and a mouse |
| State and undo | Zustand + Immer patches | Every change is undoable, 100+ steps |
| Save | IndexedDB on the device, auto-save | No accounts, no server cost in V1 |
| Export | Native SVG; PDF with jsPDF + svg2pdf.js | Factory gets real vector files |
| Hosting | Vercel | Free tier is enough; deploys from main |

## Build milestones

Build in this order; each milestone is usable on its own before the next starts.

1. **Shell and canvas.** App frame, croquis base (male, female, front, back), pan and zoom, layers panel, save to device, undo.
2. **Garment engine.** Garment object with points and landmarks, the jeans block with fit presets, drag points, add and delete points, live spec.
3. **Cut and treatments.** Crop and cut lines, holes, distress brush, text on garment, part swaps, wash colors.
4. **More blocks.** Tee, moto jacket, hoodie, shorts, skirt, dress, so a full look can be built.
5. **Sketch tools.** Pencil, pen, brush, eraser, shape, seam line, topstitch, fill, eyedropper, mirror, with strokes snapped to vector.
6. **Flats and export.** Auto front and back flats with callouts, spec sheet, SVG and PDF tech pack, materials list.
7. **Polish and ship.** iPad and pencil testing, keyboard shortcuts, deploy to Vercel.

## V2 and north star

V2 takes a look from one sample to a real order; the north star shows it on a real body before any sample is paid for.

V2:

- Upload a phone photo of a paper sketch, turned into editable garment blocks
- Size grading S to XL from grade rules
- Materials list with quantities per production run, supplier notes and links
- Collections that group looks into a drop
- Side view croquis and more poses
- Share link for a factory or patternmaker

North star (3D):

- 3D avatar built from real measurements
- Flats wrapped onto the avatar for a rough fit check first
- Fabric presets for weight, stretch and drape
- Real cloth simulation on open source physics, so a size 31 waist shows how the pant actually sits

## Open questions

- [ ] Final product name (SDTN Studio is a placeholder)
- [ ] Croquis art: Sunny draws them, or commission an illustrator with rights in writing
- [ ] Which garment blocks come first after jeans, tee and moto jacket
- [ ] Is it only for Sedition at first, or open to other designers from day one
- [ ] Tech pack format: match a specific factory's template, or a general one
