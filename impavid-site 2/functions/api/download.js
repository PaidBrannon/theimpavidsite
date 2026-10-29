import { stripe, readToken, BOOKS } from '../../server/lib.js';
export async function onRequestGet({ request, env }) {
  const deny = (m, s = 403) => new Response(m, { status: s, headers: { 'Cache-Control': 'no-store' } });
  const p = await readToken(env, new URL(request.url).searchParams.get('t'));
  if (!p || !BOOKS[p.b]) return deny('This download link is invalid or has expired. Reload your order page to get a new link.');
  try { // re-check payment, and that this session actually included this book
    const s = await stripe(env, 'GET', '/checkout/sessions/' + p.s);
    if (s.payment_status !== 'paid' || !(s.metadata?.items || '').split(',').includes(p.b)) return deny('Payment not verified.');
  } catch { return deny('Could not verify payment.', 502); }
  const obj = await env.BOOKS.get(env[BOOKS[p.b].key]);
  if (!obj) return deny('File not found. Please contact support@theimpavid.com.', 404);
  return new Response(obj.body, { headers: {
    'Content-Type': 'application/epub+zip', 'Content-Disposition': `attachment; filename="${BOOKS[p.b].file}"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}
