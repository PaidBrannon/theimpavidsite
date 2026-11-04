import { json, stripe, checkedPrice, BOOKS } from '../../server/lib.js';
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch (e) { console.error(e.message); return json({ error: 'Invalid request.' }, 400); }
  const keys = [...new Set(Array.isArray(b.items) ? b.items : [])];
  if (!keys.length || keys.some((k) => !BOOKS[k])) return json({ error: 'Choose at least one available book.' }, 400);
  // In Pages previews, return to the exact deployment that created the checkout.
  // A stale SITE_URL branch alias can otherwise send a paid buyer to outdated code.
  const requestOrigin = new URL(request.url).origin;
  const origin = new URL(request.url).hostname.endsWith('.pages.dev')
    ? requestOrigin
    : (env.SITE_URL || requestOrigin);
  try {
    const ids = await Promise.all(keys.map((k) => checkedPrice(env, BOOKS[k])));
    const s = await stripe(env, 'POST', '/checkout/sessions', {
      mode: 'payment',
      line_items: ids.map((price) => ({ price, quantity: 1 })),
      metadata: { kind: 'books', items: keys.join(',') },
      success_url: origin + '/?session_id={CHECKOUT_SESSION_ID}#success',
      cancel_url: origin + '/#cart',
    });
    return json({ url: s.url });
  } catch { return json({ error: 'Could not start checkout. Please try again.' }, 502); }
}
