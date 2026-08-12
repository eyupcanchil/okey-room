// game.js — 101 Okey oyun mantığı (backend, kural motoru)

const COLORS = ["red", "blue", "black", "yellow"];

// 106 taşlık deste oluştur: 4 renk x 1-13 x 2 kopya (104) + 2 sahte okey
function createDeck() {
  const deck = [];
  let id = 0;
  for (let copy = 0; copy < 2; copy++) {
    for (const color of COLORS) {
      for (let n = 1; n <= 13; n++) {
        deck.push({ id: `t${id++}`, n, c: color, fake: false });
      }
    }
  }
  deck.push({ id: `t${id++}`, fake: true, jokerSide: "A" });
  deck.push({ id: `t${id++}`, fake: true, jokerSide: "B" });
  return deck;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Gösterge taşına göre okey taşını belirle (göstergenin bir üstü, aynı renk; 13 ise 1'e döner)
function getOkeyFromIndicator(indicator) {
  const nextN = indicator.n === 13 ? 1 : indicator.n + 1;
  return { n: nextN, c: indicator.c };
}

function isOkeyTile(tile, okeyInfo) {
  if (tile.fake) return true; // sahte okeyler her zaman okey gibi kullanılabilir
  return tile.n === okeyInfo.n && tile.c === okeyInfo.c;
}

// Yeni bir oyun (el) başlatır: 4 oyuncuya taş dağıtır, göstergeyi belirler
// players: [{ id, name }, ...] tam olarak 4 eleman
function startNewGame(players) {
  if (players.length !== 4) {
    throw new Error("Oyun başlaması için tam 4 oyuncu gerekli.");
  }

  const playerIds = players.map((p) => p.id);
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));

  const deck = shuffle(createDeck());

  // Gösterge: desteden rastgele bir taş çekilir (sahte okey olamaz)
  let indicatorIndex = deck.findIndex((t) => !t.fake);
  const indicator = deck.splice(indicatorIndex, 1)[0];
  const okeyInfo = getOkeyFromIndicator(indicator);

  // Rastgele başlangıç oyuncusu ve dağıtım sırası
  const startingIndex = Math.floor(Math.random() * 4);
  const hands = {};
  playerIds.forEach((pid) => (hands[pid] = []));

  // Her oyuncuya 21 taş dağıt (round-robin), başlayan oyuncuya 1 fazladan (22)
  let dealIdx = 0;
  for (let round = 0; round < 21; round++) {
    for (let i = 0; i < 4; i++) {
      const pid = playerIds[(startingIndex + i) % 4];
      hands[pid].push(deck[dealIdx++]);
    }
  }
  hands[playerIds[startingIndex]].push(deck[dealIdx++]);

  const remainingDeck = deck.slice(dealIdx);

  return {
    status: "playing", // playing | finished
    playerOrder: playerIds,
    names,
    turnIndex: startingIndex,
    hands,
    indicator,
    okeyInfo,
    deck: remainingDeck,
    discardPiles: Object.fromEntries(playerIds.map((pid) => [pid, []])),
    hasDrawnThisTurn: false,
    turnPhase: "draw", // draw -> discard
    winner: null,
  };
}

function currentPlayerId(game) {
  return game.playerOrder[game.turnIndex];
}

function advanceTurn(game) {
  game.turnIndex = (game.turnIndex + 1) % 4;
  game.hasDrawnThisTurn = false;
  game.turnPhase = "draw";
}

// Desteden taş çek
function drawFromDeck(game, playerId) {
  if (currentPlayerId(game) !== playerId) return { ok: false, error: "Sıra sende değil." };
  if (game.turnPhase !== "draw") return { ok: false, error: "Zaten taş çektin, şimdi atman gerekiyor." };
  if (game.deck.length === 0) return { ok: false, error: "Desteste taş kalmadı." };

  const tile = game.deck.pop();
  game.hands[playerId].push(tile);
  game.hasDrawnThisTurn = true;
  game.turnPhase = "discard";
  return { ok: true, tile };
}

// Bir önceki oyuncunun attığı taşı ortadan al
function drawFromDiscard(game, playerId) {
  if (currentPlayerId(game) !== playerId) return { ok: false, error: "Sıra sende değil." };
  if (game.turnPhase !== "draw") return { ok: false, error: "Zaten taş çektin, şimdi atman gerekiyor." };

  const prevIndex = (game.turnIndex + 3) % 4;
  const prevPlayerId = game.playerOrder[prevIndex];
  const pile = game.discardPiles[prevPlayerId];

  if (pile.length === 0) return { ok: false, error: "Ortada alınacak taş yok." };

  const tile = pile.pop();
  game.hands[playerId].push(tile);
  game.hasDrawnThisTurn = true;
  game.turnPhase = "discard";
  return { ok: true, tile };
}

// Taş at ve sırayı devret
function discardTile(game, playerId, tileId) {
  if (currentPlayerId(game) !== playerId) return { ok: false, error: "Sıra sende değil." };
  if (game.turnPhase !== "discard") return { ok: false, error: "Önce taş çekmen gerekiyor." };

  const hand = game.hands[playerId];
  const idx = hand.findIndex((t) => t.id === tileId);
  if (idx === -1) return { ok: false, error: "Bu taş elinde yok." };

  const [tile] = hand.splice(idx, 1);
  game.discardPiles[playerId].push(tile);

  advanceTurn(game);
  return { ok: true, tile };
}

// Her oyuncuya sadece görmesi gereken bilgiyi döndürür (rakip elleri gizli, sadece sayı)
function getStateForPlayer(game, playerId) {
  const opponentInfo = game.playerOrder
    .filter((pid) => pid !== playerId)
    .map((pid) => ({
      playerId: pid,
      name: game.names[pid],
      tileCount: game.hands[pid].length,
      topDiscard: game.discardPiles[pid][game.discardPiles[pid].length - 1] || null,
    }));

  return {
    status: game.status,
    myHand: game.hands[playerId],
    myTurn: currentPlayerId(game) === playerId,
    turnPhase: game.turnPhase,
    currentPlayerId: currentPlayerId(game),
    indicator: game.indicator,
    okeyInfo: game.okeyInfo,
    deckCount: game.deck.length,
    myDiscardPile: game.discardPiles[playerId],
    opponents: opponentInfo,
    winner: game.winner,
  };
}

module.exports = {
  createDeck,
  startNewGame,
  drawFromDeck,
  drawFromDiscard,
  discardTile,
  currentPlayerId,
  getStateForPlayer,
  isOkeyTile,
};
