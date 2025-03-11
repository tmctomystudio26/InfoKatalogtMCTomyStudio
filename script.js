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
    const welcomeModal = document.getElementById('welcome-modal');
    const userNameInput = document.getElementById('user-name');
    const submitNameButton = document.getElementById('submit-name');
    const cartArray = [];
    let isPlaying = false;
    let isCartMinimized = true;
    let userName = '';

    // Show welcome modal
    welcomeModal.style.display = 'flex';

    // Handle user name submission
    submitNameButton.addEventListener('click', () => {
        userName = userNameInput.value.trim();
        if (userName) {
            welcomeModal.style.display = 'none';
            // Play audio automatically after user submits name
            audio.play();
            isPlaying = true;
            // Display user name
            document.getElementById('user-display').textContent = userName;
        } else {
            alert('Silakan masukkan nama Anda terlebih dahulu');
        }
    });

    // Allow Enter key to submit name
    userNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitNameButton.click();
        }
    });

    // Auto play audio when user interacts with page (browser policy workaround)
    document.addEventListener('click', () => {
        if (!isPlaying) {
            audio.play();
            isPlaying = true;
        }
    }, { once: true });

    // Membuat audio loop secara otomatis
    audio.addEventListener('ended', () => {
        audio.currentTime = 0;
        audio.play();
    });

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
        const prayerBoxes = ['imsyak', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        const prayerNames = {
            'imsyak': 'Imsyak', 
            'fajr': 'Subuh', 
            'dhuhr': 'Dzuhur', 
            'asr': 'Ashar', 
            'maghrib': 'Maghrib', 
            'isha': 'Isya'
        };

        // Show loading animation first
        prayerBoxes.forEach(id => {
            document.getElementById(id).innerHTML = 
                `<div class="prayer-times-title">${prayerNames[id]}</div>
                 <div class="prayer-time-loading"><div class="loading-dot"></div></div>`;
        });

        // Set a slight delay to show loading effect
        setTimeout(() => {
            document.getElementById('imsyak').innerHTML = `<div class="prayer-times-title">Imsyak</div>${prayerTimes.Imsak}`;
            document.getElementById('fajr').innerHTML = `<div class="prayer-times-title">Subuh</div>${prayerTimes.Fajr}`;
            document.getElementById('dhuhr').innerHTML = `<div class="prayer-times-title">Dzuhur</div>${prayerTimes.Dhuhr}`;
            document.getElementById('asr').innerHTML = `<div class="prayer-times-title">Ashar</div>${prayerTimes.Asr}`;
            document.getElementById('maghrib').innerHTML = `<div class="prayer-times-title">Maghrib</div>${prayerTimes.Maghrib}`;
            document.getElementById('isha').innerHTML = `<div class="prayer-times-title">Isya</div>${prayerTimes.Isha}`;
        }, 800);
    }

    updatePrayerTimes();

    async function updateLocationAndPrayerTimes() {
    locationInfo.textContent = "Sedang mengambil lokasi...";

    // Menggunakan Geolocation API browser dahulu
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                // Berhasil mendapatkan lokasi dari browser
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                try {
                    // Mendapatkan nama lokasi berdasarkan koordinat
                    const geocodeResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`);
                    const geocodeData = await geocodeResponse.json();

                    // Mendapatkan jadwal sholat untuk lokasi ini
                    await fetchPrayerTimes(latitude, longitude);

                    // Menampilkan informasi lokasi
                    locationInfo.textContent = `Lokasi: ${geocodeData.locality || geocodeData.city || ''}, ${geocodeData.principalSubdivision || ''}, ${geocodeData.countryName || ''}`;
                } catch (error) {
                    console.error('Gagal mendapatkan detail lokasi:', error);
                    locationInfo.textContent = `Lokasi: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                    await fetchPrayerTimes(latitude, longitude);
                }
            },
            async (error) => {
                // Gagal mendapatkan lokasi dari browser, coba dengan IP
                console.error('Gagal mendapatkan lokasi dari browser:', error);
                try {
                    await getLocationFromIP();
                } catch (ipError) {
                    console.error('Gagal mendapatkan lokasi:', ipError);
                    locationInfo.textContent = "Gagal mendapatkan lokasi Anda. Silakan izinkan akses lokasi dan refresh halaman.";
                    // Tidak menggunakan default Indonesia
                }
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    } else {
        // Browser tidak mendukung geolocation, coba dengan IP
        try {
            await getLocationFromIP();
        } catch (error) {
            console.error('Gagal mendapatkan lokasi:', error);
            locationInfo.textContent = "Lokasi tidak dapat ditemukan. Silakan refresh halaman atau gunakan browser lain.";
            // Tidak menggunakan default Indonesia
        }
    }
}

