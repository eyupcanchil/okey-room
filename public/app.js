// Modalı kapatmak için fonksiyon
function modalKapat() {
  document.getElementById('masaAcModal').style.display = 'none';
}

// Modalı açmak için (bunu lobi ekranındaki "Masa Aç" butonuna bağlayabilirsin)
function modalAc() {
  document.getElementById('masaAcModal').style.display = 'flex';
}

// Form gönderildiğinde verileri yakalama
document.getElementById('masaAcForm').addEventListener('submit', function(e) {
  e.preventDefault(); // Sayfanın yenilenmesini engeller

  // Seçilen ve girilen değerleri alıyoruz
  const masaVerileri = {
    masaAdi: document.getElementById('masaAdi').value,
    oyunTuru: document.getElementById('oyunTuru').value, // 'tek' veya 'esli'
    saniye: parseInt(document.getElementById('saniye').value),
    turSayisi: parseInt(document.getElementById('turSayisi').value), // İstenilen tur sayısı
    gizlilik: document.getElementById('gizlilik').value
  };

  console.log("Sunucuya gönderilecek masa verileri:", masaVerileri);

  // BURAYA RENDER SUNUCUNA GÖNDERME KODU GELECEK
  // Örnek Socket.io kullanımı: 
  // socket.emit('create_table', masaVerileri);
  
  // İşlem bitince modalı kapat
  modalKapat();
});
