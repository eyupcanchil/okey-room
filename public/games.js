// games.js — 101 Okey İstemci, Istaka, Taş İşleme, Ters Okey ve 10sn Sayım Motoru

const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const odaId = urlParams.get('oda');

const kullaniciAdi = sessionStorage.getItem('kullaniciAdi') || 'Oyuncu_' + Math.floor(Math.random() * 1000);
if (!sessionStorage.getItem('kullaniciAdi')) {
  sessionStorage.setItem('kullaniciAdi', kullaniciAdi);
}

// 28 Slotlu Standart Istaka (0..13 Üst Sıra, 14..27 Alt Sıra)
const TOPLAM_SLOT = 28;
const SATIR_SLOT_SAYISI = 14;
let slots = new Array(TOPLAM_SLOT).fill(null);
let suankiOyunDurumu = null;
let guncelMod = 'serbest'; // 'serbest' | 'per' | 'cift'
let seciliTasId = null;
let tersOkeyler = new Set(); // Arkası dönük (ters çevrilmiş) okey taşları

// Sürükle-Bırak & Çekme Koruması
let suruklenenSlotIndex = null;
let suruklenenTas = null;
let isDrawing = false;

// Saniye Sayacı / Bar Durumu
let siraTimer = null;
const SIRA_SURESI_SANIYE = 30;

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
  istakaSlotlariniOlustur();

  // Odaya Katıl
  socket.emit('oyuna_katil', { odaId: odaId, kullaniciAdi: kullaniciAdi });

  // Sırala Menüsü Dropdown
  const seciliSiralamaBtn = document.getElementById('seciliSiralama');
  const siralamaSecenekleri = document.getElementById('siralamaSecenekleri');

  seciliSiralamaBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    siralamaSecenekleri.classList.toggle('goster');
  });

  document.addEventListener('click', () => {
    siralamaSecenekleri.classList.remove('goster');
  });

  document.getElementById('btnSiralaPer').addEventListener('click', (e) => {
    e.preventDefault();
    siralaPer();
  });

  document.getElementById('btnSiralaCift').addEventListener('click', (e) => {
    e.preventDefault();
    siralaCift();
  });

  // El Aç Butonu
  document.getElementById('btnTasAc').addEventListener('click', () => {
    elAcIstegi();
  });

  // Taşı Geri Koy Butonu (Yandan alınan taşı geri bırakma)
  const btnTasiGeriKoy = document.getElementById('btnTasiGeriKoy');
  if (btnTasiGeriKoy) {
    btnTasiGeriKoy.addEventListener('click', () => {
      socket.emit('tasi_geri_koy', { odaId });
    });
  }

  // Kupa Butonu (Skor Tablosunu Aç / Kapat)
  const btnKupa = document.getElementById('btnKupa');
  const skorModal = document.getElementById('skorTablosuModal');
  const btnSkorKapat = document.getElementById('btnSkorTablosuKapat');

  if (btnKupa && skorModal) {
    btnKupa.addEventListener('click', () => {
      skorModal.style.display = 'flex';
      if (suankiOyunDurumu) skorTablosunuGuncelle(suankiOyunDurumu);
    });
  }
  if (btnSkorKapat && skorModal) {
    btnSkorKapat.addEventListener('click', () => {
      skorModal.style.display = 'none';
    });
  }

  // Botlarla Test Başlat Butonu
  const btnBotBaslat = document.getElementById('btnBotTestBaslat');
  if (btnBotBaslat) {
    btnBotBaslat.addEventListener('click', () => {
      socket.emit('test_oyunu_baslat', { odaId });
    });
  }

  // Davet Butonu (PIN Kopyala)
  const btnDavet = document.getElementById('btnDavetEt');
  if (btnDavet) {
    btnDavet.addEventListener('click', () => {
      const pin = document.getElementById('ekranMasaKodu').innerText;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(pin);
        toastGoster(`Masa Kodu (${pin}) panoya kopyalandı!`);
      }
    });
  }

  // YALNIZCA DESTE TAŞINA TIKLAYINCA TEK BİR TAŞ ÇEK
  const desteTasi = document.getElementById('desteTasiAlani');
  if (desteTasi) {
    desteTasi.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isDrawing) return;
      if (!suankiOyunDurumu || !suankiOyunDurumu.siraBenimMi || suankiOyunDurumu.faz !== 'draw') {
        if (suankiOyunDurumu && suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
          toastGoster('Zaten taş çektiniz! Şimdi sağ tarafa bir taş atmalısınız.');
        }
        return;
      }
      isDrawing = true;
      socket.emit('tas_cek', { odaId, kaynak: 'deste' });
    });
  }

  // SOL ALT KÖŞE: Yandan Taş Çekme
  const solAltKutu = document.getElementById('koseSolAlt');
  if (solAltKutu) {
    solAltKutu.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isDrawing) return;
      if (!suankiOyunDurumu || !suankiOyunDurumu.siraBenimMi || suankiOyunDurumu.faz !== 'draw') {
        if (suankiOyunDurumu && suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
          toastGoster('Zaten taş çektiniz! Şimdi sağ tarafa bir taş atmalısınız.');
        }
        return;
      }
      isDrawing = true;
      socket.emit('tas_cek', { odaId, kaynak: 'yandan' });
    });
  }

  // SAĞ ALT KÖŞE: Taş Atma Alanı
  const sagAltKutu = document.getElementById('koseSagAlt');
  if (sagAltKutu) {
    sagAltKutu.addEventListener('click', () => {
      if (!suankiOyunDurumu) return;
      if (suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
        if (seciliTasId) {
          tasAt(seciliTasId);
        } else {
          toastGoster('Atmak istediğiniz taşa tıklayın veya bu sağ köşeye sürükleyin.');
        }
      }
    });

    sagAltKutu.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (suankiOyunDurumu && suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
        sagAltKutu.classList.add('drag-over');
      }
    });
    sagAltKutu.addEventListener('dragleave', () => {
      sagAltKutu.classList.remove('drag-over');
    });
    sagAltKutu.addEventListener('drop', (e) => {
      e.preventDefault();
      sagAltKutu.classList.remove('drag-over');
      if (suruklenenTas && suankiOyunDurumu && suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
        tasAt(suruklenenTas.id);
      }
    });
  }
});

