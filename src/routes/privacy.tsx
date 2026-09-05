import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const LAST_UPDATED = '2026-09-05';

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
              Your data is encrypted on your device, before it is sent, with a passphrase only you
              know. That passphrase is never stored and never sent anywhere; you re-enter it each
              session. The flip side is that if you lose it, nobody can recover your data. Not me,
              not anyone.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              The encrypted file itself is stored on Cloudflare. Alongside it, a small database
              records your email address, which version of the file is current, how big it is, a
              checksum, and when it last changed. So Cloudflare holds a file nobody can read, plus
              the fact that you have one and roughly how large it is. The contents, meaning your
              transactions, categories, budgets and balances, are never visible to Cloudflare or to
              me.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Signing in</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You only need an account if you want cloud sync. Signing in works by emailing you a
              six-digit code, so I store your email address, and the email is delivered through a
              service called Resend.
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
              There are no ads, no third-party trackers, and your data is never sold or shared.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
