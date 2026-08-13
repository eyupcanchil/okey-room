const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Açılan masaları ve taş durumlarını sunucu hafızasında tutuyoruz
const aktifMasalar = {};

// 101 Okey Taş Dağıtma Algoritması
function taslariOlusturVeDagit101() {
  const renkler = ['sari', 'mavi', 'siyah', 'kirmizi'];
  let deste = [];
  
  renkler.forEach(renk => {
    for (let i = 1; i <= 13; i++) {
      deste.push({ sayi: i, renk: renk });
      deste.push({ sayi: i, renk: renk });
    }
  });
  deste.push({ sayi: 'S', renk: 'sahte' });
  deste.push({ sayi: 'S', renk: 'sahte' });

  // Taşları karıştır
  deste = deste.sort(() => Math.random() - 0.5);
  const gosterge = deste.pop();

  const oyuncuTaslari = {
    oyuncu1: deste.splice(0, 22), 
    oyuncu2: deste.splice(0, 21),
    oyuncu3: deste.splice(0, 21),
    oyuncu4: deste.splice(0, 21)
  };

  return {
    oyuncular: oyuncuTaslari,
    gosterge: gosterge,
    kalanTasSayisi: deste.length
  };
}

io.on('connection', (socket) => {
  // 1. AŞAMA: Masayı Kur
  socket.on('yeni_masa_kur', (data) => {
    const odaId = "oda_" + Math.floor(Math.random() * 10000); 
    
    // Masayı oluşturup sunucuya kaydediyoruz
    aktifMasalar[odaId] = {
      ayarlar: data,
      durum: taslariOlusturVeDagit101()
    };

    socket.join(odaId);
    // İstemciye (app.js) masanın ID'sini gönderip game.html'e yönlendiriyoruz
    socket.emit('masa_hazir', { odaId: odaId });
  });

  // 2. AŞAMA: Oyun Ekranına (game.html) Geçince Taşları Gönder
  socket.on('oyuna_katil', (odaId) => {
    socket.join(odaId);
    if(aktifMasalar[odaId]) {
      // Masanın o anki tüm verilerini ekrana basması için yolluyoruz
      socket.emit('masa_durumu_guncelle', aktifMasalar[odaId].durum);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
