// games.js — 101 Okey İstemci & Istaka / Sıra Yönetim Motoru

const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const odaId = urlParams.get('oda');

const kullaniciAdi = sessionStorage.getItem('kullaniciAdi') || 'Oyuncu_' + Math.floor(Math.random() * 1000);
if (!sessionStorage.getItem('kullaniciAdi')) {
  sessionStorage.setItem('kullaniciAdi', kullaniciAdi);
}

// 44 Slotlu Hassas Mikro-Izgara (0..21 Üst Sıra, 22..43 Alt Sıra)
// 22 slot = Taşlar yarım taş hassasiyetinde serbestçe kaydırılabilir
const TOPLAM_SLOT = 44;
const SATIR_SLOT_SAYISI = 22;
let slots = new Array(TOPLAM_SLOT).fill(null);
let suankiOyunDurumu = null;
let guncelMod = 'per'; // 'per' | 'cift'
let seciliTasId = null;

// Sürükle-Bırak Geçici Değişkenleri
let suruklenenSlotIndex = null;
let suruklenenTas = null;

// Saniye Sayacı / Bar Durumu
let siraTimer = null;
const SIRA_SURESI_SANIYE = 30;
let kalanSaniye = SIRA_SURESI_SANIYE;

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

  // Ortadaki Desteden Taş Çekme Etkileşimi
  const desteAlani = document.getElementById('ortadakiTaslarAlani');
  desteAlani.addEventListener('click', () => {
    if (!suankiOyunDurumu) return;
    if (suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'draw') {
      socket.emit('tas_cek', { odaId, kaynak: 'deste' });
    } else if (suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
      toastGoster('Zaten taş çektiniz! Şimdi bir taş atmalısınız.');
    }
  });

  // Sol Alttaki Yandan Taş Çekme Etkileşimi (Istakanın Sol Hizası)
  const solAltKutu = document.getElementById('koseSolAlt');
  solAltKutu.addEventListener('click', () => {
    if (!suankiOyunDurumu) return;
    if (suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'draw') {
      socket.emit('tas_cek', { odaId, kaynak: 'yandan' });
    } else if (suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
      toastGoster('Zaten taş çektiniz! Şimdi bir taş atmalısınız.');
    }
  });

  // Sağ Alttaki Taş Atma Kutusu Etkileşimi (Istakanın Sağ Hizası)
  const sagAltKutu = document.getElementById('koseSagAlt');
  sagAltKutu.addEventListener('click', () => {
    if (!suankiOyunDurumu) return;
    if (suankiOyunDurumu.siraBenimMi && suankiOyunDurumu.faz === 'discard') {
      if (seciliTasId) {
        tasAt(seciliTasId);
      } else {
        toastGoster('Atmak istediğiniz taşa tıklayın veya bu kutuya sürükleyin.');
      }
    }
  });

  // Sağ alt kutuya Drag-Drop ile taş atma
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
  kalanSaniye = SIRA_SURESI_SANIYE;
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
  }, 2200);
}

