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

  // Başlangıç oyuncusu
  const baslangicIndex = Math.floor(Math.random() * 4);
  const eller = {};
  const atilmisTaslar = {};
  const oyuncuAcmaDurumu = {};

  oyuncuIdleri.forEach(pid => {
    eller[pid] = [];
    atilmisTaslar[pid] = [];
    oyuncuAcmaDurumu[pid] = { acildiMi: false, tur: null, puan: 0 };
  });

  // Başlayan oyuncuya 22 taş, diğer 3 oyuncuya 21 taş dağıt
  oyuncuIdleri.forEach((pid, idx) => {
    const tasAdedi = (idx === baslangicIndex) ? 22 : 21;
    eller[pid] = deste.splice(0, tasAdedi);
  });

  return {
    durum: 'oyun_suruyor',
    deste: deste,
    gosterge: gosterge,
    okeyBilgisi: okeyBilgisi,
    oyuncular: tamOyuncular,
    oyuncuSirasi: oyuncuIdleri,
    isimler: isimler,
    siraIndex: baslangicIndex,
    faz: 'discard', // 22 taşı olan ilk oyuncu doğrudan taş atarak başlar
    eller: eller,
    atilmisTaslar: atilmisTaslar,
    oyuncuAcmaDurumu: oyuncuAcmaDurumu,
    acilanPerler: [], // Masadaki açılmış seri perler
    acilanCiftler: [], // Masadaki açılmış çiftler
    sonAtilanTas: null,
    sonCekilenTas: null,
    yandanCekilenTas: null,
    kazanan: null
  };
}

function suankiOyuncuId(oyun) {
  return oyun.oyuncuSirasi[oyun.siraIndex];
}

function okeyMi(tas, okeyBilgisi) {
  if (!tas || !okeyBilgisi) return false;
  if (tas.fake) return false;
  return tas.sayi === okeyBilgisi.sayi && tas.renk === okeyBilgisi.renk;
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
  oyun.yandanCekilenTas = null;

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
  oyun.yandanCekilenTas = { oyuncuId, tas: cekilenTas, solOyuncuId };

  return { ok: true, tas: cekilenTas };
}

// Yandan alınan taşı geri koy (Açamayan oyuncunun taşı geri bırakması kuralı)
function yandanTasiGeriKoy(oyun, oyuncuId) {
  if (suankiOyuncuId(oyun) !== oyuncuId) {
    return { ok: false, hata: 'Sıra sizde değil!' };
  }
  if (!oyun.yandanCekilenTas || oyun.yandanCekilenTas.oyuncuId !== oyuncuId) {
    return { ok: false, hata: 'Geri koyulacak yandan alınmış bir taş yok!' };
  }

  const { tas, solOyuncuId } = oyun.yandanCekilenTas;
  const el = oyun.eller[oyuncuId];
  const tasIndex = el.findIndex(t => t.id === tas.id);

  if (tasIndex !== -1) {
    el.splice(tasIndex, 1);
  }

  oyun.atilmisTaslar[solOyuncuId].push(tas);
  oyun.faz = 'draw'; // Tekrar taş çekme fazına dön
  oyun.sonCekilenTas = null;
  oyun.yandanCekilenTas = null;

  return { ok: true, tas };
}

// Taş at ve sırayı bir sonraki oyuncuya geçir
function tasAt(oyun, oyuncuId, tasId) {
  if (suankiOyuncuId(oyun) !== oyuncuId) {
    return { ok: false, hata: 'Sıra sizde değil!' };
  }
  if (oyun.faz !== 'discard') {
    return { ok: false, hata: 'Önce taş çekmelisiniz!' };
  }

  // KURAL: Yandan taş alındıysa o tur el açılmak zorundadır!
  if (oyun.yandanCekilenTas && oyun.yandanCekilenTas.oyuncuId === oyuncuId) {
    const acma = oyun.oyuncuAcmaDurumu[oyuncuId];
    if (!acma || !acma.acildiMi) {
      return {
        ok: false,
        hata: 'Yandan taş aldığınızda elinizi açmak zorundasınız! Açamıyorsanız \'Taşı Geri Koy\' butonuna basmalısınız.'
      };
    }
  }

  const el = oyun.eller[oyuncuId];
  const tasIndex = el.findIndex(t => t.id === tasId);
  if (tasIndex === -1) {
    return { ok: false, hata: 'Bu taş elinizde bulunmuyor!' };
  }

  const [atilanTas] = el.splice(tasIndex, 1);
  oyun.atilmisTaslar[oyuncuId].push(atilanTas);
  oyun.sonAtilanTas = { tas: atilanTas, oyuncuId };
  oyun.yandanCekilenTas = null;

  // Oyun bitti mi kontrolü
  if (el.length === 0) {
    oyun.durum = 'bitti';
    oyun.kazanan = oyuncuId;
    return { ok: true, atilanTas, oyunBitti: true, kazanan: oyuncuId };
  }

  // Sırayı bir sonraki oyuncuya geçir
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

    for (const cift of acilacakGruplar) {
      if (cift.length !== 2) return { ok: false, hata: 'Geçersiz çift grubu!' };
      oyun.acilanCiftler.push({ oyuncuId, oyuncuIsim, cift });
      cift.forEach(t => {
        const idx = el.findIndex(e => e.id === t.id);
        if (idx !== -1) el.splice(idx, 1);
      });
    }

    oyun.oyuncuAcmaDurumu[oyuncuId] = { acildiMi: true, tur: 'cift', puan: acilacakGruplar.length };
    oyun.yandanCekilenTas = null; // Yandan taş açma şartı sağlandı
    return { ok: true, mod: 'cift' };
  } else {
    let toplamPuan = 0;
    for (const per of acilacakGruplar) {
      const dogrulama = perDogrulaVePuanla(per, oyun.okeyBilgisi);
      if (!dogrulama.gecerli) {
        return { ok: false, hata: 'Geçersiz per grubu tespit edildi!' };
      }
      toplamPuan += dogrulama.puan;
    }

    if (toplamPuan < 101) {
      return { ok: false, hata: `Açmak için en az 101 puan gerekir! (Şu anki: ${toplamPuan})` };
    }

    for (const per of acilacakGruplar) {
      oyun.acilanPerler.push({ oyuncuId, oyuncuIsim, per });
      per.forEach(t => {
        const idx = el.findIndex(e => e.id === t.id);
        if (idx !== -1) el.splice(idx, 1);
      });
    }

    oyun.oyuncuAcmaDurumu[oyuncuId] = { acildiMi: true, tur: 'seri', puan: toplamPuan };
    oyun.yandanCekilenTas = null; // Yandan taş açma şartı sağlandı
    return { ok: true, mod: 'seri', puan: toplamPuan };
  }
}

