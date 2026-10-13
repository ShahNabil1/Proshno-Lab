# Proshnolab Meta Pixel setup

Pixel/dataset ID: `39691774247102448` (stored as a string).

## Implemented browser events

| Event | Trigger |
| --- | --- |
| PageView | Public and dashboard route navigation; excludes admin and auth/reset callbacks |
| ViewContent | Package catalog or selected package |
| AddToCart | Package selection when its checkout is displayed |
| InitiateCheckout | Selected package checkout displayed |
| AddPaymentInfo | Valid bKash payment session created before redirect |
| CompleteRegistration | New Google OAuth account or successful new email signup; repeated account events deduplicated |
| Purchase | Completed server-authorized payment row, using transaction ID and actual discounted BDT amount |
| Contact | WhatsApp, phone or email link click; measures a click, not a sent message |
| PaperGenerated | Successful automatic generation or manual paper draft creation |
| PrintRequested | Print/PDF dialog requested; does not claim that the user saved/printed |
| PaperDownloaded | Successful DOCX export |
| PaymentFailed / PaymentCancelled | Explicit payment provider failure/cancel callback |
| Login | Successful auth sign-in notification |

`Purchase` and `CompleteRegistration` have stable event IDs and browser storage deduplication. Purchase deduplication is scoped to this browser and dataset, not a server-wide guarantee. Marketing payloads allowlist business metadata and omit customer form details.

## Verification on 13 October 2026

Meta Test Events visibly received and processed PageView, View content, Add to cart and Initiate checkout from localhost. No real payment, signup, or outgoing contact message was created for testing. Purchase mapping and duplicate protection are tested with local mocks.

TypeScript validation and focused automated tests were run. Production build was checked locally.

## Configuration and remaining activation

- `VITE_META_PIXEL_ID=39691774247102448`
- `VITE_META_PIXEL_ENABLED=true`; set to `false` if GTM owns the Meta implementation to avoid running two installations.
- Existing Google Tag Manager remains installed. Do not add another copy of the Meta tags there.
- Changes currently apply to the local source checkout. Deploy the built website through the normal hosting workflow to enable this implementation on proshnolab.com.
- Meta Conversions API is not configured. The existing `track-event` endpoint is internal analytics/GTM forwarding, not Meta CAPI. A secure server token, backend integration, shared event IDs, and deployment are still required for CAPI. Never put a CAPI token in `VITE_*` variables or frontend source.
- Browser events can be blocked by browser settings/extensions. This implementation does not promise 100% event capture or advertising results.
- Validate a real successful payment and registration in Meta Test Events after deployment, without fabricating conversions. For Purchase, check the actual BDT amount and confirm a refresh does not create a second conversion.
