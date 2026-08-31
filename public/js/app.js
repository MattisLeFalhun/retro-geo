// Retro-Geo Main Application

const TEAM_MEMBERS = [
    'Mattis', 'Robin', 'Joanna', 'Coline', 'David',
    'Guillaume', 'Nabil', 'Rabie', 'Stéphane', 'Solène'
];

// Application State
const state = {
    currentUser: null,
    gameState: null,
    currentEvent: null,
    adminToken: null,
    inputGrid: null,
    guessGrid: null,
    revealGrid: null,
    hasGuessed: false,
    guessChannel: null,
    votesChannel: null,
    lastResetAt: null,
    userVotes: {}  // { eventId: voteCount }
};

// ========== View Management ==========

function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========== Username Selection ==========

function initUsernameSelection() {
    const container = document.getElementById('username-buttons');
    container.innerHTML = '';

    TEAM_MEMBERS.forEach(name => {
        const button = document.createElement('button');
        button.className = 'username-btn';
        button.textContent = name;
        button.onclick = () => selectUsername(name);
        container.appendChild(button);
    });
}

function selectUsername(username) {
    state.currentUser = username;
    localStorage.setItem('retrogeo_user', username);
    updateCurrentUserDisplay();
    showNotification(`Welcome, ${username}!`, 'success');
    navigateBasedOnGameState();
}

function changeUsername() {
    state.currentUser = null;
    localStorage.removeItem('retrogeo_user');
    updateCurrentUserDisplay();
    showView('view-username');
}

function updateCurrentUserDisplay() {
    const display = document.getElementById('current-user-display');
    if (state.currentUser) {
        display.innerHTML = `${state.currentUser} <button class="btn-change-user" onclick="changeUsername()">Change</button>`;
    } else {
        display.innerHTML = '';
    }
}

// ========== Navigation Based on Game State ==========

async function navigateBasedOnGameState() {
    const gameState = await getGameState();
    state.gameState = gameState;

    if (gameState.phase === 1) {
        showView('view-input');
        initInputView();
    } else if (gameState.phase === 2) {
        if (gameState.current_event_id) {
            if (gameState.revealed) {
                await showRevealView();
            } else {
                await showGuessView();
            }
        } else {
            showView('view-gameover');
            await showFinalScoreboard();
        }
    } else if (gameState.phase === 3) {
        if (gameState.voting_revealed) {
            await showVotingResultsView();
        } else {
            await showVotingView();
        }
    }
}

// ========== Event Input View ==========

async function initInputView() {
    // Initialize grid
    if (!state.inputGrid) {
        state.inputGrid = new Grid('input-grid', {
            size: 350,
            onSelect: (point) => {
                updateSubmitButton();
            }
        });
    }

    // Load existing events by this user
    await loadUserEvents();

    // Clear any previous input
    document.getElementById('event-text').value = '';
    state.inputGrid.clearSelection();
    updateSubmitButton();
}

async function loadUserEvents() {
    const events = await getEventsByAuthor(state.currentUser);
    const container = document.getElementById('user-events-list');

    if (events.length === 0) {
        container.innerHTML = '<p class="no-events">No events submitted yet</p>';
    } else {
        container.innerHTML = events.map(event => `
            <div class="event-card">
                <div class="event-card-header">
                    <p class="event-text">${escapeHtml(event.text)}</p>
                    <button class="btn-delete-event" onclick="deleteUserEvent('${event.id}')" title="Delete event">&times;</button>
                </div>
                <small class="event-position">
                    Position: (${event.position_x.toFixed(2)}, ${event.position_y.toFixed(2)})
                </small>
            </div>
        `).join('');
    }
}

async function deleteUserEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) {
        return;
    }

    try {
        await deleteEvent(eventId);
        showNotification('Event deleted!', 'success');
        await loadUserEvents();
    } catch (error) {
        console.error('Error deleting event:', error);
        showNotification('Error deleting event', 'error');
    }
}

