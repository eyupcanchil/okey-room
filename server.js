const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public klasörünü kullanıma açıyoruz (html, css, js oradan okunacak)
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('Bir kullanıcı bağlandı:', socket.id);

  // app.js'den gelen 'yeni_masa_kur' isteğini yakalıyoruz
  socket.on('yeni_masa_kur', (data) => {
    console.log("--- YENİ MASA KURULUYOR ---");
    console.log("Masa Adı:", data.masaAdi);
    console.log("Oyun Türü:", data.oyunTuru);
    console.log("Tur Sayısı:", data.turSayisi);
    console.log("Saniye:", data.saniye);
    console.log("Gizlilik:", data.gizlilik);
    console.log("---------------------------");
    
    // Masa veritabanına ya da oyun motoruna (game.js) burada eklenecek
    // Şimdilik lobideki tüm oyunculara masa eklendiğini haber verebiliriz:
    // io.emit('yeni_masa_eklendi', data);
  });

  socket.on('disconnect', () => {
    console.log('Kullanıcı ayrıldı:', socket.id);
  });
});

// Render'da dinamik port ataması için process.env.PORT kullanıyoruz
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
