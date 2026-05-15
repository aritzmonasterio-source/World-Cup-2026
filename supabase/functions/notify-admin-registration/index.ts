import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const adminEmail = Deno.env.get('ADMIN_NOTIFY_EMAIL') || 'aritzmonasterio@gmail.com';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!resendApiKey) {
    return Response.json({ ok: false, skipped: 'Missing RESEND_API_KEY' });
  }

  const payload = await request.json().catch(() => ({}));
  const communityId = payload.community_id || 'dimension-football';
  const userEmail = payload.email || 'Usuario sin email';
  const username = payload.username || userEmail;

  let communityName = communityId;
  if (supabaseUrl && serviceRole) {
    const supabase = createClient(supabaseUrl, serviceRole);
    const { data } = await supabase.from('communities').select('name').eq('id', communityId).maybeSingle();
    communityName = data?.name || communityId;
  }

  const subject = `Nuevo registro pendiente: ${username}`;
  const html = `
    <div style="font-family:Arial,sans-serif;background:#111;color:#f4f4f5;padding:24px;border-radius:16px">
      <h1 style="margin:0 0 12px;font-size:22px">Nuevo jugador pendiente</h1>
      <p><strong>Usuario:</strong> ${escapeHtml(username)}</p>
      <p><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
      <p><strong>Comunidad:</strong> ${escapeHtml(communityName)}</p>
      <p style="margin-top:20px;color:#a1a1aa">Entra en la app, abre Admin y aprueba o bloquea el registro desde Validación rápida.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Mundial 2026 <onboarding@resend.dev>',
      to: adminEmail,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ ok: false, error: await response.text() }), { status: 500 });
  }

  return Response.json({ ok: true });
});

function escapeHtml(value: string) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
