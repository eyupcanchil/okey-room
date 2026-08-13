const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const odaId = urlParams.get('oda');

const kullaniciAdi = sessionStorage.getItem('kullaniciAdi');
if (!kullaniciAdi) window.location.href = '/';

socket.emit('oyuna_katil', { odaId: odaId, kullaniciAdi: kullaniciAdi });

let guncelTaslar = [];
let guncelMod = 'per'; 

// İki satırı da Sürükle-Bırak'a (Sortable) uyumlu hale getiriyoruz
document.addEventListener('DOMContentLoaded', () => {
  const ayarlar = {
    group: 'istaka',
    animation: 150,
    onEnd: function () {
      taslariDOMdanGuncelle();
      hesaplaVeGoster();
    }
  };
  new Sortable(document.getElementById('istakaUst'), ayarlar);
  new Sortable(document.getElementById('istakaAlt'), ayarlar);
});

socket.on('masa_bilgisi', (data) => {
  document.getElementById('ekranMasaKodu').innerText = data.pin;
  document.getElementById('ekranTurSayisi').innerText = `1 / ${data.ayarlar.turSayisi}`;
});

socket.on('oyuncu_sayisi_guncelle', (sayi) => {
  const beklemeYazisi = document.getElementById('beklemeYazisi');
  if(sayi < 4) beklemeYazisi.innerText = `Diğer oyuncular bekleniyor ${sayi}/4...`;
});

socket.on('oyun_basladi', (data) => {
  document.getElementById('beklemeAlani').style.display = 'none';
  document.getElementById('ortadakiTaslarAlani').style.display = 'flex';
  document.getElementById('elDegeriGostergesi').style.display = 'block';
  
  const tasDurumu = data.tasDurumu;
  const oyuncuListesi = data.oyuncuListesi;
  
  const gostergeDiv = document.getElementById('gostergeTasi');
  gostergeDiv.className = `tas renk-${tasDurumu.gosterge.renk}`;
  gostergeDiv.innerText = tasDurumu.gosterge.sayi;
  document.getElementById('kalanTasSayisi').innerText = tasDurumu.kalanTasSayisi;
  
  const benimIndex = oyuncuListesi.findIndex(o => o.id === socket.id);
  const benimAnahtarim = `oyuncu${benimIndex + 1}`;
  
  guncelTaslar = tasDurumu.oyuncular[benimAnahtarim];
  siralaPer(); 

  const sagIndex = (benimIndex + 1) % 4;
  const ustIndex = (benimIndex + 2) % 4;
  const solIndex = (benimIndex + 3) % 4;
  
  document.querySelector('.sag-koltuk .bos-yer').innerHTML = `<span>${oyuncuListesi[sagIndex].isim}</span>`;
  document.querySelector('.ust-koltuk .bos-yer').innerHTML = `<span>${oyuncuListesi[ustIndex].isim}</span>`;
  document.querySelector('.sol-koltuk .bos-yer').innerHTML = `<span>${oyuncuListesi[solIndex].isim}</span>`;
});

// Taşları DOM'a çizen fonksiyon (Manuel Boşluk Bırakma Tıklaması Burada)
function taslariEkranaBas(tasListesi) {
  const ust = document.getElementById('istakaUst');
  const alt = document.getElementById('istakaAlt');
  ust.innerHTML = ''; 
  alt.innerHTML = '';

  tasListesi.forEach((tas, index) => {
    const tasDiv = document.createElement('div');
    tasDiv.className = `tas renk-${tas.renk} ${tas.bosluk ? tas.bosluk : ''}`;
    tasDiv.innerText = tas.sayi;
    tasDiv.dataset.sayi = tas.sayi;
    tasDiv.dataset.renk = tas.renk;

    // TIKLAYARAK MANUEL BOŞLUK BIRAKMA (Yarım -> Tam -> Kapat)
    tasDiv.addEventListener('click', function() {
      if (this.classList.contains('bosluk-tam')) {
        this.classList.remove('bosluk-tam');
      } else if (this.classList.contains('bosluk-yarim')) {
        this.classList.remove('bosluk-yarim');
        this.classList.add('bosluk-tam');
      } else {
        this.classList.add('bosluk-yarim');
      }
      taslariDOMdanGuncelle();
    });

    // İlk 11 taşı üste, kalanları alta koyar
    if (index < 11) ust.appendChild(tasDiv);
    else alt.appendChild(tasDiv);
  });
}

