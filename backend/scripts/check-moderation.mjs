// Quick local check: confirms backend can reach moderation service and whether it is in "model" mode.
// Usage:
//   node backend/scripts/check-moderation.mjs http://localhost:4000
//   node backend/scripts/check-moderation.mjs https://your-backend.onrender.com

const base = (process.argv[2] || 'http://localhost:4000').replace(/\/$/, '');
const url = `${base}/moderation/ready`;

try {
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    console.error('[moderation-check] HTTP', res.status, json);
    process.exit(1);
  }

  const ok = Boolean(json && json.ok);
  const mode = json?.mode ?? 'unknown';
  const message = json?.message ?? '';

  console.log('[moderation-check]', { ok, mode, message, url });
  process.exit(ok ? 0 : 2);
} catch (err) {
  console.error('[moderation-check] failed', { url, err: String(err) });
  process.exit(1);
}