// Saniye Çubuğu Zamanlayıcısı
function timerBaslat() {
  timerDurdur();
  const container = document.getElementById('saniyeCubuguContainer');
  const bar = document.getElementById('saniyeCubuguBar');
  if (!container || !bar) return;

  container.style.display = 'block';
  bar.style.width = '100%';
  bar.style.background = '#00e676';

  const startTime = Date.now();
  const totalDuration = SIRA_SURESI_SANIYE * 1000;

  siraTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, totalDuration - elapsed);
    const percentage = (remaining / totalDuration) * 100;

    bar.style.width = `${percentage}%`;

    if (percentage > 50) {
      bar.style.background = '#00e676';
    } else if (percentage > 25) {
      bar.style.background = '#ffb900';
    } else {
      bar.style.background = '#ff1744';
    }

    if (remaining <= 0) {
      timerDurdur();
    }
  }, 100);
}

function timerDurdur() {
  if (siraTimer) {
    clearInterval(siraTimer);
    siraTimer = null;
  }
  const container = document.getElementById('saniyeCubuguContainer');
  if (container) {
    container.style.display = 'none';
  }
}

// Toast Mesaj Gösterici
function toastGoster(mesaj) {
  const toast = document.getElementById('toastMesaj');
  if (!toast) return;
  toast.innerText = mesaj;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
}

// 28 Slotlu Istakayı DOM'a Hazırla (14 Üst, 14 Alt) & ÇEYREK TAŞ HASSASİYETİ
function istakaSlotlariniOlustur() {
  const ustSatir = document.getElementById('istakaUst');
  const altSatir = document.getElementById('istakaAlt');
  ustSatir.innerHTML = '';
  altSatir.innerHTML = '';

  for (let i = 0; i < TOPLAM_SLOT; i++) {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'istaka-slot';
    slotDiv.dataset.slotIndex = i;

    slotDiv.addEventListener('dragover', (e) => {
      e.preventDefault();
      slotDiv.classList.add('drag-over');
    });

    slotDiv.addEventListener('dragleave', () => {
      slotDiv.classList.remove('drag-over');
    });

    // Çeyrek Taş Boyutu Hassasiyeti ile Bırakma
    slotDiv.addEventListener('drop', (e) => {
      e.preventDefault();
      slotDiv.classList.remove('drag-over');
      const hedefSlot = parseInt(slotDiv.dataset.slotIndex);
      const rect = slotDiv.getBoundingClientRect();
      const relativeX = (e.clientX - rect.left) / rect.width; // 0.0 .. 1.0 (Çeyrek hassasiyet)
      slotaTasBirak(suruklenenSlotIndex, hedefSlot, relativeX);
    });

    if (i < SATIR_SLOT_SAYISI) {
      ustSatir.appendChild(slotDiv);
    } else {
      altSatir.appendChild(slotDiv);
    }
  }
}

// ÇEYREK TAŞ HASSASİYETLİ VE HATASIZ TAŞ KAYDIRMA / YER DEĞİŞTİRME ALGORİTMASI
function slotaTasBirak(kaynakSlot, hedefSlot, relativeX = 0.5) {
  if (kaynakSlot === null || kaynakSlot === undefined || isNaN(kaynakSlot)) return;
  if (hedefSlot === kaynakSlot) return;

  const tas = slots[kaynakSlot];
  if (!tas) return;

  slots[kaynakSlot] = null;

  if (!slots[hedefSlot]) {
    slots[hedefSlot] = tas;
    istakayiEkranaBas();
    hesaplaVeGoster();
    return;
  }

  const satirBasi = hedefSlot < SATIR_SLOT_SAYISI ? 0 : SATIR_SLOT_SAYISI;
  const satirSonu = hedefSlot < SATIR_SLOT_SAYISI ? (SATIR_SLOT_SAYISI - 1) : (TOPLAM_SLOT - 1);

  // Çeyrek taş sol/sağ tercihine göre boşluk arama yönü
  let oncelikliYon = relativeX < 0.35 ? 'sol' : (relativeX > 0.65 ? 'sag' : 'sag');

  let bosSag = -1;
  for (let i = hedefSlot + 1; i <= satirSonu; i++) {
    if (!slots[i]) {
      bosSag = i;
      break;
    }
  }

  let bosSol = -1;
  for (let i = hedefSlot - 1; i >= satirBasi; i--) {
    if (!slots[i]) {
      bosSol = i;
      break;
    }
  }

  if (oncelikliYon === 'sol' && bosSol !== -1) {
    for (let i = bosSol; i < hedefSlot; i++) {
      slots[i] = slots[i + 1];
    }
    slots[hedefSlot] = tas;
  } else if (bosSag !== -1) {
    for (let i = bosSag; i > hedefSlot; i--) {
      slots[i] = slots[i - 1];
    }
    slots[hedefSlot] = tas;
  } else if (bosSol !== -1) {
    for (let i = bosSol; i < hedefSlot; i++) {
      slots[i] = slots[i + 1];
    }
    slots[hedefSlot] = tas;
  } else {
    const hedeftekiTas = slots[hedefSlot];
    slots[hedefSlot] = tas;
    slots[kaynakSlot] = hedeftekiTas;
  }

  istakayiEkranaBas();
  hesaplaVeGoster();
}

