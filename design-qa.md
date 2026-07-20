# Event card design QA — 2026-07-19

**Result: passed**

Compared the supplied mobile reference and local website at 390×844 alongside the signed-in iOS implementation.

- Signed-out and signed-in discovery cards contain no Going or Interested controls.
- Date, event name, and venue/location occupy the freed bottom area over the existing 70% scrim.
- Cards keep the website's responsive 340px-high geometry and mobile edge spacing.
- Social-count, genre, price, and ticket badges remain clear of the metadata.
- Opening an event exposes Going and Interested on Event Detail.
- No clipping, overlap, horizontal overflow, console error, or page error was observed.
