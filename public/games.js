const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const odaId = urlParams.get('oda');

const kullaniciAdi = sessionStorage.getItem('kullaniciAdi');
if (!kullaniciAdi) window.location.href = '/';

socket.emit('oyuna_katil', { odaId: odaId, kullaniciAdi: kullaniciAdi });

let guncelTaslar = [];
let guncelMod = 'per'; // 'per' veya 'cift'

// Sayfa yüklendiğinde Istakayı Sürükle-Bırak'a (Sortable) Uygun Hale Getir
document.addEventListener('DOMContentLoaded', () => {
  const istaka = document.getElementById('benimIstakam');
  new Sortable(istaka, {
    animation: 150,
    onEnd: function () {
      taslariDOMdanGuncelle();
      hesaplaVeGoster();
    }
  });
});

socket.on('masa_bilgisi', (data) => {
  document.getElementById('ekranMasaKodu').innerText = data.pin;
  document.getElementById('ekranTurSayisi').innerText = `1 / ${data.ayarlar.turSayisi}`;
});

socket.on('oyuncu_sayisi_guncelle', (sayi) => {
  const beklemeYazisi = document.getElementById('beklemeYazisi');
  if(sayi < 4) beklemeYazisi.innerText = `Diğer oyuncular bekleniyor ${sayi}/4...`;
});

// Oyun Başladı
socket.on('oyun_basladi', (data) => {
  document.getElementById('beklemeAlani').style.display = 'none';
  document.getElementById('ortadakiTaslarAlani').style.display = 'flex';
  document.getElementById('elDegeriGostergesi').style.display = 'block';
  
  const tasDurumu = data.tasDurumu;
  const oyuncuListesi = data.oyuncuListesi;
  
  // Ortadaki Göstergeyi ve Kalan Taşı Ayarla
  const gostergeDiv = document.getElementById('gostergeTasi');
  gostergeDiv.className = `tas renk-${tasDurumu.gosterge.renk}`;
  gostergeDiv.innerText = tasDurumu.gosterge.sayi;
  document.getElementById('kalanTasSayisi').innerText = tasDurumu.kalanTasSayisi;
  
  // Taşları al ve ekrana bas
  const benimIndex = oyuncuListesi.findIndex(o => o.id === socket.id);
  const benimAnahtarim = `oyuncu${benimIndex + 1}`;
  
  guncelTaslar = tasDurumu.oyuncular[benimAnahtarim];
  siralaPer(); // Oyun başında standart olarak Per sıralaması yap

  // Diğer Oyuncuları Oturt
  const sagIndex = (benimIndex + 1) % 4;
  const ustIndex = (benimIndex + 2) % 4;
  const solIndex = (benimIndex + 3) % 4;
  
  document.querySelector('.sag-koltuk .bos-yer').innerHTML = `<span>${oyuncuListesi[sagIndex].isim}</span>`;
  document.querySelector('.ust-koltuk .bos-yer').innerHTML = `<span>${oyuncuListesi[ustIndex].isim}</span>`;
  document.querySelector('.sol-koltuk .bos-yer').innerHTML = `<span>${oyuncuListesi[solIndex].isim}</span>`;
});

// Taşları DOM'a çizerken özellikleri (dataset) gömüyoruz ki sürüklerken anlayabilelim
function taslariEkranaBas(tasListesi) {
  const istakaElementi = document.getElementById('benimIstakam');
  istakaElementi.innerHTML = ''; 

  tasListesi.forEach(tas => {
    const tasDiv = document.createElement('div');
    tasDiv.className = `tas renk-${tas.renk}`;
    tasDiv.innerText = tas.sayi;
    tasDiv.dataset.sayi = tas.sayi;
    tasDiv.dataset.renk = tas.renk;
    istakaElementi.appendChild(tasDiv);
  });
}

// Sürükle bırak sonrası güncel sırayı DOM'dan çeker
function taslariDOMdanGuncelle() {
  const tasDivler = document.querySelectorAll('#benimIstakam .tas');
  guncelTaslar = Array.from(tasDivler).map(div => ({
    sayi: div.dataset.sayi === 'S' ? 'S' : parseInt(div.dataset.sayi),
    renk: div.dataset.renk
  }));
}

// Per Sıralama Fonksiyonu
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
  taslariEkranaBas(guncelTaslar);
  hesaplaVeGoster();
};

// Çift Sıralama Fonksiyonu
window.siralaCift = function() {
  guncelMod = 'cift';
  document.getElementById('seciliSiralama').innerText = 'Sırala (Çift)';
  guncelTaslar.sort((a, b) => {
    if (a.sayi === b.sayi) return a.renk.localeCompare(b.renk);
    if (a.sayi === 'S') return 1;
    if (b.sayi === 'S') return -1;
    return a.sayi - b.sayi;
  });
  taslariEkranaBas(guncelTaslar);
  hesaplaVeGoster();
};

// Istakadaki taş durumuna göre el değerini hesaplar
function hesaplaVeGoster() {
  const gosterge = document.getElementById('elDegeriGostergesi');
  if(guncelTaslar.length === 0) return;

  if (guncelMod === 'cift') {
    let ciftler = 0;
    for (let i = 0; i < guncelTaslar.length - 1; i++) {
      if (guncelTaslar[i].sayi === guncelTaslar[i+1].sayi && guncelTaslar[i].renk === guncelTaslar[i+1].renk) {
        ciftler++;
        i++; // Çift bulunduğu için bir sonrakini atla
      }
    }
    gosterge.innerText = `5 / ${ciftler}`;
    gosterge.style.color = ciftler >= 5 ? "#4caf50" : "#ffb900"; // 5'i geçerse yeşil yanar
  } 
  else {
    let toplam = 0;
    let mevcutGrup = [guncelTaslar[0]];

    for (let i = 1; i < guncelTaslar.length; i++) {
      let onceki = guncelTaslar[i-1];
      let suanki = guncelTaslar[i];
      let gecerliMi = false;

      // Aynı renk ardışık sayı veya Farklı renk aynı sayı
      if (onceki.renk === suanki.renk && suanki.sayi === onceki.sayi + 1) gecerliMi = true;
      if (onceki.sayi === suanki.sayi && onceki.renk !== suanki.renk) gecerliMi = true;

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
    gosterge.style.color = toplam >= 101 ? "#4caf50" : "#ffb900"; // 101'i geçerse yeşil yanar
  }
}
