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

socket.on('oyun_basladi', (oyunDurumu) => {
  document.getElementById('beklemeAlani').style.display = 'none';
  taslariEkranaBas(oyunDurumu.oyuncular.oyuncu1);
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
