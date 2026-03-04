-- Carcassonne Player Data Migration
-- Step 0: Create players table with UUID primary keys
-- Step 1: Create game_players table for normalized per-game player data

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 0: Players Table
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create players table to store player names with UUIDs
-- Names are NOT unique to allow same names across different realms
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient queries by realm
CREATE INDEX IF NOT EXISTS idx_players_realm_id ON players(realm_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Game Players Table  
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create game_players table for normalized per-game player data
-- Replaces the JSON players array in games table
CREATE TABLE IF NOT EXISTS game_players (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    character TEXT, -- meeple selection
    breakdown JSONB DEFAULT '{}', -- score breakdown by category
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Composite primary key ensures one row per player per game
    PRIMARY KEY (game_id, player_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_player_id ON game_players(player_id);

-- Update trigger to set updated_at automatically
CREATE OR REPLACE FUNCTION update_game_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_game_players_updated_at
    BEFORE UPDATE ON game_players
    FOR EACH ROW
    EXECUTE FUNCTION update_game_players_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION HELPER VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

-- View to easily join games with their players (for backward compatibility)
CREATE OR REPLACE VIEW game_players_view AS
SELECT 
    gp.game_id,
    gp.player_id,
    p.name as player_name,
    p.realm_id,
    gp.score,
    gp.character,
    gp.breakdown,
    gp.created_at,
    gp.updated_at
FROM game_players gp
JOIN players p ON gp.player_id = p.id;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STATISTICS CALCULATION FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Efficient server-side statistics calculation to replace client-side computation
-- Calculates wins, losses, high scores, streaks, and other metrics per player
CREATE OR REPLACE FUNCTION calculate_player_statistics(realm_id UUID)
RETURNS TABLE (
    player_name TEXT,
    wins INTEGER,
    losses INTEGER,
    total_games INTEGER,
    win_rate NUMERIC,
    high_score INTEGER,
    high_score_date DATE,
    total_points INTEGER,
    avg_score NUMERIC,
    farm_wins INTEGER,
    clutch_wins INTEGER,
    clutch_losses INTEGER,
    clutch_games INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH player_game_stats AS (
        SELECT 
            p.name as player_name,
            g.id as game_id,
            g.date,
            gp.score,
            g.farm_win,
            g.clutch_win,
            -- Determine if this player won this game
            CASE 
                WHEN p.name = ANY(g.winners) THEN 1 
                ELSE 0 
            END as is_winner,
            -- Calculate if this was a clutch game for this player
            CASE 
                WHEN g.clutch_win AND p.name = ANY(g.winners) THEN 1
                ELSE 0
            END as clutch_win_for_player,
            CASE 
                WHEN g.clutch_win AND NOT (p.name = ANY(g.winners)) THEN 1
                ELSE 0  
            END as clutch_loss_for_player,
            CASE 
                WHEN g.clutch_win THEN 1
                ELSE 0
            END as is_clutch_game,
            -- Calculate farm wins for this player
            CASE 
                WHEN g.farm_win AND p.name = ANY(g.winners) THEN 1
                ELSE 0
            END as farm_win_for_player
        FROM players p
        JOIN game_players gp ON p.id = gp.player_id  
        JOIN games g ON gp.game_id = g.id
        WHERE p.realm_id = $1
    )
    SELECT 
        pgs.player_name,
        SUM(pgs.is_winner)::INTEGER as wins,
        (COUNT(*) - SUM(pgs.is_winner))::INTEGER as losses,
        COUNT(*)::INTEGER as total_games,
        CASE 
            WHEN COUNT(*) > 0 THEN ROUND((SUM(pgs.is_winner)::NUMERIC / COUNT(*)) * 100, 1)
            ELSE 0
        END as win_rate,
        MAX(pgs.score)::INTEGER as high_score,
        (SELECT date FROM player_game_stats pgs2 
         WHERE pgs2.player_name = pgs.player_name 
         AND pgs2.score = MAX(pgs.score) 
         LIMIT 1) as high_score_date,
        SUM(pgs.score)::INTEGER as total_points,
        CASE 
            WHEN COUNT(*) > 0 THEN ROUND(SUM(pgs.score)::NUMERIC / COUNT(*), 1)
            ELSE 0
        END as avg_score,
        SUM(pgs.farm_win_for_player)::INTEGER as farm_wins,
        SUM(pgs.clutch_win_for_player)::INTEGER as clutch_wins,
        SUM(pgs.clutch_loss_for_player)::INTEGER as clutch_losses,
        SUM(pgs.is_clutch_game)::INTEGER as clutch_games
    FROM player_game_stats pgs
    GROUP BY pgs.player_name
    ORDER BY win_rate DESC, wins DESC;
END;
$$ LANGUAGE plpgsql;