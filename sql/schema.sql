-- Retro-Geo Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events table: stores sprint events submitted by team members
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text TEXT NOT NULL,
    author TEXT NOT NULL,
    position_x REAL NOT NULL CHECK (position_x >= -1 AND position_x <= 1),
    position_y REAL NOT NULL CHECK (position_y >= -1 AND position_y <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guesses table: stores guesses made during phase 2
CREATE TABLE guesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guesser TEXT NOT NULL,
    position_x REAL NOT NULL CHECK (position_x >= -1 AND position_x <= 1),
    position_y REAL NOT NULL CHECK (position_y >= -1 AND position_y <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, guesser)
);

-- Game state table: singleton table to track game state
CREATE TABLE game_state (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    phase INTEGER NOT NULL DEFAULT 1 CHECK (phase IN (1, 2)),
    current_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    revealed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_events UUID[] DEFAULT '{}'::UUID[],
    reset_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial game state
INSERT INTO game_state (id, phase, revealed, processed_events, reset_at)
VALUES (1, 1, FALSE, '{}', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX idx_events_author ON events(author);
CREATE INDEX idx_guesses_event_id ON guesses(event_id);
CREATE INDEX idx_guesses_guesser ON guesses(guesser);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
-- Anyone can read events
CREATE POLICY "Events are viewable by everyone" ON events
    FOR SELECT USING (true);

-- Anyone can insert events (during phase 1)
CREATE POLICY "Anyone can insert events" ON events
    FOR INSERT WITH CHECK (true);

-- Anyone can delete events (during phase 1)
CREATE POLICY "Anyone can delete events" ON events
    FOR DELETE USING (true);

-- RLS Policies for guesses
-- Anyone can read guesses
CREATE POLICY "Guesses are viewable by everyone" ON guesses
    FOR SELECT USING (true);

-- Anyone can insert guesses
CREATE POLICY "Anyone can insert guesses" ON guesses
    FOR INSERT WITH CHECK (true);

-- RLS Policies for game_state
-- Anyone can read game state
CREATE POLICY "Game state is viewable by everyone" ON game_state
    FOR SELECT USING (true);

-- Anyone can update game state (admin auth handled at API level)
CREATE POLICY "Anyone can update game state" ON game_state
    FOR UPDATE USING (true);

-- Enable Realtime for these tables
-- Run these in Supabase Dashboard > Database > Replication
-- Or use the following SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on game_state
CREATE TRIGGER update_game_state_updated_at
    BEFORE UPDATE ON game_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
