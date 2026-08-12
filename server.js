const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const gameEngine = require("./game");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Odaları bellekte tutuyoruz:
// { roomCode: { players: [{id, name}], maxPlayers: 4, game: null | gameState } }
const rooms = {};

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms[code]);
  return code;
}

function publicRoomState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return null;
  return {
    code: roomCode,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
    maxPlayers: room.maxPlayers,
    gameStarted: !!room.game,
  };
}

// Oyundaki her oyuncuya kendi görebileceği state'i ayrı ayrı gönder
function broadcastGameState(roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.game) return;

  room.players.forEach((p) => {
    const state = gameEngine.getStateForPlayer(room.game, p.id);
    io.to(p.id).emit("gameState", state);
  });
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }, callback) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      players: [{ id: socket.id, name }],
      maxPlayers: 4,
      game: null,
    };
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.name = name;

    callback({ ok: true, room: publicRoomState(roomCode) });
    io.to(roomCode).emit("roomUpdate", publicRoomState(roomCode));
  });

  socket.on("joinRoom", ({ name, roomCode }, callback) => {
    const code = (roomCode || "").toUpperCase().trim();
    const room = rooms[code];

    if (!room) return callback({ ok: false, error: "Böyle bir oda bulunamadı." });
    if (room.players.length >= room.maxPlayers) return callback({ ok: false, error: "Oda dolu (4/4)." });
    if (room.game) return callback({ ok: false, error: "Bu oyun zaten başladı." });

    room.players.push({ id: socket.id, name });
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.name = name;

    callback({ ok: true, room: publicRoomState(code) });
    io.to(code).emit("roomUpdate", publicRoomState(code));
  });

  // Oda 4 kişi olduğunda herhangi biri oyunu başlatabilir
  socket.on("startGame", (_, callback) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return callback?.({ ok: false, error: "Oda bulunamadı." });
    if (room.players.length !== 4) return callback?.({ ok: false, error: "Oyun için 4 oyuncu gerekli." });
    if (room.game) return callback?.({ ok: false, error: "Oyun zaten başladı." });

    const playerIds = room.players.map((p) => p.id);
    room.game = gameEngine.startNewGame(playerIds);

    io.to(code).emit("roomUpdate", publicRoomState(code));
    broadcastGameState(code);
    callback?.({ ok: true });
  });

  // Desteden taş çek
  socket.on("drawFromDeck", (_, callback) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || !room.game) return callback?.({ ok: false, error: "Oyun aktif değil." });

    const result = gameEngine.drawFromDeck(room.game, socket.id);
    if (!result.ok) return callback?.(result);

    broadcastGameState(code);
    callback?.({ ok: true });
  });

  // Ortadan (bir önceki oyuncunun attığı) taşı al
  socket.on("drawFromDiscard", (_, callback) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || !room.game) return callback?.({ ok: false, error: "Oyun aktif değil." });

    const result = gameEngine.drawFromDiscard(room.game, socket.id);
    if (!result.ok) return callback?.(result);

    broadcastGameState(code);
    callback?.({ ok: true });
  });

  // Taş at
  socket.on("discardTile", ({ tileId }, callback) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || !room.game) return callback?.({ ok: false, error: "Oyun aktif değil." });

    const result = gameEngine.discardTile(room.game, socket.id, tileId);
    if (!result.ok) return callback?.(result);

    broadcastGameState(code);
    callback?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code || !rooms[code]) return;

    rooms[code].players = rooms[code].players.filter((p) => p.id !== socket.id);

    if (rooms[code].players.length === 0) {
      delete rooms[code];
    } else {
      // Oyun sırasında biri koparsa şimdilik oyunu iptal ediyoruz (basit yaklaşım)
      rooms[code].game = null;
      io.to(code).emit("roomUpdate", publicRoomState(code));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`));