function updateSubmitButton() {
    const text = document.getElementById('event-text').value.trim();
    const hasSelection = state.inputGrid && state.inputGrid.getSelection();
    const button = document.getElementById('submit-event-btn');
    button.disabled = !text || !hasSelection;
}

async function submitEvent() {
    const text = document.getElementById('event-text').value.trim();
    const position = state.inputGrid.getSelection();

    if (!text || !position) {
        showNotification('Please enter an event and select a position', 'error');
        return;
    }

    try {
        await createEvent(text, state.currentUser, position.x, position.y);
        showNotification('Event submitted!', 'success');

        // Reset form
        document.getElementById('event-text').value = '';
        state.inputGrid.clearSelection();
        updateSubmitButton();

        // Reload events list
        await loadUserEvents();
    } catch (error) {
        console.error('Error submitting event:', error);
        showNotification('Error submitting event', 'error');
    }
}

// ========== Guess View ==========

async function updateRoundIndicator() {
    const allEvents = await getAllEvents();
    const totalRounds = allEvents.length;
    const currentRound = state.gameState.processed_events?.length || 1;

    const text = `Round ${currentRound}/${totalRounds}`;

    const guessIndicator = document.getElementById('guess-round-indicator');
    const revealIndicator = document.getElementById('reveal-round-indicator');

    if (guessIndicator) guessIndicator.textContent = text;
    if (revealIndicator) revealIndicator.textContent = text;
}

async function showGuessView() {
    showView('view-guess');

    // Load current event
    state.currentEvent = await getEventById(state.gameState.current_event_id);

    // Update round indicator
    await updateRoundIndicator();

    // Display event info
    document.getElementById('guess-event-text').textContent = state.currentEvent.text;
    document.getElementById('guess-event-author').textContent = state.currentEvent.author;

    // Check if user already guessed
    state.hasGuessed = await hasUserGuessed(state.currentEvent.id, state.currentUser);

    // Initialize grid
    if (!state.guessGrid) {
        state.guessGrid = new Grid('guess-grid', {
            size: 350,
            onSelect: (point) => {
                updateGuessSubmitButton();
            }
        });
    } else {
        state.guessGrid.clearSelection();
        state.guessGrid.clearPoints();
    }

    // Check if current user is the author
    const isAuthor = state.currentUser === state.currentEvent.author;

    if (isAuthor) {
        document.getElementById('guess-status').innerHTML =
            '<p class="author-notice">You wrote this event! Waiting for others to guess...</p>';
        document.getElementById('submit-guess-btn').style.display = 'none';
        state.guessGrid.disable();
    } else if (state.hasGuessed) {
        document.getElementById('guess-status').innerHTML =
            '<p class="waiting-notice">You have guessed! Waiting for reveal...</p>';
        document.getElementById('submit-guess-btn').style.display = 'none';
        state.guessGrid.disable();
    } else {
        document.getElementById('guess-status').innerHTML = '';
        document.getElementById('submit-guess-btn').style.display = 'block';
        state.guessGrid.enable();
    }

    // Subscribe to guesses for live updates
    subscribeToCurrentEventGuesses();

    // Load who has guessed
    await updateGuessersDisplay();
}

async function updateGuessersDisplay() {
    const guesses = await getGuessesForEvent(state.currentEvent.id);
    const guessers = guesses.map(g => g.guesser);
    const display = document.getElementById('guessers-display');

    if (guessers.length === 0) {
        display.innerHTML = '<p>No guesses yet...</p>';
    } else {
        display.innerHTML = `<p>Guessed: ${guessers.join(', ')}</p>`;
    }
}

function subscribeToCurrentEventGuesses() {
    // Unsubscribe from previous
    if (state.guessChannel) {
        state.guessChannel.unsubscribe();
    }

    state.guessChannel = subscribeToGuesses(state.currentEvent.id, (newGuess) => {
        updateGuessersDisplay();
    });
}

function updateGuessSubmitButton() {
    const hasSelection = state.guessGrid && state.guessGrid.getSelection();
    const button = document.getElementById('submit-guess-btn');
    button.disabled = !hasSelection;
}

