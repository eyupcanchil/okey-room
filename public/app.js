const socket = io();

// Modalı kapatma ve açma fonksiyonları
function modalKapat() {
  document.getElementById('masaAcModal').style.display = 'none';
}

function modalAc() {
  document.getElementById('masaAcModal').style.display = 'flex';
}

// Form gönderildiğinde tetiklenen olay
document.getElementById('masaAcForm').addEventListener('submit', function(e) {
  e.preventDefault(); 

  // Formdan tüm verileri çekiyoruz
  const masaVerileri = {
    masaAdi: document.getElementById('masaAdi').value,
    oyunTuru: document.getElementById('oyunTuru').value, 
    saniye: parseInt(document.getElementById('saniye').value),
    turSayisi: parseInt(document.getElementById('turSayisi').value), 
    gizlilik: document.getElementById('gizlilik').value
  };

  // Verileri 'yeni_masa_kur' adıyla server.js'e iletiyoruz
  socket.emit('yeni_masa_kur', masaVerileri);
  
  // İşlem bitince modalı kapatıyoruz
  modalKapat();
});

// Sunucudan masa hazır mesajı geldiğinde çalışacak kod
socket.on('masa_hazir', (data) => {
  console.log("Masa kuruldu! Oyun ekranına geçiliyor...");
  
  // Oyuncuyu game.html sayfasına (Oyun Ekranına) yönlendiriyoruz.
  // Girdiği ayarları URL üzerinden game.html'e aktarıyoruz ki orada okunabilsin.
  window.location.href = `game.html?oda=${data.odaId}&tur=${data.ayarlar.turSayisi}&saniye=${data.ayarlar.saniye}&turSecimi=${data.ayarlar.oyunTuru}`;
});
