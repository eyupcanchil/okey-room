// games.js — 101 Okey İstemci & Istaka / Sıra Yönetim Motoru

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

// Sürükle-Bırak Geçici Değişkenleri
let suruklenenSlotIndex = null;
let suruklenenTas = null;

// Saniye Sayacı / Bar Durumu
let siraTimer = null;
const SIRA_SURESI_SANIYE = 30;

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
  istakaSlotlariniOlustur();

  // Odaya Katıl
  socket.emit('oyuna_katil', { odaId: odaId, kullaniciAdi: kullaniciAdi });

  // Sırala Menüsü Dropdown Toggle
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

  // SAĞ BANKA: Desteden Taş Çekme Etkileşimi
  const desteAlani = document.getElementById('ortadakiTaslarAlani');
  desteAlani.addEventListener('click', () => {
    if (!suankiOyunDurumu) return;
    if (suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'draw') {
      socket.emit('tas_cek', { odaId, kaynak: 'deste' });
    } else if (suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
      toastGoster('Zaten taş çektiniz! Şimdi sağ tarafa bir taş atmalısınız.');
    }
  });

  // SOL ALT KÖŞE: Solundaki Oyuncunun Attığı Taş (Yandan Çek)
  const solAltKutu = document.getElementById('koseSolAlt');
  solAltKutu.addEventListener('click', () => {
    if (!suankiOyunDurumu) return;
    if (suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'draw') {
      socket.emit('tas_cek', { odaId, kaynak: 'yandan' });
    } else if (suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
      toastGoster('Zaten taş çektiniz! Şimdi sağ tarafa bir taş atmalısınız.');
    }
  });

  // SAĞ ALT KÖŞE: Senin Taş Atma Alanın
  const sagAltKutu = document.getElementById('koseSagAlt');
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

  // Sağ alt köşeye Drag-Drop ile taş atma
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
  }, 2400);
}

// 28 Slotlu Istakayı DOM'a Hazırla (14 Üst, 14 Alt)
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

    slotDiv.addEventListener('drop', (e) => {
      e.preventDefault();
      slotDiv.classList.remove('drag-over');
      const hedefSlot = parseInt(slotDiv.dataset.slotIndex);
      slotaTasBirak(suruklenenSlotIndex, hedefSlot);
    });

    if (i < SATIR_SLOT_SAYISI) {
      ustSatir.appendChild(slotDiv);
    } else {
      altSatir.appendChild(slotDiv);
    }
  }
}

// HATASIZ VE KESİN TAŞ KAYDIRMA / YER DEĞİŞTİRME ALGORİTMASI
function slotaTasBirak(kaynakSlot, hedefSlot) {
  if (kaynakSlot === null || kaynakSlot === undefined || isNaN(kaynakSlot)) return;
  if (hedefSlot === kaynakSlot) return;

  const tas = slots[kaynakSlot];
  if (!tas) return;

  // 1. Önce taşın eski konumunu temizle
  slots[kaynakSlot] = null;

  // 2. Hedef slot boş ise direkt yerleştir
  if (!slots[hedefSlot]) {
    slots[hedefSlot] = tas;
    istakayiEkranaBas();
    hesaplaVeGoster();
    return;
  }

  // 3. Hedef slot doluysa: O satır içindeki sınırları belirle
  const satirBasi = hedefSlot < SATIR_SLOT_SAYISI ? 0 : SATIR_SLOT_SAYISI;
  const satirSonu = hedefSlot < SATIR_SLOT_SAYISI ? (SATIR_SLOT_SAYISI - 1) : (TOPLAM_SLOT - 1);

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

  if (bosSag !== -1) {
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

// Istakayı Ekrana Render Et (Yıldızlı ve S Damgalı Taşlar)
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

      // Tıklama (Seçme / Çift Tıklamayla Atma)
      tasDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        seciliTasId = seciliTasId === tas.id ? null : tas.id;
        istakayiEkranaBas();
      });

      tasDiv.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (suankiOyunDurumu && suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
          tasAt(tas.id);
        }
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

  if (guncelMod === 'cift') {
    if (ciftSayisi < 5) {
      toastGoster(`Çift açmak için en az 5 çift gereklidir! (Mevcut: ${ciftSayisi})`);
      return;
    }
    socket.emit('el_ac', { odaId, gruplar: ciftler, mod: 'cift' });
  } else {
    if (puan < 101) {
      toastGoster(`Açmak için en az 101 puan gereklidir! (Mevcut: ${puan})`);
      return;
    }
    socket.emit('el_ac', { odaId, gruplar: gruplar, mod: 'seri' });
  }
}

