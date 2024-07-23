document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('audio-player');
    const playButton = document.getElementById('play-btn');
    const playIcon = document.getElementById('play-icon');
    const timerElement = document.getElementById('timer');
    const realTimeElement = document.getElementById('real-time');
    const dateContainer = document.getElementById('date-container');
    const prayerTimesContainer = document.querySelector('.prayer-times-container');
    const locationInfo = document.getElementById('location-info');
    const cart = document.getElementById('cart');
    const cartIcon = document.getElementById('cart-icon');
    const cartItems = document.getElementById('cart-items');
    const totalPriceElement = document.getElementById('total-price');
    const checkoutButton = document.getElementById('checkout-btn');
    const backToProductsButton = document.getElementById('back-to-products');
    const productList = document.getElementById('product-list');
    const subproductSection = document.getElementById('subproduct-section');
    const selectedProductName = document.getElementById('selected-product-name');
    const subproductList = document.getElementById('subproduct-list');
    const searchInput = document.getElementById('search-input');
    const cartArray = [];
    let isPlaying = false;
    let isCartMinimized = true;

    playButton.addEventListener('click', () => {
        if (isPlaying) {
            audio.pause();
            playIcon.src = ''; // No icon for play/pause
        } else {
            audio.play();
            playIcon.src = ''; // No icon for play/pause
        }
        isPlaying = !isPlaying;
    });

    audio.addEventListener('timeupdate', () => {
        const currentTime = formatTime(audio.currentTime);
        const duration = formatTime(audio.duration);
        timerElement.textContent = `${currentTime} / ${duration}`;
    });

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function updateRealTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        realTimeElement.textContent = `${hours}:${minutes}:${seconds}`;
    }

    setInterval(updateRealTime, 1000);

    function updateDate() {
        const now = new Date();
        const dayNames = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const day = dayNames[now.getDay()];
        const date = now.getDate();
        const month = monthNames[now.getMonth()];
        const year = now.getFullYear();
        
        dateContainer.innerHTML = `<div>${day}, ${date} ${month} ${year}  <span id="hijri-date"></span></div>`;
    }

    updateDate();

    fetch('http://api.aladhan.com/v1/gToH?date=' + new Date().toISOString().split('T')[0])
        .then(response => response.json())
        .then(data => {
            const hijri = data.data.hijri;
            const hijriDate = `${hijri.weekday.ar}، ${hijri.day} ${hijri.month.ar} ${hijri.year}`;
            document.getElementById('hijri-date').textContent = hijriDate;
        });

    const prayerTimes = {
        Imsak: "04:30",
        Fajr: "04:45",
        Dhuhr: "12:00",
        Asr: "15:30",
        Maghrib: "18:00",
        Isha: "19:15"
    };

    function updatePrayerTimes() {
        document.getElementById('imsyak').innerHTML = `<div class="prayer-times-title">Imsyak</div>${prayerTimes.Imsak}`;
        document.getElementById('fajr').innerHTML = `<div class="prayer-times-title">Subuh</div>${prayerTimes.Fajr}`;
        document.getElementById('dhuhr').innerHTML = `<div class="prayer-times-title">Dzuhur</div>${prayerTimes.Dhuhr}`;
        document.getElementById('asr').innerHTML = `<div class="prayer-times-title">Ashar</div>${prayerTimes.Asr}`;
        document.getElementById('maghrib').innerHTML = `<div class="prayer-times-title">Maghrib</div>${prayerTimes.Maghrib}`;
        document.getElementById('isha').innerHTML = `<div class="prayer-times-title">Isya</div>${prayerTimes.Isha}`;
    }

    updatePrayerTimes();

    function updateLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(showPosition, showError);
        } else {
            locationInfo.textContent = "Geolocation tidak didukung oleh browser ini.";
        }
    }

    function showPosition(position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
            .then(response => response.json())
            .then(data => {
                const location = data.address ? `${data.address.city}, ${data.address.country}` : "Lokasi tidak dapat ditemukan";
                locationInfo.textContent = `Lokasi: ${location}`;
            })
            .catch(() => {
                locationInfo.textContent = "Tidak dapat mengambil data lokasi, mohon aktifkan lokasi";
            });
    }

    function showError(error) {
        switch (error.code) {
            case error.PERMISSION_DENIED:
                locationInfo.textContent = "Pengguna menolak permintaan lokasi.";
                break;
            case error.POSITION_UNAVAILABLE:
                locationInfo.textContent = "Informasi lokasi tidak tersedia.";
                break;
            case error.TIMEOUT:
                locationInfo.textContent = "Permintaan lokasi telah habis waktu.";
                break;
            case error.UNKNOWN_ERROR:
                locationInfo.textContent = "Terjadi kesalahan lokasi yang tidak diketahui.";
                break;
        }
    }

    updateLocation();

    const products = [
        {
            name: 'Youtube Premium',
            subproducts: [
                { name: '3 Bulan - No Garansi', price: 15000 },
                { name: '3 Bulan - Garansi 1× Replace', price: 20000 },
                { name: '3 Bulan - Garansi 2× Replace', price: 25000 },
                { name: '3 Bulan - Garansi Full', price: 30000 }
            ]
        },
        {
            name: 'Spotify Premium',
            subproducts: [
                { name: '3 Bulan - No Garansi', price: 15000 },
                { name: '3 Bulan - Garansi 1× Replace', price: 20000 },
                { name: '3 Bulan - Garansi 2× Replace', price: 25000 },
                { name: '3 Bulan - Garansi Full', price: 40000 }
            ]
        },
        {
            name: 'Canva Pro',
            subproducts: [
                { name: '1 Bulan', price: 3500 },
                { name: '2 Bulan', price: 4500 },
                { name: '3 Bulan', price: 6500 },
                { name: '6 Bulan', price: 8500 },
                { name: '1 Tahun (Garansi 8 bulan)', price: 10000 }
            ]
        },
        {
            name: 'Viu Premium',
            subproducts: [
                { name: '1 bulan Privat', price: 7000 },
                { name: '3 bulan Privat', price: 15000 },
                { name: '6 bulan Privat', price: 27000 }
            ]
        },
        {
            name: 'Vidio Premier Platinum',
            subproducts: [
                { name: '1 Bulan - Khusus TV', price: 10000 },
                { name: '1 Bulan - Khusus Hp', price: 23000 },
                { name: '1 Bulan - All device', price: 28000 }
            ]
        },
        {
            name: 'Netflix Premium',
            subproducts: [
                { name: '1 Bulan - Sharing 1P2U', price: 25000 },
                { name: '1 Bulan - Sharing 1P1U', price: 33000 },
                { name: '1 Bulan - Privat', price: 120000 }
            ]
        },
        {
            name: 'Alight Motion Premium',
            subproducts: [
                { name: '1 Tahun - No Garansi', price: 15000 },
                { name: '1 Tahun - Garansi 6 Bulan', price: 25000 },
                { name: '1 Tahun - Garansi Full', price: 30000 }
            ]
        }
    ];

    function renderProducts() {
        const searchTerm = searchInput.value.toLowerCase();
        productList.innerHTML = '';
        const filteredProducts = products.filter(product =>
            product.name.toLowerCase().includes(searchTerm)
        );
        filteredProducts.forEach(product => {
            const productItem = document.createElement('div');
            productItem.className = 'product-item';
            productItem.dataset.name = product.name;
            productItem.innerHTML = `
                <h3>${product.name}</h3>
                <button class="select-product-btn" data-name="${product.name}">Pilih</button>
            `;
            productList.appendChild(productItem);
        });
    }

    searchInput.addEventListener('input', renderProducts);

    productList.addEventListener('click', (e) => {
        if (e.target.classList.contains('select-product-btn')) {
            const productName = e.target.dataset.name;
            showSubproducts(productName);
        }
    });

    function showSubproducts(productName) {
        const product = products.find(p => p.name === productName);
        selectedProductName.textContent = product.name;
        subproductList.innerHTML = '';
        product.subproducts.forEach(subproduct => {
            const subproductItem = document.createElement('div');
            subproductItem.className = 'subproduct-item';
            subproductItem.innerHTML = `
                <h4>${subproduct.name}</h4>
                <p>Harga: Rp${subproduct.price.toLocaleString()}</p>
                <button class="add-to-cart-btn" data-name="${product.name}" data-subname="${subproduct.name}" data-price="${subproduct.price}">Tambah ke Keranjang</button>
            `;
            subproductList.appendChild(subproductItem);
        });
        productList.style.display = 'none';
        subproductSection.style.display = 'block';
    }

    backToProductsButton.addEventListener('click', () => {
        productList.style.display = 'block';
        subproductSection.style.display = 'none';
    });

    subproductList.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            const productName = e.target.dataset.name;
            const subproductName = e.target.dataset.subname;
            const price = parseInt(e.target.dataset.price);
            addToCart({ name: productName, subname: subproductName, price });
        }
    });

    function addToCart(product) {
        const cartItem = cartArray.find(item => item.name === product.name && item.subname === product.subname);
        if (cartItem) {
            cartItem.quantity++;
        } else {
            product.quantity = 1;
            cartArray.push(product);
        }
        renderCart();
    }

    function renderCart() {
        cartItems.innerHTML = '';
        let totalPrice = 0;
        cartArray.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.style.color = 'black'; // Set text color to black
            cartItem.innerHTML = `
                <h4>${item.name} - ${item.subname}</h4>
                <p>Harga: Rp${item.price.toLocaleString()}</p>
                <p>Jumlah: ${item.quantity}</p>
            `;
            cartItems.appendChild(cartItem);
            totalPrice += item.price * item.quantity;
        });
        totalPriceElement.textContent = `Total: Rp${totalPrice.toLocaleString()}`;
    }

    checkoutButton.addEventListener('click', () => {
        const message = cartArray.map(item =>
            `${item.name} - ${item.subname}: Rp${item.price.toLocaleString()} x ${item.quantity}`
        ).join('\n');
        const total = `Total: Rp${cartArray.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString()}`;
        const whatsappMessage = `*Checkout*\n\n${message}\n\n${total}\n\nTerima kasih!`;

        window.location.href = `https://wa.me/${6285159772620}?text=${encodeURIComponent(whatsappMessage)}`;
    });

    cartIcon.addEventListener('click', () => {
        if (isCartMinimized) {
            cart.style.display = 'flex';
        } else {
            cart.style.display = 'none';
        }
        isCartMinimized = !isCartMinimized;
    });

    cart.style.display = 'none';
    isCartMinimized = true;

    renderProducts();
});
                          
