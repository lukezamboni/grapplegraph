# GrappleGraph data review

This file records the source-of-truth assumptions and academy clarifications used by the catalogue.

## Catalogue rules

- Blue belt contains 30 requirements numbered `BLU-01` through `BLU-30`.
- Purple belt contains the 27 non-brown-only requirements from the upper-belt sheet, numbered `PUR-01` through `PUR-27` for the site. `source_exam_id` preserves the original sheet number.
- Brown-belt-only contains source items 10, 12, and 18, numbered `BRO-01` through `BRO-03` for the site.
- Every requirement records its start, landing, finish, family, source number, video-match quality, and professor-verification state.
- Study videos are external references, not the academy's authoritative version.

Run `npm run audit:content` after changing the catalogue. The audit checks belt counts, numbering, source-number partitioning, required fields and sections, family consistency, concept references, direct video URLs, and unresolved Wikilinks.

## Confirmed academy details

- `PUR-04`: Foot Americana means an arm-controlled figure-four lock applied to the opponent's foot, using Americana-style body mechanics. It is not applied with the attacker's feet.
- `PUR-10`: The student may choose the takedown and opponent-lapel choke that follow the standing arm drag.
- `PUR-12`: The sheet's “arm lock” is an armbar.
- `PUR-14`: The crossed-leg position is X-guard.
- `PUR-20`: Kick the leg behind the opponent forward to generate momentum.
- `PUR-26`: The finish is the Little Bucket choke.
- `PUR-27`: Establish knee on belly, control the opposite arm, and transition to the violin lock on the other arm.
- `BRO-03`: The student may choose the leg lock; a straight ankle lock is usual.

## Details still worth confirming

- Required finishing positions for the rear hair-grab and front bear-hug defences.
- The exact back-pummel route in `PUR-08`.