// 101 OKEY KURAL MOTORU: PER DOĞRULAMA VE PUAN HESAPLAMA
function perDogrulaVePuanla(per, okeyBilgisi) {
  if (!per || per.length < 3) return { gecerli: false, puan: 0 };

  // Taşların sayısal değerlerini Okey & Sahte Okey kurallarına göre hazırla
  const fakeDeger = okeyBilgisi ? okeyBilgisi.sayi : 1;
  const fakeRenk = okeyBilgisi ? okeyBilgisi.renk : 'sari';

  const islenmis = per.map(t => {
    const isOkey = okeyMi(t, okeyBilgisi);
    if (t.fake) {
      return { ...t, sayi: fakeDeger, renk: fakeRenk, isOkey: false, isFake: true };
    }
    return { ...t, isOkey: isOkey, isFake: false };
  });

  // 1. AYNI SAYI GRUBU KONTROLÜ (örn: 6 sarı, 6 mavi, 6 siyah — Max 4 taş, hepsi farklı renk)
  if (per.length >= 3 && per.length <= 4) {
    const netTaslar = islenmis.filter(t => !t.isOkey);
    if (netTaslar.length > 0) {
      const bazSayi = netTaslar[0].sayi;
      const sayilarAyni = netTaslar.every(t => t.sayi === bazSayi);
      const renkler = new Set(netTaslar.map(t => t.renk));
      const renklerFarkli = renkler.size === netTaslar.length;

      if (sayilarAyni && renklerFarkli) {
        return { gecerli: true, puan: per.length * bazSayi, tur: 'grup' };
      }
    }
  }

  // 2. SIRALI SERİ KONTROLÜ (Aynı renk ardışık: 10-11-12 veya 11-12-13-1)
  const netTaslar = islenmis.filter(t => !t.isOkey);
  if (netTaslar.length > 0) {
    const bazRenk = netTaslar[0].renk;
    const renklerAyni = netTaslar.every(t => t.renk === bazRenk);

    if (renklerAyni) {
      // Ardışıklığı kontrol et
      let seriGecerli = true;
      let beklenenSayi = null;

      // İlk net taştan geriye ve ileriye projeksiyon
      for (let i = 0; i < islenmis.length; i++) {
        if (!islenmis[i].isOkey) {
          beklenenSayi = islenmis[i].sayi - i;
          break;
        }
      }

      if (beklenenSayi !== null) {
        let toplamPuan = 0;
        for (let i = 0; i < islenmis.length; i++) {
          const t = islenmis[i];
          let sayiDegeri = beklenenSayi + i;

          // 13'ten sonra 1 gelme özel kuralı (11-12-13-1)
          if (sayiDegeri === 14 && i === islenmis.length - 1) {
            sayiDegeri = 1;
          }

          if (!t.isOkey) {
            if (t.sayi !== sayiDegeri && !(t.sayi === 1 && sayiDegeri === 14)) {
              seriGecerli = false;
              break;
            }
          }

          toplamPuan += (sayiDegeri === 14 ? 1 : sayiDegeri);
        }

        if (seriGecerli) {
          return { gecerli: true, puan: toplamPuan, tur: 'seri' };
        }
      }
    }
  }

  return { gecerli: false, puan: 0 };
}

// Her oyuncunun kendi ekran perspektifine göre masa durumunu oluşturur
function oyuncuIcinMasaDurumu(oyun, oyuncuId) {
  const benimIndex = oyun.oyuncuSirasi.indexOf(oyuncuId);
  const siraBenimMi = suankiOyuncuId(oyun) === oyuncuId;

  // Masadaki 4 koltuğu bu oyuncunun açısına göre eşle:
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
    faz: oyun.faz,
    aktifOyuncuId: suankiOyuncuId(oyun),
    benimElim: oyun.eller[oyuncuId] || [],
    gosterge: oyun.gosterge,
    okeyBilgisi: oyun.okeyBilgisi,
    kalanDesteSayisi: oyun.deste.length,
    acilanPerler: oyun.acilanPerler || [],
    acilanCiftler: oyun.acilanCiftler || [],
    koltuklar: koltuklar,
    sonAtilanTas: oyun.sonAtilanTas,
    yandanAldiMi: Boolean(oyun.yandanCekilenTas && oyun.yandanCekilenTas.oyuncuId === oyuncuId),
    kazanan: oyun.kazanan
  };
}

module.exports = {
  desteOlustur,
  yeniOyunBaslat,
  destedenTasCek,
  yandanTasCek,
  yandanTasiGeriKoy,
  tasAt,
  elAc,
  perDogrulaVePuanla,
  suankiOyuncuId,
  oyuncuIcinMasaDurumu,
  okeyMi
};
