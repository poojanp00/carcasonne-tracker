-- Add max_features tracking to board_state table for live achievement tracking
-- Stores the largest individual feature per scoring category: {type: {amount: number, player: string}}

ALTER TABLE board_state ADD COLUMN IF NOT EXISTS max_features jsonb DEFAULT '{}';
