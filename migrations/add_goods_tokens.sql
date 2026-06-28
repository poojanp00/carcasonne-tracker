ALTER TABLE board_state ADD COLUMN IF NOT EXISTS goods_tokens jsonb DEFAULT '{}';
