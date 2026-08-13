const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const aktifMasalar = {};

function botHamlesiYap(masa, pin) {
  if (!masa || !masa.oyun || masa.oyun.durum !== 'oyun_suruyor') return;

  const suankiId = game.suankiOyuncuId(masa.oyun);
  const suankiOyuncu = masa.oyuncular.find(o => o.id === suankiId);

  // Eğer sıra bir botta ise otomatik oynasın
  if (suankiOyuncu && suankiOyuncu.isBot) {
    setTimeout(() => {
      if (!masa.oyun || masa.oyun.durum !== 'oyun_suruyor') return;
      if (game.suankiOyuncuId(masa.oyun) !== suankiId) return;

      // 1. Aşama: Taş çek (Eğer draw fazındaysa)
      if (masa.oyun.faz === 'draw') {
        game.destedenTasCek(masa.oyun, suankiId);
      }

      // Kısa bir beklemeden sonra taş at
      setTimeout(() => {
        if (!masa.oyun || masa.oyun.durum !== 'oyun_suruyor') return;
        if (game.suankiOyuncuId(masa.oyun) !== suankiId) return;

        const el = masa.oyun.eller[suankiId];
        if (el && el.length > 0) {
          // Rastgele veya son taşı at
          const atilacakTas = el[el.length - 1];
          game.tasAt(masa.oyun, suankiId, atilacakTas.id);
        }

        masayiGuncelle(pin);
        // Sonraki oyuncu da bot ise zincirleme devam et
        botHamlesiYap(masa, pin);
      }, 900);

      masayiGuncelle(pin);
    }, 900);
  }
}

function masayiGuncelle(pin) {
  const masa = aktifMasalar[pin];
  if (!masa || !masa.oyun) return;

  masa.oyuncular.forEach(oyuncu => {
    if (!oyuncu.isBot) {
      const durum = game.oyuncuIcinMasaDurumu(masa.oyun, oyuncu.id);
      io.to(oyuncu.id).emit('oyun_durumu_guncelle', durum);
    }
  });
}

function oyunuBaslat(pin) {
  const masa = aktifMasalar[pin];
  if (!masa) return;

  masa.basladiMi = true;
  // 4 kişiye botlarla tamamlayarak oyunu başlat
  masa.oyun = game.yeniOyunBaslat(masa.oyuncular, masa.ayarlar);
  // Gerçek oyuncu listesini ve botları senkronize et
  masa.oyuncular = masa.oyun.oyuncular;

  io.to(masa.odaId).emit('oyuncu_listesi_guncelle', masa.oyuncular);
  masayiGuncelle(pin);

  // Başlayan oyuncu bot ise oynamasını tetikle
  botHamlesiYap(masa, pin);
}

io.on('connection', (socket) => {
  console.log('Kullanıcı bağlandı:', socket.id);

  socket.on('yeni_masa_kur', (data) => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const odaId = 'oda_' + pin;

    aktifMasalar[pin] = {
      odaId: odaId,
      pin: pin,
      ayarlar: data || { turSayisi: 5 },
      oyuncular: [],
      basladiMi: false,
      oyun: null
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

    if (pin) {
      const masa = aktifMasalar[pin];
      socket.join(odaId);

      if (!masa.oyuncular.find(o => o.id === socket.id)) {
        masa.oyuncular.push({ id: socket.id, isim: kullaniciAdi, isBot: false });
      }

      socket.emit('masa_bilgisi', {
        pin: pin,
        ayarlar: masa.ayarlar,
        basladiMi: masa.basladiMi
      });

      io.to(odaId).emit('oyuncu_listesi_guncelle', masa.oyuncular);

      if (masa.basladiMi && masa.oyun) {
        masayiGuncelle(pin);
      } else if (masa.oyuncular.length === 4 && !masa.basladiMi) {
        oyunuBaslat(pin);
      }
    }
  });

  // Hızlı test başlatma (Masa kurucu isterse tek başına botlarla test başlatabilir)
  socket.on('test_oyunu_baslat', (data) => {
    const { odaId } = data;
    const pin = Object.keys(aktifMasalar).find(p => aktifMasalar[p].odaId === odaId);
    if (pin && aktifMasalar[pin] && !aktifMasalar[pin].basladiMi) {
      oyunuBaslat(pin);
    }
  });

  // Taş çekme isteği (Desteden veya Yandan)
  socket.on('tas_cek', (data) => {
    const { odaId, kaynak } = data; // kaynak: 'deste' | 'yandan'
    const pin = Object.keys(aktifMasalar).find(p => aktifMasalar[p].odaId === odaId);
    if (!pin) return;

    const masa = aktifMasalar[pin];
    if (!masa || !masa.oyun) return;

    let sonuc;
    if (kaynak === 'yandan') {
      sonuc = game.yandanTasCek(masa.oyun, socket.id);
    } else {
      sonuc = game.destedenTasCek(masa.oyun, socket.id);
    }

    if (sonuc.ok) {
      masayiGuncelle(pin);
    } else {
      socket.emit('hata', sonuc.hata);
    }
  });

  // Taş atma isteği
  socket.on('tas_at', (data) => {
    const { odaId, tasId } = data;
    const pin = Object.keys(aktifMasalar).find(p => aktifMasalar[p].odaId === odaId);
    if (!pin) return;

    const masa = aktifMasalar[pin];
    if (!masa || !masa.oyun) return;

    const sonuc = game.tasAt(masa.oyun, socket.id, tasId);
    if (sonuc.ok) {
      if (sonuc.cezaUyarisi) {
        io.to(odaId).emit('hata', sonuc.cezaUyarisi);
      }
      masayiGuncelle(pin);
      // Sonraki oyuncu bot ise oynasın
      botHamlesiYap(masa, pin);
    } else {
      socket.emit('hata', sonuc.hata);
    }
  });

  // Taş İşleme isteği (Açılan perlere / çiftlere elden taş ekleme)
  socket.on('tas_isle', (data) => {
    const { odaId, tasId, perIndex, taraf } = data;
    const pin = Object.keys(aktifMasalar).find(p => aktifMasalar[p].odaId === odaId);
    if (!pin) return;

    const masa = aktifMasalar[pin];
    if (!masa || !masa.oyun) return;

    const sonuc = game.tasIsle(masa.oyun, socket.id, tasId, perIndex, taraf);
    if (sonuc.ok) {
      masayiGuncelle(pin);
    } else {
      socket.emit('hata', sonuc.hata);
    }
  });

  // El Açma isteği (Seri veya Çift açma)
  socket.on('el_ac', (data) => {
    const { odaId, gruplar, mod } = data; // mod: 'seri' | 'cift'
    const pin = Object.keys(aktifMasalar).find(p => aktifMasalar[p].odaId === odaId);
    if (!pin) return;

    const masa = aktifMasalar[pin];
    if (!masa || !masa.oyun) return;

    const sonuc = game.elAc(masa.oyun, socket.id, gruplar, mod);
    if (sonuc.ok) {
      masayiGuncelle(pin);
    } else {
      socket.emit('hata', sonuc.hata);
    }
  });

  // Yandan alınan taşı geri koyma isteği
  socket.on('tasi_geri_koy', (data) => {
    const { odaId } = data;
    const pin = Object.keys(aktifMasalar).find(p => aktifMasalar[p].odaId === odaId);
    if (!pin) return;

    const masa = aktifMasalar[pin];
    if (!masa || !masa.oyun) return;

    const sonuc = game.yandanTasiGeriKoy(masa.oyun, socket.id);
    if (sonuc.ok) {
      masayiGuncelle(pin);
    } else {
      socket.emit('hata', sonuc.hata);
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

