import { useSearchParams } from 'react-router';
import { LoginPage } from '@/routes/login';

/**
 * Where the emailed invite link lands (`worker/src/services/email.ts` builds
 * `/accept-invite?token=`).
 *
 * A thin entry point by design. Everything past reading the token is the
 * login shell in invite mode, reused rather than copied: a second copy would
 * duplicate the parts that are easy to get wrong, such as never storing the
 * recovery phrase and handling a spent bridge token.
 *
 * A missing token is passed on as an empty one, and the shell says the link
 * is broken. The token stays in the URL: it arrived there in the email, so the
 * address bar holds nothing the inbox does not, and a refresh needs it.
 */
export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  return <LoginPage inviteToken={searchParams.get('token') ?? ''} />;
}
