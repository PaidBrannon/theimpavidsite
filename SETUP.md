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

Consultation notifications are initiated by verified Square payment webhooks (payment.created/payment.updated), with confirmation-page verification as a fallback. Configure SQUARE_WEBHOOK_SIGNATURE_KEY and SQUARE_WEBHOOK_URL=https://theimpavid.com/api/square-webhook in Production. Sandbox consultation checkout and Resend owner notification have been tested; independent Production consultation notification has not been verified with a real payment. An automatic customer email is not yet implemented.

## Release checks
1. Sandbox: verify an ebook purchase and actual EPUB download.
2. Sandbox: verify consultation payment, category, package, and owner notification email.
3. Confirm both ebook R2 keys and email configuration exist in Production.
4. Deploy Square branch to production only after tests pass. Verify both checkout types with live payments and check notifications.
5. Remove obsolete payment credentials from Cloudflare only after live verification. Never remove BOOKS, NOTIFIED or DOWNLOAD_SIGNING_SECRET.
6. Ensure old duplicate folders in the repository are not used as the Cloudflare build root.

## Customer book reviews
The Book Reviews navigation link and each product page show approved reviews and accept submissions (1–5 stars, name, 15–1200 character review). Submitted reviews are saved in the existing NOTIFIED KV namespace under review:pending: and are not publicly visible until approved. The public API is /api/reviews; moderation API is /api/reviews-admin. The owner interface is /reviews-admin.html. Set REVIEW_ADMIN_SECRET as a strong random Secret (32+ characters) in Cloudflare Pages Production, and in Preview if moderation there is desired. Open the owner interface, enter the secret, load pending reviews, and approve or reject. Never paste the secret into chat or commit it to GitHub. The secret is not stored by the admin page. Pending reviews expire after 180 days; approved reviews persist. Moderation is required; this is not a verified-purchaser review system. Before promoting widely, add spam/rate-limit protection such as Cloudflare WAF rules or Turnstile.
