# Meta Conversions API implementation

Dataset: `39691774247102448`. API endpoint version is pinned to `v25.0`, configurable with the server-only `META_GRAPH_API_VERSION` secret.

## Current activation state

Implementation is prepared and tested. Database settings default to disabled, and customer matching defaults to disabled. A Meta access token is required before live activation. Never paste the access token into chat, frontend code, GitHub, or any `VITE_*` environment variable.

## Behavior

- Browser Pixel, GTM dataLayer and server signals share an event ID from one mapping.
- `Purchase` is queued by a database trigger only after a live bKash payment has a matching verified Completed receipt, transaction ID, amount, payment ID and BDT currency. Browser requests cannot create Purchase conversions.
- `CompleteRegistration` is queued only for newly confirmed auth accounts created after installation. Existing accounts are not backfilled.
- Payments capture validated first-party `_fbp` and genuine ad-click `_fbc` context before the off-site checkout. Source URLs omit query tokens and fragments.
- PageView, ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Contact and supported custom signals use the server ingestion path. Signed-in identity is derived from authentication, not a posted user ID.
- Optional customer matching sends SHA-256 hashes of normalized email, BD phone digits with country code, and account ID. Raw email, phone and access tokens are never sent in event metadata or logs.
- A private outbox supports database uniqueness, leased claims, bounded retry with stable identity/time, 47-hour deduplication-window expiry and a credential-failure circuit breaker.
- A private Vault credential protects the delivery worker. The cron dispatcher runs every minute only when delivery is enabled and an event is pending. Browser roles cannot read or claim the queue.
- Admin Analytics shows aggregate delivery health without exposing customer identifiers or credentials. Successful delivery immediately clears matching data from the queue record; metadata retention is bounded.
- An authenticated administrative `CapiConnectionTest` requires an explicit test-event code and never claims production conversions. Production delivery never inherits a test-event code.

## Activation

1. In Meta Events Manager, choose the existing dataset, Settings, direct integration without Dataset Quality API. Generate a token only after approval for the new persistent credential.
2. Store the token in the project's Supabase Edge Function secrets as `META_CAPI_ACCESS_TOKEN`.
3. Send one administrative connection test with the displayed Meta Test Events code and verify that Meta receives it as Server.
4. Enable `public.meta_capi_settings.enabled`; enable `customer_matching` only after approval to share hashed customer matching data. Clear `delivery_paused` after validating any replacement token.
5. Verify live browser/server event IDs in Meta Test Events. Validate Purchase with a legitimate paid transaction; do not fabricate purchase conversions or replay historical orders.

## Checks

- Full app suite: 328 tests passed.
- CAPI queue: 21 SQL checks passed, including protected roles, canonical IDs, recovery, expiry and no browser-authored Purchase.
- Mocked CAPI delivery/worker/payment suite: 20 tests passed.
- TypeScript, Deno checks and production build passed.
- Real database SHA-256 output checked against a known test vector.

To stop new CAPI activity, set database `enabled=false`. The browser Pixel is controlled separately by `VITE_META_PIXEL_ENABLED`.

## Confirmed signup leads — 14 October 2026

New accounts created after the Lead migration and confirmed by Supabase generate exactly one server-only `Lead` with ID `lead:<account UUID>`, alongside the existing `CompleteRegistration`. Existing accounts, repeat sign-ins, confirmation timestamp updates and historical registrations are not replayed. A unique outbox key prevents repeated Lead delivery from the same signup. Browser-authored Lead ingestion remains blocked; no second browser Lead is emitted.

The Lead uses existing approved hashed email/account matching and authenticated signup browser context when received while pending. Delivery is delayed at least 30 seconds to allow context enrichment and then uses the existing retry worker. Successful delivery clears matching data. Lead and CompleteRegistration represent the same person at distinct event types and must not be added together as unique customers. Ads Manager's Lead result still depends on attribution and its selected date range.

Validation: 31 SQL checks passed, including new confirmations, duplicate/reconfirmation prevention, no backfill, disabled settings, context enrichment, spoof rejection, existing Purchase retry and queue permissions. Migration deployed to production; real Lead delivery awaits the next legitimate new signup. No fake accounts or fabricated conversions were sent.
