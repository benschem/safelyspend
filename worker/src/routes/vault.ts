import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import * as vaultService from '../services/vault.js';
import type { HonoEnv } from '../types.js';

const KEEP_VERSIONS = 10;
const MAX_VAULT_SIZE = 10 * 1024 * 1024; // 10MB

/** Read request body as stream with early abort if size exceeds limit. */
async function readBodyWithLimit(req: Request, maxSize: number): Promise<ArrayBuffer> {
  const stream = req.body;
  if (!stream) {
    throw badRequest('Request body is required');
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.byteLength;
      if (totalSize > maxSize) {
        await reader.cancel();
        throw badRequest(`Vault data exceeds maximum size of ${maxSize} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalSize === 0) {
    throw badRequest('Request body is required');
  }

  // Combine chunks into single ArrayBuffer
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return combined.buffer as ArrayBuffer;
}

// Rate limiters
const readRateLimit = rateLimit({ max: 60, windowSeconds: 60, keyPrefix: 'vault:read' });
const uploadRateLimit = rateLimit({ max: 30, windowSeconds: 60, keyPrefix: 'vault:upload' });

const vault = new Hono<HonoEnv>();

// All vault routes require authentication
vault.use('*', authMiddleware);

// GET /vault - Get vault metadata
vault.get('/', readRateLimit, async (c) => {
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
vault.get('/data', readRateLimit, async (c) => {
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

  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/octet-stream')) {
    throw badRequest('Content-Type must be application/octet-stream');
  }

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

  // Stream body with size enforcement — abort as soon as limit is exceeded
  // rather than buffering the entire request before checking
  const body = await readBodyWithLimit(c.req.raw, MAX_VAULT_SIZE);

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
      vaultService.pruneOldVersions(c.env.DB, c.env.VAULT_BUCKET, user.id, KEEP_VERSIONS)
        .catch((err) => console.error('Background vault prune failed:', err)),
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
vault.get('/history', readRateLimit, async (c) => {
  const user = c.get('user');
  const history = await vaultService.getHistory(c.env.DB, user.id);
  return c.json({ versions: history });
});

// GET /vault/data/:vaultId - Stream specific historical version
vault.get('/data/:vaultId', readRateLimit, async (c) => {
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
