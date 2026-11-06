# The Impavid — Square checkout deployment

## Payment environments
Cloudflare Pages Preview: SQUARE_ENVIRONMENT=sandbox, sandbox SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.
Cloudflare Pages Production: SQUARE_ENVIRONMENT=production, production SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.
SQUARE_ACCESS_TOKEN must be a Secret. Never publish it.

## Required Cloudflare resources
- KV binding NOTIFIED for order references and consultation notification flags.
- Private R2 binding BOOKS for purchased ebooks.
- Text variables BOOK_KEY_RELATIONSHIP_GOALS and BOOK_KEY_WWYS matching the exact R2 object names.
- Secret DOWNLOAD_SIGNING_SECRET for expiring ebook links.

## Consultation notification email
To email the owner after a verified Square consultation payment, configure:
- RESEND_API_KEY as Secret
- NOTIFY_EMAIL_TO as the owner's inbox
- NOTIFY_EMAIL_FROM as an address on a verified sending domain

Consultation notifications are initiated when the successful Square confirmation page calls /api/order; they are not currently delivered by an independent webhook. The customer confirmation does not guarantee email delivery. Monitor orders in Square until notifications are independently tested. An automatic customer email is not yet implemented.

## Release checks
1. Sandbox: verify an ebook purchase and actual EPUB download.
2. Sandbox: verify consultation payment, category, package, and owner notification email.
3. Confirm both ebook R2 keys and email configuration exist in Production.
4. Deploy Square branch to production only after tests pass. Verify both checkout types with live payments and check notifications.
5. Remove obsolete payment credentials from Cloudflare only after live verification. Never remove BOOKS, NOTIFIED or DOWNLOAD_SIGNING_SECRET.
6. Ensure old duplicate folders in the repository are not used as the Cloudflare build root.
