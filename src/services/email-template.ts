export const escapeEmailHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

/**
 * Shared Nivaana wrapper for transactional HTML emails.
 *
 * Keep styles inline because many email clients remove stylesheets from the
 * document head.
 */
export const renderNivaanaEmail = (
  title: string,
  recipientName: string,
  content: string,
): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeEmailHtml(title)}</title></head>
<body style="margin:0;background:#f5f3ee;font-family:Arial,sans-serif;color:#292524">
<div style="max-width:620px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4">
<div style="background:#6b4f35;color:#fff;padding:22px 28px"><div style="font-size:24px;font-weight:700">Nivaana</div></div>
<div style="padding:28px"><h1 style="font-size:22px;margin:0 0 18px">${escapeEmailHtml(title)}</h1>
<p style="line-height:1.6">Hello ${escapeEmailHtml(recipientName)},</p>${content}</div>
<div style="padding:18px 28px;background:#fafaf9;color:#78716c;font-size:12px">This is an automated Nivaana email. Please do not reply.</div>
</div></body></html>`;
