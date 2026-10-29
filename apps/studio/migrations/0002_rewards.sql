CREATE TABLE request_limits (
  key TEXT PRIMARY KEY,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL
);
CREATE TRIGGER reward_balance_check BEFORE INSERT ON reward_requests
WHEN NOT EXISTS(SELECT 1 FROM reward_requests WHERE id=NEW.id)
  AND (SELECT remaining FROM reward_state WHERE id=1) <= 0
BEGIN SELECT RAISE(ABORT, 'No requests remaining'); END;
CREATE TRIGGER reward_balance_debit AFTER INSERT ON reward_requests
BEGIN UPDATE reward_state SET remaining=remaining-1,revision=revision+1 WHERE id=1; END;
