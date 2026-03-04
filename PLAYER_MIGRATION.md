# Carcassonne Player Data Migration

This document outlines the incremental migration from storing player data as JSON in the `games.players` column to a normalized database structure using separate `players` and `game_players` tables.

## Migration Overview

The migration normalizes per-game player data while maintaining backward compatibility during the transition period. Players are now identified by UUIDs instead of names, allowing the same name to be used across different realms.

### Goals
- ✅ Normalize per-game player data using UUIDs
- ✅ Allow duplicate player names across different realms  
- ✅ Maintain site functionality during migration
- ✅ Keep aggregation capabilities for future implementation
- ✅ Zero-downtime deployment

## Database Schema Changes

### Step 0: Players Table
```sql
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    realm_id UUID NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Step 1: Game Players Table  
```sql
CREATE TABLE IF NOT EXISTS game_players (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    character TEXT, -- meeple selection
    breakdown JSONB DEFAULT '{}', -- score breakdown by category
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (game_id, player_id)
);
```

## Migration Steps

### Step 0: Create Players Table ✅
- Created `players` table with UUID primary keys 
- Updated realm creation to insert player names as individual UUID records
- Modified `saveRealm()` to create player records for new realms

### Step 1: Create Game Players Table ✅
- Created `game_players` table for normalized per-game player data
- Added composite primary key `(game_id, player_id)` 
- Added helper view `game_players_view` for easy data access

### Step 2: Update Game Creation/Completion Logic ✅
- Modified `addGame()` to create `game_players` records when games are created
- Updated game completion to populate `game_players` with actual scores/characters
- Maintained legacy `games.players` JSON for backward compatibility

### Step 3: Comprehensive Data & Component Refactoring ✅
- **Performance Fix**: Replaced N+1 queries with efficient bulk data loading using JOINs
- **Statistics Optimization**: Updated `Statistics.jsx` to use server-side computation with PostgreSQL function
- **PreGameSetup Normalization**: Modified to read from `players` table instead of `realm.players` JSON
- **Player Management**: Added full CRUD operations (`addPlayer`, `removePlayer`) for managing players within realms
- **Backward Compatibility**: Maintains fallback to legacy data formats when normalized data unavailable

## Major Architecture Improvements

### 🚀 Server-Side Statistics Calculation
The Statistics component now uses efficient PostgreSQL aggregation instead of client-side computation:

**Before (Heavy Client Processing):**
```javascript
// Process every game in JavaScript for each player
function calcStats(games, playerName) {
  const playerGames = games.filter(g => g.players.find(p => p.name === playerName));
  // ... heavy computation for wins, losses, streaks, etc.
}
```

**After (Efficient Database Query):**
```sql
-- Single PostgreSQL function calculates all stats server-side
CREATE FUNCTION calculate_player_statistics(realm_id UUID) 
RETURNS TABLE (wins INT, losses INT, win_rate NUMERIC, high_score INT, ...)
```

### 🏎️ Performance: Fixed N+1 Query Problem  
**Before (Inefficient):**
```javascript
// Made separate database call for each game's players
const games = await getGames(); // 1 query
for (const game of games) {
  const players = await getGamePlayersData(game.id); // N queries!
}
```

**After (Efficient Bulk Loading):**
```javascript 
// Single JOIN query loads everything at once
const [games, allGamePlayers] = await Promise.all([
  supabase.from('games').select('*'),                    // 1 query
  supabase.from('game_players_view').select('*')        // 1 query  
]);
// Group by game_id for O(1) lookup
```

### 🎯 Proper Player Management
**Before (JSON Array Manipulation):**
```javascript
// Manually updating JSON arrays
const updatedPlayers = [...realm.players, newPlayerName];
await updateRealm(realmId, { players: updatedPlayers });
```

**After (Normalized Database Operations):**
```javascript
// Proper relational operations with UUIDs
await addPlayerToRealm(realmId, newPlayerName, userId);
// Handles both players table AND legacy realm.players for compatibility
```

## Implementation Details

### New Functions Added

#### Storage Layer (`src/data/storage.js`)
- `createPlayersForRealm(playerNames, realmId)` - Creates player records for a realm
- `getPlayersForRealm(realmId)` - Retrieves all players for a realm  
- `createGamePlayerRecords(gameId, playerNames, realmId)` - Creates initial game player records
- `updateGamePlayerData(gameId, playerName, realmId, playerData)` - Updates player's game data
- `getGamePlayersData(gameId)` - Retrieves normalized player data for a game

#### Hook Layer (`src/hooks/useGameData.js`) 
- Added player management functions to return object
- Updated `addGame()` to create and populate `game_players` records
- Updated `addRealm()` and `updateRealm()` to handle player record creation

### Backward Compatibility

The migration is designed to be completely backward compatible:

1. **Reading**: The `getGames()` function automatically tries to load from `game_players` first, falling back to legacy JSON
2. **Writing**: New games create both normalized records AND legacy JSON
3. **UI**: No changes needed in components - they continue to access `game.players` as before

### Migration Sequence

1. **Deploy Schema**: Run `migrations.sql` to create new tables
2. **Deploy Code**: Deploy updated application code  
3. **Automatic Migration**: New realms/games automatically use normalized structure
4. **Gradual Conversion**: Existing games gradually get normalized as they're accessed
5. **Future Cleanup**: Eventually remove legacy `games.players` column (separate task)

## Running the Migration

### 1. Database Migration
```sql
-- Run the migrations.sql file in your Supabase SQL editor
\i migrations.sql
```

### 2. Code Deployment  
Deploy the updated codebase. The migration happens automatically:
- New realms create player records in `players` table
- New games create records in `game_players` table
- Data reading automatically uses normalized data when available

### 3. Verification
Check that the migration is working:
```sql
-- Verify new tables exist
SELECT COUNT(*) FROM players;
SELECT COUNT(*) FROM game_players;

