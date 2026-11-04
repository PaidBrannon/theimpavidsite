import { json, stripe, signToken, validSession, BOOKS } from '../../server/lib.js';

// Verify Stripe server-side before issuing any download links.
export async function onRequestGet({ request, env }) {
  const sid = new URL(request.url).searchParams.get('session_id');
  if (!validSession(sid)) return json({ paid: false, error: 'Missing or invalid checkout session ID.' }, 400);

  let session;
  try {
    session = await stripe(env, 'GET', '/checkout/sessions/' + encodeURIComponent(sid));
  } catch (error) {
    console.error('Stripe checkout verification failed:', error);
    return json({ paid: false, error: 'Stripe could not verify this checkout session.' }, 502);
  }

  if (session.payment_status !== 'paid') return json({ paid: false, error: 'Stripe has not confirmed payment yet.' }, 202);

  const metadata = session.metadata || {};
  if (metadata.kind === 'consultation') {
    return json({ paid: true, kind: 'consultation', category: metadata.category_label, package: metadata.package_label });
  }

  if (metadata.kind !== 'books') {
    console.error('Paid checkout has unexpected metadata kind:', metadata.kind);
    return json({ paid: false, error: 'This paid checkout has unrecognized order details.' }, 422);
  }

  const keys = [...new Set((metadata.items || '').split(',').filter(k => BOOKS[k]))];
  if (!keys.length) {
    console.error('Paid book checkout has no recognized book keys');
    return json({ paid: false, error: 'The paid order does not contain recognized books.' }, 422);
  }

  if (!env.DOWNLOAD_SIGNING_SECRET) {
    console.error('DOWNLOAD_SIGNING_SECRET is missing from this Cloudflare environment');
    return json({ paid: false, error: 'Downloads are temporarily unavailable: signing configuration is missing.' }, 503);
  }

  if (!env.BOOKS) {
    console.error('R2 BOOKS binding is missing from this Cloudflare environment');
    return json({ paid: false, error: 'Downloads are temporarily unavailable: storage is not configured.' }, 503);
  }

  try {
    const missing = [];
    for (const key of keys) {
      const objectKey = env[BOOKS[key].key];
      if (!objectKey) { missing.push(key + ': missing ' + BOOKS[key].key); continue; }
      const object = await env.BOOKS.head(objectKey);
      if (!object) missing.push(key + ': object not found');
    }
    if (missing.length) {
      console.error('Book download configuration error:', missing.join('; '));
      return json({ paid: false, error: 'Payment confirmed, but the ebook file is unavailable. Please contact support@theimpavid.com.' }, 503);
    }

    const expires = Math.floor(Date.now() / 1000) + 900;
    const downloads = await Promise.all(keys.map(async key => ({
      title: BOOKS[key].title,
      url: '/api/download?t=' + encodeURIComponent(await signToken(env, { s: sid, b: key, e: expires })),
    })));
    return json({ paid: true, kind: 'books', downloads });
  } catch (error) {
    console.error('Paid order download preparation failed:', error);
    return json({ paid: false, error: 'Payment confirmed, but downloads could not be prepared. Check Cloudflare runtime logs.' }, 503);
  }
}