// Bir taşın Okey (Joker) olup olmadığını kontrol eder
function tasOkeyMi(tas) {
  if (!tas || !suankiOyunDurumu || !suankiOyunDurumu.okeyBilgisi) return false;
  if (tas.fake) return false;
  return tas.sayi === suankiOyunDurumu.okeyBilgisi.sayi && tas.renk === suankiOyunDurumu.okeyBilgisi.renk;
}

// Istakayı Ekrana Render Et (Yıldızlı, S Damgalı ve Çift Tıklamayla Ters Çevrilebilen Taşlar)
function istakayiEkranaBas() {
  const tumSlotlar = document.querySelectorAll('.istaka-slot');

  tumSlotlar.forEach((slotDiv, idx) => {
    slotDiv.innerHTML = '';
    const tas = slots[idx];

    if (tas) {
      const tasDiv = document.createElement('div');
      const okey = tasOkeyMi(tas);

      if (tas.fake) {
        tasDiv.className = 'tas renk-sahte';
        tasDiv.innerHTML = `<span class="tas-sayi-metin">S</span><span class="tas-yildiz">★</span>`;
      } else {
        tasDiv.className = `tas renk-${tas.renk}`;
        if (okey) tasDiv.classList.add('okey-tasi');
        tasDiv.innerHTML = `<span class="tas-sayi-metin">${tas.sayi}</span><span class="tas-yildiz">★</span>`;
      }

      // Kullanıcının eline gelen okey taşı varsayılan olarak sırtı dönük gelir veya çift tıklamayla ters döner
      if (tersOkeyler.has(tas.id)) {
        tasDiv.classList.add('tas-ters');
      }

      if (seciliTasId === tas.id) {
        tasDiv.style.border = '2px solid #ffd700';
        tasDiv.style.boxShadow = '0 0 15px rgba(255,215,0,0.8)';
        tasDiv.style.transform = 'translateY(-4px)';
      }

      tasDiv.draggable = true;

      // Drag Dinleyicileri
      tasDiv.addEventListener('dragstart', (e) => {
        suruklenenSlotIndex = idx;
        suruklenenTas = tas;
        tasDiv.classList.add('surukleniyor');
        e.dataTransfer.setData('text/plain', tas.id);
      });

      tasDiv.addEventListener('dragend', () => {
        tasDiv.classList.remove('surukleniyor');
        suruklenenSlotIndex = null;
        suruklenenTas = null;
      });

      // Tek Tıklama (Seçme)
      tasDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        seciliTasId = seciliTasId === tas.id ? null : tas.id;
        istakayiEkranaBas();
      });

      // Çift Tıklama (Okey Taşını Yüzünü Göster / Sırtını Çevir)
      tasDiv.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (tersOkeyler.has(tas.id)) {
          tersOkeyler.delete(tas.id);
        } else {
          tersOkeyler.add(tas.id);
        }
        istakayiEkranaBas();
      });

      slotDiv.appendChild(tasDiv);
    }
  });
}

// Taş Atma İsteği
function tasAt(tasId) {
  if (!suankiOyunDurumu || !suankiOyunDurumu.siraBenimMi || suankiOyunDurumu.faz !== 'discard') {
    toastGoster('Şu an taş atamazsınız!');
    return;
  }

  socket.emit('tas_at', { odaId, tasId });
  seciliTasId = null;
}

// El Açma Butonu Tıklandığında
function elAcIstegi() {
  if (!suankiOyunDurumu || !suankiOyunDurumu.siraBenimMi || suankiOyunDurumu.faz !== 'discard') {
    toastGoster('Taş çekmeden el açamazsınız!');
    return;
  }

  const { gruplar, puan, ciftler, ciftSayisi } = elGruplariniAyikla();
  const dahaOnceActiMi = suankiOyunDurumu.benimAcmaDurumu?.acildiMi;

  if (guncelMod === 'cift') {
    if (!dahaOnceActiMi && ciftSayisi < 5) {
      toastGoster(`Çift açmak için en az 5 çift gereklidir! (Mevcut: ${ciftSayisi})`);
      return;
    }
    if (ciftler.length === 0) {
      toastGoster('Istakanızda açılacak çift bulunamadı!');
      return;
    }
    socket.emit('el_ac', { odaId, gruplar: ciftler, mod: 'cift' });
  } else {
    // Seri açımı
    if (!dahaOnceActiMi && puan < 101) {
      toastGoster(`İlk açılış için en az 101 puan gereklidir! (Mevcut: ${puan})`);
      return;
    }
    if (gruplar.length === 0) {
      toastGoster('Istakanızda geçerli bir per grubu bulunamadı!');
      return;
    }
    socket.emit('el_ac', { odaId, gruplar: gruplar, mod: 'seri' });
  }
}

