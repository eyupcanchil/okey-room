const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const odaId = urlParams.get('oda');

const kullaniciAdi = sessionStorage.getItem('kullaniciAdi');
if (!kullaniciAdi) {
  window.location.href = '/';
}

socket.emit('oyuna_katil', { odaId: odaId, kullaniciAdi: kullaniciAdi });

socket.on('masa_bilgisi', (data) => {
  document.getElementById('ekranMasaKodu').innerText = data.pin;
  document.getElementById('ekranTurSayisi').innerText = `1 / ${data.ayarlar.turSayisi}`;
});

socket.on('oyuncu_sayisi_guncelle', (sayi) => {
  const beklemeYazisi = document.getElementById('beklemeYazisi');
  if(sayi < 4) {
    beklemeYazisi.innerText = `Diğer oyuncular bekleniyor ${sayi}/4...`;
  }
});

// OYUN BAŞLADIĞINDA VERİLERİ İŞLİYORUZ
socket.on('oyun_basladi', (data) => {
  document.getElementById('beklemeAlani').style.display = 'none';
  
  const tasDurumu = data.tasDurumu;
  const oyuncuListesi = data.oyuncuListesi;
  
  // 1. KENDİ SIRAMIZI BULUYORUZ (0, 1, 2, 3)
  const benimIndex = oyuncuListesi.findIndex(o => o.id === socket.id);
  
  // 2. KENDİ TAŞLARIMIZI ALIYORUZ (oyuncu1, oyuncu2 vb.)
  const benimAnahtarim = `oyuncu${benimIndex + 1}`;
  taslariEkranaBas(tasDurumu.oyuncular[benimAnahtarim]);

  // 3. DİĞER OYUNCULARI MASAYA OTURTUYORUZ (İsimlerini Yazdırıyoruz)
  // Biz masanın altındayız. Sağımız, üstümüz ve solumuz matematiksel olarak sırayla hesaplanır:
  const sagIndex = (benimIndex + 1) % 4;
  const ustIndex = (benimIndex + 2) % 4;
  const solIndex = (benimIndex + 3) % 4;
  
  // Koltuklardaki "Boş Yer" yazısını oyuncunun ismiyle değiştiriyoruz
  document.querySelector('.sag-koltuk .bos-yer').innerHTML = `<span>${oyuncuListesi[sagIndex].isim}</span>`;
  document.querySelector('.ust-koltuk .bos-yer').innerHTML = `<span>${oyuncuListesi[ustIndex].isim}</span>`;
  document.querySelector('.sol-koltuk .bos-yer').innerHTML = `<span>${oyuncuListesi[solIndex].isim}</span>`;
});

function taslariEkranaBas(tasListesi) {
  const istakaElementi = document.getElementById('benimIstakam');
  istakaElementi.innerHTML = ''; 

  tasListesi.forEach(tas => {
    const tasDiv = document.createElement('div');
    tasDiv.className = `tas renk-${tas.renk}`;
    tasDiv.innerText = tas.sayi;
    istakaElementi.appendChild(tasDiv);
  });
}
