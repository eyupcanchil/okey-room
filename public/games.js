const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const odaId = urlParams.get('oda');

socket.emit('oyuna_katil', odaId);

// Masa durumu ve Taşlar geldiğinde
socket.on('masa_durumu_guncelle', (data) => {
  // Masa kodunu sol üste yazdır
  document.getElementById('ekranMasaKodu').innerText = data.pin;
  
  // Taşlarımızı ıstakaya diz
  taslariEkranaBas(data.durum.oyuncular.oyuncu1);
});

// Odaya biri girdiğinde veya çıktığında 1/4 yazısını günceller
socket.on('oyuncu_sayisi_guncelle', (sayi) => {
  const beklemeYazisi = document.getElementById('beklemeYazisi');
  if(sayi < 4) {
    beklemeYazisi.innerText = `Diğer oyuncular bekleniyor ${sayi}/4...`;
  } else {
    beklemeYazisi.innerText = "Oyun Başlıyor!";
    setTimeout(() => {
      document.querySelector('.orta-bekleme').style.display = 'none';
      // Burada ortaya gerçek okey göstergesini açacak kodu ileride ekleyebilirsin
    }, 2000);
  }
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