// MASADAKİ AÇILAN TAŞLARI RENDER ET VE İŞLEK TAŞLARA BEYAZ SAYDAM '+' KOY
function acilanTaslariRenderEt(acilanPerler, acilanCiftler) {
  const serilerKolon = document.getElementById('acilanSerilerKolon');
  const ciftlerKolon = document.getElementById('acilanCiftlerKolon');
  if (!serilerKolon || !ciftlerKolon) return;

  serilerKolon.innerHTML = '';
  ciftlerKolon.innerHTML = '';

  const eldekiTaslar = slots.filter(t => t !== null);
  const okeyBilgisi = suankiOyunDurumu?.okeyBilgisi;
  const islemeYapabilirMi = Boolean(
    suankiOyunDurumu?.siraBenimMi &&
    suankiOyunDurumu?.faz === 'discard' &&
    suankiOyunDurumu?.benimAcmaDurumu?.acildiMi &&
    suankiOyunDurumu?.benimAcmaDurumu?.tur !== 'cift'
  );

  // 1. Seri Perler (Fotoğraf 2'deki gibi yatay mini per satırları)
  if (acilanPerler && Array.isArray(acilanPerler)) {
    acilanPerler.forEach((item, perIdx) => {
      const grupDiv = document.createElement('div');
      grupDiv.className = 'acilan-per-grubu';

      const per = item.per;
      let solEslesme = null;
      let sagEslesme = null;
      let setEslesme = null;

      if (islemeYapabilirMi && per && per.length > 0) {
        const ilkTas = per[0];
        const sonTas = per[per.length - 1];
        const ilkSayi = ilkTas.fake ? okeyBilgisi.sayi : ilkTas.sayi;
        const sonSayi = sonTas.fake ? okeyBilgisi.sayi : sonTas.sayi;
        const bazRenk = per.find(t => !t.fake && !tasOkeyMi(t))?.renk || ilkTas.renk;
        const ayniRenk = per.every(t => (t.fake ? okeyBilgisi?.renk : (tasOkeyMi(t) ? bazRenk : t.renk)) === bazRenk);

        // Eldeki taşlar ile eşleşme kontrolü
        for (const t of eldekiTaslar) {
          const tSayi = t.fake ? okeyBilgisi.sayi : t.sayi;
          const tRenk = t.fake ? okeyBilgisi.renk : t.renk;
          const joker = tasOkeyMi(t);

          if (ayniRenk && (tRenk === bazRenk || joker)) {
            if (tSayi === ilkSayi - 1 && ilkSayi > 1 && !solEslesme) {
              solEslesme = t;
            }
            if (tSayi === sonSayi + 1 && sonSayi < 13 && !sagEslesme) {
              sagEslesme = t;
            }
            if (sonSayi === 13 && tSayi === 1 && !sagEslesme) {
              sagEslesme = t;
            }
          }

          if (per.length === 3 && !ayniRenk) {
            if (tSayi === ilkSayi || joker) {
              const renkler = new Set(per.map(p => (p.fake ? okeyBilgisi?.renk : p.renk)));
              if (!renkler.has(tRenk) || joker) {
                setEslesme = t;
              }
            }
          }
        }
      }

      // Sol başa işlek artı butonu
      if (solEslesme) {
        const artiSol = document.createElement('div');
        artiSol.className = 'btn-islek-arti';
        artiSol.innerText = '+';
        artiSol.title = `Eldeki ${solEslesme.sayi} taşını buraya işle`;
        artiSol.addEventListener('click', (e) => {
          e.stopPropagation();
          socket.emit('tas_isle', { odaId, tasId: solEslesme.id, perIndex: perIdx, taraf: 'sol' });
        });
        grupDiv.appendChild(artiSol);
      }

      // Taşların kendisi
      per.forEach(tas => {
        const miniTas = document.createElement('div');
        if (tas.fake) {
          miniTas.className = 'tas-mini renk-sahte';
          miniTas.innerHTML = `<span class="tas-sayi-metin">S</span><span class="tas-yildiz">★</span>`;
        } else {
          miniTas.className = `tas-mini renk-${tas.renk}`;
          if (tasOkeyMi(tas)) miniTas.classList.add('okey-tasi');
          miniTas.innerHTML = `<span class="tas-sayi-metin">${tas.sayi}</span><span class="tas-yildiz">★</span>`;
        }
        grupDiv.appendChild(miniTas);
      });

      // Sağ sona işlek artı butonu
      if (sagEslesme) {
        const artiSag = document.createElement('div');
        artiSag.className = 'btn-islek-arti';
        artiSag.innerText = '+';
        artiSag.title = `Eldeki ${sagEslesme.sayi} taşını buraya işle`;
        artiSag.addEventListener('click', (e) => {
          e.stopPropagation();
          socket.emit('tas_isle', { odaId, tasId: sagEslesme.id, perIndex: perIdx, taraf: 'sag' });
        });
        grupDiv.appendChild(artiSag);
      } else if (setEslesme) {
        const artiSet = document.createElement('div');
        artiSet.className = 'btn-islek-arti';
        artiSet.innerText = '+';
        artiSet.title = `Eldeki ${setEslesme.renk} ${setEslesme.sayi} taşını gruba işle`;
        artiSet.addEventListener('click', (e) => {
          e.stopPropagation();
          socket.emit('tas_isle', { odaId, tasId: setEslesme.id, perIndex: perIdx, taraf: 'sag' });
        });
        grupDiv.appendChild(artiSet);
      }

      serilerKolon.appendChild(grupDiv);
    });
  }

  // 2. Çiftler (Fotoğraf 2'deki gibi dikey ikili gruplar)
  if (acilanCiftler && Array.isArray(acilanCiftler)) {
    acilanCiftler.forEach(item => {
      const grupDiv = document.createElement('div');
      grupDiv.className = 'acilan-per-grubu';

      item.cift.forEach(tas => {
        const miniTas = document.createElement('div');
        if (tas.fake) {
          miniTas.className = 'tas-mini renk-sahte';
          miniTas.innerHTML = `<span class="tas-sayi-metin">S</span><span class="tas-yildiz">★</span>`;
        } else {
          miniTas.className = `tas-mini renk-${tas.renk}`;
          if (tasOkeyMi(tas)) miniTas.classList.add('okey-tasi');
          miniTas.innerHTML = `<span class="tas-sayi-metin">${tas.sayi}</span><span class="tas-yildiz">★</span>`;
        }
        grupDiv.appendChild(miniTas);
      });

      ciftlerKolon.appendChild(grupDiv);
    });
  }
}