async function submitGuess() {
    const position = state.guessGrid.getSelection();

    if (!position) {
        showNotification('Please select a position', 'error');
        return;
    }

    try {
        await createGuess(state.currentEvent.id, state.currentUser, position.x, position.y);
        showNotification('Guess submitted!', 'success');

        state.hasGuessed = true;
        document.getElementById('guess-status').innerHTML =
            '<p class="waiting-notice">You have guessed! Waiting for reveal...</p>';
        document.getElementById('submit-guess-btn').style.display = 'none';
        state.guessGrid.disable();
    } catch (error) {
        console.error('Error submitting guess:', error);
        showNotification('Error submitting guess', 'error');
    }
}

// ========== Reveal View ==========

async function showRevealView() {
    showView('view-reveal');

    // Ensure we have current event
    if (!state.currentEvent || state.currentEvent.id !== state.gameState.current_event_id) {
        state.currentEvent = await getEventById(state.gameState.current_event_id);
    }

    // Update round indicator
    await updateRoundIndicator();

    // Display event info
    document.getElementById('reveal-event-text').textContent = state.currentEvent.text;
    document.getElementById('reveal-event-author').textContent = state.currentEvent.author;
    document.getElementById('discussion-author').textContent = state.currentEvent.author;

    // Initialize reveal grid
    if (!state.revealGrid) {
        state.revealGrid = new Grid('reveal-grid', {
            size: 400,
            interactive: false
        });
    }

    // Get all guesses and display
    const guesses = await getGuessesForEvent(state.currentEvent.id);

    // Prepare points array
    const points = guesses.map(g => ({
        name: g.guesser,
        x: g.position_x,
        y: g.position_y,
        isOriginal: false
    }));

    // Add original author position
    points.push({
        name: `${state.currentEvent.author} (Original)`,
        x: state.currentEvent.position_x,
        y: state.currentEvent.position_y,
        isOriginal: true
    });

    state.revealGrid.setPoints(points);

    // Calculate and display rankings
    displayRankings(guesses, state.currentEvent);
}

function displayRankings(guesses, event) {
    const rankings = rankGuesses(guesses, event);
    const container = document.getElementById('rankings-list');

    if (rankings.length === 0) {
        container.innerHTML = '<p>No guesses were made</p>';
        return;
    }

    container.innerHTML = rankings.map((guess, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        const score = ((1 - guess.distance / 2.83) * 100).toFixed(0);
        return `
            <div class="ranking-item ${index === 0 ? 'winner' : ''}">
                <span class="rank">${medal} #${index + 1}</span>
                <span class="name">${guess.guesser}</span>
                <span class="score">${score}% accuracy</span>
            </div>
        `;
    }).join('');
}

// ========== Final Scoreboard ==========

