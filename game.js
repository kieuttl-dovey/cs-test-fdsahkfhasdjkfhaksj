(() => {
  "use strict";

  const LEVELS = window.CATEGORY_SORT_LEVELS || [];
  const STORAGE_KEY = "categorySortDragPrototype_v2";
  const SESSION_KEY = "categorySortDragSession_v2";
  const DEFAULT_STATE = {
    coins: 600,
    unlockedLevel: 1,
    completed: {},
    doubledRewards: {},
    settings: { debug: true }
  };

  const ui = {};
  let profile = loadProfile();
  let game = null;
  let timerId = null;
  let dragState = null;
  let hoverDrop = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    [
      "homeScreen", "gameScreen", "levelGrid", "homeCoins", "homeUnlocked", "homeCompleted",
      "backBtn", "levelTitle", "difficultyBadge", "movesValue", "coinsValue", "timeValue",
      "messageBar", "categoryArea", "stackArea", "tempArea", "remainingCards", "undoBtn",
      "hintBtn", "magnetBtn", "restartBtn", "undoPrice", "hintPrice", "magnetCount",
      "resultModal", "resultEyebrow", "resultTitle", "resultStats", "rewardValue",
      "doubleRewardBtn", "nextLevelBtn", "retryBtn", "modalLevelsBtn", "exportBtn",
      "resetProgressBtn"
    ].forEach(id => ui[id] = document.getElementById(id));

    ui.backBtn.addEventListener("click", showHome);
    ui.undoBtn.addEventListener("click", useUndo);
    ui.hintBtn.addEventListener("click", useHint);
    ui.magnetBtn.addEventListener("click", useMagnet);
    ui.restartBtn.addEventListener("click", () => startLevel(game.level.id));
    ui.doubleRewardBtn.addEventListener("click", claimDoubleReward);
    ui.nextLevelBtn.addEventListener("click", nextLevel);
    ui.retryBtn.addEventListener("click", () => startLevel(game.level.id));
    ui.modalLevelsBtn.addEventListener("click", showHome);
    ui.exportBtn.addEventListener("click", exportSession);
    ui.resetProgressBtn.addEventListener("click", resetProgress);

    renderHome();
    const requestedLevel = Number(new URLSearchParams(window.location.search).get("level"));
    if (Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= LEVELS.length) {
      startLevel(requestedLevel);
    }
  }

  function loadProfile() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { ...DEFAULT_STATE, ...(parsed || {}), completed: { ...(parsed?.completed || {}) }, doubledRewards: { ...(parsed?.doubledRewards || {}) } };
    } catch {
      return structuredCloneSafe(DEFAULT_STATE);
    }
  }

  function saveProfile() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }

  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function renderHome() {
    ui.homeCoins.textContent = profile.coins;
    ui.homeUnlocked.textContent = `${Math.min(profile.unlockedLevel, LEVELS.length)}/${LEVELS.length}`;
    ui.homeCompleted.textContent = Object.keys(profile.completed).length;
    ui.levelGrid.innerHTML = "";

    LEVELS.forEach(level => {
      const unlocked = level.id <= profile.unlockedLevel;
      const completed = Boolean(profile.completed[level.id]);
      const button = document.createElement("button");
      button.className = "level-card";
      button.disabled = !unlocked;
      button.innerHTML = `
        <span class="level-state">${completed ? "COMPLETED" : unlocked ? "AVAILABLE" : "LOCKED"}</span>
        <div class="level-number">${level.id}</div>
        <strong>${escapeHtml(level.title)}</strong>
        <div class="level-meta"><span>${level.difficulty}</span><span>${level.moveLimit} moves</span></div>
      `;
      button.addEventListener("click", () => startLevel(level.id));
      ui.levelGrid.appendChild(button);
    });
  }

  function startLevel(id) {
    closeModal();
    const level = LEVELS.find(x => x.id === id);
    if (!level) return;

    clearInterval(timerId);
    const cardToCategory = {};
    Object.entries(level.categories).forEach(([category, cards]) => cards.forEach(card => cardToCategory[card] = category));

    game = {
      level,
      cardToCategory,
      stacks: level.stacks.map(stack => [...stack]),
      temp: Array(level.tempSlots).fill(null),
      targets: Object.fromEntries(Object.keys(level.categories).map(name => [name, []])),
      moveCount: 0,
      startedAt: Date.now(),
      elapsedSeconds: 0,
      selected: null,
      history: [],
      freeHints: level.freeHints || 0,
      freeUndos: level.freeUndos || 0,
      magnetUses: level.magnetUses || 0,
      hintsUsed: 0,
      undosUsed: 0,
      magnetsUsed: 0,
      invalidMoves: 0,
      tempUses: 0,
      coinsSpent: 0,
      completed: false,
      failed: false,
      rewardClaimed: false,
      hintedSource: null
    };

    ui.homeScreen.classList.remove("active");
    ui.gameScreen.classList.add("active");
    timerId = setInterval(updateTimer, 1000);
    setMessage(level.id === 1
      ? "Drag the visible top card onto its matching yellow category pile."
      : "Drag a visible card to a matching category or an empty Free slot.");
    renderGame();
  }

  function renderGame() {
    if (!game) return;
    const { level } = game;
    ui.levelTitle.textContent = `Level ${level.id} - ${level.title}`;
    ui.difficultyBadge.textContent = level.difficulty.toUpperCase();
    ui.difficultyBadge.classList.toggle("hard", level.difficulty.toLowerCase() === "hard");
    ui.movesValue.textContent = `${game.moveCount}/${level.moveLimit}`;
    ui.coinsValue.textContent = profile.coins;
    ui.timeValue.textContent = formatTime(game.elapsedSeconds);
    ui.undoPrice.textContent = game.freeUndos > 0 ? `${game.freeUndos} free` : "200 coins";
    ui.hintPrice.textContent = game.freeHints > 0 ? `${game.freeHints} free` : "300 coins";
    ui.magnetCount.textContent = `${game.magnetUses} available`;
    ui.undoBtn.disabled = game.history.length === 0 || game.completed || game.failed;
    ui.hintBtn.disabled = game.completed || game.failed;
    ui.magnetBtn.disabled = game.magnetUses <= 0 || game.completed || game.failed;

    renderCategories();
    renderStacks();
    renderTempSlots();
    const remaining = countRemainingCards();
    ui.remainingCards.textContent = remaining;
  }

  function renderCategories() {
    ui.categoryArea.innerHTML = "";
    Object.entries(game.level.categories).forEach(([name, requiredCards]) => {
      const placed = game.targets[name];
      const complete = placed.length === requiredCards.length;
      const target = document.createElement("button");
      target.type = "button";
      target.className = `category-target${complete ? " complete" : ""}`;
      target.dataset.dropType = "category";
      target.dataset.category = name;
      target.setAttribute("aria-label", `${name}: ${placed.length} of ${requiredCards.length}`);
      const latest = placed.at(-1);
      target.innerHTML = `
        <span class="category-tab">${escapeHtml(name)}</span>
        <span class="category-card">
          <span class="category-progress">${placed.length}/${requiredCards.length}<span class="category-star">★</span></span>
          <span class="category-display">${latest ? escapeHtml(latest) : "Drop here"}</span>
        </span>
      `;
      target.addEventListener("click", () => moveSelectedToCategory(name));
      ui.categoryArea.appendChild(target);
    });
  }

  function renderStacks() {
    ui.stackArea.innerHTML = "";
    game.stacks.forEach((stack, stackIndex) => {
      const wrapper = document.createElement("div");
      wrapper.className = "card-stack";

      if (stack.length === 0) {
        wrapper.innerHTML = '<div class="empty-stack">Empty</div>';
      } else {
        const shell = document.createElement("div");
        shell.className = "stack-shell";
        const visibleLayers = Math.min(2, Math.max(0, stack.length - 1));
        for (let layer = visibleLayers; layer >= 1; layer -= 1) {
          const backing = document.createElement("span");
          backing.className = `stack-layer layer-${layer}`;
          shell.appendChild(backing);
        }

        const card = stack[stack.length - 1];
        const button = createSourceCard(card, "stack", stackIndex);
        shell.appendChild(button);

        if (stack.length > 1) {
          const count = document.createElement("span");
          count.className = "stack-count";
          count.textContent = stack.length;
          shell.appendChild(count);
        }
        wrapper.appendChild(shell);
      }
      ui.stackArea.appendChild(wrapper);
    });
  }

  function renderTempSlots() {
    ui.tempArea.innerHTML = "";
    game.temp.forEach((card, index) => {
      const slot = document.createElement("div");
      slot.className = `temp-slot ${card ? "occupied" : "empty"}${isSelected("temp", index) ? " selected" : ""}`;
      slot.dataset.dropType = "temp";
      slot.dataset.tempIndex = index;
      slot.setAttribute("role", "button");
      slot.setAttribute("tabindex", "0");
      slot.setAttribute("aria-label", card ? `Free slot ${index + 1}: ${card}` : `Empty free slot ${index + 1}`);
      if (isHinted("temp", index)) slot.classList.add("hinted");

      if (card) {
        const button = createSourceCard(card, "temp", index);
        slot.appendChild(button);
      }

      const activateSlot = () => {
        if (game.selected && !card) moveSelectedToTemp(index);
        else if (card) selectSource("temp", index);
      };
      slot.addEventListener("click", event => {
        if (event.target.closest(".source-card")) return;
        activateSlot();
      });
      slot.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateSlot();
        }
      });
      ui.tempArea.appendChild(slot);
    });
  }

  function createSourceCard(card, type, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sort-card source-card";
    button.dataset.sourceType = type;
    button.dataset.sourceIndex = index;
    button.setAttribute("aria-label", `Drag ${card}`);
    button.setAttribute("aria-grabbed", isSelected(type, index) ? "true" : "false");
    if (isSelected(type, index)) button.classList.add("selected");
    if (isHinted(type, index)) button.classList.add("hinted");
    button.innerHTML = `<span class="drag-grip"></span><span class="card-text">${escapeHtml(card)}</span>`;
    attachCardPointerEvents(button, type, index);
    button.addEventListener("click", event => {
      event.stopPropagation();
      if (button.dataset.dragged === "true") {
        button.dataset.dragged = "false";
        return;
      }
      selectSource(type, index);
    });
    return button;
  }

  function attachCardPointerEvents(element, type, index) {
    element.addEventListener("pointerdown", event => {
      if (game.completed || game.failed) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const card = getSourceCard(type, index);
      if (!card) return;
      event.preventDefault();
      cleanupDrag();
      dragState = {
        pointerId: event.pointerId,
        type,
        index,
        card,
        sourceElement: element,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
        ghost: null
      };
      element.setPointerCapture?.(event.pointerId);
      element.addEventListener("pointermove", onPointerMove);
      element.addEventListener("pointerup", onPointerUp);
      element.addEventListener("pointercancel", onPointerCancel);
    });
  }

  function onPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.preventDefault();
    dragState.x = event.clientX;
    dragState.y = event.clientY;
    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.dragging && distance >= 6) startVisualDrag();
    if (!dragState.dragging) return;
    positionGhost(event.clientX, event.clientY);
    updateHoverDrop(event.clientX, event.clientY);
  }

  function onPointerUp(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.preventDefault();
    const state = dragState;
    if (state.dragging) {
      state.sourceElement.dataset.dragged = "true";
      const target = findDropTarget(event.clientX, event.clientY);
      performDrop(state, target);
    }
    cleanupDrag();
  }

  function onPointerCancel() {
    cleanupDrag();
  }

  function startVisualDrag() {
    if (!dragState || dragState.dragging) return;
    dragState.dragging = true;
    dragState.sourceElement.classList.add("dragging-source");
    document.body.classList.add("drag-active");
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.innerHTML = `<div class="sort-card"><span class="drag-grip"></span><span class="card-text">${escapeHtml(dragState.card)}</span></div>`;
    document.body.appendChild(ghost);
    dragState.ghost = ghost;
    positionGhost(dragState.x, dragState.y);
    setMessage(`Dragging “${dragState.card}”. Drop it on the correct yellow pile or a Free slot.`);
  }

  function positionGhost(x, y) {
    if (!dragState?.ghost) return;
    dragState.ghost.style.left = `${x}px`;
    dragState.ghost.style.top = `${y}px`;
  }

  function findDropTarget(x, y) {
    const element = document.elementFromPoint(x, y);
    return element?.closest?.("[data-drop-type]") || null;
  }

  function updateHoverDrop(x, y) {
    const target = findDropTarget(x, y);
    if (hoverDrop === target) return;
    clearHoverDrop();
    hoverDrop = target;
    if (!target || !dragState) return;
    const valid = isValidDrop(dragState, target);
    target.classList.add(valid ? "drop-valid" : "drop-invalid");
  }

  function clearHoverDrop() {
    if (hoverDrop) hoverDrop.classList.remove("drop-valid", "drop-invalid");
    hoverDrop = null;
  }

  function isValidDrop(state, target) {
    if (!target) return false;
    if (target.dataset.dropType === "category") {
      return game.cardToCategory[state.card] === target.dataset.category;
    }
    if (target.dataset.dropType === "temp") {
      const tempIndex = Number(target.dataset.tempIndex);
      return !game.temp[tempIndex] && !(state.type === "temp" && state.index === tempIndex);
    }
    return false;
  }

  function performDrop(state, target) {
    if (!target) {
      setMessage(`“${state.card}” returned to its stack. Drop it on a category or Free slot.`, "warning");
      return;
    }
    game.selected = { type: state.type, index: state.index, card: state.card };
    game.hintedSource = null;
    if (target.dataset.dropType === "category") {
      moveSelectedToCategory(target.dataset.category);
      return;
    }
    if (target.dataset.dropType === "temp") {
      const tempIndex = Number(target.dataset.tempIndex);
      if (!isValidDrop(state, target)) {
        game.invalidMoves += 1;
        game.selected = null;
        setMessage("That Free slot is already occupied.", "error");
        renderGame();
        return;
      }
      moveSelectedToTemp(tempIndex);
    }
  }

  function cleanupDrag() {
    clearHoverDrop();
    if (!dragState) return;
    const { sourceElement, pointerId, ghost } = dragState;
    try { sourceElement.releasePointerCapture?.(pointerId); } catch {}
    sourceElement.removeEventListener("pointermove", onPointerMove);
    sourceElement.removeEventListener("pointerup", onPointerUp);
    sourceElement.removeEventListener("pointercancel", onPointerCancel);
    sourceElement.classList.remove("dragging-source");
    ghost?.remove();
    document.body.classList.remove("drag-active");
    dragState = null;
  }

  function selectSource(type, index) {
    if (game.completed || game.failed) return;
    const card = getSourceCard(type, index);
    if (!card) return;
    game.selected = { type, index, card };
    game.hintedSource = null;
    setMessage(`Selected “${card}”. Tap a yellow category pile or an empty Free slot, or drag the card directly.`);
    renderGame();
  }

  function moveSelectedToCategory(category) {
    if (!game.selected || game.completed || game.failed) return;
    const card = game.selected.card;
    const correctCategory = game.cardToCategory[card];
    if (correctCategory !== category) {
      game.invalidMoves += 1;
      setMessage(`“${card}” does not belong to ${category}.`, "error");
      return;
    }
    snapshot();
    removeSelectedCard();
    game.targets[category].push(card);
    game.moveCount += 1;
    game.selected = null;
    game.hintedSource = null;
    setMessage(`Correct: “${card}” → ${category}.`);
    afterMove();
  }

  function moveSelectedToTemp(index) {
    if (!game.selected || game.temp[index] || game.completed || game.failed || (game.selected.type === "temp" && game.selected.index === index)) return;
    snapshot();
    const card = game.selected.card;
    removeSelectedCard();
    game.temp[index] = card;
    game.moveCount += 1;
    game.tempUses += 1;
    game.selected = null;
    game.hintedSource = null;
    setMessage(`Moved “${card}” to temporary slot ${index + 1}.`, "warning");
    afterMove();
  }

  function removeSelectedCard() {
    const { type, index } = game.selected;
    if (type === "stack") game.stacks[index].pop();
    if (type === "temp") game.temp[index] = null;
  }

  function getSourceCard(type, index) {
    if (type === "stack") return game.stacks[index][game.stacks[index].length - 1] || null;
    if (type === "temp") return game.temp[index] || null;
    return null;
  }

  function snapshot() {
    game.history.push({
      stacks: game.stacks.map(x => [...x]),
      temp: [...game.temp],
      targets: Object.fromEntries(Object.entries(game.targets).map(([k, v]) => [k, [...v]])),
      moveCount: game.moveCount,
      tempUses: game.tempUses
    });
    if (game.history.length > 50) game.history.shift();
  }

  function useUndo() {
    if (!game || game.history.length === 0 || game.completed || game.failed) return;
    const price = game.freeUndos > 0 ? 0 : 200;
    if (!spendCoins(price, "Undo")) return;
    if (game.freeUndos > 0) game.freeUndos -= 1;
    const state = game.history.pop();
    game.stacks = state.stacks.map(x => [...x]);
    game.temp = [...state.temp];
    game.targets = Object.fromEntries(Object.entries(state.targets).map(([k, v]) => [k, [...v]]));
    game.moveCount = state.moveCount;
    game.tempUses = state.tempUses;
    game.selected = null;
    game.hintedSource = null;
    game.undosUsed += 1;
    setMessage(price ? "Undo used for 200 coins." : "Free undo used.");
    renderGame();
  }

  function useHint() {
    if (!game || game.completed || game.failed) return;
    const source = findFirstAvailableSource();
    if (!source) return;
    const price = game.freeHints > 0 ? 0 : 300;
    if (!spendCoins(price, "Hint")) return;
    if (game.freeHints > 0) game.freeHints -= 1;
    game.hintsUsed += 1;
    game.hintedSource = source;
    const card = getSourceCard(source.type, source.index);
    setMessage(`Hint: “${card}” belongs to ${game.cardToCategory[card]}.`, "warning");
    renderGame();
  }

  function useMagnet() {
    if (!game || game.magnetUses <= 0 || game.completed || game.failed) return;
    const candidates = [];
    game.stacks.forEach((stack, index) => {
      if (stack.length) candidates.push({ type: "stack", index, card: stack[stack.length - 1] });
    });
    game.temp.forEach((card, index) => { if (card) candidates.push({ type: "temp", index, card }); });
    if (!candidates.length) return;

    snapshot();
    const picked = candidates[0];
    if (picked.type === "stack") game.stacks[picked.index].pop();
    else game.temp[picked.index] = null;
    const category = game.cardToCategory[picked.card];
    game.targets[category].push(picked.card);
    game.moveCount += 1;
    game.magnetUses -= 1;
    game.magnetsUsed += 1;
    game.selected = null;
    game.hintedSource = null;
    setMessage(`Magnet collected “${picked.card}” into ${category}.`);
    afterMove();
  }

  function findFirstAvailableSource() {
    for (let i = 0; i < game.temp.length; i += 1) if (game.temp[i]) return { type: "temp", index: i };
    for (let i = 0; i < game.stacks.length; i += 1) if (game.stacks[i].length) return { type: "stack", index: i };
    return null;
  }

  function spendCoins(amount, label) {
    if (amount === 0) return true;
    if (profile.coins < amount) {
      setMessage(`Not enough coins for ${label}.`, "error");
      return false;
    }
    profile.coins -= amount;
    game.coinsSpent += amount;
    saveProfile();
    return true;
  }

  function afterMove() {
    renderGame();
    if (countRemainingCards() === 0) completeLevel();
    else if (game.moveCount >= game.level.moveLimit) failLevel("Move limit reached.");
  }

  function countRemainingCards() {
    return game.stacks.reduce((sum, stack) => sum + stack.length, 0) + game.temp.filter(Boolean).length;
  }

  function completeLevel() {
    game.completed = true;
    clearInterval(timerId);
    const firstCompletion = !profile.completed[game.level.id];
    if (!game.rewardClaimed) {
      profile.coins += game.level.reward;
      game.rewardClaimed = true;
    }
    profile.completed[game.level.id] = {
      bestMoves: Math.min(profile.completed[game.level.id]?.bestMoves ?? Infinity, game.moveCount),
      bestTime: Math.min(profile.completed[game.level.id]?.bestTime ?? Infinity, game.elapsedSeconds)
    };
    profile.unlockedLevel = Math.max(profile.unlockedLevel, Math.min(game.level.id + 1, LEVELS.length));
    saveProfile();
    logSession("win", firstCompletion);
    showResult(true);
  }

  function failLevel(reason) {
    game.failed = true;
    clearInterval(timerId);
    logSession("fail", false, reason);
    showResult(false, reason);
  }

  function showResult(won, reason = "") {
    ui.resultModal.classList.add("open");
    ui.resultModal.setAttribute("aria-hidden", "false");
    ui.resultEyebrow.textContent = won ? "LEVEL COMPLETE" : "LEVEL FAILED";
    ui.resultTitle.textContent = won ? "Great work!" : reason;
    ui.rewardValue.textContent = won ? `+${game.level.reward} coins` : "+0 coins";
    ui.resultStats.innerHTML = `
      <div><span>Moves</span><strong>${game.moveCount}/${game.level.moveLimit}</strong></div>
      <div><span>Time</span><strong>${formatTime(game.elapsedSeconds)}</strong></div>
      <div><span>Efficiency</span><strong>${calculateEfficiency()}%</strong></div>
      <div><span>Hints</span><strong>${game.hintsUsed}</strong></div>
      <div><span>Temp Uses</span><strong>${game.tempUses}</strong></div>
      <div><span>Coins Spent</span><strong>${game.coinsSpent}</strong></div>
    `;
    ui.doubleRewardBtn.style.display = won ? "inline-flex" : "none";
    ui.nextLevelBtn.style.display = won && game.level.id < LEVELS.length ? "inline-flex" : "none";
    ui.retryBtn.style.display = won ? "none" : "inline-flex";
    ui.doubleRewardBtn.disabled = Boolean(profile.doubledRewards[game.level.id]);
    ui.doubleRewardBtn.textContent = profile.doubledRewards[game.level.id] ? "x2 Already Claimed" : "Simulate x2 Reward";
  }

  function claimDoubleReward() {
    if (!game?.completed || profile.doubledRewards[game.level.id]) return;
    profile.coins += game.level.reward;
    profile.doubledRewards[game.level.id] = true;
    saveProfile();
    ui.doubleRewardBtn.disabled = true;
    ui.doubleRewardBtn.textContent = "x2 Reward Claimed";
    ui.rewardValue.textContent = `+${game.level.reward * 2} total coins`;
  }

  function nextLevel() {
    const nextId = game.level.id + 1;
    if (nextId <= LEVELS.length) startLevel(nextId);
    else showHome();
  }

  function showHome() {
    cleanupDrag();
    clearInterval(timerId);
    closeModal();
    game = null;
    ui.gameScreen.classList.remove("active");
    ui.homeScreen.classList.add("active");
    renderHome();
  }

  function closeModal() {
    ui.resultModal.classList.remove("open");
    ui.resultModal.setAttribute("aria-hidden", "true");
  }

  function updateTimer() {
    if (!game || game.completed || game.failed) return;
    game.elapsedSeconds = Math.floor((Date.now() - game.startedAt) / 1000);
    ui.timeValue.textContent = formatTime(game.elapsedSeconds);
  }

  function calculateEfficiency() {
    const totalCards = Object.values(game.level.categories).reduce((sum, list) => sum + list.length, 0);
    const ideal = totalCards;
    return Math.max(0, Math.min(100, Math.round((ideal / Math.max(ideal, game.moveCount)) * 100)));
  }

  function setMessage(text, type = "") {
    ui.messageBar.textContent = text;
    ui.messageBar.className = `message-bar${type ? ` ${type}` : ""}`;
  }

  function isSelected(type, index) {
    return game.selected?.type === type && game.selected?.index === index;
  }

  function isHinted(type, index) {
    return game.hintedSource?.type === type && game.hintedSource?.index === index;
  }

  function logSession(result, firstCompletion, failReason = "") {
    const logs = JSON.parse(localStorage.getItem(SESSION_KEY) || "[]");
    logs.push({
      timestamp: new Date().toISOString(),
      level: game.level.id,
      result,
      firstCompletion,
      failReason,
      moves: game.moveCount,
      moveLimit: game.level.moveLimit,
      durationSeconds: game.elapsedSeconds,
      hintsUsed: game.hintsUsed,
      undosUsed: game.undosUsed,
      magnetsUsed: game.magnetsUsed,
      tempUses: game.tempUses,
      invalidMoves: game.invalidMoves,
      coinsSpent: game.coinsSpent,
      coinsAfter: profile.coins,
      efficiencyPct: calculateEfficiency()
    });
    localStorage.setItem(SESSION_KEY, JSON.stringify(logs));
  }

  function exportSession() {
    const logs = JSON.parse(localStorage.getItem(SESSION_KEY) || "[]");
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      sessions: logs,
      levelCount: LEVELS.length
    };
    downloadFile("category-sort-playtest-data.json", JSON.stringify(payload, null, 2), "application/json");
  }

  function resetProgress() {
    if (!window.confirm("Reset all coins, level progress and session logs?")) return;
    profile = structuredCloneSafe(DEFAULT_STATE);
    saveProfile();
    localStorage.removeItem(SESSION_KEY);
    showHome();
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const remainder = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainder}`;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>'"]/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
    })[char]);
  }
})();
