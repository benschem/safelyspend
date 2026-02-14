export async function sendAuthCode(
  apiKey: string,
  fromEmail: string,
  toEmail: string,
  code: string,
): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      subject: 'Your SafelySpend login code',
      html: `<p>Your login code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }
}
