import type { Context } from 'hono';

export interface Env {
  DB: D1Database;
  VAULT_BUCKET: R2Bucket;
  JWT_SECRET: string;
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

export interface JwtPayload {
  sub: string;
  sid: string;
  email: string;
  iat: number;
  exp: number;
}

export type HonoEnv = {
  Bindings: Env;
  Variables: {
    requestId: string;
    user: User;
    jwtPayload: JwtPayload;
  };
};

export type AppContext = Context<HonoEnv>;
