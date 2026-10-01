import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Hourglass } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

/**
 * Placeholder for the invitee's waiting screen, so invite signup has
 * somewhere real to land. Step 4 of `docs/auth-rewrite/07_invite_flow.md`
 * replaces it: polling for the handoff, the safety number, and the password
 * and phrase that open it.
 *
 * Sign out is here even in the placeholder: this route sits outside the app
 * shell, so without it the page is a dead end with no way off it.
 */
export function HouseholdWaitingPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      toast.error('Could not sign you out. Please try again.');
      setSigningOut(false);
      return;
    }
    navigate('/welcome', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg text-center">
        <div className="mb-4 inline-flex rounded-full bg-blue-500/10 p-3">
          <Hourglass className="h-6 w-6 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold">Waiting to join</h1>
        <p className="mt-2 text-muted-foreground">
          Your account is ready. The person who invited you needs to approve you before you can see
          the shared budget.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-6 cursor-pointer text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:cursor-not-allowed"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