// SKOR TABLOSUNU GÜNCELLE VE MODALDA GÖSTER
function skorTablosunuGuncelle(durum) {
  if (!durum || !durum.koltuklar) return;

  const koltuklar = durum.koltuklar;
  const th0 = document.getElementById('thOyuncu0');
  const th1 = document.getElementById('thOyuncu1');
  const th2 = document.getElementById('thOyuncu2');
  const th3 = document.getElementById('thOyuncu3');

  if (th0 && koltuklar[0]) th0.innerText = koltuklar[0].isim;
  if (th1 && koltuklar[1]) th1.innerText = koltuklar[1].isim;
  if (th2 && koltuklar[2]) th2.innerText = koltuklar[2].isim;
  if (th3 && koltuklar[3]) th3.innerText = koltuklar[3].isim;

  const govde = document.getElementById('skorGovde');
  if (!govde) return;
  govde.innerHTML = '';

  const turSkorlari = durum.turSkorlari || [];
  const toplamTur = durum.toplamTur || 5;

  for (let t = 1; t <= toplamTur; t++) {
    const tr = document.createElement('tr');
    const turData = turSkorlari.find(x => x.turNo === t);

    let html = `<td><strong>${t}. El</strong></td>`;
    for (let k = 0; k < 4; k++) {
      const pid = koltuklar[k] ? koltuklar[k].oyuncuId : null;
      let puanMetin = '-';
      let stil = '';

      if (turData && pid && turData.skorlar[pid] !== undefined) {
        const p = turData.skorlar[pid];
        puanMetin = p;
        if (p < 0) stil = 'style="color: #00e676; font-weight: 900;"';
        else if (p > 100) stil = 'style="color: #ff5252; font-weight: 700;"';
      }

      html += `<td class="sutun-ayrac" ${stil}>${puanMetin}</td>`;
    }

    tr.innerHTML = html;
    govde.appendChild(tr);
  }

  // Toplam Puanlar
  const toplamlar = durum.toplamSkorlar || {};
  for (let k = 0; k < 4; k++) {
    const el = document.getElementById(`toplamPuan${k}`);
    if (el && koltuklar[k]) {
      const p = toplamlar[koltuklar[k].oyuncuId] || 0;
      el.innerText = p;
      el.style.color = p < 0 ? '#00e676' : '#ffd700';
    }
  }
}

// 10 Saniye Sayım Bildirimi
socket.on('yeni_el_sayim', (data) => {
  let banner = document.getElementById('turSayimBanner');
  if (data.kalanSaniye > 0) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'turSayimBanner';
      banner.className = 'tur-sayim-banner';
      document.body.appendChild(banner);
    }
    banner.innerHTML = `⏱️ Yeni El Başlıyor: <strong>${data.kalanSaniye}s</strong>`;
  } else {
    if (banner) banner.remove();
  }
});

// Masa Bilgisi Geldiğinde
socket.on('masa_bilgisi', (data) => {
  document.getElementById('ekranMasaKodu').innerText = data.pin;
  document.getElementById('ekranTurSayisi').innerText = `1 / ${data.ayarlar.turSayisi || 5}`;
});

// Oyuncu Listesi Güncellendiğinde
socket.on('oyuncu_listesi_guncelle', (oyuncular) => {
  const beklemeYazisi = document.getElementById('beklemeYazisi');
  if (beklemeYazisi) {
    beklemeYazisi.innerText = `Diğer oyuncular bekleniyor (${oyuncular.length}/4)...`;
  }
});

