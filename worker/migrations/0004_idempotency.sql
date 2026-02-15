-- Add idempotency key support for retry-safe vault uploads
ALTER TABLE vaults ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX idx_vaults_user_idempotency ON vaults(user_id, idempotency_key);
