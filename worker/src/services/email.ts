async function send(
  apiKey: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  html: string,
): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromEmail, to: toEmail, subject, html }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }
}

export async function sendAuthCode(
  apiKey: string,
  fromEmail: string,
  toEmail: string,
  code: string,
): Promise<void> {
  await send(
    apiKey,
    fromEmail,
    toEmail,
    'Your SafelySpend login code',
    `<p>Your login code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
  );
}

export async function sendInvite(
  apiKey: string,
  fromEmail: string,
  toEmail: string,
  senderEmail: string,
  appUrl: string,
  token: string,
): Promise<void> {
  const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`;

  await send(
    apiKey,
    fromEmail,
    toEmail,
    'You have been invited to share a SafelySpend budget',
    `<p><strong>${escapeHtml(senderEmail)}</strong> has invited you to share their budget on SafelySpend.</p>` +
      `<p><a href="${acceptUrl}">Accept the invitation</a></p>` +
      `<p>If you weren't expecting this, you can safely ignore this email.</p>`,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