// Anlık Oyun Durumu Güncellemesi (Tüm Masa Senkronizasyonu)
socket.on('oyun_durumu_guncelle', (durum) => {
  suankiOyunDurumu = durum;
  isDrawing = false;

  // Bekleme alanını gizle
  const beklemeAlani = document.getElementById('beklemeAlani');
  if (beklemeAlani) beklemeAlani.style.display = 'none';

  // Banka: Deste Sayısı ve Gösterge Taşı
  const kalanTasSayisi = document.getElementById('kalanTasSayisi');
  if (kalanTasSayisi) {
    kalanTasSayisi.innerText = durum.kalanDesteSayisi;
  }

  const ekranTur = document.getElementById('ekranTurSayisi');
  if (ekranTur) {
    ekranTur.innerText = `${durum.turNo || 1} / ${durum.toplamTur || 5}`;
  }

  if (durum.gosterge) {
    const gostergeDiv = document.getElementById('gostergeTasi');
    if (gostergeDiv) {
      gostergeDiv.className = `tas gosterge-tasi renk-${durum.gosterge.renk}`;
      gostergeDiv.innerHTML = `<span class="tas-sayi-metin">${durum.gosterge.sayi}</span><span class="tas-yildiz">★</span>`;
    }
  }

  // Yandan Taşı Geri Koy Butonunun Görünürlüğü
  const btnTasiGeriKoy = document.getElementById('btnTasiGeriKoy');
  if (btnTasiGeriKoy) {
    btnTasiGeriKoy.style.display = (durum.yandanAldiMi && durum.siraBenimMi && durum.faz === 'discard') ? 'inline-block' : 'none';
  }

  // Ortadaki Açılan Taşları ve İşlek Butonlarını Güncelle
  acilanTaslariRenderEt(durum.acilanPerler, durum.acilanCiftler);

  // Skor Tablosunu Güncelle
  skorTablosunuGuncelle(durum);

  if (durum.durum === 'el_bitti') {
    const skorModal = document.getElementById('skorTablosuModal');
    if (skorModal) skorModal.style.display = 'flex';
  }

  // Sıra Vurguları
  const desteTasi = document.getElementById('desteTasiAlani');
  const solAltKutu = document.getElementById('koseSolAlt');
  const sagAltKutu = document.getElementById('koseSagAlt');

  if (desteTasi) desteTasi.classList.remove('cekilebilir');
  if (solAltKutu) solAltKutu.classList.remove('cekilebilir');
  if (sagAltKutu) sagAltKutu.classList.remove('atabilir');

  if (durum.siraBenimMi) {
    timerBaslat();
    if (durum.faz === 'draw') {
      if (desteTasi) desteTasi.classList.add('cekilebilir');
      if (solAltKutu) solAltKutu.classList.add('cekilebilir');
    } else {
      if (sagAltKutu) sagAltKutu.classList.add('atabilir');
    }
  } else {
    timerDurdur();
  }

  // 4 Koltuk ve Köşeler
  if (durum.koltuklar && Array.isArray(durum.koltuklar)) {
    durum.koltuklar.forEach(k => {
      let koltukEl, koseTasEl;
      if (k.koltukYeri === 'alt') {
        koltukEl = document.getElementById('koltukAlt');
        koseTasEl = document.getElementById('kutuSagAltTas');
      } else if (k.koltukYeri === 'sol') {
        koltukEl = document.getElementById('koltukSol');
        koseTasEl = document.getElementById('kutuSolAltTas');
      } else if (k.koltukYeri === 'ust') {
        koltukEl = document.getElementById('koltukUst');
        koseTasEl = document.getElementById('kutuSolUstTas');
      } else if (k.koltukYeri === 'sag') {
        koltukEl = document.getElementById('koltukSag');
        koseTasEl = document.getElementById('kutuSagUstTas');
      }

      if (koltukEl && k.koltukYeri !== 'alt') {
        if (k.siraBundaMi) {
          koltukEl.classList.add('aktif-oyuncu');
        } else {
          koltukEl.classList.remove('aktif-oyuncu');
        }
        const isimEl = koltukEl.querySelector('.oyuncu-isim');
        if (isimEl) {
          isimEl.innerHTML = k.isim + (k.cezaArtisi > 0 ? `<span class="ceza-artilar"> ➕x${k.cezaArtisi} (+${k.cezaPuani})</span>` : '');
        }
        const durumEl = koltukEl.querySelector('.oyuncu-durum');
        if (durumEl) {
          if (k.acmaDurumu && k.acmaDurumu.acildiMi) {
            durumEl.innerText = k.acmaDurumu.tur === 'seri' ? `Seri Açtı (${k.acmaDurumu.puan})` : `Çift Açtı (${k.acmaDurumu.puan})`;
            durumEl.style.color = '#00e676';
          } else {
            durumEl.innerText = 'Açmadı';
            durumEl.style.color = '#999';
          }
        }
      }

      // Köşedeki son atılan taş
      if (koseTasEl) {
        if (k.sonAtilanTas) {
          const t = k.sonAtilanTas;
          if (t.fake) {
            koseTasEl.innerHTML = `<div class="tas renk-sahte"><span class="tas-sayi-metin">S</span><span class="tas-yildiz">★</span></div>`;
          } else {
            koseTasEl.innerHTML = `<div class="tas renk-${t.renk}"><span class="tas-sayi-metin">${t.sayi}</span><span class="tas-yildiz">★</span></div>`;
          }
        } else {
          koseTasEl.innerHTML = '';
        }
      }
    });
  }

  // Kullanıcının Istakasını Senkronize Et
  if (durum.benimElim) {
    elSenkronizasyonu(durum.benimElim);
  }
});

// Gelen el listesi ile 28 slotu eşle & OKEY TAŞINI VARSAYILAN OLARAK SIRTI DÖNÜK YAP
function elSenkronizasyonu(yeniEl) {
  if (!yeniEl || !Array.isArray(yeniEl)) return;

  // Yeni gelen okey taşlarını otomatik olarak sırtı dönük yap
  yeniEl.forEach(tas => {
    if (tasOkeyMi(tas) && !tersOkeyler.has(tas.id)) {
      tersOkeyler.add(tas.id);
    }
  });

  const mevcutDoluSlotlar = slots.filter(t => t !== null);

  if (mevcutDoluSlotlar.length === 0) {
    slots.fill(null);
    const ustAdet = Math.ceil(yeniEl.length / 2);
    yeniEl.forEach((tas, i) => {
      if (i < ustAdet) {
        slots[i] = tas;
      } else {
        const altIndex = SATIR_SLOT_SAYISI + (i - ustAdet);
        if (altIndex < TOPLAM_SLOT) {
          slots[altIndex] = tas;
        }
      }
    });
    istakayiEkranaBas();
    hesaplaVeGoster();
    return;
  }

  for (let i = 0; i < TOPLAM_SLOT; i++) {
    if (slots[i] && !yeniEl.find(t => t.id === slots[i].id)) {
      slots[i] = null;
    }
  }

  yeniEl.forEach(tas => {
    const slottaVarMi = slots.some(s => s && s.id === tas.id);
    if (!slottaVarMi) {
      const ilkBosSlot = slots.findIndex(s => s === null);
      if (ilkBosSlot !== -1) {
        slots[ilkBosSlot] = tas;
      }
    }
  });

  const guncelDolu = slots.filter(t => t !== null);
  if (guncelDolu.length !== yeniEl.length) {
    slots.fill(null);
    const ustAdet = Math.ceil(yeniEl.length / 2);
    yeniEl.forEach((tas, i) => {
      if (i < ustAdet) {
        slots[i] = tas;
      } else {
        slots[SATIR_SLOT_SAYISI + (i - ustAdet)] = tas;
      }
    });
  }

  istakayiEkranaBas();
  hesaplaVeGoster();
}

