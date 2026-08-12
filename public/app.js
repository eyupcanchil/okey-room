// Sunucu ile bağlantıyı kur
const socket = io();

function modalKapat() {
  document.getElementById('masaAcModal').style.display = 'none';
}

function modalAc() {
  document.getElementById('masaAcModal').style.display = 'flex';
}

document.getElementById('masaAcForm').addEventListener('submit', function(e) {
  e.preventDefault(); 

  const masaVerileri = {
    masaAdi: document.getElementById('masaAdi').value,
    oyunTuru: document.getElementById('oyunTuru').value, 
    saniye: parseInt(document.getElementById('saniye').value),
    turSayisi: parseInt(document.getElementById('turSayisi').value), 
    gizlilik: document.getElementById('gizlilik').value
  };

  // Verileri 'yeni_masa_kur' adıyla server.js'e gönderiyoruz
  socket.emit('yeni_masa_kur', masaVerileri);
  
  modalKapat();
});
