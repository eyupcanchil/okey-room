const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

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

  socket.on('yeni_masa_kur', (data) => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString(); 
    const odaId = "oda_" + pin; 
    
    aktifMasalar[pin] = {
      odaId: odaId,
      pin: pin,
      ayarlar: data,
      oyuncular: [], 
      basladiMi: false,
      oyunDurumu: null
    };

    socket.emit('masa_kuruldu', { odaId: odaId, pin: pin });
  });

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

  socket.on('oyuna_katil', (data) => {
    const { odaId, kullaniciAdi } = data;
    const pin = Object.keys(aktifMasalar).find(p => aktifMasalar[p].odaId === odaId);
    
    if(pin) {
      const masa = aktifMasalar[pin];
      socket.join(odaId);
      
      if(!masa.oyuncular.find(o => o.id === socket.id)) {
        masa.oyuncular.push({ id: socket.id, isim: kullaniciAdi });
      }

      socket.emit('masa_bilgisi', { 
        pin: pin, 
        ayarlar: masa.ayarlar,
        basladiMi: masa.basladiMi
      });

      io.to(odaId).emit('oyuncu_sayisi_guncelle', masa.oyuncular.length);

      if (masa.basladiMi) {
        socket.emit('oyun_basladi', {
          tasDurumu: masa.oyunDurumu,
          oyuncuListesi: masa.oyuncular
        });
      }

      if (masa.oyuncular.length === 4 && !masa.basladiMi) {
        masa.basladiMi = true;
        masa.oyunDurumu = taslariOlusturVeDagit101(); 
        
        io.to(odaId).emit('oyun_basladi', {
          tasDurumu: masa.oyunDurumu,
          oyuncuListesi: masa.oyuncular
        });
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
