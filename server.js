const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Aktif masaları ve PIN kodlarını tutacağımız obje
const aktifMasalar = {};

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
    // 6 haneli rastgele bir masa kodu (PIN) oluşturuyoruz
    const pin = Math.floor(100000 + Math.random() * 900000).toString(); 
    const odaId = "oda_" + pin; 
    
    aktifMasalar[pin] = {
      odaId: odaId,
      pin: pin,
      ayarlar: data,
      oyuncular: [], // Başlangıçta boş, sayfa yüklenince eklenecek
      durum: taslariOlusturVeDagit101()
    };

    // Kuran kişiye direk kodu ve odayı gönderiyoruz
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

  // 3. OYUN EKRANINA (game.html) GEÇİNCE
  socket.on('oyuna_katil', (odaId) => {
    // Oda ID'sinden PIN'i buluyoruz
    const pin = Object.keys(aktifMasalar).find(p => aktifMasalar[p].odaId === odaId);
    
    if(pin) {
      const masa = aktifMasalar[pin];
      socket.join(odaId);
      
      // Oyuncu daha önce eklenmediyse listeye ekle
      if(!masa.oyuncular.includes(socket.id)) {
        masa.oyuncular.push(socket.id);
      }

      // Odadaki herkese güncel oyuncu sayısını bildir
      io.to(odaId).emit('oyuncu_sayisi_guncelle', masa.oyuncular.length);
      
      // Oyuncuya masa bilgisini ve taşlarını gönder
      socket.emit('masa_durumu_guncelle', {
        durum: masa.durum,
        pin: pin,
        kisiSayisi: masa.oyuncular.length
      });
    }
  });

  socket.on('disconnect', () => {
    // Gerçek bir senaryoda oyuncu koptuğunda diziden çıkarılır
    console.log('Kullanıcı ayrıldı:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