function taslariDOMdanGuncelle() {
  const tasDivler = document.querySelectorAll('.istaka-satir .tas');
  guncelTaslar = Array.from(tasDivler).map(div => ({
    sayi: div.dataset.sayi === 'S' ? 'S' : parseInt(div.dataset.sayi),
    renk: div.dataset.renk,
    bosluk: div.classList.contains('bosluk-tam') ? 'bosluk-tam' : (div.classList.contains('bosluk-yarim') ? 'bosluk-yarim' : '')
  }));
}

window.siralaPer = function() {
  guncelMod = 'per';
  document.getElementById('seciliSiralama').innerText = 'Sırala (Per)';
  
  guncelTaslar.sort((a, b) => {
    if (a.renk === b.renk) {
      if (a.sayi === 'S') return 1;
      if (b.sayi === 'S') return -1;
      return a.sayi - b.sayi;
    }
    return a.renk.localeCompare(b.renk);
  });

  // Otomatik yarım boşluk ekleme (Renk veya seri değiştiğinde)
  for (let i = 0; i < guncelTaslar.length; i++) {
     guncelTaslar[i].bosluk = ''; 
     if (i > 0) {
        let onceki = guncelTaslar[i-1];
        let suanki = guncelTaslar[i];
        if (onceki.renk !== suanki.renk || (suanki.sayi !== 'S' && onceki.sayi !== 'S' && suanki.sayi !== onceki.sayi + 1 && suanki.sayi !== onceki.sayi)) {
           guncelTaslar[i].bosluk = 'bosluk-yarim';
        }
     }
  }
  taslariEkranaBas(guncelTaslar);
  hesaplaVeGoster();
};

window.siralaCift = function() {
  guncelMod = 'cift';
  document.getElementById('seciliSiralama').innerText = 'Sırala (Çift)';
  guncelTaslar.sort((a, b) => {
    if (a.sayi === b.sayi) return a.renk.localeCompare(b.renk);
    if (a.sayi === 'S') return 1;
    if (b.sayi === 'S') return -1;
    return a.sayi - b.sayi;
  });

  // Otomatik yarım boşluk ekleme (Her 2 taşta bir)
  for (let i = 0; i < guncelTaslar.length; i++) {
     guncelTaslar[i].bosluk = ''; 
     if (i > 0 && i % 2 === 0) guncelTaslar[i].bosluk = 'bosluk-yarim';
  }
  taslariEkranaBas(guncelTaslar);
  hesaplaVeGoster();
};

function hesaplaVeGoster() {
  const gosterge = document.getElementById('elDegeriGostergesi');
  if(guncelTaslar.length === 0) return;

  if (guncelMod === 'cift') {
    let ciftler = 0;
    for (let i = 0; i < guncelTaslar.length - 1; i++) {
      if (guncelTaslar[i].sayi === guncelTaslar[i+1].sayi && guncelTaslar[i].renk === guncelTaslar[i+1].renk) {
        ciftler++;
        i++; 
      }
    }
    gosterge.innerText = `5 / ${ciftler}`;
    gosterge.style.color = ciftler >= 5 ? "#4caf50" : "#ffb900"; 
  } 
  else {
    let toplam = 0;
    let mevcutGrup = [guncelTaslar[0]];

    for (let i = 1; i < guncelTaslar.length; i++) {
      let onceki = guncelTaslar[i-1];
      let suanki = guncelTaslar[i];
      let gecerliMi = false;

      if (onceki.renk === suanki.renk && suanki.sayi === onceki.sayi + 1) gecerliMi = true;
      if (onceki.sayi === suanki.sayi && onceki.renk !== suanki.renk) gecerliMi = true;

      // Eğer per arasına kullanıcı boşluk koyduysa grubu böl
      if (suanki.bosluk === 'bosluk-yarim' || suanki.bosluk === 'bosluk-tam') gecerliMi = false;

      if (gecerliMi) {
        mevcutGrup.push(suanki);
      } else {
        if (mevcutGrup.length >= 3) {
          toplam += mevcutGrup.reduce((sum, tas) => sum + (tas.sayi === 'S' ? 0 : tas.sayi), 0);
        }
        mevcutGrup = [suanki];
      }
    }
    if (mevcutGrup.length >= 3) {
      toplam += mevcutGrup.reduce((sum, tas) => sum + (tas.sayi === 'S' ? 0 : tas.sayi), 0);
    }

    gosterge.innerText = `101 / ${toplam}`;
    gosterge.style.color = toplam >= 101 ? "#4caf50" : "#ffb900"; 
  }
}
