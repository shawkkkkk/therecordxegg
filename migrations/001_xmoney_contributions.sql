CREATE TABLE IF NOT EXISTS xmoney_contributions (
  id BIGSERIAL PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE CHECK (char_length(transaction_id) BETWEEN 1 AND 128),
  x_handle TEXT NOT NULL CHECK (char_length(x_handle) BETWEEN 2 AND 50),
  donor_name VARCHAR(32) NOT NULL,
  egg_name VARCHAR(32) NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  paid_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS xmoney_contributions_handle_idx ON xmoney_contributions (lower(x_handle));
CREATE INDEX IF NOT EXISTS xmoney_contributions_paid_at_idx ON xmoney_contributions (paid_at DESC);
