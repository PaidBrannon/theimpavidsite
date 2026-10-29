import { json, stripe, signToken, validSession, BOOKS } from '../../server/lib.js';
// Confirms payment with Stripe (server-side), then returns the result or fresh 15-minute download links.
export async function onRequestGet({ request, env }) {
  const sid = new URL(request.url).searchParams.get('session_id');
  if (!validSession(sid)) return json({ paid: false }, 400);
  let s; try { s = await stripe(env, 'GET', '/checkout/sessions/' + sid); } catch { return json({ paid: false }, 404); }
  if (s.payment_status !== 'paid') return json({ paid: false });
  const m = s.metadata || {};
  if (m.kind === 'consultation') return json({ paid: true, kind: 'consultation', category: m.category_label, package: m.package_label });
  if (m.kind === 'books') {
    const exp = Math.floor(Date.now() / 1000) + 900;
    const downloads = await Promise.all((m.items || '').split(',').filter((k) => BOOKS[k]).map(async (k) => ({
      title: BOOKS[k].title, url: '/api/download?t=' + encodeURIComponent(await signToken(env, { s: sid, b: k, e: exp })),
    })));
    return json({ paid: true, kind: 'books', downloads });
  }
  return json({ paid: false }, 404);
}
