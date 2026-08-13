const socket = io();

// URL'den masa bilgilerini çekiyoruz (app.js yönlendirirken eklemişti)
const urlParams = new URLSearchParams(window.location.search);
const odaId = urlParams.get('oda');

// Odaya katıldığımızı sunucuya bildiriyoruz
socket.emit('oyuna_katil', odaId);

// Lobi (app.js) tarafında masa açıldığında taşları localStorage veya benzeri bir yerden de alabilirsin 
// Ancak modern yöntemde oyun ekranı yüklendiğinde sunucudan taşları talep ederiz.
// Test kolaylığı için taşları render etme fonksiyonu:

function taslariEkranaBas(tasListesi) {
  const istakaElementi = document.getElementById('benimIstakam');
  istakaElementi.innerHTML = ''; // Önce temizle

  tasListesi.forEach(tas => {
    const tasDiv = document.createElement('div');
    tasDiv.className = `tas renk-${tas.renk}`;
    tasDiv.innerText = tas.sayi;
    istakaElementi.appendChild(tasDiv);
  });
}

function gostergeyiGuncelle(gostergeTasi, kalanSayi) {
  const gKutusu = document.getElementById('gostergeKutusu');
  gKutusu.className = `tas gosterge-tas renk-${gostergeTasi.renk}`;
  gKutusu.innerText = gostergeTasi.sayi;

  document.getElementById('kalanSayisi').innerText = kalanSayi;
}

// Sunucudan (server.js'den) veri geldiğinde localStorage üzerinden veya direkt yakalayarak basacağız.
// NOT: app.js'den geçiş yaparken veriyi localStorage'a kaydedip burada okumak en pratik yoldur.
const oyunVerisi = JSON.parse(localStorage.getItem('oyunVerisi'));

if(oyunVerisi) {
  // Senin (Oyuncu 1) taşlarını ekrana basar (22 Taş)
  taslariEkranaBas(oyunVerisi.oyuncular.oyuncu1);
  gostergeyiGuncelle(oyunVerisi.gosterge, oyunVerisi.kalanTasSayisi);
}