async function getLocationFromIP() {
    // Coba beberapa layanan geolokasi IP berbeda
    const ipServices = [
        'https://ipapi.co/json',
        'https://api.ipgeolocation.io/ipgeo?apiKey=d4aac1787c714096a9ebca5e4462a797',
        'https://ipinfo.io/json?token=ce8fe2a7e8cb12'
    ];

    let success = false;

    for (const service of ipServices) {
        if (success) break;

        try {
            const response = await fetch(service);
            if (!response.ok) continue;

            const data = await response.json();
            let latitude, longitude, locationName;

            // Format respons berbeda untuk setiap layanan
            if (service.includes('ipapi.co')) {
                latitude = data.latitude;
                longitude = data.longitude;
                locationName = `${data.city}, ${data.region}, ${data.country_name}`;
            } else if (service.includes('ipgeolocation.io')) {
                latitude = data.latitude;
                longitude = data.longitude;
                locationName = `${data.city}, ${data.state_prov}, ${data.country_name}`;
            } else if (service.includes('ipinfo.io')) {
                [latitude, longitude] = data.loc.split(',');
                locationName = `${data.city}, ${data.region}, ${data.country}`;
            }

            if (latitude && longitude) {
                await fetchPrayerTimes(latitude, longitude);
                locationInfo.textContent = `Lokasi: ${locationName}`;
                success = true;
            }
        } catch (error) {
            console.error(`Gagal dengan layanan ${service}:`, error);
        }
    }

    if (!success) {
        throw new Error('Semua layanan geolokasi IP gagal');
    }
}

async function fetchPrayerTimes(latitude, longitude) {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    // Mencoba 3 metode kalkulasi berbeda
    const methods = [3, 2, 5]; // 3=MWL, 2=ISNA, 5=Egyptian

    for (const method of methods) {
        try {
            const prayerResponse = await fetch(`https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${latitude}&longitude=${longitude}&method=${method}`);

            if (!prayerResponse.ok) {
                continue;
            }

            const prayerData = await prayerResponse.json();

            if (prayerData.code === 200 && prayerData.data && prayerData.data.timings) {
                const timings = prayerData.data.timings;

                document.getElementById('imsyak').innerHTML = `<div class="prayer-times-title">Imsyak</div>${formatPrayerTime(timings.Imsak)}`;
                document.getElementById('fajr').innerHTML = `<div class="prayer-times-title">Subuh</div>${formatPrayerTime(timings.Fajr)}`;
                document.getElementById('dhuhr').innerHTML = `<div class="prayer-times-title">Dzuhur</div>${formatPrayerTime(timings.Dhuhr)}`;
                document.getElementById('asr').innerHTML = `<div class="prayer-times-title">Ashar</div>${formatPrayerTime(timings.Asr)}`;
                document.getElementById('maghrib').innerHTML = `<div class="prayer-times-title">Maghrib</div>${formatPrayerTime(timings.Maghrib)}`;
                document.getElementById('isha').innerHTML = `<div class="prayer-times-title">Isya</div>${formatPrayerTime(timings.Isha)}`;

                return; // Berhasil dapat jadwal, keluar dari loop
            }
        } catch (error) {
            console.error(`Gagal dengan metode ${method}:`, error);
        }
    }

    throw new Error('Semua metode kalkulasi gagal');
}

