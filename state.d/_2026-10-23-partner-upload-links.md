# Partner/fan upload short links — 2026-10-23

Internal source receipt; underscore prefix preserves default Jekyll exclusion.

- `/submit` (promoters: flyers + promo videos, rights checkbox) and `/send` (fans: show clips + photos) are `_redirects` 302s to
  the two Google Forms owned by trydropapp@gmail.com. Both forms need a signed-in Google account to upload files.
- `link.html` lists both under About (`#sendClips`, `#submitEvent`); the smoke test now expects 7 children.
- Forms land in the business Drive (`Promoters/_Submissions/`, `Intake/Street Team Uploads/`) and are read by the concert-intake
  watcher (ashinde8513/concert-intake). If a form is recreated, update the two form IDs in `_redirects`.
- A no-login upload page (Supabase Storage signed URLs + Turnstile) is a separate, unapproved production change.
