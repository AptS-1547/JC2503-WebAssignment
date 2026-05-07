const socket = io();

const joinForm = document.querySelector('#join-form');
const playerNameInput = document.querySelector('#player-name');
const gameMessage = document.querySelector('#game-message');
const playerList = document.querySelector('#player-list');
const boardHeading = document.querySelector('#board-heading');
const turnState = document.querySelector('#turn-state');
const boardGrid = document.querySelector('#board-grid');
const boardCells = Array.from(document.querySelectorAll('.board-cell'));
const boardBlockCard = document.querySelector('#board-block-card');
const boardBlockLabel = document.querySelector('#board-block-label');
const boardBlockValue = document.querySelector('#board-block-value');
const currentBlockPanel = document.querySelector('#current-block-panel');
const currentBlockPreview = document.querySelector('#current-block-preview');
const currentBlockLabel = document.querySelector('#current-block-label');
const currentBlockNote = document.querySelector('#current-block-note');
const poolCount = document.querySelector('#pool-count');
const filledCount = document.querySelector('#filled-count');
const turnTimer = document.querySelector('#turn-timer');
const scoreboard = document.querySelector('#scoreboard');

let joinedPlayerId = null;
let latestState = null;
let privateTurn = {
  isCurrent: false,
  block: null,
  expiresAt: null,
};
let timerInterval = null;
let rejoinNotice = '';
let clearAnimationTimer = null;

if (joinForm) {
  joinForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (joinedPlayerId) {
      socket.emit('leaveGame', (response) => {
        if (response && !response.ok) {
          setStatus(response.message);
          return;
        }

        resetJoinForm();
        setStatus('You left the game.');
      });
      return;
    }

    const displayName = playerNameInput.value.trim();

    socket.emit('joinGame', displayName, (response) => {
      if (!response || !response.ok) {
        setStatus(response ? response.message : 'Could not join the game.');
        return;
      }

      joinedPlayerId = response.playerId;
      playerNameInput.disabled = true;
      joinForm.querySelector('button').textContent = 'Leave Game';
      setStatus('You joined. Watch the turn order.');
    });
  });
}

if (boardGrid) {
  boardGrid.addEventListener('click', (event) => {
    const cell = event.target.closest('.board-cell');

    if (!cell) {
      return;
    }

    const cellIndex = Number(cell.dataset.cellIndex);

    socket.emit('placeBlock', cellIndex, (response) => {
      if (response && !response.ok) {
        setStatus(response.message);
      }
    });
  });
}

socket.on('connect', () => {
  setStatus('Enter a display name to join.');
});

socket.on('disconnect', () => {
  setStatus('Connection lost. Reconnect to continue.');
  stopTimer();
});

socket.on('gameState', (state) => {
  latestState = state;
  syncJoinedPlayer();
  renderGameState();
});

socket.on('privateTurn', (turn) => {
  privateTurn = turn || {
    isCurrent: false,
    block: null,
    expiresAt: null,
  };
  renderPrivateTurn();
});

function setStatus(message) {
  if (gameMessage) {
    gameMessage.textContent = message;
  }
}

function renderGameState() {
  if (!latestState) {
    return;
  }

  renderBoard();
  renderPlayers();
  renderScores();
  renderStats();

  if (boardHeading) {
    boardHeading.textContent = latestState.currentPlayerName
      ? `Turn: ${latestState.currentPlayerName}`
      : 'Waiting for players';
  }

  if (turnState) {
    if (!joinedPlayerId) {
      turnState.textContent = 'Not joined';
    } else if (latestState.currentPlayerId === joinedPlayerId) {
      turnState.textContent = 'Your turn';
    } else if (latestState.currentPlayerName) {
      turnState.textContent = 'Waiting';
    } else {
      turnState.textContent = 'No active players';
    }
  }

  if (rejoinNotice) {
    setStatus(rejoinNotice);
    rejoinNotice = '';
  } else if (latestState.lastEvent) {
    setStatus(latestState.lastEvent);
  }

  renderPrivateTurn();
}

function syncJoinedPlayer() {
  if (!joinedPlayerId || !latestState) {
    return;
  }

  const stillActive = latestState.players.some((player) => player.id === joinedPlayerId);

  if (stillActive) {
    return;
  }

  joinedPlayerId = null;
  privateTurn = {
    isCurrent: false,
    block: null,
    expiresAt: null,
  };

  if (playerNameInput) {
    resetJoinForm();
  }

  rejoinNotice = 'You are no longer in the turn order. Enter a name to rejoin.';
}

function resetJoinForm() {
  if (playerNameInput) {
    playerNameInput.disabled = false;
  }

  const joinButton = joinForm ? joinForm.querySelector('button') : null;

  if (joinButton) {
    joinButton.textContent = 'Join Game';
    joinButton.disabled = false;
  }
}

function renderBoard() {
  const shouldAnimateClearedCells = latestState.lastClearedAt
    && Date.now() - latestState.lastClearedAt < 1500;
  const clearedCellIndexes = new Set(shouldAnimateClearedCells
    ? latestState.lastClearedCellIndexes || []
    : []);
  const clearedCellBlocks = new Map(
    shouldAnimateClearedCells
      ? (latestState.lastClearedCells || []).map((clearedCell) => [clearedCell.index, clearedCell.block])
      : [],
  );

  latestState.grid.forEach((block, index) => {
    const cell = boardCells[index];

    if (!cell) {
      return;
    }

    cell.innerHTML = '';
    cell.disabled = !canPlaceBlock(index);
    cell.classList.toggle('occupied', Boolean(block));
    cell.classList.toggle('available', canPlaceBlock(index));
    cell.classList.toggle('cleared', clearedCellIndexes.has(index));

    if (block) {
      cell.appendChild(createBlockElement(block));
    } else if (clearedCellBlocks.has(index)) {
      cell.appendChild(createBlockElement(clearedCellBlocks.get(index), 'clearing-block'));
    }
  });

  scheduleClearHighlightReset(clearedCellIndexes.size > 0);
}

