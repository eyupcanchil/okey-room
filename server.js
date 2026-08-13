const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const aktifMasalar = {};

// Taş Dağıtma Algoritması (Sadece oyun başlayınca çalışacak)
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

  deste = deste.sort(() => Math.random() - 0.5);
  const gosterge = deste.pop();

  return {
    oyuncular: {
      oyuncu1: deste.splice(0, 22), 
      oyuncu2: deste.splice(0, 21),
      oyuncu3: deste.splice(0, 21),
      oyuncu4: deste.splice(0, 21)
    },
    gosterge: gosterge,
    kalanTasSayisi: deste.length
  };
}

io.on('connection', (socket) => {
  console.log('Kullanıcı bağlandı:', socket.id);

  // 1. MASAYI KUR VE PIN OLUŞTUR
  socket.on('yeni_masa_kur', (data) => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString(); 
    const odaId = "oda_" + pin; 
    
    // Masayı detaylı ayarlarla kaydediyoruz (Taşlar henüz yok)
    aktifMasalar[pin] = {
      odaId: odaId,
      pin: pin,
      ayarlar: data, // Tur sayısı, saniye vb. burada
      oyuncular: [], 
      basladiMi: false,
      oyunDurumu: null
    };

    socket.emit('masa_kuruldu', { odaId: odaId, pin: pin });
  });

  // 2. KOD İLE MASAYA KATILMA İSTEĞİ (Lobiden)
  socket.on('pin_ile_katil', (girilenPin) => {
    const masa = aktifMasalar[girilenPin];
    if (masa) {
      if (masa.oyuncular.length < 4) {
        socket.emit('pin_dogru', { odaId: masa.odaId });
      } else {
        socket.emit('hata', 'Bu masa şu an tam dolu!');
      }
    } else {
      socket.emit('hata', 'Geçersiz veya süresi dolmuş masa kodu!');
    }
  });

  // 3. OYUN EKRANINA (game.html) GEÇİLDİĞİNDE
  socket.on('oyuna_katil', (data) => {
    const { odaId, kullaniciAdi } = data;
    const pin = Object.keys(aktifMasalar).find(p => aktifMasalar[p].odaId === odaId);
    
    if(pin) {
      const masa = aktifMasalar[pin];
      socket.join(odaId);
      
      // Oyuncuyu listeye ekle
      if(!masa.oyuncular.find(o => o.id === socket.id)) {
        masa.oyuncular.push({ id: socket.id, isim: kullaniciAdi });
      }

      // Oyuncuya masanın genel ayarlarını gönder (Tur sayısı vs. için)
      socket.emit('masa_bilgisi', { 
        pin: pin, 
        ayarlar: masa.ayarlar,
        basladiMi: masa.basladiMi
      });

      // Eğer oyun zaten başladıysa direkt taşları gönder
      if (masa.basladiMi) {
        socket.emit('oyun_basladi', masa.oyunDurumu);
      }

      // Odadaki herkese güncel oyuncu sayısını bildir
      io.to(odaId).emit('oyuncu_sayisi_guncelle', masa.oyuncular.length);

      // EĞER 4 KİŞİ OLDUYSA OYUNU BAŞLAT VE TAŞLARI DAĞIT
      if (masa.oyuncular.length === 4 && !masa.basladiMi) {
        masa.basladiMi = true;
        masa.oyunDurumu = taslariOlusturVeDagit101(); // Taşlar ŞİMDİ dağıtılıyor
        
        // Tüm odaya oyunun başladığını ve taş verilerini gönder
        io.to(odaId).emit('oyun_basladi', masa.oyunDurumu);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Kullanıcı ayrıldı:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
