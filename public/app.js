const socket = io();

function masaAcModalGoster() { document.getElementById('masaAcModal').style.display = 'flex'; }
function oyunaGirModalGoster() { document.getElementById('oyunaGirModal').style.display = 'flex'; }
function modalKapat(id) { document.getElementById(id).style.display = 'none'; }

// Masa Kuran Kişi
document.getElementById('masaAcForm').addEventListener('submit', function(e) {
  e.preventDefault(); 
  const masaVerileri = { masaAdi: document.getElementById('masaAdi').value };
  socket.emit('yeni_masa_kur', masaVerileri);
});

socket.on('masa_kuruldu', (data) => {
  // Masa kurulunca kurucu direkt masaya yönlendirilir, kod içeride yazacak
  window.location.href = `game.html?oda=${data.odaId}`;
});

// Kod İle Masaya Katılan Kişi
document.getElementById('oyunaGirForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const girilenKod = document.getElementById('masaKoduInput').value;
  socket.emit('pin_ile_katil', girilenKod);
});

socket.on('pin_dogru', (data) => {
  // Şifre doğruysa oyuna al
  window.location.href = `game.html?oda=${data.odaId}`;
});

socket.on('hata', (mesaj) => {
  alert(mesaj);
});
