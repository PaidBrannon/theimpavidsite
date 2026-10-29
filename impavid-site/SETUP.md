# The Impavid: payments, downloads, consultations setup

Nothing here is confirmed working until you complete the tests at the bottom.

## 1. Add to your GitHub repo
Copy `functions/`, `server/`, `assets/` and the updated `index.html` into your repo root (merge index.html with yours if you changed it since the prototype). `functions/` must sit at the project root. Commit and push; Cloudflare Pages redeploys.

## 2. Stripe dashboard (use TEST mode first)
- Your 5 Price IDs are already in the code. If they are test-mode IDs, use test keys; live mode needs the live IDs (see step 4). Do not create new products.
- **Developers > Webhooks > Add endpoint**: URL `https://YOURDOMAIN/api/stripe-webhook`; events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy the **Signing secret** (`whsec_`).
- Settings > Customer emails: turn on successful-payment receipts.

## 3. Cloudflare R2 and KV
- R2 bucket `the-impavid-books`: keep it **private** (no public access or custom domain). Note the exact object names of the two EPUBs. (Watch Where You’re Standing: use the .epub, not the PDF.)
- Workers & Pages > KV > create a namespace named `impavid-notified`.

## 4. Cloudflare Pages project > Settings
**Bindings** (Production and Preview):
| Type | Variable name | Value |
|---|---|---|
| R2 bucket | `BOOKS` | `the-impavid-books` |
| KV namespace | `NOTIFIED` | `impavid-notified` |

**Variables (plain text):** `BOOK_KEY_RELATIONSHIP_GOALS`, `BOOK_KEY_WWYS` (exact R2 filenames); `NOTIFY_EMAIL_TO` (your email); `NOTIFY_EMAIL_FROM` (e.g. `The Impavid <bookings@theimpavid.com>`); optional `SITE_URL` (https://theimpavid.com). Your five Price IDs are already built into `server/lib.js`. Before every checkout the server asks Stripe to confirm each price is active, one-time, USD, the right amount and the right product, and refuses otherwise. If you switch to live mode, add `PRICE_RELATIONSHIP_GOALS`, `PRICE_WWYS`, `PRICE_ESSENTIAL`, `PRICE_EXTENDED`, `PRICE_PREMIUM` with the live IDs to override.

**Secrets (type "Secret"):** `STRIPE_SECRET_KEY` (test `sk_test_` first), `STRIPE_WEBHOOK_SECRET`, `DOWNLOAD_SIGNING_SECRET` (any random 32+ character string), `RESEND_API_KEY`.

## 5. Email notifications
Notifications use Resend (resend.com): create an account, verify theimpavid.com, create an API key. Without a verified domain, emails will not send. (Any other email API would need a small code change in `server/lib.js`.)

## 6. Redeploy, then test (Stripe test mode, card 4242 4242 4242 4242)
1. Buy each book: you land on the success page, EPUB downloads, and the file opens.
2. Open a download link after 15 minutes: it must be refused. Open a fake link: refused.
3. Book one consultation in each category: you get the on-screen message; you receive the notification with name, email, phone, category, package and payment; the customer email arrives.
4. Stripe > Webhooks > resend the same event: no second notification.
5. Cancel at Stripe checkout: you return to the site and no notification arrives.
6. Mind Over Mirror shows Coming soon and cannot be added.
7. Check on a phone. Then switch to live keys and live Price IDs/webhook and repeat with one real small purchase (refund yourself).

## Notes
- Duplicate protection uses KV, which is not atomic; two webhook deliveries in the same instant could rarely both send.
- Refunds do not auto-revoke already-issued links (they expire in 15 minutes, but the order page can mint new ones). Tell me if you want refund blocking added.
- No secret keys are in the code. Never paste them into chat.

## Sandbox (test) testing
- Test vs live is chosen automatically from `STRIPE_SECRET_KEY` (`sk_test_` = test, `sk_live_` = live). Test Price IDs for Relationship Goals and Essential Consultation are built in; the live IDs are used only with a live key. Other products have no test price, so they will refuse checkout in test mode.
- Put the test key and test webhook secret in the **Preview** environment only, test on a branch, and leave **Production** untouched. In Preview, do not set `SITE_URL`.
- Test notification emails start with `[TEST]`. Webhook events whose mode doesn't match the key are ignored.
