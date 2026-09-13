import type { Context } from 'hono';

export interface Env {
  DB: D1Database;
  VAULT_BUCKET: R2Bucket;
  JWT_SECRET: string;
  JWT_SECRET_PREVIOUS?: string;
  RESEND_API_KEY: string;
  ENVIRONMENT: string;
  FROM_EMAIL: string;
  APP_URL: string;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Household {
  id: string;
  name: string;
}

export interface JwtPayload {
  sub: string;
  sid: string;
  email: string;
  /** Household the user belonged to when the token was signed. One per user in v1
   *  (Q5). Absent for a user who has signed up against an invite but whose handoff
   *  has not completed — they have no household yet. Informational for the client;
   *  server-side scoping reads `householdId` from the context, which the auth
   *  middleware resolves from household_members on every request. */
  hid?: string;
  /** Session was established through the recovery path, so no password verifier was
   *  checked. Such a session may only read the key bundle and complete the recovery
   *  reset — see requireFullSession in middleware/auth.ts. */
  rec?: boolean;
  iat: number;
  exp: number;
}

export type HonoEnv = {
  Bindings: Env;
  Variables: {
    requestId: string;
    user: User;
    jwtPayload: JwtPayload;
    /** Resolved from household_members, not from the JWT claim: a user who joins a
     *  household mid-session would otherwise carry a stale token until re-login. */
    householdId: string | null;
  };
};

export type AppContext = Context<HonoEnv>;
