const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Odaları bellekte tutuyoruz: { roomCode: { players: [{id, name}], maxPlayers: 4 } }
const rooms = {};

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışabilecek harfler çıkarıldı (0,O,1,I)
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
  };
}

io.on("connection", (socket) => {
  // Yeni oda oluştur
  socket.on("createRoom", ({ name }, callback) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      players: [{ id: socket.id, name }],
      maxPlayers: 4,
    };
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.name = name;

    callback({ ok: true, room: publicRoomState(roomCode) });
    io.to(roomCode).emit("roomUpdate", publicRoomState(roomCode));
  });

  // Var olan bir odaya katıl
  socket.on("joinRoom", ({ name, roomCode }, callback) => {
    const code = (roomCode || "").toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      return callback({ ok: false, error: "Böyle bir oda bulunamadı." });
    }
    if (room.players.length >= room.maxPlayers) {
      return callback({ ok: false, error: "Oda dolu (4/4)." });
    }

    room.players.push({ id: socket.id, name });
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.name = name;

    callback({ ok: true, room: publicRoomState(code) });
    io.to(code).emit("roomUpdate", publicRoomState(code));
  });

  // Oyuncu ayrılırsa odadan çıkar, oda boşalırsa sil
  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code || !rooms[code]) return;

    rooms[code].players = rooms[code].players.filter((p) => p.id !== socket.id);

    if (rooms[code].players.length === 0) {
      delete rooms[code];
    } else {
      io.to(code).emit("roomUpdate", publicRoomState(code));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`));
