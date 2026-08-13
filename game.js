// game.js — 101 Okey Backend Oyun ve Kural Motoru

const RENKLER = ['sari', 'mavi', 'siyah', 'kirmizi'];

// Standart 101 Okey Taşı Oluşturucu (106 Taş: 104 Sayı Taşı + 2 Sahte Okey)
function desteOlustur() {
  const deste = [];
  let id = 0;

  for (let set = 0; set < 2; set++) {
    for (const renk of RENKLER) {
      for (let sayi = 1; sayi <= 13; sayi++) {
        deste.push({
          id: `t_${id++}`,
          renk: renk,
          sayi: sayi,
          fake: false
        });
      }
    }
  }

  // 2 Sahte Okey (S harfli damgalı taş)
  deste.push({ id: `t_${id++}`, renk: 'sahte', sayi: 'S', fake: true });
  deste.push({ id: `t_${id++}`, renk: 'sahte', sayi: 'S', fake: true });

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

function okeyBelirle(gosterge) {
  const okeySayi = gosterge.sayi === 13 ? 1 : gosterge.sayi + 1;
  return { sayi: okeySayi, renk: gosterge.renk };
}

function okeyMi(tas, okeyBilgisi) {
  if (!tas || !okeyBilgisi) return false;
  if (tas.fake) return false;
  return tas.sayi === okeyBilgisi.sayi && tas.renk === okeyBilgisi.renk;
}

// Yeni Oyun Başlat (4 Kişilik 101 Okey)
function yeniOyunBaslat(oyuncular, ayarlar = {}) {
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
  const cezaPuanlari = {};
  const cezaArtilar = {};

  oyuncuIdleri.forEach(pid => {
    eller[pid] = [];
    atilmisTaslar[pid] = [];
    oyuncuAcmaDurumu[pid] = { acildiMi: false, tur: null, puan: 0 };
    cezaPuanlari[pid] = 0;
    cezaArtilar[pid] = 0;
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
    cezaPuanlari: cezaPuanlari,
    cezaArtilar: cezaArtilar,
    turSkorlari: [],
    turNo: 1,
    toplamTur: parseInt(ayarlar.turSayisi) || 5,
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

// Desteden taş çek
function destedenTasCek(oyun, oyuncuId) {
  if (suankiOyuncuId(oyun) !== oyuncuId) {
    return { ok: false, hata: 'Sıra sizde değil!' };
  }
  if (oyun.faz !== 'draw') {
    return { ok: false, hata: 'Zaten taş çektiniz, şimdi bir taş atmalısınız!' };
  }
  if (oyun.deste.length === 0) {
    elSonuHesapla(oyun, null);
    return { ok: true, oyunBitti: true };
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
  oyun.faz = 'draw';
  oyun.sonCekilenTas = null;
  oyun.yandanCekilenTas = null;

  return { ok: true, tas };
}

// İŞLEK TAŞ KONTROLÜ (Açılmış serilere veya gruplara eklenebilen taş mı?)
function tasIslenebilirMi(tas, acilanPerler, acilanCiftler, okeyBilgisi) {
  if (!tas) return { islenebilir: false };

  const sayi = tas.fake ? (okeyBilgisi ? okeyBilgisi.sayi : 1) : tas.sayi;
  const renk = tas.fake ? (okeyBilgisi ? okeyBilgisi.renk : 'sari') : tas.renk;
  const joker = okeyMi(tas, okeyBilgisi);

  // 1. Açılan Seri Perleri Kontrol Et
  if (acilanPerler && Array.isArray(acilanPerler)) {
    for (let i = 0; i < acilanPerler.length; i++) {
      const per = acilanPerler[i].per;
      if (!per || per.length === 0) continue;

      // A. Sıralı Seri (örn: 10-11-12 aynı renk)
      const bazRenk = per.find(t => !okeyMi(t, okeyBilgisi) && !t.fake)?.renk || per[0].renk;
      const ayniRenk = per.every(t => (t.fake ? okeyBilgisi?.renk : (okeyMi(t, okeyBilgisi) ? bazRenk : t.renk)) === bazRenk);

      if (ayniRenk && (renk === bazRenk || joker)) {
        const ilkTas = per[0];
        const sonTas = per[per.length - 1];
        const ilkSayi = ilkTas.fake ? okeyBilgisi.sayi : ilkTas.sayi;
        const sonSayi = sonTas.fake ? okeyBilgisi.sayi : sonTas.sayi;

        // Sol Başa ekleme (örn: 10-11-12'nin soluna 9)
        if (sayi === ilkSayi - 1 && ilkSayi > 1) {
          return { islenebilir: true, tur: 'seri', perIndex: i, taraf: 'sol', hedefPer: per };
        }
        // Sağ Sona ekleme (örn: 10-11-12'nin sağına 13)
        if (sayi === sonSayi + 1 && sonSayi < 13) {
          return { islenebilir: true, tur: 'seri', perIndex: i, taraf: 'sag', hedefPer: per };
        }
        // 13'ün sağına 1 ekleme (örn: 11-12-13'ün sağına 1)
        if (sonSayi === 13 && sayi === 1) {
          return { islenebilir: true, tur: 'seri', perIndex: i, taraf: 'sag', hedefPer: per };
        }
      }

      // B. Aynı Sayı Farklı Renk Grubu (örn: 6 sarı, 6 mavi, 6 siyah — 4. renk eklenebilir)
      if (per.length === 3) {
        const ilkSayi = per.find(t => !okeyMi(t, okeyBilgisi) && !t.fake)?.sayi || per[0].sayi;
        const ayniSayi = per.every(t => (t.fake ? okeyBilgisi?.sayi : (okeyMi(t, okeyBilgisi) ? ilkSayi : t.sayi)) === ilkSayi);

        if (ayniSayi && (sayi === ilkSayi || joker)) {
          const mevcutRenkler = new Set(per.map(t => (t.fake ? okeyBilgisi?.renk : t.renk)));
          if (!mevcutRenkler.has(renk) || joker) {
            return { islenebilir: true, tur: 'grup', perIndex: i, taraf: 'set', hedefPer: per };
          }
        }
      }
    }
  }

  // 2. Açılan Çiftleri Kontrol Et
  if (acilanCiftler && Array.isArray(acilanCiftler)) {
    for (let i = 0; i < acilanCiftler.length; i++) {
      const cift = acilanCiftler[i].cift;
      if (cift && cift.length === 2) {
        if (cift[0].sayi === sayi && cift[0].renk === renk) {
          return { islenebilir: true, tur: 'cift', ciftIndex: i };
        }
      }
    }
  }

  return { islenebilir: false };
}

// TAŞ İŞLEME AKSİYONU (Açılmış serilere / çiftlere taş ekleme)
function tasIsle(oyun, oyuncuId, tasId, perIndex, taraf) {
  if (suankiOyuncuId(oyun) !== oyuncuId) {
    return { ok: false, hata: 'Sıra sizde değil!' };
  }
  if (oyun.faz !== 'discard') {
    return { ok: false, hata: 'Taş çekmeden taş işleyemezsiniz!' };
  }

  const acma = oyun.oyuncuAcmaDurumu[oyuncuId];
  if (!acma || !acma.acildiMi) {
    return { ok: false, hata: 'Taş işlemek için önce elinizi açmış olmanız gerekir!' };
  }

  const el = oyun.eller[oyuncuId];
  const tasIndex = el.findIndex(t => t.id === tasId);
  if (tasIndex === -1) {
    return { ok: false, hata: 'İşlenecek taş elinizde bulunmuyor!' };
  }

  const tas = el[tasIndex];
  const hedefGrup = oyun.acilanPerler[perIndex];
  if (!hedefGrup || !hedefGrup.per) {
    return { ok: false, hata: 'Hedef per bulunamadı!' };
  }

  // Çift açan birisi perlere taş işleyemez
  if (acma.tur === 'cift') {
    return { ok: false, hata: 'Çift açan oyuncular sadece çiftlere taş işleyebilir!' };
  }

  // Taşı elden çıkar ve per grubuna ekle
  el.splice(tasIndex, 1);

  if (taraf === 'sol') {
    hedefGrup.per.unshift(tas);
  } else {
    hedefGrup.per.push(tas);
  }

  // Oyun bitti mi kontrolü (Elde 0 taş kaldıysa)
  if (el.length === 0) {
    elSonuHesapla(oyun, oyuncuId);
    return { ok: true, oyunBitti: true, kazanan: oyuncuId };
  }

  return { ok: true, perIndex, taraf };
}

// TAŞ ATMA VE İŞLEK TAŞ CEZASI KONTROLÜ
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

  // 101 KURALI: İşlek Taş Atma Cezası (+101 Ceza ve Kırmızı Artı)
  let cezaUyarisi = null;
  if (oyun.acilanPerler.length > 0 || oyun.acilanCiftler.length > 0) {
    const islekSonuc = tasIslenebilirMi(atilanTas, oyun.acilanPerler, oyun.acilanCiftler, oyun.okeyBilgisi);
    if (islekSonuc.islenebilir) {
      oyun.cezaPuanlari[oyuncuId] = (oyun.cezaPuanlari[oyuncuId] || 0) + 101;
      oyun.cezaArtilar[oyuncuId] = (oyun.cezaArtilar[oyuncuId] || 0) + 1;
      cezaUyarisi = `${oyun.isimler[oyuncuId]} işlek taş attığı için +101 Ceza Puanı aldı (+) !`;
    }
  }

  // Oyun bitti mi kontrolü (Elde 0 taş kaldıysa bitiş)
  if (el.length === 0) {
    elSonuHesapla(oyun, oyuncuId);
    return { ok: true, atilanTas, oyunBitti: true, kazanan: oyuncuId, cezaUyarisi };
  }

  // Sırayı bir sonraki oyuncuya geçir
  oyun.siraIndex = (oyun.siraIndex + 1) % 4;
  oyun.faz = 'draw';
  oyun.sonCekilenTas = null;

  return { ok: true, atilanTas, sonrakiOyuncuId: suankiOyuncuId(oyun), cezaUyarisi };
}

// EL AÇMA İSTEĞİ (İLK AÇILIŞTA 101 / 5 ÇİFT, SONRAKİ TURLARDA SERBEST PER AÇIMI)
function elAc(oyun, oyuncuId, acilacakGruplar, mod) {
  if (suankiOyuncuId(oyun) !== oyuncuId) {
    return { ok: false, hata: 'Sıra sizde değil!' };
  }
  if (oyun.faz !== 'discard') {
    return { ok: false, hata: 'Taş çekmeden el açamazsınız!' };
  }

  const el = oyun.eller[oyuncuId];
  const oyuncuIsim = oyun.isimler[oyuncuId] || 'Oyuncu';
  const dahaOnceActiMi = oyun.oyuncuAcmaDurumu[oyuncuId]?.acildiMi;

  if (mod === 'cift') {
    // İlk açılışsa en az 5 çift gerekir, daha önce açtıysa 1 çift de açabilir
    if (!dahaOnceActiMi && acilacakGruplar.length < 5) {
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

    oyun.oyuncuAcmaDurumu[oyuncuId] = { acildiMi: true, tur: 'cift', puan: (oyun.oyuncuAcmaDurumu[oyuncuId].puan || 0) + acilacakGruplar.length };
    oyun.yandanCekilenTas = null;
    return { ok: true, mod: 'cift' };
  } else {
    // Çift açmış birisi per açamaz
    if (dahaOnceActiMi && oyun.oyuncuAcmaDurumu[oyuncuId]?.tur === 'cift') {
      return { ok: false, hata: 'Çift açan oyuncular per açamaz!' };
    }

    let toplamPuan = 0;
    for (const per of acilacakGruplar) {
      const dogrulama = perDogrulaVePuanla(per, oyun.okeyBilgisi);
      if (!dogrulama.gecerli) {
        return { ok: false, hata: 'Geçersiz per grubu tespit edildi!' };
      }
      toplamPuan += dogrulama.puan;
    }

    // İlk açılışta en az 101 puan şartı vardır; daha önce açmışsa 101 şartı aranmaz
    if (!dahaOnceActiMi && toplamPuan < 101) {
      return { ok: false, hata: `İlk açılış için en az 101 puan gerekir! (Şu anki: ${toplamPuan})` };
    }

    for (const per of acilacakGruplar) {
      oyun.acilanPerler.push({ oyuncuId, oyuncuIsim, per });
      per.forEach(t => {
        const idx = el.findIndex(e => e.id === t.id);
        if (idx !== -1) el.splice(idx, 1);
      });
    }

    oyun.oyuncuAcmaDurumu[oyuncuId] = {
      acildiMi: true,
      tur: 'seri',
      puan: (oyun.oyuncuAcmaDurumu[oyuncuId].puan || 0) + toplamPuan
    };
    oyun.yandanCekilenTas = null;
    return { ok: true, mod: 'seri', puan: toplamPuan };
  }
}

// 101 OKEY KURAL MOTORU: PER DOĞRULAMA VE PUAN HESAPLAMA
function perDogrulaVePuanla(per, okeyBilgisi) {
  if (!per || per.length < 3) return { gecerli: false, puan: 0 };

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
      let seriGecerli = true;
      let beklenenSayi = null;

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

// 101 OKEY KURALI: EL SONU CEZA VE PUAN HESAPLAMA (SKOR TABLOSU)
function elSonuHesapla(oyun, kazananId) {
  oyun.durum = 'el_bitti';
  oyun.kazanan = kazananId;

  // Masada çift açan var mı kontrolü (Çift açan varsa açmayanlara 202 yazılır)
  const ciftAcanVar = Object.values(oyun.oyuncuAcmaDurumu).some(a => a.acildiMi && a.tur === 'cift');
  const turSkorlari = {};

  oyun.oyuncuSirasi.forEach(pid => {
    let puan = 0;

    if (pid === kazananId) {
      // Eli bitiren oyuncuya -101 puan yazılır
      puan = -101;
    } else {
      const acma = oyun.oyuncuAcmaDurumu[pid];
      if (acma && acma.acildiMi) {
        // El açan oyuncunun elinde kalan taşların sayı toplamı
        const kalanTaslar = oyun.eller[pid] || [];
        let elToplami = 0;
        kalanTaslar.forEach(t => {
          if (t.fake) elToplami += (oyun.okeyBilgisi ? oyun.okeyBilgisi.sayi : 1);
          else if (okeyMi(t, oyun.okeyBilgisi)) elToplami += 25; // Okey elde kalırsa 25
          else elToplami += t.sayi;
        });

        // Çift açmışsa el toplamı 2 ile çarpılır
        if (acma.tur === 'cift') {
          elToplami *= 2;
        }
        puan = elToplami;
      } else {
        // El açmayan oyuncuya normalde +101, masada çift açan varsa +202 yazılır
        puan = ciftAcanVar ? 202 : 101;
      }
    }

    // Oyun içindeki işlek taş vb. ceza puanlarını ekle
    const ceza = oyun.cezaPuanlari[pid] || 0;
    turSkorlari[pid] = puan + ceza;
  });

  oyun.turSkorlari.push({
    turNo: oyun.turNo,
    skorlar: turSkorlari
  });

  return turSkorlari;
}

// Her oyuncunun kendi ekran perspektifine göre masa durumunu oluşturur
function oyuncuIcinMasaDurumu(oyun, oyuncuId) {
  const benimIndex = oyun.oyuncuSirasi.indexOf(oyuncuId);
  const siraBenimMi = suankiOyuncuId(oyun) === oyuncuId;

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
      acmaDurumu: acma,
      cezaArtisi: oyun.cezaArtilar[pid] || 0,
      cezaPuani: oyun.cezaPuanlari[pid] || 0
    };
  });

  // Toplam puan tablosunu hesapla
  const toplamSkorlar = {};
  oyun.oyuncuSirasi.forEach(pid => {
    toplamSkorlar[pid] = oyun.turSkorlari.reduce((acc, t) => acc + (t.skorlar[pid] || 0), 0);
  });

  return {
    durum: oyun.durum,
    benimId: oyuncuId,
    siraBenimMi: siraBenimMi,
    faz: oyun.faz,
    aktifOyuncuId: suankiOyuncuId(oyun),
    benimElim: oyun.eller[oyuncuId] || [],
    benimAcmaDurumu: oyun.oyuncuAcmaDurumu[oyuncuId],
    gosterge: oyun.gosterge,
    okeyBilgisi: oyun.okeyBilgisi,
    kalanDesteSayisi: oyun.deste.length,
    acilanPerler: oyun.acilanPerler || [],
    acilanCiftler: oyun.acilanCiftler || [],
    koltuklar: koltuklar,
    sonAtilanTas: oyun.sonAtilanTas,
    yandanAldiMi: Boolean(oyun.yandanCekilenTas && oyun.yandanCekilenTas.oyuncuId === oyuncuId),
    turSkorlari: oyun.turSkorlari,
    toplamSkorlar: toplamSkorlar,
    turNo: oyun.turNo,
    toplamTur: oyun.toplamTur,
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
  tasIsle,
  tasIslenebilirMi,
  elAc,
  elSonuHesapla,
  perDogrulaVePuanla,
  suankiOyuncuId,
  oyuncuIcinMasaDurumu,
  okeyMi
};