// Hata Bildirimi
socket.on('hata', (mesaj) => {
  isDrawing = false;
  toastGoster('⚠️ ' + mesaj);
});

// --- AKILLI VE BOŞLUKLU PER SIRALAMA (101 OKEY KURALINA GÖRE GRUPLAYIP BOŞLUKLU DİZER) ---
window.siralaPer = function () {
  guncelMod = 'per';
  const seciliBtn = document.getElementById('seciliSiralama');
  if (seciliBtn) seciliBtn.innerText = 'Per ▼';

  const el = (suankiOyunDurumu && suankiOyunDurumu.benimElim) ? [...suankiOyunDurumu.benimElim] : slots.filter(t => t !== null);
  if (el.length === 0) return;

  // 1. Taşları Renk ve Sayıya göre düzenle
  const renkGruplari = { kirmizi: [], mavi: [], siyah: [], sari: [], sahte: [] };
  el.forEach(t => {
    if (t.fake) renkGruplari.sahte.push(t);
    else if (renkGruplari[t.renk]) renkGruplari[t.renk].push(t);
  });

  Object.keys(renkGruplari).forEach(r => {
    renkGruplari[r].sort((a, b) => (a.sayi - b.sayi));
  });

  // 2. Ardışık serileri ve aynı sayı gruplarını tespit et
  const gruplar = [];
  const kullanilanTasId = new Set();

  // A. Renk içi ardışık serileri bul (örn: 10-11-12)
  ['kirmizi', 'mavi', 'siyah', 'sari'].forEach(renk => {
    const taslar = renkGruplari[renk];
    let seri = [];

    for (let i = 0; i < taslar.length; i++) {
      const t = taslar[i];
      if (seri.length === 0) {
        seri.push(t);
      } else {
        const sonTas = seri[seri.length - 1];
        if (t.sayi === sonTas.sayi + 1) {
          seri.push(t);
        } else if (t.sayi === sonTas.sayi) {
          // Çift olan aynı taşı atla
        } else {
          if (seri.length >= 3) {
            gruplar.push([...seri]);
            seri.forEach(st => kullanilanTasId.add(st.id));
          }
          seri = [t];
        }
      }
    }
    if (seri.length >= 3) {
      gruplar.push([...seri]);
      seri.forEach(st => kullanilanTasId.add(st.id));
    }
  });

  // B. Aynı sayı farklı renk gruplarını bul (örn: 6-6-6)
  const sayiHavuzu = {};
  el.forEach(t => {
    if (!t.fake && !kullanilanTasId.has(t.id)) {
      if (!sayiHavuzu[t.sayi]) sayiHavuzu[t.sayi] = [];
      if (!sayiHavuzu[t.sayi].some(x => x.renk === t.renk)) {
        sayiHavuzu[t.sayi].push(t);
      }
    }
  });

  Object.values(sayiHavuzu).forEach(ayniSayiGrubu => {
    if (ayniSayiGrubu.length >= 3) {
      gruplar.push([...ayniSayiGrubu]);
      ayniSayiGrubu.forEach(st => kullanilanTasId.add(st.id));
    }
  });

  // C. Kalan eşleşmemiş taşları topla
  const kalanTaslar = el.filter(t => !kullanilanTasId.has(t.id));
  kalanTaslar.sort((a, b) => {
    if (a.renk === b.renk) return a.sayi - b.sayi;
    return a.renk.localeCompare(b.renk);
  });

  // 3. Istaka Slotlarına 1 Boşluk Bırakarak Yerleştir (Fotoğraf 2'deki gibi)
  slots.fill(null);
  let slotIdx = 0;

  // Tespit edilen perleri yerleştir
  for (const grup of gruplar) {
    if (slotIdx < SATIR_SLOT_SAYISI && (slotIdx + grup.length) > SATIR_SLOT_SAYISI) {
      slotIdx = SATIR_SLOT_SAYISI;
    }
    if (slotIdx >= TOPLAM_SLOT) break;

    for (const t of grup) {
      if (slotIdx < TOPLAM_SLOT) {
        slots[slotIdx++] = t;
      }
    }
    if (slotIdx < SATIR_SLOT_SAYISI || slotIdx < TOPLAM_SLOT) {
      slotIdx++;
    }
  }

  for (const t of kalanTaslar) {
    if (slotIdx === SATIR_SLOT_SAYISI - 1 && kalanTaslar.length > 1) {
      slotIdx = SATIR_SLOT_SAYISI;
    }
    if (slotIdx >= TOPLAM_SLOT) {
      const bos = slots.findIndex(s => s === null);
      if (bos !== -1) slots[bos] = t;
    } else {
      slots[slotIdx++] = t;
    }
  }

  istakayiEkranaBas();
  hesaplaVeGoster();
};

