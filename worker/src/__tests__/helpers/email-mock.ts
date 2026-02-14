import { vi } from 'vitest';

// Global mock for the email service — prevents real API calls to Resend.
// Applied via vitest setupFiles so individual test files don't need to repeat it.
vi.mock('../../services/email.js', () => ({
  sendAuthCode: vi.fn().mockResolvedValue(undefined),
}));
