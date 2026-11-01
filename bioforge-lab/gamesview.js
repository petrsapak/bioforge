'use strict';
// The Load game screen, opened from the main menu: a card for every game with something saved, the one played last
// first, showing the creature left in the Lab, how far the levels got and when it was played; a click plays it, ✕
// deletes it (browser only). The game list itself is in savegame.js.

// wires the screen's ✕ and the click beside it
function setUpGamesScreen() {
  byId('games-close').onclick = () => closeGamesScreen();
  byId('games-sheet').onclick = event => {
    if (event.target === byId('games-sheet')) closeGamesScreen();   // a click beside the screen
  };
}

const isGamesScreenOpen = () => byId('games-sheet').style.display === 'flex';

// shows the screen with a card per saved game
function openGamesScreen(app) {
  byId('games-sheet').style.display = 'flex';
  playSound(app, 'open');
  showGameCards(app);
}

// hides the screen, back to the main menu under it
function closeGamesScreen() {
  byId('games-sheet').style.display = 'none';
}

// one game's saved values, read straight from storage, since only the current game's are behind readStorage
function readGameValue(game, name) {
  return readSharedStorage(gameKey(game.id, name), null);
}

// fills the screen: the games with something saved, the one played last first; a note when there are none
function showGameCards(app) {
  const games = readGames();
  const box = byId('games-cards');
  box.innerHTML = '';
  const saved = gamesByLastPlayed(games).filter(game => !isUnplayedGame(readGameValue(game, 'continue'),
    readGameValue(game, 'level-results'), readGameValue(game, 'library')));
  if (!saved.length) box.innerHTML = '<div class="library-empty">No saved games yet. New game starts one.</div>';
  for (const game of saved) box.appendChild(makeGameCard(app, game, game.id === games.current));
}

// One card: the creature left in the Lab, the game's number, how far its levels got, where it was left, its
// creatures and when it was played, with ✕ to delete it. The current game is marked.
function makeGameCard(app, game, isCurrent) {
  const summary = gameSummary(readGameValue(game, 'continue'), readGameValue(game, 'level-results'),
    readGameValue(game, 'library'));
  const element = document.createElement('div');
  element.className = 'library-card game-card' + (isCurrent ? ' selected' : '');
  element.title = `Play ${gameName(game)} from where it was left`;
  const thumbnail = document.createElement('canvas');
  thumbnail.width = THUMBNAIL_WIDTH;
  thumbnail.height = THUMBNAIL_HEIGHT;
  if (summary.design) drawThumbnail(thumbnail, summary.design);
  element.appendChild(thumbnail);
  element.appendChild(cardLine('card-name', gameName(game) + (isCurrent ? ' · last played' : '')));
  element.appendChild(cardLine('card-size', levelProgressText(summary)));
  element.appendChild(cardLine('card-about', [summary.leftIn ? `Left in ${summary.leftIn}` : 'Left in the Lab',
    `${summary.creatures} creature${summary.creatures === 1 ? '' : 's'}`, playedText(game)].join(' · ')));
  const buttons = document.createElement('div');
  buttons.className = 'card-buttons';
  buttons.appendChild(makeCardButton('✕', 'Delete', () => deleteGameAsked(app, game)));
  element.appendChild(buttons);
  element.onclick = () => loadGame(app, game);
  return element;
}

// a line of text on a card
function cardLine(className, text) {
  const line = document.createElement('div');
  line.className = className;
  line.textContent = text;
  return line;
}

// how far a game's levels got, in a line
function levelProgressText(summary) {
  if (!summary.levelsWon) return 'Chapter 1 · no levels won yet';
  const won = `${summary.levelsWon} level${summary.levelsWon === 1 ? '' : 's'} won · ${summary.stars} ★`;
  return summary.chapter ? `Chapter ${summary.chapter} · ${won}` : `All ${won}`;
}

// when a game was played last, in the player's own date format
function playedText(game) {
  if (!game.playedAt) return 'played before games were dated';
  return 'played ' + new Date(game.playedAt).toLocaleString(undefined,
    { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Plays a game from where it was left: the current one at once (unless a Sandbox changed the Lab), another after the
// page loads again into it
function loadGame(app, game) {
  leaveTitle(app, () => {
    closeGamesScreen();
    if (game.id === readGames().current && !app.progress.isSandboxSession) {
      enterCurrentGame(app);
      return;
    }
    restartIntoGame(app, switchGame(readGames(), game.id, Date.now()), 'continue', !app.progress.isSandboxSession);
  });
}

// asks first; the game's creatures, level results and saved place go with it. Deleting the current game loads the
// page again, at the main menu, into the game played before it.
function deleteGameAsked(app, game) {
  askToConfirm({
    title: `Delete ${gameName(game)}?`,
    text: 'Its creatures, level results and saved place go for good.',
    confirmLabel: 'Delete',
    isDangerous: true,
  }, () => {
    for (const name of GAME_KEYS) writeSharedStorage(gameKey(game.id, name), null);
    const games = readGames();
    const remaining = removeGame(games, game.id);
    if (game.id === games.current) {
      restartIntoGame(app, remaining, null, false);
      return;
    }
    writeSharedStorage('games', remaining);
    showGameCards(app);
  });
}
