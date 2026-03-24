-- Add expansion-aware achievement tracking to games table
-- These JSONB columns store {amount: number, player: string} or NULL if achievement wasn't scored

-- Base game achievements
ALTER TABLE games ADD COLUMN IF NOT EXISTS longest_road jsonb DEFAULT NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS largest_city jsonb DEFAULT NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS largest_field jsonb DEFAULT NULL;

-- Inns & Cathedrals achievements
ALTER TABLE games ADD COLUMN IF NOT EXISTS longest_inn jsonb DEFAULT NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS largest_cathedral jsonb DEFAULT NULL;

-- Traders & Builders achievements
ALTER TABLE games ADD COLUMN IF NOT EXISTS biggest_pig jsonb DEFAULT NULL;

-- Abbey & Mayor achievements
ALTER TABLE games ADD COLUMN IF NOT EXISTS largest_barn jsonb DEFAULT NULL;
