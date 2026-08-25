-- Migration: Add reset_at column and delete policy
-- Run this in Supabase SQL Editor

-- Add reset_at column to game_state
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing row to have reset_at
UPDATE game_state SET reset_at = NOW() WHERE id = 1;

-- Add delete policy for events
CREATE POLICY "Anyone can delete events" ON events
    FOR DELETE USING (true);
