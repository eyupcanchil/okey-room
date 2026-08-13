// games.js — 101 Okey İstemci & Istaka / Sıra Yönetim Motoru

const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const odaId = urlParams.get('oda');

const kullaniciAdi = sessionStorage.getItem('kullaniciAdi') || 'Oyuncu_' + Math.floor(Math.random() * 1000);
if (!sessionStorage.getItem('kullaniciAdi')) {
  sessionStorage.setItem('kullaniciAdi', kullaniciAdi);
}

// 28 Slotlu Istaka Durumu (0..13 Üst Sıra, 14..27 Alt Sıra)
let slots = new Array(28).fill(null);
let suankiOyunDurumu = null;
let guncelMod = 'per'; // 'per' | 'cift'
let seciliTasId = null;

// Sürükle-Bırak Geçici Verileri
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
  bar.style.background = '#4caf50';

  const startTime = Date.now();
  const totalDuration = SIRA_SURESI_SANIYE * 1000;

  siraTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, totalDuration - elapsed);
    const percentage = (remaining / totalDuration) * 100;

    bar.style.width = `${percentage}%`;

    if (percentage > 50) {
      bar.style.background = '#4caf50';
    } else if (percentage > 25) {
      bar.style.background = '#ffb900';
    } else {
      bar.style.background = '#e53935';
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

// 28 Slotlu Istakayı DOM'a Hazırla
function istakaSlotlariniOlustur() {
  const ustSatir = document.getElementById('istakaUst');
  const altSatir = document.getElementById('istakaAlt');
  ustSatir.innerHTML = '';
  altSatir.innerHTML = '';

  for (let i = 0; i < 28; i++) {
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

    if (i < 14) {
      ustSatir.appendChild(slotDiv);
    } else {
      altSatir.appendChild(slotDiv);
    }
  }
}

// Bir taşı hedef slota yerleştir / komşuları kaydır
function slotaTasBirak(kaynakSlot, hedefSlot) {
  if (kaynakSlot === null || kaynakSlot === undefined || isNaN(kaynakSlot)) return;
  if (hedefSlot === kaynakSlot) return;

  const tas = slots[kaynakSlot];
  if (!tas) return;

  // Hedef slot boş ise direkt taşı
  if (!slots[hedefSlot]) {
    slots[hedefSlot] = tas;
    slots[kaynakSlot] = null;
    istakayiEkranaBas();
    hesaplaVeGoster();
    return;
  }

  // Hedef slot doluysa: O satır içinde sağa kaydırma alanı ara
  const satirBasi = hedefSlot < 14 ? 0 : 14;
  const satirSonu = hedefSlot < 14 ? 13 : 27;

  // 1. Hedefin sağında boş yer var mı?
  let bosSag = -1;
  for (let i = hedefSlot + 1; i <= satirSonu; i++) {
    if (!slots[i]) {
      bosSag = i;
      break;
    }
  }

  if (bosSag !== -1) {
    // Sağa kaydır
    for (let i = bosSag; i > hedefSlot; i--) {
      slots[i] = slots[i - 1];
    }
    slots[hedefSlot] = tas;
    slots[kaynakSlot] = null;
  } else {
    // 2. Sağda yer yoksa hedefin solunda boş yer var mı?
    let bosSol = -1;
    for (let i = hedefSlot - 1; i >= satirBasi; i--) {
      if (!slots[i]) {
        bosSol = i;
        break;
      }
    }

    if (bosSol !== -1) {
      // Sola kaydır
      for (let i = bosSol; i < hedefSlot; i++) {
        slots[i] = slots[i + 1];
      }
      slots[hedefSlot] = tas;
      slots[kaynakSlot] = null;
    } else {
      // 3. O satır tamamen doluysa direkt takas et (Swap)
      const hedeftekiTas = slots[hedefSlot];
      slots[hedefSlot] = tas;
      slots[kaynakSlot] = hedeftekiTas;
    }
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
        tasDiv.style.border = '2px solid #ffb900';
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

  // Sıra Bildirimleri & Vurguları
  const desteAlani = document.getElementById('ortadakiTaslarAlani');
  const solAltKutu = document.getElementById('koseSolAlt');
  const sagAltKutu = document.getElementById('koseSagAlt');

  // Önceki efektleri temizle
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

  // 4 Koltuk ve Köşeler Güncellemesi (Hatasız ve Güvenli)
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
        koseTasEl = document.getElementById('kutuSagAltTas');
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

// Gelen el listesi ile 28 slotu eşle (Mevcut dizilimi bozmadan)
function elSenkronizasyonu(yeniEl) {
  if (!yeniEl || !Array.isArray(yeniEl)) return;
  const mevcutTaslar = slots.filter(t => t !== null);

  // Eğer ıstaka tamamen boşsa (ilk başlangıç) doğrudan doldur ve Per sırala
  if (mevcutTaslar.length === 0) {
    slots.fill(null);
    yeniEl.forEach((tas, i) => {
      if (i < 28) slots[i] = tas;
    });
    // İlk başlangıçta kullanıcıya güzelce per dizilimi sun
    siralaPer();
    return;
  }

  // 1. Artık elde olmayan (atılan) taşları slotlardan temizle
  for (let i = 0; i < 28; i++) {
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

// --- PER SIRALAMA FONKSİYONU ---
window.siralaPer = function () {
  guncelMod = 'per';
  const seciliBtn = document.getElementById('seciliSiralama');
  if (seciliBtn) seciliBtn.innerText = 'Per ▼';

  const el = slots.filter(t => t !== null);
  if (el.length === 0) return;

  // Renk ve Sayıya göre grupla
  el.sort((a, b) => {
    if (a.renk === b.renk) {
      if (a.sayi === 'S') return 1;
      if (b.sayi === 'S') return -1;
      return a.sayi - b.sayi;
    }
    return a.renk.localeCompare(b.renk);
  });

  // Serileri ve grupları bulup 1 boşluk bırakarak slotlara yerleştir
  slots.fill(null);
  let slotIdx = 0;
  let prevTas = null;

  for (let i = 0; i < el.length; i++) {
    const tas = el[i];

    if (prevTas) {
      const seriDevam = prevTas.renk === tas.renk && tas.sayi === prevTas.sayi + 1;
      const ayniSayi = prevTas.sayi === tas.sayi && prevTas.renk !== tas.renk;

      // Seri veya grup bozulduysa 1 slot boşluk bırak
      if (!seriDevam && !ayniSayi) {
        slotIdx++;
      }
    }

    // Üst sıradan alt sıraya geçiş kontrolü
    if (slotIdx === 14) slotIdx = 14;
    if (slotIdx >= 28) slotIdx = 27;

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
      if (slotIdx < 27) {
        slots[slotIdx] = suanki;
        slots[slotIdx + 1] = sonraki;
        slotIdx += 3; // 2 taş + 1 boşluk
        i++; // Çifti atla
        continue;
      }
    }

    if (slotIdx < 28) {
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
      const baslangic = r * 14;
      for (let i = baslangic; i < baslangic + 13; i++) {
        const t1 = slots[i];
        const t2 = slots[i + 1];
        if (t1 && t2 && t1.sayi === t2.sayi && t1.renk === t2.renk) {
          ciftSayisi++;
          i++; // Çifti geç
        }
      }
    }

    gosterge.innerText = `5 / ${ciftSayisi}`;
    gosterge.style.color = ciftSayisi >= 5 ? '#4caf50' : '#ffb900';
  } else {
    let toplamPuan = 0;

    // Hem üst hem alt sıradaki bitişik grupları tara
    for (let r = 0; r < 2; r++) {
      const baslangic = r * 14;
      let grup = [];

      for (let i = baslangic; i < baslangic + 14; i++) {
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
    gosterge.style.color = toplamPuan >= 101 ? '#4caf50' : '#ffb900';
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

