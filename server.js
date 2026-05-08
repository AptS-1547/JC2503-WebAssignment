const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = Number(process.env.PORT) || 8080;
const TURN_TIMEOUT_MS = Number(process.env.TURN_TIMEOUT_MS) || 60 * 1000;
const BOARD_SIZE = 16;

const shapes = ['square', 'circle', 'triangle', 'diamond'];
const colors = ['yellow', 'pink', 'blue', 'green'];
const blocks = shapes.flatMap((shape) => colors.map((color) => ({
  id: `${color}-${shape}`,
  shape,
  color,
  label: `${capitalize(color)} ${capitalize(shape)}`,
})));

const blockMap = new Map(blocks.map((block) => [block.id, block]));

const game = {
  grid: Array(BOARD_SIZE).fill(null),
  pool: blocks.map((block) => block.id),
  players: [],
  currentPlayerIndex: 0,
  currentBlockId: null,
  turnStartedAt: null,
  turnTimer: null,
  lastEvent: 'Enter a display name to join the game.',
  lastClearedCells: [],
  lastClearedCellIndexes: [],
  lastClearedAt: 0,
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index', {
    pageTitle: 'Introduction',
    activePage: 'home',
  });
});

app.get('/about', (req, res) => {
  res.render('about', {
    pageTitle: 'About',
    activePage: 'about',
  });
});

app.get('/game', (req, res) => {
  res.render('game', {
    pageTitle: 'Puzzle Game',
    activePage: 'game',
    extraStylesheet: '/css/game.css',
  });
});

