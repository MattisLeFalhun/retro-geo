# Retro-Geo

A GeoGuessr-themed game for sprint retrospectives where team members share and guess feelings about sprint events.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- A [Supabase](https://supabase.com/) account (free tier works)

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a new project on [Supabase](https://supabase.com/)
2. In the SQL Editor, create the required tables:

```sql
-- Events table
CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text TEXT NOT NULL,
    author TEXT NOT NULL,
    position_x FLOAT NOT NULL,
    position_y FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guesses table
CREATE TABLE guesses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    guesser TEXT NOT NULL,
    position_x FLOAT NOT NULL,
    position_y FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game state table
CREATE TABLE game_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phase INT DEFAULT 1,
    current_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    revealed BOOLEAN DEFAULT FALSE,
    voting_revealed BOOLEAN DEFAULT FALSE
);

-- Insert initial game state
INSERT INTO game_state (phase, revealed, voting_revealed) VALUES (1, FALSE, FALSE);

-- Votes table (for Phase 3)
CREATE TABLE votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    voter TEXT NOT NULL,
    vote_count INTEGER NOT NULL DEFAULT 1 CHECK (vote_count >= 1 AND vote_count <= 3),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, voter)
);

CREATE INDEX idx_votes_event_id ON votes(event_id);

-- Enable RLS and policies for votes
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes are viewable by everyone" ON votes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert votes" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update votes" ON votes FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete votes" ON votes FOR DELETE USING (true);

-- If upgrading an existing database, run this migration:
-- ALTER TABLE game_state ADD COLUMN IF NOT EXISTS voting_revealed BOOLEAN DEFAULT FALSE;
-- ALTER TABLE game_state DROP CONSTRAINT IF EXISTS game_state_phase_check;
-- ALTER TABLE game_state ADD CONSTRAINT game_state_phase_check CHECK (phase IN (1, 2, 3));
```

3. Go to **Project Settings > API** to find your credentials

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
ADMIN_PASSWORD=your_admin_password
PORT=3000
```

### 4. Run the application

```bash
npm start
```

Or for development:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Project Structure

```
retro-geo/
├── server.js           # Express server
├── public/
│   ├── index.html      # Main HTML page
│   ├── css/
│   │   └── style.css   # Styles
│   └── js/
│       ├── app.js      # Main application logic
│       ├── grid.js     # 2D grid component
│       └── supabase.js # Supabase client setup
├── package.json
├── .env                # Environment variables (create this)
└── CLAUDE.md           # Project documentation
```

## Team Members

The game uses a fixed list of team members:
- Mattis, Robin, Joanna, Coline, David, Guillaume, Nabil, Rabie, Stéphane, Solène

## Game Flow

1. **Phase 1 - Event Collection**: Team members submit events from the sprint and position them on a 2D grid (Negative↔Positive, Expected↔Surprising)
2. **Phase 2 - Guessing**: Admin starts the guessing phase. For each event, players guess how the author felt, then positions are revealed for discussion.
3. **Phase 3 - Voting**: After all events are processed, admin starts voting. Each player distributes 3 votes across events they want to discuss further. Admin then reveals results with top 3 highlighted.

## Admin Access

To access admin features, use the admin password configured in your `.env` file.