-- Check that new realms are creating player records
SELECT r.name, COUNT(p.*) as player_count 
FROM realms r 
LEFT JOIN players p ON r.id = p.realm_id 
GROUP BY r.id, r.name;

-- Verify game_players records for recent games
SELECT g.date, COUNT(gp.*) as player_count
FROM games g
LEFT JOIN game_players gp ON g.id = gp.game_id  
WHERE g.inserted_at > NOW() - INTERVAL '1 day'
GROUP BY g.id, g.date;
```

## Notes

- **Performance**: The migration adds one database query per game when loading, but this is offset by better normalization
- **Data Integrity**: All foreign key constraints ensure data consistency
- **Rollback**: If needed, can fall back to legacy format by reverting code changes (data remains intact)
- **Future Features**: This structure enables per-player statistics, achievements, and cross-realm analytics

## Next Steps

After migration is complete and stable:

1. **Data Cleanup**: Remove legacy `games.players` JSON columns
2. **Aggregation**: Implement player statistics using normalized data  
3. **Performance**: Add caching layer for frequently accessed player stats
4. **Features**: Build advanced analytics and achievement system

## Troubleshooting

### Common Issues

1. **Missing Player Records**: If a game fails to create `game_players`, check that the realm has player records in the `players` table
2. **Name Mismatches**: Ensure player names in games exactly match names in the `players` table for that realm
3. **Legacy Data**: Older games will continue using JSON format until the full data migration is implemented

### Debug Queries

```sql
-- Find games without normalized player data
SELECT g.id, g.date, COUNT(gp.player_id) as normalized_players
FROM games g
LEFT JOIN game_players gp ON g.id = gp.game_id
GROUP BY g.id, g.date
HAVING COUNT(gp.player_id) = 0
ORDER BY g.inserted_at DESC;

-- Compare legacy vs normalized player counts  
SELECT 
    g.id,
    jsonb_array_length(g.players::jsonb) as legacy_count,
    COUNT(gp.player_id) as normalized_count
FROM games g
LEFT JOIN game_players gp ON g.id = gp.game_id  
GROUP BY g.id, g.players
HAVING jsonb_array_length(g.players::jsonb) != COUNT(gp.player_id);
```