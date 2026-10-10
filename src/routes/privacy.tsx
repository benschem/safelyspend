import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const LAST_UPDATED = '2026-10-10';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/10">
            <ShieldCheck className="h-5 w-5 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold">Privacy</h1>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Last updated{' '}
          {new Date(LAST_UPDATED).toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        <p className="mt-6 text-muted-foreground">
          SafelySpend is a budgeting app, so it holds some of the most sensitive information you
          have. This page explains what stays on your device, what doesn&apos;t, and why.
        </p>

        <div className="mt-10 space-y-10">
          <section>
            <h2 className="text-lg font-semibold">Where your data lives</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything you enter (transactions, categories, budgets, scenarios, savings goals) is
              stored in your browser, on your device. It is not uploaded anywhere unless you turn on
              cloud sync.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              The copy on your device is not encrypted. Anyone who can open this browser on this
              device can read it, the same as any other file on your computer. Your account password
              protects the copy in the cloud, not the one on your device.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              You can export all of it to a file, or delete it, at any time from Settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Cloud sync</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cloud sync is off by default and the app works fully without it. Turning it on lets
              you carry your data between devices.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Your data is encrypted on your device before it is sent. The key that locks it is made
              on your device, and only two things can unlock it: your password, and the twelve-word
              recovery phrase you are shown when you create your account. Neither is ever sent
              anywhere.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              To sign you in, the server checks a scrambled value worked out from your password. It
              is built to be slow to guess, which is one reason a long password matters.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              If you forget your password, the recovery phrase lets you set a new one. If you lose
              both, nobody can recover your data. Not me, not anyone.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              The encrypted file itself is stored on Cloudflare. Alongside it, a small database
              records your email address, that scrambled value, locked copies of your keys, which
              version of the file is current, how big it is, a checksum, and when it last changed.
              So Cloudflare holds a file nobody can read, plus the fact that you have one and
              roughly how large it is. The contents, meaning your transactions, categories, budgets
              and balances, are never visible to Cloudflare or to me.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Sharing a budget</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You can invite one other person to share your budget. Nothing is shared unless you
              send an invite.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              To invite someone you type in their email address. I store that address, and they are
              sent one email with a link, delivered through Resend. The email shows them your email
              address so they know who it is from. The invite, including their address, stays on
              record until you delete your account.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Once they join, they can read and change everything in the budget, the same as you.
              They have their own password and recovery phrase. The budget&apos;s key is passed to
              them locked, so that only they can open it. Before that happens, each of you is shown
              a short safety number to check with the other, in person or on a call. That check is
              what stops anyone in between, including my server, from swapping in a key of their
              own.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              The server records that the two of you share a budget, and when each of you joined. It
              still cannot read the budget.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Sharing cannot be undone yet. There is no way to remove someone, or to leave, short of
              deleting an account, and they keep whatever is already on their device. Only invite
              someone you would hand your bank statements to.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Signing in</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You only need an account if you want cloud sync or to share a budget. Signing in works
              by emailing you a six-digit code, so I store your email address, and the email is
              delivered through a service called Resend.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Your IP address is recorded briefly to stop people hammering the login endpoint, and
              is deleted as soon as that limit window expires. Sign-in sessions record only when
              they were created and when they expire. No IP address, no device details. You can see
              and revoke them under Settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Analytics</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              I count visits to the landing page (the page you see before you start using the app)
              so I know whether anyone is finding SafelySpend and where they came from. Nothing
              inside the app is measured. Once you start using it, no page you open and no action
              you take is recorded or sent anywhere.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              This uses a self-hosted copy of{' '}
              <a
                href="https://plausible.io"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Plausible
              </a>
              , which I run myself on a rented server in Sydney, Australia. It records the page
              address, the referring site, country, device type and browser. No cookies, no
              cross-site tracking, and nothing that identifies you personally.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Hosting</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The app is served by Netlify, which keeps its own short-term server logs. I don&apos;t
              read those unless something has gone wrong. The analytics server is a droplet rented
              from DigitalOcean, so they could in principle reach what is on it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">No ads, no selling</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              There are no ads and no third-party trackers. Your data is never sold, and never
              shared with anyone you have not invited yourself.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
