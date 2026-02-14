-- Index for rate_limits cleanup query: DELETE FROM rate_limits WHERE reset_at <= ?
CREATE INDEX idx_rate_limits_reset_at ON rate_limits(reset_at);

-- Index for auth_codes cleanup query: DELETE FROM auth_codes WHERE created_at < ?
CREATE INDEX idx_auth_codes_created_at ON auth_codes(created_at);
