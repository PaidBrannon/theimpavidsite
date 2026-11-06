// Shared server helpers. Secrets come only from Cloudflare env (never from the browser).
const enc = new TextEncoder();
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Product catalog and R2 object keys.
export const BOOKS = {
  rg:  { title: 'Relationship Goals', cents: 499, name: 'relationship goals', key: 'BOOK_KEY_RELATIONSHIP_GOALS', file: 'relationship-goals.epub' },
  wws: { title: 'Watch Where You’re Standing: The Three Circles Method', cents: 499, name: 'watch where', key: 'BOOK_KEY_WWYS', file: 'watch-where-youre-standing.epub' },
};
export const PACKAGES = {
  essential: { label: 'Essential', cents: 5000, name: 'essential', usd: 50, min: 30 },
  extended:  { label: 'Extended', cents: 9900, name: 'extended', usd: 99, min: 60 },
  premium:   { label: 'Premium', cents: 19900, name: 'premium',   usd: 199, min: 90 },
};
export const CATEGORIES = { 'financial-wellness': 'Financial Wellness', 'health-fitness': 'Health & Fitness', 'personal-development': 'Personal Development' };
export const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}
function safeEq(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

// Time-limited download tokens: {s: session id, b: book key, e: expiry (unix s)}
export async function signToken(env, payload) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  return body + '.' + b64u(await hmac(env.DOWNLOAD_SIGNING_SECRET, body));
}
export async function readToken(env, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !safeEq(b64u(await hmac(env.DOWNLOAD_SIGNING_SECRET, body)), sig)) return null;
  try { const p = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))); return p.e > Date.now() / 1000 ? p : null; } catch { return null; }
}

export async function sendEmail(env, { to, subject, html, replyTo }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.NOTIFY_EMAIL_FROM, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!r.ok) throw new Error('Email send failed ' + r.status);
}