// 44 Slotlu Istakayı DOM'a Hazırla (22 Üst, 22 Alt)
function istakaSlotlariniOlustur() {
  const ustSatir = document.getElementById('istakaUst');
  const altSatir = document.getElementById('istakaAlt');
  ustSatir.innerHTML = '';
  altSatir.innerHTML = '';

  for (let i = 0; i < TOPLAM_SLOT; i++) {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'istaka-slot';
    slotDiv.dataset.slotIndex = i;

    // Slot Drag-Drop Dinleyicileri
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

  // KRİTİK: Önce taşın eski konumunu temizle ki klonlama/çiftleme imkansız olsun!
  slots[kaynakSlot] = null;

  // 1. Hedef slot boş ise direkt yerleştir
  if (!slots[hedefSlot]) {
    slots[hedefSlot] = tas;
    istakayiEkranaBas();
    hesaplaVeGoster();
    return;
  }

  // 2. Hedef slot doluysa: O satır içindeki sınırları belirle
  const satirBasi = hedefSlot < SATIR_SLOT_SAYISI ? 0 : SATIR_SLOT_SAYISI;
  const satirSonu = hedefSlot < SATIR_SLOT_SAYISI ? (SATIR_SLOT_SAYISI - 1) : (TOPLAM_SLOT - 1);

  // Sağa doğru en yakın boş slotu ara
  let bosSag = -1;
  for (let i = hedefSlot + 1; i <= satirSonu; i++) {
    if (!slots[i]) {
      bosSag = i;
      break;
    }
  }

  // Sola doğru en yakın boş slotu ara
  let bosSol = -1;
  for (let i = hedefSlot - 1; i >= satirBasi; i--) {
    if (!slots[i]) {
      bosSol = i;
      break;
    }
  }

  if (bosSag !== -1) {
    // Sağa kaydır
    for (let i = bosSag; i > hedefSlot; i--) {
      slots[i] = slots[i - 1];
    }
    slots[hedefSlot] = tas;
  } else if (bosSol !== -1) {
    // Sola kaydır
    for (let i = bosSol; i < hedefSlot; i++) {
      slots[i] = slots[i + 1];
    }
    slots[hedefSlot] = tas;
  } else {
    // Satır tamamen doluysa takas et (Swap)
    const hedeftekiTas = slots[hedefSlot];
    slots[hedefSlot] = tas;
    slots[kaynakSlot] = hedeftekiTas;
  }

  istakayiEkranaBas();
  hesaplaVeGoster();
}

// Istakayı Ekrana Render Et
function istakayiEkranaBas() {
  const tumSlotlar = document.querySelectorAll('.istaka-slot');

  tumSlotlar.forEach((slotDiv, idx) => {
    slotDiv.innerHTML = '';
    const tas = slots[idx];

    if (tas) {
      const tasDiv = document.createElement('div');
      tasDiv.className = `tas renk-${tas.renk}`;
      if (suankiOyunDurumu && suankiOyunDurumu.okeyBilgisi) {
        if (!tas.fake && tas.sayi === suankiOyunDurumu.okeyBilgisi.sayi && tas.renk === suankiOyunDurumu.okeyBilgisi.renk) {
          tasDiv.classList.add('okey-tasi');
        }
      }
      if (seciliTasId === tas.id) {
        tasDiv.style.border = '2px solid #ffd700';
        tasDiv.style.boxShadow = '0 0 15px rgba(255,215,0,0.8)';
        tasDiv.style.transform = 'translateY(-4px)';
      }

      tasDiv.innerText = tas.sayi;
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

  // Bekleme alanını gizle, masayı aç
  const beklemeAlani = document.getElementById('beklemeAlani');
  if (beklemeAlani) beklemeAlani.style.display = 'none';

  const ortadakiTaslarAlani = document.getElementById('ortadakiTaslarAlani');
  if (ortadakiTaslarAlani) ortadakiTaslarAlani.style.display = 'flex';

  const elDegeriGostergesi = document.getElementById('elDegeriGostergesi');
  if (elDegeriGostergesi) elDegeriGostergesi.style.display = 'block';

  // Deste Sayısı ve Gösterge
  const kalanTasSayisi = document.getElementById('kalanTasSayisi');
  if (kalanTasSayisi) {
    kalanTasSayisi.innerText = durum.kalanDesteSayisi;
  }

  if (durum.gosterge) {
    const gostergeDiv = document.getElementById('gostergeTasi');
    if (gostergeDiv) {
      gostergeDiv.className = `tas gosterge-tasi renk-${durum.gosterge.renk}`;
      gostergeDiv.innerText = durum.gosterge.sayi;
    }
  }

  // Sıra Bildirimleri & Laser Efektleri
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

  // 4 Koltuk ve Simetrik Yuvaların Güncellenmesi
  if (durum.koltuklar && Array.isArray(durum.koltuklar)) {
    durum.koltuklar.forEach(k => {
      let koltukEl, koseTasEl;
      if (k.koltukYeri === 'ust') {
        koltukEl = document.getElementById('koltukUst');
        koseTasEl = document.getElementById('kutuSagUstTas');
      } else if (k.koltukYeri === 'sol') {
        koltukEl = document.getElementById('koltukSol');
        koseTasEl = document.getElementById('kutuSolUstTas');
      } else if (k.koltukYeri === 'sag') {
        koltukEl = document.getElementById('koltukSag');
        koseTasEl = document.getElementById('kutuSagOrtaTas');
      } else {
        koltukEl = document.getElementById('koltukAlt');
        koseTasEl = document.getElementById('kutuSolAltTas');
      }

      if (koltukEl) {
        if (k.siraBundaMi) {
          koltukEl.classList.add('aktif-oyuncu');
        } else {
          koltukEl.classList.remove('aktif-oyuncu');
        }
        const bosYer = koltukEl.querySelector('.bos-yer');
        if (bosYer) {
          bosYer.innerHTML = `<span>${k.isim}</span><br>${k.tasSayisi} Taş`;
        }
      }

      // Atılan son taşın gösterimi
      if (koseTasEl) {
        if (k.sonAtilanTas) {
          koseTasEl.innerHTML = `<div class="tas renk-${k.sonAtilanTas.renk}">${k.sonAtilanTas.sayi}</div>`;
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

// Gelen el listesi ile 44 slotu eşle (Mevcut dizilimi bozmadan)
function elSenkronizasyonu(yeniEl) {
  if (!yeniEl || !Array.isArray(yeniEl)) return;
  const mevcutTaslar = slots.filter(t => t !== null);

  // Eğer ıstaka tamamen boşsa (ilk başlangıç) doğrudan doldur ve Per sırala
  if (mevcutTaslar.length === 0) {
    slots.fill(null);
    yeniEl.forEach((tas, i) => {
      if (i < TOPLAM_SLOT) slots[i] = tas;
    });
    siralaPer();
    return;
  }

  // 1. Artık elde olmayan (atılan) taşları slotlardan temizle
  for (let i = 0; i < TOPLAM_SLOT; i++) {
    if (slots[i] && !yeniEl.find(t => t.id === slots[i].id)) {
      slots[i] = null;
    }
  }

  // 2. Yeni çekilen (slotta henüz bulunmayan) taşları ilk boş slotlara ekle
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

// --- PER SIRALAMA FONKSİYONU (44 Slot / 22'şer Satır) ---
window.siralaPer = function () {
  guncelMod = 'per';
  const seciliBtn = document.getElementById('seciliSiralama');
  if (seciliBtn) seciliBtn.innerText = 'Per ▼';

  const el = slots.filter(t => t !== null);
  if (el.length === 0) return;

  // Renk ve Sayıya göre sırala
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

      // Seri veya grup bozulduysa 1 mikro-slot (yarım taş) boşluk bırak
      if (!seriDevam && !ayniSayi) {
        slotIdx++;
      }
    }

    // Üst satır dolunca veya ortasına gelince alt satıra (22) geç
    if (slotIdx >= 19 && slotIdx < SATIR_SLOT_SAYISI) {
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

// --- ÇİFT SIRALAMA FONKSİYONU (44 Slot / 22'şer Satır) ---
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
      if (slotIdx < TOPLAM_SLOT - 1) {
        slots[slotIdx] = suanki;
        slots[slotIdx + 1] = sonraki;
        slotIdx += 3; // 2 taş + 1 yarım slot boşluk
        i++; // Çifti atla
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

// --- EL DEĞERİ VE 101 PUAN HESAPLAMA ---
function hesaplaVeGoster() {
  const gosterge = document.getElementById('elDegeriGostergesi');
  if (!gosterge) return;

  const el = slots.filter(t => t !== null);
  if (el.length === 0) {
    gosterge.innerText = '101 / 0';
    return;
  }

  if (guncelMod === 'cift') {
    let ciftSayisi = 0;
    // Slotları tara, yan yana duran aynı taşları çift say
    for (let r = 0; r < 2; r++) {
      const baslangic = r * SATIR_SLOT_SAYISI;
      for (let i = baslangic; i < baslangic + SATIR_SLOT_SAYISI - 1; i++) {
        const t1 = slots[i];
        const t2 = slots[i + 1];
        if (t1 && t2 && t1.sayi === t2.sayi && t1.renk === t2.renk) {
          ciftSayisi++;
          i++; // Çifti geç
        }
      }
    }

    gosterge.innerText = `5 / ${ciftSayisi}`;
    gosterge.style.color = ciftSayisi >= 5 ? '#00e676' : '#ffd700';
  } else {
    let toplamPuan = 0;

    // Hem üst hem alt sıradaki bitişik grupları tara
    for (let r = 0; r < 2; r++) {
      const baslangic = r * SATIR_SLOT_SAYISI;
      let grup = [];

      for (let i = baslangic; i < baslangic + SATIR_SLOT_SAYISI; i++) {
        const tas = slots[i];
        if (tas) {
          grup.push(tas);
        } else {
          toplamPuan += grupPuaniniHesapla(grup);
          grup = [];
        }
      }
      toplamPuan += grupPuaniniHesapla(grup);
    }

    gosterge.innerText = `101 / ${toplamPuan}`;
    gosterge.style.color = toplamPuan >= 101 ? '#00e676' : '#ffd700';
  }
}

// Bitişik taş grubunun geçerli bir seri (1-2-3) veya aynı sayı grubu (7-7-7) olup olmadığını hesaplar
function grupPuaniniHesapla(grup) {
  if (!grup || grup.length < 3) return 0;

  // 1. Seri kontrolü (Aynı renk, ardışık sayılar)
  const ayniRenk = grup.every(t => t.renk === grup[0].renk || t.fake);
  let seriGecerli = true;
  if (ayniRenk) {
    for (let i = 0; i < grup.length - 1; i++) {
      const suanki = grup[i].sayi === 'S' ? (grup[i + 1].sayi - 1) : grup[i].sayi;
      const sonraki = grup[i + 1].sayi === 'S' ? (suanki + 1) : grup[i + 1].sayi;
      if (suanki === 13 && sonraki === 1 && i === grup.length - 2) {
        continue;
      }
      if (sonraki !== suanki + 1) {
        seriGecerli = false;
        break;
      }
    }
  } else {
    seriGecerli = false;
  }

  if (seriGecerli) {
    return grup.reduce((toplam, t) => toplam + (t.sayi === 'S' ? 0 : (t.sayi === 1 && grup.some(g => g.sayi === 13) ? 1 : t.sayi)), 0);
  }

  // 2. Grup kontrolü (Aynı sayı, farklı renkler)
  const ilkSayi = grup.find(t => t.sayi !== 'S')?.sayi;
  if (ilkSayi) {
    const sayilarAyni = grup.every(t => t.sayi === ilkSayi || t.fake);
    const renkler = new Set(grup.map(t => t.renk));
    const renklerFarkli = renkler.size === grup.length;

    if (sayilarAyni && renklerFarkli) {
      return grup.length * ilkSayi;
    }
  }

  return 0;
}