// Helper function to format prayer time (remove timezone info)
function formatPrayerTime(timeString) {
    // Memformat waktu untuk menghapus informasi timezone
    return timeString.split(' ')[0];
}
    updateLocationAndPrayerTimes();

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
            outOfStock: true,
            restockMessage: 'Akan segera restock',
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
                { name: '1 Bulan', price: 3000 },
                { name: '2 Bulan', price: 4500 },
                { name: '3 Bulan', price: 6500 },
                { name: '6 Bulan', price: 8500 },
                { name: '1 Tahun (Garansi 8 bulan)', price: 10000, outOfStock: true, restockMessage: 'Akan segera restock' }
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
                { name: '3-12 Bulan (Khusus TV)', price: 15000 },
                { name: '1 Bulan - Khusus Hp', price: 20000 },
                { name: '1 Bulan - All device', price: 28000 }
            ]
        },
        {
            name: 'Netflix Premium',
            subproducts: [
                { name: '1 Bulan - Sharing 1P2U', price: 20500 },
                { name: '1 Bulan - Sharing 1P1U', price: 25500 },
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
        },
        {
            name: 'WeTV',
            subproducts: [
                { name: '1 Bulan 6u', price: 8500 },
                { name: '1 Bulan Privat', price: 35000 }
            ]
        },
        {
            name: 'Prime Video',
            subproducts: [
                { name: '1 Bulan Sharing', price: 8000 },
                { name: '1 Bulan Privat', price: 15000 }
            ]
        },
        {
            name: 'Request dan Custom Produk',
            subproducts: [
                { name: 'Request Produk', price: 0, description: 'Tidak menemukan produk yang anda mau pada list produk disini? Ayo request!' },
                { name: 'Custom Produk', price: 0, description: 'Mau campur-campur ataupun custom durasi produk? Yuk ah!' }
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

            // Get logo URL based on product name
            let logoUrl = '';
            if (product.name.includes('Request dan Custom')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/images__2_-removebg-preview.png';
            else if (product.name.includes('Youtube')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Youtube_logo.png';
            else if (product.name.includes('Spotify')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Spotify_logo_with_text.svg.png';
            else if (product.name.includes('Netflix')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Logonetflix.png';
            else if (product.name.includes('Canva')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Canva-logo.png';
            else if (product.name.includes('Viu')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Viu_logo.svg%20(1).png';
            else if (product.name.includes('Vidio')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Logo_Vidio.png';
            else if (product.name.includes('Alight')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Alight_Motion.png';
            else if (product.name.includes('Prime')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Amazon_Prime_Video_logo.svg.png';
            else if (product.name.includes('WeTV')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/WeTV_logo.svg.png';
            else logoUrl = '';

            if (product.outOfStock) {
                productItem.innerHTML = `
                    <div class="product-logo">
                        ${logoUrl ? `<img src="${logoUrl}" alt="${product.name} logo">` : `<i class="fas fa-tag"></i>`}
                    </div>
                    <div class="out-of-stock-badge">Stok Habis</div>
                    <h3>${product.name}</h3>
                    <p class="product-desc">Paket ${product.name}</p>
                    <p class="restock-message">${product.restockMessage}</p>
                `;
            } else {
                productItem.innerHTML = `
                    <div class="product-logo">
                        ${logoUrl ? `<img src="${logoUrl}" alt="${product.name} logo">` : `<i class="fas fa-tag"></i>`}
                    </div>
                    <h3>${product.name}</h3>
                    <p class="product-desc">Paket ${product.name}</p>
                    <button class="select-product-btn" data-name="${product.name}">Pilih & Lanjutkan <i class="fas fa-angle-right"></i></button>
                `;
            }
            productList.appendChild(productItem);
        });
    }

    searchInput.addEventListener('input', renderProducts);

    productList.addEventListener('click', (e) => {
        if (e.target.classList.contains('select-product-btn')) {
            const productName = e.target.dataset.name;
            const product = products.find(p => p.name === productName);

            if (!product.outOfStock) {
                showSubproducts(productName);
            }
        }
    });

    function showSubproducts(productName) {
        const product = products.find(p => p.name === productName);
        selectedProductName.textContent = `Paket ${product.name}`;
        subproductList.innerHTML = '';

        // Get logo URL based on product name
        let logoUrl = '';
        if (product.name.includes('Youtube')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Youtube_logo.png';
        else if (product.name.includes('Spotify')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Spotify_logo_with_text.svg.png';
        else if (product.name.includes('Netflix')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Logonetflix.png';
        else if (product.name.includes('Canva')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Canva-logo.png';
        else if (product.name.includes('Viu')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Viu_logo.svg%20(1).png';
        else if (product.name.includes('Vidio')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Logo_Vidio.png';
        else if (product.name.includes('Alight')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Alight_Motion.png';
        else if (product.name.includes('Prime')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/Amazon_Prime_Video_logo.svg.png';
        else if (product.name.includes('WeTV')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/WeTV_logo.svg.png';
        else if (product.name.includes('Request dan Custom')) logoUrl = 'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/refs/heads/main/images__2_-removebg-preview.png';
        else logoUrl = '';

        product.subproducts.forEach(subproduct => {
            const subproductItem = document.createElement('div');
            subproductItem.className = 'subproduct-item';

            if (subproduct.outOfStock) {
                subproductItem.innerHTML = `
                    <div class="product-logo small-logo">
                        ${logoUrl ? `<img src="${logoUrl}" alt="${product.name} logo">` : `<i class="fas fa-tag"></i>`}
                    </div>
                    <div class="out-of-stock-badge">Stok Habis</div>
                    <h4>${subproduct.name}</h4>
                    <div class="price-tag">Rp${subproduct.price.toLocaleString()}</div>
                    <p class="restock-message">${subproduct.restockMessage}</p>
                `;
            } else {
                let descriptionHtml = '';
                if (subproduct.description) {
                    descriptionHtml = `<p class="product-description">${subproduct.description}</p>`;
                }

                subproductItem.innerHTML = `
                    <div class="product-logo small-logo">
                        ${logoUrl ? `<img src="${logoUrl}" alt="${product.name} logo">` : `<i class="fas fa-tag"></i>`}
                    </div>
                    <h4>${subproduct.name}</h4>
                    ${descriptionHtml}
                    <div class="price-tag">Rp${subproduct.price.toLocaleString()}</div>
                    <button class="add-to-cart-btn" data-name="${product.name}" data-subname="${subproduct.name}" data-price="${subproduct.price}"><i class="fas fa-cart-plus"></i> Tambah ke Keranjang</button>
                `;
            }
            subproductList.appendChild(subproductItem);
        });
        productList.style.display = 'none';
        subproductSection.style.display = 'block';
    }

    backToProductsButton.addEventListener('click', () => {
        productList.style.display = 'grid';
        subproductSection.style.display = 'none';
    });

    subproductList.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            const productName = e.target.dataset.name;
            const subproductName = e.target.dataset.subname;
            const price = parseInt(e.target.dataset.price);

            const existingItem = cartArray.find(item => 
                item.product === productName && 
                item.subproduct === subproductName);

            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cartArray.push({
                    product: productName,
                    subproduct: subproductName,
                    price,
                    quantity: 1
                });
            }

            updateCart();
        }
    });

    function updateCart() {
        // Perbarui keranjang di halaman utama
        cartItems.innerHTML = '';
        // Perbarui juga keranjang di halaman cart page
        const cartPageItems = document.getElementById('cart-page-items');
        if (cartPageItems) {
            cartPageItems.innerHTML = '';
        }

        // Animate cart badge when items added
        const cartBadge = document.getElementById('cart-badge');
        cartBadge.classList.add('badge-pulse');
        setTimeout(() => {
            cartBadge.classList.remove('badge-pulse');
        }, 500);

        let total = 0;

        if (cartArray.length === 0) {
            // Pesan keranjang kosong untuk halaman utama
            const emptyCart = document.createElement('div');
            emptyCart.className = 'empty-cart-message';
            emptyCart.innerHTML = `
                <div class="empty-cart-icon"><i class="fas fa-shopping-basket"></i></div>
                <p>Keranjang belanja Anda masih kosong</p>
                <p>Silakan tambahkan beberapa produk</p>
            `;
            cartItems.appendChild(emptyCart);

            // Pesan keranjang kosong untuk halaman cart page
            if (cartPageItems) {
                const emptyCartPage = emptyCart.cloneNode(true);
                cartPageItems.appendChild(emptyCartPage);
            }
        } else {
            cartArray.forEach((item, index) => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;

                // Determine icon based on product name
                let iconClass = 'fa-tag';
                if (item.product.includes('Request dan Custom')) iconClass = 'fas fa-cogs';
                else if (item.product.includes('Youtube')) iconClass = 'fab fa-youtube';
                else if (item.product.includes('Spotify')) iconClass = 'fab fa-spotify';
                else if (item.product.includes('Netflix')) iconClass = 'fas fa-film';
                else if (item.product.includes('Canva')) iconClass = 'fas fa-paint-brush';
                else if (item.product.includes('Viu')) iconClass = 'fas fa-tv';
                else if (item.product.includes('Vidio')) iconClass = 'fas fa-video';
                else if (item.product.includes('Alight')) iconClass = 'fas fa-photo-video';

                // Item untuk halaman utama
                const cartItem = document.createElement('div');
                cartItem.className = 'cart-item';
                cartItem.innerHTML = `
                    <div class="cart-item-icon">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="cart-item-details">
                        <h4 title="${item.product}">${item.product}</h4>
                        <p title="${item.subproduct}">${item.subproduct}</p>
                        <p class="cart-item-price">Rp${item.price.toLocaleString()} × ${item.quantity}</p>
                        <div class="quantity-control">
                            <button class="quantity-btn minus" data-index="${index}">-</button>
                            <span class="quantity">${item.quantity}</span>
                            <button class="quantity-btn plus" data-index="${index}">+</button>
                            <button class="remove-btn" data-index="${index}" title="Hapus item">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    <div class="cart-item-total">
                        Rp${itemTotal.toLocaleString()}
                    </div>
                `;
                cartItems.appendChild(cartItem);

                // Item untuk halaman cart page
                if (cartPageItems) {
                    const cartPageItem = cartItem.cloneNode(true);
                    cartPageItems.appendChild(cartPageItem);
                }
            });
        }

        // Update total price di halaman utama
        const totalDiv = document.getElementById('total-price');
        if (totalDiv) {
            totalDiv.innerHTML = `
                <span>Total Belanja</span>
                <span>Rp${total.toLocaleString()}</span>
            `;
        }

        // Update total price di halaman cart page
        const cartPageTotal = document.getElementById('cart-page-total');
        if (cartPageTotal) {
            cartPageTotal.innerHTML = `
                <span>Total Belanja</span>
                <span>Rp${total.toLocaleString()}</span>
            `;
        }

        // Update cart badge
        document.getElementById('cart-badge').textContent = cartArray.reduce((sum, item) => sum + item.quantity, 0);

        // Enable/disable checkout button di halaman utama
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            if (cartArray.length === 0) {
                checkoutBtn.disabled = true;
                checkoutBtn.style.opacity = '0.5';
                checkoutBtn.style.cursor = 'not-allowed';
            } else {
                checkoutBtn.disabled = false;
                checkoutBtn.style.opacity = '1';
                checkoutBtn.style.cursor = 'pointer';
            }
        }

        // Enable/disable checkout button di halaman cart page
        const cartPageCheckout = document.getElementById('cart-page-checkout');
        if (cartPageCheckout) {
            if (cartArray.length === 0) {
                cartPageCheckout.disabled = true;
                cartPageCheckout.style.opacity = '0.5';
                cartPageCheckout.style.cursor = 'not-allowed';
            } else {
                cartPageCheckout.disabled = false;
                cartPageCheckout.style.opacity = '1';
                cartPageCheckout.style.cursor = 'pointer';
            }
        }
    }

    // Event listener untuk tombol plus, minus, hapus pada halaman utama
    cartItems.addEventListener('click', (e) => {
        if (e.target.classList.contains('plus')) {
            const index = parseInt(e.target.dataset.index);
            cartArray[index].quantity += 1;
            updateCart();
        } else if (e.target.classList.contains('minus')) {
            const index = parseInt(e.target.dataset.index);
            if (cartArray[index].quantity > 1) {
                cartArray[index].quantity -= 1;
            } else {
                cartArray.splice(index, 1);
            }
            updateCart();
        } else if (e.target.classList.contains('remove-btn')) {
            const index = parseInt(e.target.dataset.index);
            cartArray.splice(index, 1);
            updateCart();
        }
    });

    // Event listener untuk tombol plus, minus, hapus pada halaman cart-page
    document.addEventListener('click', (e) => {
        // Cari elemen cart-page-items terlebih dahulu
        const cartPageItems = document.getElementById('cart-page-items');
        if (!cartPageItems) return;

        // Periksa apakah event berasal dari dalam cart-page-items
        if (cartPageItems.contains(e.target)) {
            if (e.target.classList.contains('plus')) {
                const index = parseInt(e.target.dataset.index);
                cartArray[index].quantity += 1;
                updateCart();
            } else if (e.target.classList.contains('minus')) {
                const index = parseInt(e.target.dataset.index);
                if (cartArray[index].quantity > 1) {
                    cartArray[index].quantity -= 1;
                } else {
                    cartArray.splice(index, 1);
                }
                updateCart();
            } else if (e.target.classList.contains('remove-btn')) {
                const index = parseInt(e.target.dataset.index);
                cartArray.splice(index, 1);
                updateCart();
            }
        }
    });

    let isCartMaximized = false;

    cartIcon.addEventListener('click', () => {
        // Toggle between cart page and regular cart popup based on window width
        if (window.innerWidth <= 768) {
            // Pada layar mobile, tampilkan halaman keranjang dan sembunyikan halaman utama
            document.getElementById('cart-page').classList.add('active');
            document.getElementById('main-container').classList.add('hidden');
        } else {
            // Pada layar desktop, tampilkan popup keranjang
            cart.style.display = cart.style.display === 'none' ? 'block' : 'none';
        }

        // Refresh cart contents
        updateCart();
        console.log('Keranjang diklik, item: ', cartArray.length);
    });

    // Toggle maximize/minimize saat tombol judul diklik
    document.getElementById('cart-title').addEventListener('click', () => {
        toggleCartSize();
    });

    // Fungsi untuk toggle ukuran keranjang
    function toggleCartSize() {
        isCartMaximized = !isCartMaximized;

        if (isCartMaximized) {
            // Maximize
            cart.classList.add('maximized');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        } else {
            // Minimize
            cart.classList.remove('maximized');
            document.body.style.overflow = 'auto'; // Restore scrolling
        }
    }

    // Tombol kembali dari halaman keranjang ke halaman utama
    document.getElementById('back-to-main').addEventListener('click', () => {
        document.getElementById('cart-page').classList.remove('active');
        document.getElementById('main-container').classList.remove('hidden');
    });

    // Hide cart on initial page load
    document.addEventListener('DOMContentLoaded', () => {
        cart.style.display = 'none';
    });

    // Close cart when clicking the close button (legacy)
    document.getElementById('cart-close').addEventListener('click', () => {
        document.getElementById('cart-page').classList.remove('active');
        document.getElementById('main-container').classList.remove('hidden');
        cart.style.display = 'none'; // Hide cart when closing
    });

    // Close cart when clicking outside the cart content
    cart.addEventListener('click', (e) => {
        if (e.target === cart) {
            document.getElementById('cart-close').click();
        }
    });

    // Event listener untuk tombol checkout di halaman cart-page
    document.getElementById('cart-page-checkout').addEventListener('click', () => {
        if (cartArray.length === 0) {
            alert('Keranjang Anda kosong. Silakan tambahkan produk terlebih dahulu.');
            return;
        }

        if (!userName) {
            alert('Silakan masukkan nama Anda terlebih dahulu.');
            welcomeModal.style.display = 'flex';
            return;
        }

        let message = `Halo, saya ${userName} ingin memesan:%0A%0A`;
        cartArray.forEach(item => {
            message += `- ${item.product} (${item.subproduct}) - ${item.quantity} × Rp${item.price.toLocaleString()} = Rp${(item.price * item.quantity).toLocaleString()}%0A`;
        });

        const total = cartArray.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        message += `%0ATotal: Rp${total.toLocaleString()}`;
        message += `%0A%0ATolong diproses ya Kak Tomy! 😇%0ATerimakasih`;

        window.open(`https://wa.me/+6285159772620?text=${message}`);
    });

    // Event listener untuk tombol checkout di halaman utama
    checkoutButton.addEventListener('click', () => {
        if (cartArray.length === 0) {
            alert('Keranjang Anda kosong. Silakan tambahkan produk terlebih dahulu.');
            return;
        }

        if (!userName) {
            alert('Silakan masukkan nama Anda terlebih dahulu.');
            welcomeModal.style.display = 'flex';
            return;
        }

        let message = `Halo, saya ${userName} ingin memesan:%0A%0A`;
        cartArray.forEach(item => {
            message += `- ${item.product} (${item.subproduct}) - ${item.quantity} × Rp${item.price.toLocaleString()} = Rp${(item.price * item.quantity).toLocaleString()}%0A`;
        });

        const total = cartArray.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        message += `%0ATotal: Rp${total.toLocaleString()}`;
        message += `%0A%0ATolong diproses ya Kak Tomy! 😇%0ATerimakasih`;

        window.open(`https://wa.me/+6285159772620?text=${message}`);
    });

    renderProducts();
});
