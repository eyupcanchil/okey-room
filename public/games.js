const socket = io();

// Hangi odada olduğumuzu URL'den alıyoruz
const urlParams = new URLSearchParams(window.location.search);
const odaId = urlParams.get('oda');

// Sayfa yüklendiğinde sunucudan taşlarımızı ve masayı istiyoruz
socket.emit('oyuna_katil', odaId);

// Sunucu masayı gönderdiğinde ekranı çiziyoruz
socket.on('masa_durumu_guncelle', (oyunVerisi) => {
  taslariEkranaBas(oyunVerisi.oyuncular.oyuncu1); // Senin ıstakan
  gostergeyiGuncelle(oyunVerisi.gosterge, oyunVerisi.kalanTasSayisi); // Ortadaki gösterge ve kalan sayı
});

// Istakaya taşları dizen fonksiyon
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

// Göstergeyi ve kalan taşı güncelleyen fonksiyon
function gostergeyiGuncelle(gostergeTasi, kalanSayi) {
  const gKutusu = document.getElementById('gostergeKutusu');
  gKutusu.className = `tas gosterge-tas renk-${gostergeTasi.renk}`;
  gKutusu.innerText = gostergeTasi.sayi;

  document.getElementById('kalanSayisi').innerText = kalanSayi;
}
