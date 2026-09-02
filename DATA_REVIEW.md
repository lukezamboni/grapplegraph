# GrappleGraph data review

This file records the source-of-truth assumptions used by the catalogue and the details that still need academy confirmation.

## Catalogue rules

- Blue belt contains 30 requirements numbered `BLU-01` through `BLU-30`.
- Purple belt contains the 27 non-brown-only requirements from the upper-belt sheet, numbered `PUR-01` through `PUR-27` for the site. `source_exam_id` preserves the original sheet number.
- Brown-belt-only contains source items 10, 12, and 18, numbered `BRO-01` through `BRO-03` for the site.
- Every requirement records its start, landing, finish, family, source number, video-match quality, and professor-verification state.
- Study videos are external references, not the academy's authoritative version.

Run `npm run audit:content` after changing the catalogue. The audit checks belt counts, numbering, source-number partitioning, required fields and sections, family consistency, concept references, direct video URLs, and unresolved Wikilinks.

## Professor confirmations still needed

1. `PUR-04`: What exact mechanics and academy name are intended by “Foot Americana”?
2. `PUR-10` (source item 11): Which takedown follows the standing arm drag, and what is the exact opponent-lapel choke setup?
3. `PUR-12` (source item 14): Does “arm lock” specifically mean the armbar shown in the current reference?
4. `PUR-14` (source item 16): What is the name or setup of the sweep made by crossing the legs behind the standing opponent's knee?
5. `PUR-20` (source item 23): Which leg is kicked, and in which direction, for the academy's deep-half kick sweep?
6. `PUR-26` (source item 29): Which choke is required after the Little Bucket pass?
7. `PUR-27` (source item 30): What is the exact opposite-arm reverse violin-lock configuration?
8. `BRO-03` (source item 18): Which leg lock is required after the standing guard pass?

Additional useful details are the required finishing positions for the rear hair-grab and front bear-hug defences, and the exact back-pummel route in `PUR-08`.
