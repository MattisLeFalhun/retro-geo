# Retro-Geo: Sprint Retrospective Game

A GeoGuessr-themed game for sprint retrospectives where team members share and guess feelings about sprint events.

## Team Members (Fixed List)
- Mattis
- Robin
- Joanna
- Coline
- David
- Guillaume
- Nabil
- Rabie
- Stéphane
- Solène

## Tech Stack
- **Hosting**: Render.com (free tier)
- **Database**: Supabase
- **Session**: Cookie or session storage for username persistence

## Game Flow

### Phase 1: Event Collection

1. **User Selection**
   - User arrives at the app
   - User selects their username from the predefined list
   - Username is stored in session/cookie for the duration of the session

2. **Event Input**
   - User inputs text describing an event from the sprint
   - Below the input, a 2D grid (square matrix) is displayed with:
     - X-axis: Negative ←→ Positive
     - Y-axis: Expected ←→ Surprising
   - User clicks on the grid to position their feeling about the event
   - User validates and submits the event
   - User can repeat to add more events (minimum 1 required)
   - Events are stored with:
     - Event text
     - Author name
     - X position (negative/positive scale)
     - Y position (expected/surprising scale)

### Phase 2: Guessing Game (Admin-triggered)

1. **Admin starts Phase 2**
   - Admin authenticates with a password
   - Admin triggers the start of Phase 2

2. **Event Display & Guessing**
   - App randomly selects one event
   - Displays the event text and author name
   - Shows an empty 2D grid (same axes as before)
   - All players see the same screen
   - Each player clicks on the grid to guess how the author felt about the event
   - Players submit their guesses

3. **Reveal & Discussion**
   - Admin reveals all guesses on the grid
   - Each point shows the name of who guessed it
   - The original author's position is revealed
   - Closest guess(es) identified (potential scoring system)
   - Author discusses the event and their feelings
   - Admin proceeds to next random event
   - Repeat until all events are processed

## Data Model

### Events Table
- id (primary key)
- text (event description)
- author (username from fixed list)
- position_x (float: -1 to 1, negative to positive)
- position_y (float: -1 to 1, expected to surprising)
- created_at (timestamp)

### Guesses Table
- id (primary key)
- event_id (foreign key to events)
- guesser (username from fixed list)
- position_x (float: -1 to 1)
- position_y (float: -1 to 1)
- created_at (timestamp)

### Game State Table
- id (primary key)
- phase (1 or 2)
- current_event_id (nullable, foreign key to events)
- revealed (boolean, whether guesses are revealed)

## Admin Features
- Password-protected admin actions
- Start Phase 2
- Reveal guesses for current event
- Move to next event
- Reset game (optional)

## UI Components

### 2D Grid Component
- Square matrix visualization
- X-axis label: "Negative" (left) ←→ "Positive" (right)
- Y-axis label: "Expected" (bottom) ←→ "Surprising" (top)
- Clickable to place a point
- Can display multiple named points in reveal mode

### Screens
1. **Username Selection**: Dropdown/buttons with team member names
2. **Event Input**: Text area + grid + submit button
3. **Waiting Screen**: Shown after submitting events, waiting for Phase 2
4. **Guessing Screen**: Event display + author + grid for guessing
5. **Reveal Screen**: Grid with all guesses + original position + closest calculation
6. **Admin Panel**: Phase control, reveal, next event buttons