// Masadaki Açılan Taşları Render Et (Fotoğraf 2'deki gibi)
function acilanTaslariRenderEt(acilanPerler, acilanCiftler) {
  const serilerKolon = document.getElementById('acilanSerilerKolon');
  const ciftlerKolon = document.getElementById('acilanCiftlerKolon');
  if (!serilerKolon || !ciftlerKolon) return;

  serilerKolon.innerHTML = '';
  ciftlerKolon.innerHTML = '';

  // 1. Seri Perler (Yatay Dizilimler)
  if (acilanPerler && Array.isArray(acilanPerler)) {
    acilanPerler.forEach(item => {
      const grupDiv = document.createElement('div');
      grupDiv.className = 'acilan-per-grubu';

      item.per.forEach(tas => {
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

      serilerKolon.appendChild(grupDiv);
    });
  }

  // 2. Çiftler (Dikey / İkili Dizilimler)
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

// Masa Bilgisi Geldiğinde
socket.on('masa_bilgisi', (data) => {
  document.getElementById('ekranMasaKodu').innerText = data.pin;
  document.getElementById('ekranTurSayisi').innerText = `1 / ${data.ayarlar.turSayisi || 1}`;
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

  // Bekleme alanını gizle
  const beklemeAlani = document.getElementById('beklemeAlani');
  if (beklemeAlani) beklemeAlani.style.display = 'none';

  // Banka: Deste Sayısı ve Gösterge Taşı
  const kalanTasSayisi = document.getElementById('kalanTasSayisi');
  if (kalanTasSayisi) {
    kalanTasSayisi.innerText = durum.kalanDesteSayisi;
  }

  if (durum.gosterge) {
    const gostergeDiv = document.getElementById('gostergeTasi');
    if (gostergeDiv) {
      gostergeDiv.className = `tas gosterge-tasi renk-${durum.gosterge.renk}`;
      gostergeDiv.innerHTML = `<span class="tas-sayi-metin">${durum.gosterge.sayi}</span><span class="tas-yildiz">★</span>`;
    }
  }

  // Ortadaki Açılan Taşları Güncelle
  acilanTaslariRenderEt(durum.acilanPerler, durum.acilanCiftler);

  // Sıra Bildirimleri & Laser Vurguları
  const desteAlani = document.getElementById('ortadakiTaslarAlani');
  const solAltKutu = document.getElementById('koseSolAlt');
  const sagAltKutu = document.getElementById('koseSagAlt');

  if (desteAlani) desteAlani.classList.remove('cekilebilir');
  if (solAltKutu) solAltKutu.classList.remove('cekilebilir');
  if (sagAltKutu) sagAltKutu.classList.remove('atabilir');

  if (durum.siraBenimMi) {
    timerBaslat();
    if (durum.faz === 'draw') {
      if (desteAlani) desteAlani.classList.add('cekilebilir');
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
        if (isimEl) isimEl.innerText = k.isim;
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

  // Istakayı Senkronize Et
  if (durum.benimElim) {
    elSenkronizasyonu(durum.benimElim);
  }
});

// Gelen el listesi ile 28 slotu eşle
function elSenkronizasyonu(yeniEl) {
  if (!yeniEl || !Array.isArray(yeniEl)) return;
  const mevcutTaslar = slots.filter(t => t !== null);

  if (mevcutTaslar.length === 0) {
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

  istakayiEkranaBas();
  hesaplaVeGoster();
}

// Hata Bildirimi
socket.on('hata', (mesaj) => {
  toastGoster('⚠️ ' + mesaj);
});

// --- PER SIRALAMA FONKSİYONU ---
window.siralaPer = function () {
  guncelMod = 'per';
  const seciliBtn = document.getElementById('seciliSiralama');
  if (seciliBtn) seciliBtn.innerText = 'Per ▼';

  const el = slots.filter(t => t !== null);
  if (el.length === 0) return;

  el.sort((a, b) => {
    if (a.renk === b.renk) {
      if (a.sayi === 'S') return 1;
      if (b.sayi === 'S') return -1;
      return a.sayi - b.sayi;
    }
    return a.renk.localeCompare(b.renk);
  });

  slots.fill(null);
  let slotIdx = 0;
  let prevTas = null;

  for (let i = 0; i < el.length; i++) {
    const tas = el[i];

    if (prevTas) {
      const seriDevam = prevTas.renk === tas.renk && tas.sayi === prevTas.sayi + 1;
      const ayniSayi = prevTas.sayi === tas.sayi && prevTas.renk !== tas.renk;

      if (!seriDevam && !ayniSayi) {
        slotIdx++;
      }
    }

    if (slotIdx >= 12 && slotIdx < SATIR_SLOT_SAYISI) {
      slotIdx = SATIR_SLOT_SAYISI;
    }
    if (slotIdx >= TOPLAM_SLOT) {
      slotIdx = TOPLAM_SLOT - 1;
    }

    slots[slotIdx] = tas;
    prevTas = tas;
    slotIdx++;
  }

  istakayiEkranaBas();
  hesaplaVeGoster();
};

// --- ÇİFT SIRALAMA FONKSİYONU ---
window.siralaCift = function () {
  guncelMod = 'cift';
  const seciliBtn = document.getElementById('seciliSiralama');
  if (seciliBtn) seciliBtn.innerText = 'Çift ▼';

  const el = slots.filter(t => t !== null);
  if (el.length === 0) return;

  el.sort((a, b) => {
    if (a.sayi === b.sayi) return a.renk.localeCompare(b.renk);
    if (a.sayi === 'S') return 1;
    if (b.sayi === 'S') return -1;
    return a.sayi - b.sayi;
  });

  slots.fill(null);
  let slotIdx = 0;

  for (let i = 0; i < el.length; i++) {
    const suanki = el[i];
    const sonraki = el[i + 1];

    if (sonraki && suanki.sayi === sonraki.sayi && suanki.renk === sonraki.renk) {
      if (slotIdx < SATIR_SLOT_SAYISI - 2) {
        slots[slotIdx] = suanki;
        slots[slotIdx + 1] = sonraki;
        slotIdx += 3;
        i++;
        continue;
      } else if (slotIdx >= SATIR_SLOT_SAYISI && slotIdx < TOPLAM_SLOT - 1) {
        slots[slotIdx] = suanki;
        slots[slotIdx + 1] = sonraki;
        slotIdx += 3;
        i++;
        continue;
      } else if (slotIdx < SATIR_SLOT_SAYISI) {
        slotIdx = SATIR_SLOT_SAYISI;
        slots[slotIdx] = suanki;
        slots[slotIdx + 1] = sonraki;
        slotIdx += 3;
        i++;
        continue;
      }
    }

    if (slotIdx < TOPLAM_SLOT) {
      slots[slotIdx] = suanki;
      slotIdx++;
    }
  }

  istakayiEkranaBas();
  hesaplaVeGoster();
};

// Istakadaki ayrık per ve çift gruplarını hesaplayıp döndürür
function elGruplariniAyikla() {
  const okeyBilgisi = suankiOyunDurumu?.okeyBilgisi;
  let toplamPuan = 0;
  const gecerliGruplar = [];
  const gecerliCiftler = [];

  // 1. Seri Grupları
  for (let r = 0; r < 2; r++) {
    const baslangic = r * SATIR_SLOT_SAYISI;
    let grup = [];

    for (let i = baslangic; i < baslangic + SATIR_SLOT_SAYISI; i++) {
      const tas = slots[i];
      if (tas) {
        grup.push(tas);
      } else {
        const puan = grupPuaniniHesapla(grup, okeyBilgisi);
        if (puan > 0) {
          toplamPuan += puan;
          gecerliGruplar.push(grup);
        }
        grup = [];
      }
    }
    const puan = grupPuaniniHesapla(grup, okeyBilgisi);
    if (puan > 0) {
      toplamPuan += puan;
      gecerliGruplar.push(grup);
    }
  }

  // 2. Çift Grupları
  for (let r = 0; r < 2; r++) {
    const baslangic = r * SATIR_SLOT_SAYISI;
    for (let i = baslangic; i < baslangic + SATIR_SLOT_SAYISI - 1; i++) {
      const t1 = slots[i];
      const t2 = slots[i + 1];
      if (t1 && t2) {
        const eslesme = (t1.sayi === t2.sayi && t1.renk === t2.renk) || (tasOkeyMi(t1) || tasOkeyMi(t2));
        if (eslesme) {
          gecerliCiftler.push([t1, t2]);
          i++;
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

// OKEY (JOKER) DESTEKLİ PER PUAN HESAPLAMA
function grupPuaniniHesapla(grup, okeyBilgisi) {
  if (!grup || grup.length < 3) return 0;

  // 1. Aynı Sayı Grubu (Farklı renkler, max 4 taş)
  const netSayilar = grup.filter(t => !tasOkeyMi(t) && !t.fake);
  if (netSayilar.length > 0 && grup.length <= 4) {
    const bazSayi = netSayilar[0].sayi;
    const ayniSayi = netSayilar.every(t => t.sayi === bazSayi);
    const renkler = new Set(netSayilar.map(t => t.renk));
    if (ayniSayi && renkler.size === netSayilar.length) {
      return grup.length * bazSayi;
    }
  }

  // 2. Sıralı Seri (Aynı renk ardışık veya Okey joker)
  let sum = 0;
  for (let i = 0; i < grup.length; i++) {
    const t = grup[i];
    if (t.fake && okeyBilgisi) {
      sum += okeyBilgisi.sayi;
    } else if (tasOkeyMi(t)) {
      sum += (netSayilar.length > 0 ? (netSayilar[0].sayi + i) : 10);
    } else {
      sum += (t.sayi === 1 && grup.some(x => x.sayi === 13) ? 1 : t.sayi);
    }
  }
  return sum;
}



