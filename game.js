// game.js — 101 Okey oyun mantığı & kural motoru

const RENKLER = ['sari', 'mavi', 'siyah', 'kirmizi'];

// 106 taşlık deste oluştur: 4 renk x 1-13 x 2 kopya (104) + 2 sahte okey (106)
function desteOlustur() {
  const deste = [];
  let id = 0;
  for (let kopya = 0; kopya < 2; kopya++) {
    for (const renk of RENKLER) {
      for (let sayi = 1; sayi <= 13; sayi++) {
        deste.push({ id: `t_${id++}`, sayi, renk, fake: false });
      }
    }
  }
  deste.push({ id: `t_${id++}`, sayi: 'S', renk: 'sahte', fake: true, sahteTaraf: 'A' });
  deste.push({ id: `t_${id++}`, sayi: 'S', renk: 'sahte', fake: true, sahteTaraf: 'B' });
  return deste;
}

function karistir(deste) {
  const arr = deste.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Gösterge taşına göre Okey taşını belirle (aynı renk, sayının bir fazlası; 13 ise 1)
function okeyBelirle(gosterge) {
  const okeySayi = gosterge.sayi === 13 ? 1 : gosterge.sayi + 1;
  return { sayi: okeySayi, renk: gosterge.renk };
}

function okeyMi(tas, okeyBilgisi) {
  if (!tas) return false;
  if (tas.fake) return true; // Sahte okeyler gerçek okey yerine geçer
  return tas.sayi === okeyBilgisi.sayi && tas.renk === okeyBilgisi.renk;
}

// Yeni oyun başlatma (4 oyuncu)
function yeniOyunBaslat(oyuncular) {
  if (!oyuncular || oyuncular.length === 0) {
    throw new Error('Oyuncu listesi boş olamaz.');
  }

  // Eğer 4 oyuncu yoksa test amaçlı bot/boş koltukları tamamla
  const tamOyuncular = [...oyuncular];
  while (tamOyuncular.length < 4) {
    const botNo = tamOyuncular.length + 1;
    tamOyuncular.push({ id: `bot_${botNo}_${Date.now()}`, isim: `Bot ${botNo}`, isBot: true });
  }

  const oyuncuIdleri = tamOyuncular.map(o => o.id);
  const isimler = Object.fromEntries(tamOyuncular.map(o => [o.id, o.isim]));

  let deste = karistir(desteOlustur());

  // Gösterge taşı seçimi (sahte okey olamaz)
  let gostergeIndex = deste.findIndex(t => !t.fake);
  const gosterge = deste.splice(gostergeIndex, 1)[0];
  const okeyBilgisi = okeyBelirle(gosterge);

  // Başlangıç oyuncusu (rastgele veya 0. oyuncu)
  const baslangicIndex = Math.floor(Math.random() * 4);
  const eller = {};
  oyuncuIdleri.forEach(pid => (eller[pid] = []));

  // Başlayan oyuncuya 22 taş, diğer 3 oyuncuya 21 taş dağıt
  oyuncuIdleri.forEach((pid, idx) => {
    const tasAdedi = idx === baslangicIndex ? 22 : 21;
    eller[pid] = deste.splice(0, tasAdedi);
  });

  return {
    durum: 'oyun_suruyor', // 'oyun_suruyor' | 'bitti'
    oyuncular: tamOyuncular,
    oyuncuSirasi: oyuncuIdleri,
    isimler: isimler,
    siraIndex: baslangicIndex,
    eller: eller,
    gosterge: gosterge,
    okeyBilgisi: okeyBilgisi,
    deste: deste,
    atilmisTaslar: Object.fromEntries(oyuncuIdleri.map(pid => [pid, []])),
    // Başlayan oyuncuda zaten 22 taş olduğundan direkt 'discard' (taş atma) aşamasında başlar
    faz: 'discard', // 'draw' (çekme) | 'discard' (atma)
    sonCekilenTas: null,
    sonAtilanTas: null,
    kazanan: null
  };
}

function suankiOyuncuId(oyun) {
  return oyun.oyuncuSirasi[oyun.siraIndex];
}

// Desteden taş çek
function destedenTasCek(oyun, oyuncuId) {
  if (suankiOyuncuId(oyun) !== oyuncuId) {
    return { ok: false, hata: 'Sıra sizde değil!' };
  }
  if (oyun.faz !== 'draw') {
    return { ok: false, hata: 'Zaten taş çektiniz, şimdi bir taş atmalısınız!' };
  }
  if (oyun.deste.length === 0) {
    return { ok: false, hata: 'Destede taş kalmadı!' };
  }

  const cekilenTas = oyun.deste.pop();
  oyun.eller[oyuncuId].push(cekilenTas);
  oyun.faz = 'discard';
  oyun.sonCekilenTas = { kaynak: 'deste', tas: cekilenTas, oyuncuId };

  return { ok: true, tas: cekilenTas };
}

// Solundaki oyuncunun attığı taşı çek (yandan alma)
function yandanTasCek(oyun, oyuncuId) {
  if (suankiOyuncuId(oyun) !== oyuncuId) {
    return { ok: false, hata: 'Sıra sizde değil!' };
  }
  if (oyun.faz !== 'draw') {
    return { ok: false, hata: 'Zaten taş çektiniz, şimdi bir taş atmalısınız!' };
  }

  const solOyuncuIndex = (oyun.siraIndex + 3) % 4;
  const solOyuncuId = oyun.oyuncuSirasi[solOyuncuIndex];
  const solKule = oyun.atilmisTaslar[solOyuncuId];

  if (!solKule || solKule.length === 0) {
    return { ok: false, hata: 'Sol oyuncudan alınabilecek taş yok!' };
  }

  const cekilenTas = solKule.pop();
  oyun.eller[oyuncuId].push(cekilenTas);
  oyun.faz = 'discard';
  oyun.sonCekilenTas = { kaynak: 'yandan', tas: cekilenTas, oyuncuId };

  return { ok: true, tas: cekilenTas };
}

// Taş at ve sırayı bir sonraki oyuncuya geçir
function tasAt(oyun, oyuncuId, tasId) {
  if (suankiOyuncuId(oyun) !== oyuncuId) {
    return { ok: false, hata: 'Sıra sizde değil!' };
  }
  if (oyun.faz !== 'discard') {
    return { ok: false, hata: 'Önce taş çekmelisiniz!' };
  }

  const el = oyun.eller[oyuncuId];
  const tasIndex = el.findIndex(t => t.id === tasId);
  if (tasIndex === -1) {
    return { ok: false, hata: 'Bu taş elinizde bulunmuyor!' };
  }

  const [atilanTas] = el.splice(tasIndex, 1);
  oyun.atilmisTaslar[oyuncuId].push(atilanTas);
  oyun.sonAtilanTas = { tas: atilanTas, oyuncuId };

  // Sırayı saat yönünde bir sonraki oyuncuya geçir
  oyun.siraIndex = (oyun.siraIndex + 1) % 4;
  oyun.faz = 'draw';
  oyun.sonCekilenTas = null;

  return { ok: true, atilanTas, sonrakiOyuncuId: suankiOyuncuId(oyun) };
}

// Her oyuncunun kendi ekran perspektifine göre masa durumunu oluşturur
function oyuncuIcinMasaDurumu(oyun, oyuncuId) {
  const benimIndex = oyun.oyuncuSirasi.indexOf(oyuncuId);
  const siraBenimMi = suankiOyuncuId(oyun) === oyuncuId;

  // Masadaki 4 koltuğu bu oyuncunun açısına göre eşle:
  // 0: Kendisi (Alt)
  // 1: Sağı (Sağ)
  // 2: Karşısı (Üst)
  // 3: Solu (Sol)
  const koltuklar = [0, 1, 2, 3].map(offset => {
    const gerçekIndex = (benimIndex !== -1 ? (benimIndex + offset) % 4 : offset);
    const pid = oyun.oyuncuSirasi[gerçekIndex];
    const atilanlar = oyun.atilmisTaslar[pid] || [];
    const sonAtilan = atilanlar.length > 0 ? atilanlar[atilanlar.length - 1] : null;

    return {
      koltukYeri: offset === 0 ? 'alt' : (offset === 1 ? 'sag' : (offset === 2 ? 'ust' : 'sol')),
      oyuncuId: pid,
      isim: oyun.isimler[pid] || 'Oyuncu',
      tasSayisi: oyun.eller[pid] ? oyun.eller[pid].length : 0,
      sonAtilanTas: sonAtilan,
      siraBundaMi: oyun.siraIndex === gerçekIndex
    };
  });

  return {
    durum: oyun.durum,
    benimId: oyuncuId,
    siraBenimMi: siraBenimMi,
    faz: oyun.faz, // 'draw' veya 'discard'
    aktifOyuncuId: suankiOyuncuId(oyun),
    benimElim: oyun.eller[oyuncuId] || [],
    gosterge: oyun.gosterge,
    okeyBilgisi: oyun.okeyBilgisi,
    kalanDesteSayisi: oyun.deste.length,
    koltuklar: koltuklar,
    sonAtilanTas: oyun.sonAtilanTas
  };
}

module.exports = {
  desteOlustur,
  yeniOyunBaslat,
  destedenTasCek,
  yandanTasCek,
  tasAt,
  suankiOyuncuId,
  oyuncuIcinMasaDurumu,
  okeyMi
};

