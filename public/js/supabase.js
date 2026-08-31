// Supabase client setup for Retro-Geo
// Uses the Supabase JavaScript CDN

let supabaseClient = null;

// Initialize Supabase client
async function initSupabase() {
    // Fetch config from server
    const response = await fetch('/api/config');
    const config = await response.json();

    // Create Supabase client using the global supabase object from CDN
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

    return supabaseClient;
}

// Get the Supabase client
function getSupabase() {
    if (!supabaseClient) {
        throw new Error('Supabase not initialized. Call initSupabase() first.');
    }
    return supabaseClient;
}

// ========== Events API ==========

async function createEvent(text, author, positionX, positionY) {
    const { data, error } = await getSupabase()
        .from('events')
        .insert([{
            text,
            author,
            position_x: positionX,
            position_y: positionY
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function getEventsByAuthor(author) {
    const { data, error } = await getSupabase()
        .from('events')
        .select('*')
        .eq('author', author)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

async function getAllEvents() {
    const { data, error } = await getSupabase()
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

async function getEventById(eventId) {
    const { data, error } = await getSupabase()
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (error) throw error;
    return data;
}

async function deleteEvent(eventId) {
    const { error } = await getSupabase()
        .from('events')
        .delete()
        .eq('id', eventId);

    if (error) throw error;
    return true;
}

// ========== Guesses API ==========

async function createGuess(eventId, guesser, positionX, positionY) {
    const { data, error } = await getSupabase()
        .from('guesses')
        .upsert([{
            event_id: eventId,
            guesser,
            position_x: positionX,
            position_y: positionY
        }], { onConflict: 'event_id,guesser' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function getGuessesForEvent(eventId) {
    const { data, error } = await getSupabase()
        .from('guesses')
        .select('*')
        .eq('event_id', eventId);

    if (error) throw error;
    return data;
}

async function getAllGuesses() {
    const { data, error } = await getSupabase()
        .from('guesses')
        .select('*');

    if (error) throw error;
    return data;
}

async function hasUserGuessed(eventId, guesser) {
    const { data, error } = await getSupabase()
        .from('guesses')
        .select('id')
        .eq('event_id', eventId)
        .eq('guesser', guesser)
        .maybeSingle();

    if (error) throw error;
    return data !== null;
}

// ========== Votes API ==========

async function submitVote(eventId, voter, voteCount) {
    const { data, error } = await getSupabase()
        .from('votes')
        .upsert([{
            event_id: eventId,
            voter,
            vote_count: voteCount
        }], { onConflict: 'event_id,voter' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function removeVote(eventId, voter) {
    const { error } = await getSupabase()
        .from('votes')
        .delete()
        .eq('event_id', eventId)
        .eq('voter', voter);

    if (error) throw error;
    return true;
}

async function getVotesByVoter(voter) {
    const { data, error } = await getSupabase()
        .from('votes')
        .select('*')
        .eq('voter', voter);

    if (error) throw error;
    return data;
}

async function getAllVotes() {
    const { data, error } = await getSupabase()
        .from('votes')
        .select('*');

    if (error) throw error;
    return data;
}

async function getVoteTotalsPerEvent() {
    const events = await getAllEvents();
    const votes = await getAllVotes();

    // Sum votes per event
    const voteTotals = {};
    votes.forEach(vote => {
        if (!voteTotals[vote.event_id]) {
            voteTotals[vote.event_id] = 0;
        }
        voteTotals[vote.event_id] += vote.vote_count;
    });

    // Combine with event data and sort by votes
    return events.map(event => ({
        ...event,
        totalVotes: voteTotals[event.id] || 0
    })).sort((a, b) => b.totalVotes - a.totalVotes);
}

async function getVotersWhoHaveVoted() {
    const { data, error } = await getSupabase()
        .from('votes')
        .select('voter');

    if (error) throw error;

    // Return unique voters
    const uniqueVoters = [...new Set(data.map(v => v.voter))];
    return uniqueVoters;
}

// ========== Game State API ==========

async function getGameState() {
    const { data, error } = await getSupabase()
        .from('game_state')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) throw error;
    return data;
}

async function updateGameState(updates) {
    const { data, error } = await getSupabase()
        .from('game_state')
        .update(updates)
        .eq('id', 1)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function startPhase2() {
    // Get all events and pick a random one
    const events = await getAllEvents();
    if (events.length === 0) {
        throw new Error('No events to process');
    }

    const randomEvent = events[Math.floor(Math.random() * events.length)];

    return await updateGameState({
        phase: 2,
        current_event_id: randomEvent.id,
        revealed: false,
        processed_events: [randomEvent.id]
    });
}

async function revealGuesses() {
    return await updateGameState({
        revealed: true
    });
}

async function nextEvent() {
    const gameState = await getGameState();
    const allEvents = await getAllEvents();

    // Find events not yet processed
    const processedIds = gameState.processed_events || [];
    const remainingEvents = allEvents.filter(e => !processedIds.includes(e.id));

    if (remainingEvents.length === 0) {
        // All events processed, game over
        return await updateGameState({
            current_event_id: null,
            revealed: false
        });
    }

    // Pick a random remaining event
    const nextEventData = remainingEvents[Math.floor(Math.random() * remainingEvents.length)];

    return await updateGameState({
        current_event_id: nextEventData.id,
        revealed: false,
        processed_events: [...processedIds, nextEventData.id]
    });
}

async function startPhase3() {
    return await updateGameState({
        phase: 3,
        current_event_id: null,
        revealed: false,
        voting_revealed: false
    });
}

async function revealVotingResults() {
    return await updateGameState({
        voting_revealed: true
    });
}

async function resetGame() {
    // Delete all votes
    await getSupabase().from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Delete all guesses
    await getSupabase().from('guesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Delete all events
    await getSupabase().from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Reset game state with new reset_at timestamp
    return await updateGameState({
        phase: 1,
        current_event_id: null,
        revealed: false,
        voting_revealed: false,
        processed_events: [],
        reset_at: new Date().toISOString()
    });
}

// ========== Real-time Subscriptions ==========

function subscribeToGameState(callback) {
    return getSupabase()
        .channel('game_state_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'game_state' },
            payload => callback(payload.new)
        )
        .subscribe();
}

function subscribeToGuesses(eventId, callback) {
    return getSupabase()
        .channel(`guesses_${eventId}`)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'guesses', filter: `event_id=eq.${eventId}` },
            payload => callback(payload.new)
        )
        .subscribe();
}

function subscribeToEvents(callback) {
    return getSupabase()
        .channel('events_changes')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'events' },
            payload => callback(payload.new)
        )
        .subscribe();
}

function subscribeToVotes(callback) {
    return getSupabase()
        .channel('votes_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'votes' },
            payload => callback(payload)
        )
        .subscribe();
}

// ========== Scoring ==========

function calculateDistance(guess, original) {
    const dx = guess.position_x - original.position_x;
    const dy = guess.position_y - original.position_y;
    return Math.sqrt(dx * dx + dy * dy);
}

function rankGuesses(guesses, originalEvent) {
    return guesses
        .map(guess => ({
            ...guess,
            distance: calculateDistance(guess, originalEvent)
        }))
        .sort((a, b) => a.distance - b.distance);
}