// --- AKILLI ÇİFT SIRALAMA (FOTOĞRAF 2'DEKİ GİBİ İKİLİ GRUPLAR) ---
window.siralaCift = function () {
  guncelMod = 'cift';
  const seciliBtn = document.getElementById('seciliSiralama');
  if (seciliBtn) seciliBtn.innerText = 'Çift ▼';

  const el = (suankiOyunDurumu && suankiOyunDurumu.benimElim) ? [...suankiOyunDurumu.benimElim] : slots.filter(t => t !== null);
  if (el.length === 0) return;

  el.sort((a, b) => {
    const valA = a.sayi === 'S' ? 99 : (typeof a.sayi === 'number' ? a.sayi : parseInt(a.sayi) || 0);
    const valB = b.sayi === 'S' ? 99 : (typeof b.sayi === 'number' ? b.sayi : parseInt(b.sayi) || 0);
    if (valA === valB) return a.renk.localeCompare(b.renk);
    return valA - valB;
  });

  const ciftler = [];
  const tekler = [];
  const kullanilan = new Set();

  for (let i = 0; i < el.length; i++) {
    if (kullanilan.has(el[i].id)) continue;
    const suanki = el[i];
    const es = el.find((t, idx) => idx > i && !kullanilan.has(t.id) && t.sayi === suanki.sayi && t.renk === suanki.renk);

    if (es) {
      ciftler.push([suanki, es]);
      kullanilan.add(suanki.id);
      kullanilan.add(es.id);
    } else {
      tekler.push(suanki);
    }
  }

  slots.fill(null);
  let slotIdx = 0;

  for (const c of ciftler) {
    if (slotIdx === SATIR_SLOT_SAYISI - 1) slotIdx = SATIR_SLOT_SAYISI;
    if (slotIdx >= TOPLAM_SLOT - 1) break;

    slots[slotIdx] = c[0];
    slots[slotIdx + 1] = c[1];
    slotIdx += 3; // 2 taş + 1 boşluk
  }

  for (const t of tekler) {
    if (slotIdx >= TOPLAM_SLOT) {
      const bos = slots.findIndex(s => s === null);
      if (bos !== -1) slots[bos] = t;
    } else {
      slots[slotIdx++] = t;
    }
  }

  istakayiEkranaBas();
  hesaplaVeGoster();
};

// 101 OKEY KURALI: Bitişik bir grubun geçerli seri veya grup olup olmadığını hesaplar
function grupGecerliMi(grup, okeyBilgisi) {
  if (!grup || grup.length < 3) return { gecerli: false, puan: 0 };

  const fakeDeger = okeyBilgisi ? okeyBilgisi.sayi : 1;
  const fakeRenk = okeyBilgisi ? okeyBilgisi.renk : 'sari';

  const islenmis = grup.map(t => {
    const isOkey = tasOkeyMi(t);
    if (t.fake) {
      return { ...t, sayi: fakeDeger, renk: fakeRenk, isOkey: false };
    }
    return { ...t, isOkey: isOkey };
  });

  // 1. AYNI SAYI GRUBU (örn: 6 sarı, 6 mavi, 6 siyah — Max 4 taş, hepsi farklı renk)
  if (grup.length >= 3 && grup.length <= 4) {
    const netTaslar = islenmis.filter(t => !t.isOkey);
    if (netTaslar.length > 0) {
      const bazSayi = netTaslar[0].sayi;
      const sayilarAyni = netTaslar.every(t => t.sayi === bazSayi);
      const renkler = new Set(netTaslar.map(t => t.renk));
      if (sayilarAyni && renkler.size === netTaslar.length) {
        return { gecerli: true, puan: grup.length * bazSayi, tur: 'grup' };
      }
    }
  }

  // 2. SIRALI SERİ (Aynı renk ardışık: 10-11-12 veya 11-12-13-1)
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

// Istakadaki ayrık per ve çift gruplarını hesaplayıp döndürür
function elGruplariniAyikla() {
  const okeyBilgisi = suankiOyunDurumu?.okeyBilgisi;
  let toplamPuan = 0;
  const gecerliGruplar = [];
  const gecerliCiftler = [];

  // 1. Seri ve Grup Taraması (Slotlardaki bitişik taş blokları)
  for (let r = 0; r < 2; r++) {
    const baslangic = r * SATIR_SLOT_SAYISI;
    let blok = [];

    for (let i = baslangic; i < baslangic + SATIR_SLOT_SAYISI; i++) {
      const tas = slots[i];
      if (tas) {
        blok.push(tas);
      } else {
        if (blok.length >= 3) {
          const sonuc = grupGecerliMi(blok, okeyBilgisi);
          if (sonuc.gecerli) {
            toplamPuan += sonuc.puan;
            gecerliGruplar.push(blok);
          }
        }
        blok = [];
      }
    }
    if (blok.length >= 3) {
      const sonuc = grupGecerliMi(blok, okeyBilgisi);
      if (sonuc.gecerli) {
        toplamPuan += sonuc.puan;
        gecerliGruplar.push(blok);
      }
    }
  }

  // 2. Çift Taraması (Yan yana duran çift blokları)
  for (let r = 0; r < 2; r++) {
    const baslangic = r * SATIR_SLOT_SAYISI;
    for (let i = baslangic; i < baslangic + SATIR_SLOT_SAYISI - 1; i++) {
      const t1 = slots[i];
      const t2 = slots[i + 1];
      if (t1 && t2) {
        const eslesme = (t1.sayi === t2.sayi && t1.renk === t2.renk) || (tasOkeyMi(t1) || tasOkeyMi(t2));
        if (eslesme) {
          gecerliCiftler.push([t1, t2]);
          i++; // Çifti atla
        }
      }
    }
  }

  return {
    gruplar: gecerliGruplar,
    puan: toplamPuan,
    ciftler: gecerliCiftler,
    ciftSayisi: gecerliCiftler.length
  };
}

// --- SOL HUD PUAN HESAPLAMA & GÖSTERME ---
function hesaplaVeGoster() {
  const serilerEl = document.getElementById('hudSerilerPuan');
  const ciftlerEl = document.getElementById('hudCiftlerSayi');
  if (!serilerEl || !ciftlerEl) return;

  const { puan, ciftSayisi } = elGruplariniAyikla();

  serilerEl.innerText = `${puan} / 101`;
  serilerEl.style.color = puan >= 101 ? '#00e676' : '#ffdf78';

  ciftlerEl.innerText = `${ciftSayisi} / 5`;
  ciftlerEl.style.color = ciftSayisi >= 5 ? '#00e676' : '#ffdf78';
}