app.get('/report.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'report.html'));
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

io.on('connection', (socket) => {
  socket.emit('gameState', createPublicState());

  socket.on('joinGame', (displayName, respond) => {
    const name = normalizeName(displayName);

    if (!name) {
      sendResponse(respond, {
        ok: false,
        message: 'Enter a display name before joining.',
      });
      return;
    }

    const existingPlayer = findPlayer(socket.id);

    if (isDisplayNameTaken(name, existingPlayer ? existingPlayer.id : null)) {
      sendResponse(respond, {
        ok: false,
        message: 'That display name is already in use.',
      });
      return;
    }

    if (existingPlayer) {
      existingPlayer.name = name;
      game.lastEvent = `${name} updated their name.`;
      sendResponse(respond, { ok: true, playerId: socket.id });
      emitGameState();
      return;
    }

    game.players.push({
      id: socket.id,
      name,
      score: 0,
    });

    game.lastEvent = `${name} joined.`;
    sendResponse(respond, { ok: true, playerId: socket.id });

    if (game.players.length === 1) {
      game.currentPlayerIndex = 0;
      startTurn(`${name} starts the first turn.`);
      return;
    }

    emitGameState();
  });

  socket.on('placeBlock', (cellIndex, respond) => {
    const player = findPlayer(socket.id);
    const currentPlayer = getCurrentPlayer();
    const index = Number(cellIndex);

    if (!player) {
      sendResponse(respond, {
        ok: false,
        message: 'Join the game before placing a block.',
      });
      return;
    }

    if (!currentPlayer || player.id !== currentPlayer.id) {
      sendResponse(respond, {
        ok: false,
        message: 'Wait for your turn before placing a block.',
      });
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) {
      sendResponse(respond, {
        ok: false,
        message: 'Choose a valid board position.',
      });
      return;
    }

    if (game.grid[index]) {
      sendResponse(respond, {
        ok: false,
        message: 'That position is already occupied.',
      });
      return;
    }

    const block = blockMap.get(game.currentBlockId);

    if (!block) {
      sendResponse(respond, {
        ok: false,
        message: 'No block is available for this turn.',
      });
      return;
    }

    placeCurrentBlock(player, block, index);
    sendResponse(respond, { ok: true });
  });

  socket.on('leaveGame', (respond) => {
    const player = findPlayer(socket.id);

    if (!player) {
      sendResponse(respond, {
        ok: false,
        message: 'You are not currently in the game.',
      });
      return;
    }

    removePlayer(socket.id, 'left.');
    sendResponse(respond, { ok: true });
  });

  socket.on('disconnect', () => {
    removePlayer(socket.id, 'disconnected.');
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeName(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ').slice(0, 24);
}

function getDisplayNameKey(name) {
  return normalizeName(name).toLowerCase();
}

function isDisplayNameTaken(name, ignoredPlayerId = null) {
  const nameKey = getDisplayNameKey(name);

  return game.players.some((player) => (
    player.id !== ignoredPlayerId && getDisplayNameKey(player.name) === nameKey
  ));
}

function sendResponse(respond, payload) {
  if (typeof respond === 'function') {
    respond(payload);
  }
}

function findPlayer(playerId) {
  return game.players.find((player) => player.id === playerId);
}

function getCurrentPlayer() {
  if (game.players.length === 0) {
    return null;
  }

  if (game.currentPlayerIndex >= game.players.length) {
    game.currentPlayerIndex = 0;
  }

  return game.players[game.currentPlayerIndex];
}

function createPublicState() {
  const currentPlayer = getCurrentPlayer();

  return {
    grid: game.grid,
    players: game.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      isCurrent: currentPlayer ? player.id === currentPlayer.id : false,
      turnPosition: index + 1,
    })),
    currentPlayerId: currentPlayer ? currentPlayer.id : null,
    currentPlayerName: currentPlayer ? currentPlayer.name : null,
    poolCount: game.pool.length,
    boardFilledCount: game.grid.filter(Boolean).length,
    lastClearedCells: game.lastClearedCells,
    lastClearedCellIndexes: game.lastClearedCellIndexes,
    lastClearedAt: game.lastClearedAt,
    timeoutSeconds: TURN_TIMEOUT_MS / 1000,
    turnStartedAt: game.turnStartedAt,
    turnExpiresAt: game.turnStartedAt ? game.turnStartedAt + TURN_TIMEOUT_MS : null,
    lastEvent: game.lastEvent,
  };
}

function emitGameState() {
  io.emit('gameState', createPublicState());
  emitPrivateTurns();
}

function emitPrivateTurns() {
  const currentPlayer = getCurrentPlayer();

  game.players.forEach((player) => {
    const isCurrent = currentPlayer ? player.id === currentPlayer.id : false;
    const block = isCurrent ? blockMap.get(game.currentBlockId) : null;

    io.to(player.id).emit('privateTurn', {
      isCurrent,
      block: block || null,
      expiresAt: isCurrent && game.turnStartedAt ? game.turnStartedAt + TURN_TIMEOUT_MS : null,
    });
  });
}

function startTurn(message) {
  clearTurnTimer();

  if (message) {
    game.lastEvent = message;
  }

  if (game.players.length === 0) {
    game.currentPlayerIndex = 0;
    game.currentBlockId = null;
    game.turnStartedAt = null;
    emitGameState();
    return;
  }

  if (game.currentPlayerIndex >= game.players.length) {
    game.currentPlayerIndex = 0;
  }

  if (game.pool.length === 0) {
    refillPoolFromBoard();
    game.lastEvent = 'The board has been reset.';
  }

  game.currentBlockId = chooseRandomBlockId();
  game.turnStartedAt = Date.now();
  game.turnTimer = setTimeout(() => {
    const currentPlayer = getCurrentPlayer();

    if (currentPlayer) {
      removePlayer(currentPlayer.id, 'ran out of time.');
    }
  }, TURN_TIMEOUT_MS);

  emitGameState();
}

function clearTurnTimer() {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
}

function chooseRandomBlockId() {
  const randomIndex = Math.floor(Math.random() * game.pool.length);
  return game.pool[randomIndex];
}

function removePlayer(playerId, reason) {
  const leavingIndex = game.players.findIndex((player) => player.id === playerId);

  if (leavingIndex === -1) {
    return;
  }

  const [leavingPlayer] = game.players.splice(leavingIndex, 1);
  const wasCurrentPlayer = leavingIndex === game.currentPlayerIndex;

  if (game.players.length === 0) {
    clearTurnTimer();
    game.currentPlayerIndex = 0;
    game.currentBlockId = null;
    game.turnStartedAt = null;
    game.lastEvent = `${leavingPlayer.name} ${reason} Waiting for players.`;
    emitGameState();
    return;
  }

  if (wasCurrentPlayer) {
    if (game.currentPlayerIndex >= game.players.length) {
      game.currentPlayerIndex = 0;
    }

    game.currentBlockId = null;
    startTurn(`${leavingPlayer.name} ${reason} ${getCurrentPlayer().name} is next.`);
    return;
  }

  if (leavingIndex < game.currentPlayerIndex) {
    game.currentPlayerIndex -= 1;
  }

  game.lastEvent = `${leavingPlayer.name} ${reason}`;
  emitGameState();
}

function placeCurrentBlock(player, block, cellIndex) {
  clearTurnTimer();

  game.lastClearedCells = [];
  game.lastClearedCellIndexes = [];
  game.lastClearedAt = 0;
  game.grid[cellIndex] = { ...block };
  game.pool = game.pool.filter((blockId) => blockId !== block.id);
  game.currentBlockId = null;

  const clearedCells = findMatchingCells();

  if (clearedCells.length > 0) {
    const clearedBlocks = clearedCells.map((index) => ({
      index,
      block: game.grid[index],
    }));
    const returnedBlockIds = clearedBlocks.map((clearedCell) => clearedCell.block.id);
    clearedCells.forEach((index) => {
      game.grid[index] = null;
    });
    returnBlocksToPool(returnedBlockIds);
    player.score += clearedCells.length;
    game.lastClearedCells = clearedBlocks;
    game.lastClearedCellIndexes = clearedCells;
    game.lastClearedAt = Date.now();
    advanceTurn(`${player.name} cleared ${clearedCells.length} blocks.`);
    return;
  }

  if (game.grid.every(Boolean)) {
    const jackpotCells = game.grid.map((placedBlock, index) => ({
      index,
      block: placedBlock,
    }));

    refillPoolFromBoard();
    game.lastClearedCells = jackpotCells;
    game.lastClearedCellIndexes = jackpotCells.map((cell) => cell.index);
    game.lastClearedAt = Date.now();
    player.score += BOARD_SIZE;
    advanceTurn(`${player.name} scored a 16-point jackpot. The board has been reset.`);
    return;
  }

  advanceTurn(`${player.name} placed a ${block.label}.`);
}

function advanceTurn(message) {
  if (game.players.length === 0) {
    game.lastEvent = message || 'Waiting for players.';
    emitGameState();
    return;
  }

  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  startTurn(message);
}

function returnBlocksToPool(blockIds) {
  blockIds.forEach((blockId) => {
    if (!game.pool.includes(blockId)) {
      game.pool.push(blockId);
    }
  });
}

function refillPoolFromBoard() {
  game.grid = Array(BOARD_SIZE).fill(null);
  game.pool = blocks.map((block) => block.id);
  game.lastClearedCells = [];
  game.lastClearedCellIndexes = [];
  game.lastClearedAt = 0;
}

function findMatchingCells() {
  const matchingCells = new Set();
  const lines = getScoringLines();

  lines.forEach((line) => {
    ['shape', 'color'].forEach((property) => {
      findRuns(line, property).forEach((cellIndex) => matchingCells.add(cellIndex));
    });
  });

  return Array.from(matchingCells);
}

function findRuns(line, property) {
  const matchedCells = [];
  let run = [];
  let runValue = null;

  line.forEach((cellIndex) => {
    const block = game.grid[cellIndex];
    const value = block ? block[property] : null;

    if (value && value === runValue) {
      run.push(cellIndex);
      return;
    }

    if (run.length >= 3) {
      matchedCells.push(...run);
    }

    run = value ? [cellIndex] : [];
    runValue = value;
  });

  if (run.length >= 3) {
    matchedCells.push(...run);
  }

  return matchedCells;
}

function getScoringLines() {
  return [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
    [0, 4, 8, 12],
    [1, 5, 9, 13],
    [2, 6, 10, 14],
    [3, 7, 11, 15],
    [0, 5, 10, 15],
    [1, 6, 11],
    [4, 9, 14],
    [3, 6, 9, 12],
    [2, 5, 8],
    [7, 10, 13],
  ];
}
