const socket = io();

// Sayfa yüklendiğinde isim kontrolü yap
document.addEventListener("DOMContentLoaded", () => {
  const kayitliIsim = sessionStorage.getItem('kullaniciAdi');
  if (kayitliIsim) {
    document.getElementById('isimModal').style.display = 'none';
    document.getElementById('lobiKullaniciAdiText').innerText = kayitliIsim;
  } else {
    document.getElementById('isimModal').style.display = 'flex';
  }
});

// İsim Kaydetme Formu
document.getElementById('isimForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const isim = document.getElementById('kullaniciAdiInput').value;
  sessionStorage.setItem('kullaniciAdi', isim);
  document.getElementById('lobiKullaniciAdiText').innerText = isim;
  document.getElementById('isimModal').style.display = 'none';
});

// Modalları Aç/Kapat
function masaAcModalGoster() { document.getElementById('masaAcModal').style.display = 'flex'; }
function oyunaGirModalGoster() { document.getElementById('oyunaGirModal').style.display = 'flex'; }
function modalKapat(id) { document.getElementById(id).style.display = 'none'; }

// Masa Kur
document.getElementById('masaAcForm').addEventListener('submit', function(e) {
  e.preventDefault(); 
  const masaVerileri = { 
    masaAdi: document.getElementById('masaAdi').value,
    oyunTuru: document.getElementById('oyunTuru').value,
    saniye: document.getElementById('saniye').value,
    turSayisi: document.getElementById('turSayisi').value,
    gizlilik: document.getElementById('gizlilik').value
  };
  socket.emit('yeni_masa_kur', masaVerileri);
});

socket.on('masa_kuruldu', (data) => {
  window.location.href = `game.html?oda=${data.odaId}`;
});

// Kod ile Katıl
document.getElementById('oyunaGirForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const girilenKod = document.getElementById('masaKoduInput').value;
  socket.emit('pin_ile_katil', girilenKod);
});

socket.on('pin_dogru', (data) => {
  window.location.href = `game.html?oda=${data.odaId}`;
});

socket.on('hata', (mesaj) => {
  alert(mesaj);
});
