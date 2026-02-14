import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import * as vaultService from '../services/vault.js';
import type { HonoEnv } from '../types.js';

const KEEP_VERSIONS = 10;
const MAX_VAULT_SIZE = 10 * 1024 * 1024; // 10MB

// Rate limiter for vault uploads (30 per minute per IP)
const uploadRateLimit = rateLimit({ max: 30, windowSeconds: 60, keyPrefix: 'vault:upload' });

const vault = new Hono<HonoEnv>();

// All vault routes require authentication
vault.use('*', authMiddleware);

// GET /vault - Get vault metadata
vault.get('/', async (c) => {
  const user = c.get('user');
  const metadata = await vaultService.getMetadata(c.env.DB, user.id);

  if (!metadata) {
    return c.json({ version: 0 });
  }

  return c.json({
    version: metadata.version,
    sizeBytes: metadata.sizeBytes,
    checksum: metadata.checksum,
    updatedAt: metadata.updatedAt,
  });
});

// GET /vault/data - Stream current encrypted blob
vault.get('/data', async (c) => {
  const user = c.get('user');
  const data = await vaultService.getData(c.env.DB, c.env.VAULT_BUCKET, user.id);

  if (!data) {
    throw notFound('No vault data found');
  }

  return new Response(data.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Vault-Version': data.version.toString(),
      'X-Vault-Checksum': data.checksum,
    },
  });
});

// PUT /vault/data - Upload encrypted blob
vault.put('/data', uploadRateLimit, async (c) => {
  const user = c.get('user');

  const expectedVersionHeader = c.req.header('X-Expected-Version');
  if (!expectedVersionHeader) {
    throw badRequest('X-Expected-Version header is required');
  }

  const expectedVersion = parseInt(expectedVersionHeader, 10);
  if (isNaN(expectedVersion) || expectedVersion < 0) {
    throw badRequest('X-Expected-Version must be a non-negative integer');
  }

  // Check Content-Length header before reading body (fast reject)
  const contentLength = parseInt(c.req.header('content-length') ?? '0', 10);
  if (contentLength > MAX_VAULT_SIZE) {
    throw badRequest(`Vault data exceeds maximum size of ${MAX_VAULT_SIZE} bytes`);
  }

  const body = await c.req.arrayBuffer();

  if (body.byteLength === 0) {
    throw badRequest('Request body is required');
  }

  // Defense in depth: headers can lie
  if (body.byteLength > MAX_VAULT_SIZE) {
    throw badRequest(`Vault data exceeds maximum size of ${MAX_VAULT_SIZE} bytes`);
  }

  try {
    const result = await vaultService.putData(
      c.env.DB,
      c.env.VAULT_BUCKET,
      user.id,
      body,
      expectedVersion,
    );

    // Prune old versions in background
    c.executionCtx.waitUntil(
      vaultService.pruneOldVersions(c.env.DB, c.env.VAULT_BUCKET, user.id, KEEP_VERSIONS),
    );

    return c.json({ version: result.version, vaultId: result.vaultId });
  } catch (err) {
    if (err instanceof AppError && err.code === 'CONFLICT') {
      return c.json(
        {
          error: 'Version conflict',
          currentVersion: (err.data as { currentVersion: number }).currentVersion,
        },
        409,
      );
    }
    throw err;
  }
});

// GET /vault/history - List all vault versions
vault.get('/history', async (c) => {
  const user = c.get('user');
  const history = await vaultService.getHistory(c.env.DB, user.id);
  return c.json({ versions: history });
});

// GET /vault/data/:vaultId - Stream specific historical version
vault.get('/data/:vaultId', async (c) => {
  const user = c.get('user');
  const vaultId = c.req.param('vaultId');

  const data = await vaultService.getDataByVaultId(
    c.env.DB,
    c.env.VAULT_BUCKET,
    user.id,
    vaultId,
  );

  if (!data) {
    throw notFound('Vault version not found');
  }

  return new Response(data.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Vault-Version': data.version.toString(),
    },
  });
});

export default vault;
