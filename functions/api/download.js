import { stripe, readToken, BOOKS } from '../../server/lib.js';

// Signed, short-lived links are issued only after server-side Stripe verification.
export async function onRequestGet({ request, env }) {
  const deny = (message, status = 403) => new Response(message, {
    status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
  });

  if (!env.DOWNLOAD_SIGNING_SECRET) {
    console.error('Download failed: DOWNLOAD_SIGNING_SECRET is not configured');
    return deny('Downloads are temporarily unavailable. Please contact support@theimpavid.com.', 503);
  }
  if (!env.BOOKS) {
    console.error('Download failed: R2 BOOKS binding is not configured');
    return deny('Downloads are temporarily unavailable. Please contact support@theimpavid.com.', 503);
  }

  let token;
  try {
    token = await readToken(env, new URL(request.url).searchParams.get('t'));
  } catch (error) {
    console.error('Download token verification failed:', error);
    return deny('Could not validate download link. Please reload your order page.', 503);
  }
  if (!token || !BOOKS[token.b]) {
    return deny('This download link is invalid or expired. Reload your order page for a new link.');
  }

  try {
    const session = await stripe(env, 'GET', '/checkout/sessions/' + encodeURIComponent(token.s));
    if (session.payment_status !== 'paid' || session.metadata?.kind !== 'books' ||
        !(session.metadata?.items || '').split(',').includes(token.b)) {
      return deny('Payment not verified for this book.');
    }
  } catch (error) {
    console.error('Download Stripe verification failed:', error);
    return deny('Could not verify payment. Please try again shortly.', 502);
  }

  const key = env[BOOKS[token.b].key];
  if (!key) {
    console.error('Download failed: missing R2 object key variable', BOOKS[token.b].key);
    return deny('The ebook is not configured. Please contact support@theimpavid.com.', 503);
  }

  try {
    const obj = await env.BOOKS.get(key);
    if (!obj) {
      console.error('Download failed: R2 ebook object not found for', token.b);
      return deny('File not found. Please contact support@theimpavid.com.', 404);
    }
    return new Response(obj.body, { headers: {
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': 'attachment; filename="' + BOOKS[token.b].file + '"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    console.error('Download failed: R2 read error:', error);
    return deny('Could not retrieve the ebook. Please try again shortly.', 503);
  }
}