async function showFinalScoreboard() {
    const container = document.getElementById('final-scores-list');

    try {
        // Get all events and guesses
        const allEvents = await getAllEvents();
        const allGuesses = await getAllGuesses();

        if (allGuesses.length === 0) {
            container.innerHTML = '<p>No guesses were recorded.</p>';
            return;
        }

        // Create a map of event id to event data
        const eventsMap = {};
        allEvents.forEach(event => {
            eventsMap[event.id] = event;
        });

        // Calculate scores per player
        const playerScores = {};

        allGuesses.forEach(guess => {
            const event = eventsMap[guess.event_id];
            if (!event) return;

            // Calculate distance and convert to score percentage
            const distance = calculateDistance(guess, event);
            const score = (1 - distance / 2.83) * 100;

            if (!playerScores[guess.guesser]) {
                playerScores[guess.guesser] = {
                    name: guess.guesser,
                    totalScore: 0,
                    rounds: 0
                };
            }

            playerScores[guess.guesser].totalScore += score;
            playerScores[guess.guesser].rounds += 1;
        });

        // Calculate averages and sort
        const sortedPlayers = Object.values(playerScores)
            .map(player => ({
                name: player.name,
                avgScore: player.totalScore / player.rounds,
                rounds: player.rounds
            }))
            .sort((a, b) => b.avgScore - a.avgScore);

        // Render scoreboard
        container.innerHTML = sortedPlayers.map((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            return `
                <div class="final-score-item ${index === 0 ? 'winner' : ''}">
                    <span class="rank">${medal} #${index + 1}</span>
                    <span class="name">${player.name}</span>
                    <span class="score">${player.avgScore.toFixed(1)}% avg</span>
                    <span class="rounds">(${player.rounds} rounds)</span>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading scoreboard:', error);
        container.innerHTML = '<p>Error loading scores.</p>';
    }
}

// ========== Voting View (Phase 3) ==========

async function showVotingView() {
    showView('view-voting');

    // Load user's existing votes
    const userVotes = await getVotesByVoter(state.currentUser);
    state.userVotes = {};
    userVotes.forEach(vote => {
        state.userVotes[vote.event_id] = vote.vote_count;
    });

    // Load all events
    const events = await getAllEvents();

    // Render events list
    renderVotingEvents(events);

    // Update votes remaining display
    updateVotesRemaining();

    // Update voters display
    await updateVotersDisplay();

    // Subscribe to votes for real-time updates
    subscribeToVotesUpdates();
}

function renderVotingEvents(events) {
    const container = document.getElementById('voting-events-list');

    container.innerHTML = events.map(event => {
        const currentVotes = state.userVotes[event.id] || 0;
        return `
            <div class="voting-event-card" data-event-id="${event.id}">
                <div class="voting-event-content">
                    <p class="voting-event-text">${escapeHtml(event.text)}</p>
                    <small class="voting-event-author">by ${event.author}</small>
                </div>
                <div class="voting-controls">
                    <button class="vote-btn vote-minus" onclick="adjustVote('${event.id}', -1)" ${currentVotes === 0 ? 'disabled' : ''}>-</button>
                    <span class="vote-count" id="vote-count-${event.id}">${currentVotes}</span>
                    <button class="vote-btn vote-plus" onclick="adjustVote('${event.id}', 1)">+</button>
                </div>
            </div>
        `;
    }).join('');
}

async function adjustVote(eventId, delta) {
    const currentVotes = state.userVotes[eventId] || 0;
    const totalUsedVotes = Object.values(state.userVotes).reduce((a, b) => a + b, 0);

    const newVotes = currentVotes + delta;

    // Validation
    if (newVotes < 0) return;
    if (newVotes > 3) {
        showNotification('Maximum 3 votes per event', 'error');
        return;
    }
    if (delta > 0 && totalUsedVotes >= 3) {
        showNotification('You have used all 3 votes', 'error');
        return;
    }

    try {
        if (newVotes === 0) {
            await removeVote(eventId, state.currentUser);
            delete state.userVotes[eventId];
        } else {
            await submitVote(eventId, state.currentUser, newVotes);
            state.userVotes[eventId] = newVotes;
        }

        // Update UI
        document.getElementById(`vote-count-${eventId}`).textContent = newVotes;
        updateVotesRemaining();
        updateVoteButtons(eventId, newVotes);

    } catch (error) {
        console.error('Error adjusting vote:', error);
        showNotification('Error updating vote', 'error');
    }
}

function updateVotesRemaining() {
    const totalUsed = Object.values(state.userVotes).reduce((a, b) => a + b, 0);
    const remaining = 3 - totalUsed;
    document.getElementById('votes-remaining').textContent = remaining;

    // Disable all plus buttons if no votes remaining
    document.querySelectorAll('.vote-plus').forEach(btn => {
        const eventId = btn.closest('.voting-event-card').dataset.eventId;
        const currentVotes = state.userVotes[eventId] || 0;
        btn.disabled = remaining === 0 || currentVotes >= 3;
    });
}

function updateVoteButtons(eventId, voteCount) {
    const card = document.querySelector(`[data-event-id="${eventId}"]`);
    if (!card) return;

    const minusBtn = card.querySelector('.vote-minus');
    minusBtn.disabled = voteCount === 0;
}

async function updateVotersDisplay() {
    const voters = await getVotersWhoHaveVoted();
    const display = document.getElementById('voters-list');

    if (voters.length === 0) {
        display.textContent = 'No votes yet...';
    } else {
        display.textContent = voters.join(', ');
    }
}

function subscribeToVotesUpdates() {
    if (state.votesChannel) {
        state.votesChannel.unsubscribe();
    }

    state.votesChannel = subscribeToVotes(() => {
        updateVotersDisplay();
    });
}

// ========== Voting Results View (Phase 3.5) ==========

async function showVotingResultsView() {
    showView('view-voting-results');

    const eventsWithVotes = await getVoteTotalsPerEvent();
    renderVotingResults(eventsWithVotes);
}

function renderVotingResults(events) {
    const container = document.getElementById('voting-results-list');

    container.innerHTML = events.map((event, index) => {
        const rank = index + 1;
        const medalClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

        return `
            <div class="voting-result-item ${medalClass}">
                <div class="result-rank">
                    <span class="medal">${medal}</span>
                    <span class="rank-number">#${rank}</span>
                </div>
                <div class="result-content">
                    <p class="result-text">${escapeHtml(event.text)}</p>
                    <small class="result-author">by ${event.author}</small>
                </div>
                <div class="result-votes">
                    <span class="vote-total">${event.totalVotes}</span>
                    <span class="vote-label">votes</span>
                </div>
            </div>
        `;
    }).join('');
}

// ========== Admin Panel ==========

function toggleAdminPanel() {
    const panel = document.getElementById('admin-panel');
    panel.classList.toggle('active');
}

async function adminLogin() {
    const password = document.getElementById('admin-password').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok) {
            state.adminToken = data.token;
            localStorage.setItem('retrogeo_admin', data.token);
            showNotification('Admin logged in!', 'success');
            document.getElementById('admin-login-section').style.display = 'none';
            document.getElementById('admin-controls').style.display = 'block';
            updateAdminButtons();
        } else {
            showNotification('Invalid password', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed', 'error');
    }
}

function updateAdminButtons() {
    const phase = state.gameState?.phase || 1;
    const revealed = state.gameState?.revealed || false;
    const votingRevealed = state.gameState?.voting_revealed || false;
    const hasCurrentEvent = !!state.gameState?.current_event_id;

    document.getElementById('btn-start-phase2').style.display = phase === 1 ? 'block' : 'none';
    document.getElementById('btn-reveal').style.display = phase === 2 && !revealed && hasCurrentEvent ? 'block' : 'none';
    document.getElementById('btn-next-event').style.display = phase === 2 && revealed ? 'block' : 'none';

    // Phase 3 buttons
    const isGameOver = phase === 2 && !hasCurrentEvent;
    document.getElementById('btn-start-phase3').style.display = isGameOver ? 'block' : 'none';
    document.getElementById('btn-reveal-voting').style.display = phase === 3 && !votingRevealed ? 'block' : 'none';

    document.getElementById('btn-reset').style.display = 'block';
}

async function adminStartPhase2() {
    try {
        const gameState = await startPhase2();
        state.gameState = gameState;
        showNotification('Phase 2 started!', 'success');
        updateAdminButtons();
    } catch (error) {
        console.error('Error starting phase 2:', error);
        showNotification(error.message || 'Error starting phase 2', 'error');
    }
}

async function adminReveal() {
    try {
        const gameState = await revealGuesses();
        state.gameState = gameState;
        showNotification('Guesses revealed!', 'success');
        updateAdminButtons();
    } catch (error) {
        console.error('Error revealing:', error);
        showNotification('Error revealing guesses', 'error');
    }
}

async function adminNextEvent() {
    try {
        const gameState = await nextEvent();
        state.gameState = gameState;
        showNotification('Moving to next event!', 'success');
        updateAdminButtons();
    } catch (error) {
        console.error('Error moving to next event:', error);
        showNotification('Error moving to next event', 'error');
    }
}

async function adminReset() {
    if (!confirm('Are you sure you want to reset the game? All events, guesses, and votes will be deleted.')) {
        return;
    }

    try {
        const gameState = await resetGame();
        state.gameState = gameState;
        showNotification('Game reset!', 'success');
        updateAdminButtons();
    } catch (error) {
        console.error('Error resetting:', error);
        showNotification('Error resetting game', 'error');
    }
}

async function adminStartPhase3() {
    try {
        const gameState = await startPhase3();
        state.gameState = gameState;
        showNotification('Voting phase started!', 'success');
        updateAdminButtons();
    } catch (error) {
        console.error('Error starting phase 3:', error);
        showNotification('Error starting voting phase', 'error');
    }
}

async function adminRevealVoting() {
    try {
        const gameState = await revealVotingResults();
        state.gameState = gameState;
        showNotification('Voting results revealed!', 'success');
        updateAdminButtons();
    } catch (error) {
        console.error('Error revealing voting results:', error);
        showNotification('Error revealing results', 'error');
    }
}

// ========== Real-time Updates ==========

function setupRealtimeSubscriptions() {
    subscribeToGameState(async (newState) => {
        const previousState = state.gameState;
        state.gameState = newState;

        // Check for game reset (reset_at changed)
        if (state.lastResetAt && newState.reset_at && state.lastResetAt !== newState.reset_at) {
            showNotification('Game has been reset!', 'info');
            // Clear user session
            state.currentUser = null;
            localStorage.removeItem('retrogeo_user');
            state.lastResetAt = newState.reset_at;
            state.userVotes = {};  // Clear user votes
            updateCurrentUserDisplay();
            showView('view-username');
            updateAdminButtons();
            return;
        }

        // Update lastResetAt
        state.lastResetAt = newState.reset_at;

        // Check for phase change
        if (previousState?.phase !== newState.phase) {
            if (newState.phase === 2) {
                showNotification('Phase 2 has started!', 'info');
            } else if (newState.phase === 3) {
                showNotification('Voting phase has started!', 'info');
            }
        }

        // Check for voting reveal
        if (previousState?.voting_revealed !== newState.voting_revealed && newState.voting_revealed) {
            showNotification('Voting results are in!', 'info');
        }

        // Check for event change
        if (previousState?.current_event_id !== newState.current_event_id) {
            if (newState.current_event_id) {
                state.hasGuessed = false;
            }
        }

        // Navigate based on new state
        if (state.currentUser) {
            await navigateBasedOnGameState();
        }
        updateAdminButtons();
    });
}

// ========== Utility Functions ==========

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== Initialization ==========

async function init() {
    try {
        // Initialize Supabase
        await initSupabase();

        // Initialize username buttons
        initUsernameSelection();

        // Check for saved user
        const savedUser = localStorage.getItem('retrogeo_user');
        if (savedUser && TEAM_MEMBERS.includes(savedUser)) {
            state.currentUser = savedUser;
        }

        // Update current user display
        updateCurrentUserDisplay();

        // Check for saved admin token
        const savedAdmin = localStorage.getItem('retrogeo_admin');
        if (savedAdmin) {
            state.adminToken = savedAdmin;
            document.getElementById('admin-login-section').style.display = 'none';
            document.getElementById('admin-controls').style.display = 'block';
        }

        // Get initial game state
        state.gameState = await getGameState();
        state.lastResetAt = state.gameState.reset_at;
        updateAdminButtons();

        // Setup real-time subscriptions
        setupRealtimeSubscriptions();

        // Navigate to appropriate view
        if (state.currentUser) {
            await navigateBasedOnGameState();
        } else {
            showView('view-username');
        }

        // Event listeners
        document.getElementById('event-text').addEventListener('input', updateSubmitButton);

    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Failed to connect to server', 'error');
    }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
