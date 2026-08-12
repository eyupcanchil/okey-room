const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 'public' klasörünü statik dosya olarak kullanıma açıyoruz (html, css, js oradan okunacak)
app.use(express.static('public'));

// Bağlantı kurulduğunda yapılacak işlemler
io.on('connection', (socket) => {
  console.log('Bir kullanıcı bağlandı:', socket.id);

  // app.js'den gelen 'yeni_masa_kur' isteğini yakalıyoruz
  socket.on('yeni_masa_kur', (data) => {
    console.log("--- YENİ MASA AÇILIYOR ---");
    console.log("Masa Ayarları:", data);
    
    // Masa için rastgele bir ID oluşturuyoruz
    const odaId = "oda_" + Math.floor(Math.random() * 10000); 

    // Odaya kullanıcıyı dahil ediyoruz
    socket.join(odaId);

    // ==========================================================
    // DİKKAT: KENDİ TAŞ DAĞITMA VE OYUN ALGORİTMANI BURAYA EKLE!
    // ==========================================================
    // Örnek:
    // const taslar = taslariDagit();
    // oyunMotoruBaslat(odaId, data.turSayisi, taslar);
    //
    // ==========================================================

    // Masa hazırlandığında istemciye (app.js'e) masanın kurulduğunu ve sayfaya gitmesini söylüyoruz
    socket.emit('masa_hazir', { 
      odaId: odaId, 
      ayarlar: data 
    });
  });

  // Kullanıcı ayrıldığında
  socket.on('disconnect', () => {
    console.log('Kullanıcı ayrıldı:', socket.id);
  });
});

// Render'da dinamik port ataması için process.env.PORT kullanıyoruz
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
