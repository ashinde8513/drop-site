# Email confirmation callback

Drop keeps Supabase Auth on PKCE. A confirmation code can only be exchanged in
the browser that created its verifier, so signup email links use a token hash
instead. This makes confirmation work when Gmail opens the link in another
browser or on another device without weakening OAuth.

Supabase's current PKCE signup guidance pairs `{{ .TokenHash }}` with the
`email` OTP type. The hosted **Confirm signup** template must send this exact
trusted callback:

```html
<a href="https://app.trydropapp.com/?mode=signup-complete&amp;token_hash={{ .TokenHash }}&amp;type=email">
  Confirm email address
</a>
```

The SPA accepts only `type=email`, removes the token from the URL before
exchange, calls `auth.verifyOtp`, and then reuses the existing compliance and
activation checks. Invalid, expired, recovery, invite, and email-change tokens
fail closed.

Template changes are hosted Supabase Auth configuration, not a database
migration. Read the current template before updating it, change only the link,
and preserve its subject and branded content.
