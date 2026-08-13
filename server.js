const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- 101 OKEY TAŞ DAĞITMA ALGORİTMASI ---
function taslariOlusturVeDagit101() {
  const renkler = ['sari', 'mavi', 'siyah', 'kirmizi'];
  let deste = [];
  
  // 1'den 13'e kadar her renkten 2'şer adet taş oluştur
  renkler.forEach(renk => {
    for (let i = 1; i <= 13; i++) {
      deste.push({ sayi: i, renk: renk });
      deste.push({ sayi: i, renk: renk });
    }
  });
  // 2 adet Sahte Okey ekle
  deste.push({ sayi: 'S', renk: 'sahte' });
  deste.push({ sayi: 'S', renk: 'sahte' });

  // Taşları rastgele karıştır
  deste = deste.sort(() => Math.random() - 0.5);

  // Gösterge taşını belirle
  const gosterge = deste.pop();

  // Taşları 101 kuralına göre dağıt (Başlayana 22, diğer 3 kişiye 21 taş)
  const oyuncuTaslari = {
    oyuncu1: deste.splice(0, 22), // Oyunu başlatacak kişi
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
// ----------------------------------------

io.on('connection', (socket) => {
  console.log('Bir kullanıcı bağlandı:', socket.id);

  // Masa açma isteği geldiğinde
  socket.on('yeni_masa_kur', (data) => {
    console.log("Masa Ayarları Geldi:", data);
    const odaId = "oda_" + Math.floor(Math.random() * 10000); 
    socket.join(odaId);

    // 101 Okey taş dağıtma fonksiyonunu çalıştır
    const masaDurumu = taslariOlusturVeDagit101();

    // İstemciyi oyuna yönlendir ve taş verilerini gönder
    socket.emit('masa_hazir', { 
      odaId: odaId, 
      ayarlar: data,
      oyunVerisi: masaDurumu // Taşlar burada gidiyor
    });
  });

  // Oyuncu game.html'e geçip odaya bağlandığında taşları istemesi için
  socket.on('oyuna_katil', (odaId) => {
    socket.join(odaId);
    console.log(`Kullanıcı ${odaId} odasına katıldı.`);
  });

  socket.on('disconnect', () => {
    console.log('Kullanıcı ayrıldı:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
