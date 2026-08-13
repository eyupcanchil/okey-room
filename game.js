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
  // Sahte Okey: Siyah S damgalı, orijinal okeyin yerine geçen taş
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

// Bir taşın gerçek OKEY (Joker) olup olmadığını kontrol eder
function okeyMi(tas, okeyBilgisi) {
  if (!tas || !okeyBilgisi) return false;
  if (tas.fake) return false; // Sahte okey joker değil, sabit taştır
  return tas.sayi === okeyBilgisi.sayi && tas.renk === okeyBilgisi.renk;
}

// Sahte Okey'in (S) temsil ettiği asıl taş değerini döndürür
function sahteOkeyDegeri(okeyBilgisi) {
  return { sayi: okeyBilgisi.sayi, renk: okeyBilgisi.renk, fake: true };
}

// Yeni oyun başlatma (4 oyuncu)
function yeniOyunBaslat(oyuncular) {
  if (!oyuncular || oyuncular.length === 0) {
    throw new Error('Oyuncu listesi boş olamaz.');
  }

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
    durum: 'oyun_suruyor',
    oyuncular: tamOyuncular,
    oyuncuSirasi: oyuncuIdleri,
    isimler: isimler,
    siraIndex: baslangicIndex,
    eller: eller,
    gosterge: gosterge,
    okeyBilgisi: okeyBilgisi,
    deste: deste,
    atilmisTaslar: Object.fromEntries(oyuncuIdleri.map(pid => [pid, []])),
    // Masada Açılan Taşlar (Seriler ve Çiftler)
    acilanPerler: [],   // [ { oyuncuId, oyuncuIsim, per: [tas, tas, ...] }, ... ]
    acilanCiftler: [],  // [ { oyuncuId, oyuncuIsim, cift: [tas, tas] }, ... ]
    oyuncuAcmaDurumu: Object.fromEntries(oyuncuIdleri.map(pid => [pid, { acildiMi: false, tur: null, puan: 0 }])),
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

  // Oyun bitti mi kontrolü (Elde taş kalmadıysa)
  if (el.length === 0) {
    oyun.durum = 'bitti';
    oyun.kazanan = oyuncuId;
    return { ok: true, atilanTas, oyunBitti: true, kazanan: oyuncuId };
  }

  // Sırayı saat yönünde bir sonraki oyuncuya geçir
  oyun.siraIndex = (oyun.siraIndex + 1) % 4;
  oyun.faz = 'draw';
  oyun.sonCekilenTas = null;

  return { ok: true, atilanTas, sonrakiOyuncuId: suankiOyuncuId(oyun) };
}

// El Açma İsteği (Seri >= 101 puan veya Çift >= 5 çift)
function elAc(oyun, oyuncuId, acilacakGruplar, mod) {
  if (suankiOyuncuId(oyun) !== oyuncuId) {
    return { ok: false, hata: 'Sıra sizde değil!' };
  }
  if (oyun.faz !== 'discard') {
    return { ok: false, hata: 'Taş çekmeden el açamazsınız!' };
  }

  const el = oyun.eller[oyuncuId];
  const oyuncuIsim = oyun.isimler[oyuncuId] || 'Oyuncu';

  if (mod === 'cift') {
    if (acilacakGruplar.length < 5) {
      return { ok: false, hata: 'Çift açmak için en az 5 çift gereklidir!' };
    }

    // Çiftleri doğrula
    for (const cift of acilacakGruplar) {
      if (cift.length !== 2) return { ok: false, hata: 'Geçersiz çift grubu!' };
      // Çiftleri masaya ekle
      oyun.acilanCiftler.push({ oyuncuId, oyuncuIsim, cift });
      // Taşları elden çıkar
      cift.forEach(t => {
        const idx = el.findIndex(e => e.id === t.id);
        if (idx !== -1) el.splice(idx, 1);
      });
    }

    oyun.oyuncuAcmaDurumu[oyuncuId] = { acildiMi: true, tur: 'cift', puan: acilacakGruplar.length };
    return { ok: true, mod: 'cift' };
  } else {
    // Seri modunda puanı doğrula
    let toplamPuan = 0;
    for (const per of acilacakGruplar) {
      if (per.length < 3) return { ok: false, hata: 'Perler en az 3 taştan oluşmalıdır!' };
      toplamPuan += perPuaniniHesapla(per, oyun.okeyBilgisi);
    }

    if (toplamPuan < 101) {
      return { ok: false, hata: `Açmak için en az 101 puan gerekir! (Şu anki: ${toplamPuan})` };
    }

    // Perleri masaya ekle ve elden çıkar
    for (const per of acilacakGruplar) {
      oyun.acilanPerler.push({ oyuncuId, oyuncuIsim, per });
      per.forEach(t => {
        const idx = el.findIndex(e => e.id === t.id);
        if (idx !== -1) el.splice(idx, 1);
      });
    }

    oyun.oyuncuAcmaDurumu[oyuncuId] = { acildiMi: true, tur: 'seri', puan: toplamPuan };
    return { ok: true, mod: 'seri', puan: toplamPuan };
  }
}

// Bir per grubunun puanını Okey joker kuralına göre hesaplar
function perPuaniniHesapla(per, okeyBilgisi) {
  if (!per || per.length < 3) return 0;

  // 1. Aynı Sayı Grubu (örn: 7 sarı, 7 mavi, 7 siyah veya Okey)
  const netSayilar = per.filter(t => !okeyMi(t, okeyBilgisi) && !t.fake);
  if (netSayilar.length > 0) {
    const bazSayi = netSayilar[0].sayi;
    const ayniSayi = netSayilar.every(t => t.sayi === bazSayi);
    const renkler = new Set(netSayilar.map(t => t.renk));
    if (ayniSayi && renkler.size === netSayilar.length && per.length <= 4) {
      return per.length * bazSayi;
    }
  }

  // 2. Sıralı Seri (örn: 10-11-12 aynı renk veya Okey joker)
  let sum = 0;
  for (let i = 0; i < per.length; i++) {
    const t = per[i];
    if (t.fake) {
      sum += okeyBilgisi.sayi;
    } else if (okeyMi(t, okeyBilgisi)) {
      // Joker taş, serideki yerinin değerini alır
      sum += (netSayilar.length > 0 ? (netSayilar[0].sayi + i) : 10);
    } else {
      sum += (t.sayi === 1 && per.some(x => x.sayi === 13) ? 1 : t.sayi);
    }
  }
  return sum;
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
    const acma = oyun.oyuncuAcmaDurumu[pid] || { acildiMi: false, tur: null, puan: 0 };

    return {
      koltukYeri: offset === 0 ? 'alt' : (offset === 1 ? 'sag' : (offset === 2 ? 'ust' : 'sol')),
      oyuncuId: pid,
      isim: oyun.isimler[pid] || 'Oyuncu',
      tasSayisi: oyun.eller[pid] ? oyun.eller[pid].length : 0,
      sonAtilanTas: sonAtilan,
      siraBundaMi: oyun.siraIndex === gerçekIndex,
      acmaDurumu: acma
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
    acilanPerler: oyun.acilanPerler || [],
    acilanCiftler: oyun.acilanCiftler || [],
    koltuklar: koltuklar,
    sonAtilanTas: oyun.sonAtilanTas,
    kazanan: oyun.kazanan
  };
}

module.exports = {
  desteOlustur,
  yeniOyunBaslat,
  destedenTasCek,
  yandanTasCek,
  tasAt,
  elAc,
  suankiOyuncuId,
  oyuncuIcinMasaDurumu,
  okeyMi
};