function scheduleClearHighlightReset(hasClearedCells) {
  if (clearAnimationTimer) {
    clearTimeout(clearAnimationTimer);
    clearAnimationTimer = null;
  }

  if (!hasClearedCells) {
    return;
  }

  clearAnimationTimer = setTimeout(() => {
    boardCells.forEach((cell) => {
      cell.classList.remove('cleared');
      cell.querySelectorAll('.clearing-block').forEach((block) => block.remove());
    });
    clearAnimationTimer = null;
  }, 460);
}

function renderPlayers() {
  if (!playerList) {
    return;
  }

  playerList.innerHTML = '';

  if (latestState.players.length === 0) {
    playerList.appendChild(createListItem('No players have joined yet.'));
    return;
  }

  latestState.players.forEach((player) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const status = document.createElement('strong');

    item.classList.toggle('active-player', player.isCurrent);
    name.textContent = `${player.turnPosition}. ${player.name}`;
    status.textContent = player.isCurrent ? 'Turn' : 'Wait';
    item.append(name, status);
    playerList.appendChild(item);
  });
}

function renderScores() {
  if (!scoreboard) {
    return;
  }

  scoreboard.innerHTML = '';

  if (latestState.players.length === 0) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    const score = document.createElement('strong');

    label.textContent = 'No scores yet';
    score.textContent = '0';
    item.append(label, score);
    scoreboard.appendChild(item);
    return;
  }

  [...latestState.players]
    .sort((first, second) => second.score - first.score || first.turnPosition - second.turnPosition)
    .forEach((player) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      const score = document.createElement('strong');

      item.classList.toggle('active-player', player.isCurrent);
      name.textContent = player.name;
      score.textContent = player.score;
      item.append(name, score);
      scoreboard.appendChild(item);
    });
}

function renderStats() {
  if (poolCount) {
    poolCount.textContent = latestState.poolCount;
  }

  if (filledCount) {
    filledCount.textContent = `${latestState.boardFilledCount} / 16`;
  }
}

function renderPrivateTurn() {
  if (!currentBlockPanel || !currentBlockPreview || !currentBlockLabel || !currentBlockNote) {
    return;
  }

  renderBoardBlockCard();
  currentBlockPreview.className = 'block-placeholder';
  currentBlockPreview.innerHTML = '';
  currentBlockPanel.classList.toggle('active-turn', privateTurn.isCurrent);

  if (privateTurn.isCurrent && privateTurn.block) {
    currentBlockPreview.className = `block-preview ${privateTurn.block.shape} block-${privateTurn.block.color}`;
    currentBlockLabel.textContent = privateTurn.block.label;
    currentBlockNote.textContent = 'Place it on an empty cell before the timer ends.';
    startTimer(privateTurn.expiresAt);
    renderBoard();
    return;
  }

  stopTimer();

  if (!joinedPlayerId) {
    currentBlockLabel.textContent = 'No block assigned';
    currentBlockNote.textContent = 'Join the game to receive a block on your turn.';
    return;
  }

  currentBlockLabel.textContent = 'Waiting for your turn';
  currentBlockNote.textContent = 'The current block is visible only to the active player.';
  renderBoard();
}

function renderBoardBlockCard() {
  if (!boardBlockCard || !boardBlockLabel || !boardBlockValue) {
    return;
  }

  boardBlockValue.innerHTML = '';
  boardBlockCard.classList.toggle('active-turn', privateTurn.isCurrent);

  if (privateTurn.isCurrent && privateTurn.block) {
    const previewSlot = document.createElement('span');

    boardBlockLabel.textContent = 'Your block';
    previewSlot.className = 'board-block-preview-slot';
    previewSlot.appendChild(createBlockElement(privateTurn.block, 'board-block-preview'));
    boardBlockValue.appendChild(previewSlot);
    boardBlockValue.setAttribute('aria-label', privateTurn.block.label);
    return;
  }

  boardBlockLabel.textContent = joinedPlayerId ? 'Waiting' : 'Block';
  boardBlockValue.textContent = '--';
  boardBlockValue.setAttribute('aria-label', joinedPlayerId ? 'Waiting for your block' : 'No block assigned');
}

function startTimer(expiresAt) {
  stopTimer();

  updateTimer(expiresAt);
  timerInterval = setInterval(() => updateTimer(expiresAt), 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  if (turnTimer) {
    turnTimer.textContent = '--';
  }
}

function updateTimer(expiresAt) {
  if (!turnTimer || !expiresAt) {
    return;
  }

  const remainingSeconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  turnTimer.textContent = `${remainingSeconds}s`;
}

function canPlaceBlock(index) {
  return Boolean(
    joinedPlayerId
      && privateTurn.isCurrent
      && privateTurn.block
      && latestState
      && !latestState.grid[index],
  );
}

function createBlockElement(block, extraClassName = '') {
  const element = document.createElement('span');
  element.className = `block-preview ${block.shape} block-${block.color} ${extraClassName}`.trim();
  element.title = block.label;
  element.setAttribute('aria-label', block.label);
  return element;
}

function createListItem(text) {
  const item = document.createElement('li');
  item.textContent = text;
  return item;
}
