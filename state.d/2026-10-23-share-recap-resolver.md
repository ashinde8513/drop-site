### share-recap.html reads `?r=<recap id>` (2026-10-23, Web app specs build lane)
- **Changed:** `share-recap.html?r=<recap_posts.id>` asks the `shared_recap_card` RPC (Drop-App #1373) what to show. It follows the Spec05-Recap-Public-Page board.
  - Shows the real show, "Venue, Mon D, YYYY" in the show's zone, and "Photos aren't shared."
  - With a name the sharer allowed: "{Name}'s night at {Show}" and "Join {Name} on Drop". Otherwise: "A night at {Show}" and "Join Drop".
  - No result: one "This recap isn't available." state with "Browse shows". A server error leaves the generic card.
  - The #213 rules stay: no text from the link, and UUID-only referral. `?event=` works as before. `data.js` gains `Drop.fetchSharedRecap`.
- **Tested:** `tests/share-pages.spec.ts` (+4 cases: name, no name, not found, error) and smoke.
- **Open:** merge only after the A68 production apply of `shared_recap_card`. Before then the RPC 404s and every `?r=` link shows the generic card.
