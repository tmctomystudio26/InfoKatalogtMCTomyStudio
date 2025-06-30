document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('audio-player');
    const playButton = document.getElementById('play-btn');
    const prevButton = document.getElementById('prev-btn');
    const nextButton = document.getElementById('next-btn');
    const playIcon = document.getElementById('play-icon');
    const timerElement = document.getElementById('timer');

    const playlist = [
        'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/main/NDX%20AKA%20OPENING%20JOSSS%20-%20DITINGGAL%20RABI%20%20LIVE%20PERFORM%20DI%20PANTAI%20FESTIVAL%20ANCOL.mp3',
        'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/main/ABUN%20SUNGKAR%20-%20MENGIKHLASKAN%20HATI%20(OST%20CINTA%20DALAM%20IKHLAS)(3).mp3',
        'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/main/Restianade%20-%20Tresno%20Tekan%20Mati(2).mp3',
        'https://raw.githubusercontent.com/tmctomystudio26/github.musik.io/main/V1%20Angel%20Baby%20%20Shania%20Yan%20Cover%20-%20Shania%20Yan_1_1.mp3'
    ];
    const songTitles = [
        'NDX AKA - Opening Perform - Festival Pantai Ancol',
        'ABUN SUNGKAR - MENGIKHLASKAN HATI',
        'Restianade - Tresno Tekan Mati',
        'Angel Baby - Shania Yan Cover'
    ];
    let currentTrack = 0;

    function updateRunningText() {
        const currentSongText = document.getElementById('current-song');
        const text = `🎵 Now Playing: ${songTitles[currentTrack]} 🎵`;
        currentSongText.textContent = text;
        currentSongText.setAttribute('data-text', text);
    }

    // Create playlist modal
    const playlistModal = document.createElement('div');
    playlistModal.className = 'playlist-modal';
    document.body.appendChild(playlistModal);

    // Add playlist functionality
    function showPlaylist() {
        playlistModal.innerHTML = `
            <div class="playlist-header">
                <div class="playlist-title">Now Playing</div>
                <div class="playlist-controls">
                    <button class="playlist-btn minimize-btn" title="Minimize">_</button>
                    <button class="playlist-btn close-btn" title="Close">×</button>
                </div>
            </div>
        `;

        songTitles.forEach((title, index) => {
            const item = document.createElement('div');
            item.className = `playlist-item ${index === currentTrack ? 'active' : ''}`;
            item.textContent = title;
            item.onclick = () => {
                currentTrack = index;
                audio.src = playlist[currentTrack];
                audio.play();
                updateRunningText();
                highlightActiveTrack();
            };
            playlistModal.appendChild(item);
        });

        const closeBtn = playlistModal.querySelector('.close-btn');
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            playlistModal.style.display = 'none';
        };

        const minimizeBtn = playlistModal.querySelector('.minimize-btn');
        minimizeBtn.onclick = (e) => {
            e.stopPropagation();
            playlistModal.classList.toggle('playlist-minimized');
        };

        playlistModal.style.display = 'block';
    }

    function highlightActiveTrack() {
        const items = playlistModal.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            item.classList.toggle('active', index === currentTrack);
        });
    }

    // Improve next/prev buttons functionality
    nextButton.onclick = () => {
        currentTrack = (currentTrack + 1) % playlist.length;
        audio.src = playlist[currentTrack];
        audio.play();
        updateRunningText();
        highlightActiveTrack();
    };

    prevButton.onclick = () => {
        currentTrack = (currentTrack - 1 + playlist.length) % playlist.length;
        audio.src = playlist[currentTrack];
        audio.play();
        updateRunningText();
        highlightActiveTrack();
    };

    // Update audio controls visibility and styling
    nextButton.style.width = '40px';
    prevButton.style.width = '40px';
    nextButton.style.height = '40px';
    prevButton.style.height = '40px';

    // Add click event to running text
    document.querySelector('.running-text-container').onclick = showPlaylist;

    // Close playlist when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.playlist-modal') && 
            !e.target.closest('.running-text-container')) {
            playlistModal.style.display = 'none';
        }
    });
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

    // Name quotes generator
    function generateNameQuote(name) {
        const quotes = [
            `Nama "${name}" melambangkan keindahan yang tiada tara, bagaikan mutiara di dasar samudra`,
            `"${name}" menyimpan kekuatan dan keteguhan, seperti gunung yang berdiri kokoh`,
            `Pemilik nama "${name}" adalah pembawa cahaya, menerangi setiap langkah dalam kehidupan`,
            `"${name}" adalah perpaduan keanggunan dan kecerdasan yang tak tertandingi`,
            `Nama "${name}" memancarkan aura positif, menghangatkan hati setiap orang di sekitarnya`,
            `"${name}" adalah cerminan jiwa yang bersih dan hati yang tulus`,
            `Penyandang nama "${name}" ditakdirkan untuk mencapai kemuliaan dan kesuksesan`,
            `"${name}" adalah simbol kerendahan hati dan kebijaksanaan yang mendalam`,
            `Nama "${name}" membawa keberuntungan dan keberkahan di setiap langkah`,
            `"${name}" adalah nama yang dipilih dengan penuh makna dan harapan`,
            `Pemilik nama "${name}" memiliki pesona yang mampu menginspirasi banyak orang`,
            `"${name}" mencerminkan keberanian dan tekad yang tak tergoyahkan`,
            `Nama "${name}" adalah doa dan harapan untuk masa depan yang cemerlang`,
            `"${name}" membawa semangat perubahan dan kemajuan dalam hidupnya`,
            `Penyandang nama "${name}" adalah pemimpin sejati dengan visi yang jelas`
        ];
        return quotes[Math.floor(Math.random() * quotes.length)];
    }

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
            // Display name quote immediately
            const quoteElement = document.getElementById('name-quote');
            quoteElement.textContent = generateNameQuote(userName);
        } else {
            alert('Silakan masukkan nama Anda terlebih dahulu.');
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

    // Handle track ending
    audio.addEventListener('ended', () => {
        currentTrack = (currentTrack + 1) % playlist.length;
        audio.src = playlist[currentTrack];
        audio.play();
        updateRunningText();
    });

    // Next track button
    nextButton.addEventListener('click', () => {
        currentTrack = (currentTrack + 1) % playlist.length;
        audio.src = playlist[currentTrack];
        audio.play();
        isPlaying = true;
        updateRunningText();
    });

    // Previous track button
    prevButton.addEventListener('click', () => {
        currentTrack = (currentTrack - 1 + playlist.length) % playlist.length;
        audio.src = playlist[currentTrack];
        audio.play();
        isPlaying = true;
        updateRunningText();
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


    const products = [
        {
            name: 'Netflix Premium',
            isBestSeller: true,
            subproducts: [
                { name: '1 Bulan - Sharing 1P2U', price: 22500, oldPrice: 21500 },
                { name: '1 Bulan - Sharing 1P1U', price: 30000, oldPrice: 27500 },
                { name: '1 Bulan - Privat', price: 125000, oldPrice: 120000 }
            ],
            description: "Yth, <b>harga produk Netflix mengalami sedikit kenaikan harga</b>, disebabkan stok produk yang mengalami kelangkaan karena tingginya permintaan 🙏"
        },
        {
            name: 'Youtube Premium',
            outOfStock: true,
            restockMessage: 'Akan segera restock',
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
        productList.style.opacity = '0';

        setTimeout(() => {
            productList.style.transition = 'opacity 0.5s ease';
            productList.style.opacity = '1';
        }, 50);
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
                    ${product.isBestSeller ? '<div class="best-seller-badge">Best Seller</div>' : ''}
                    <div class="product-logo">
                        ${logoUrl ? `<img src="${logoUrl}" alt="${product.name} logo">` : `<i class="fas fa-tag"></i>`}
                    </div>
                    <div class="out-of-stock-badge">Stok Habis</div>
                    <h3>${product.name}</h3>
                    ${product.description ? `<p class="product-desc">${product.description}</p>` : ''}
                    <p class="product-desc">Paket ${product.name}</p>
                    <p class="restock-message">${product.restockMessage}</p>
                `;
            } else {
                productItem.innerHTML = `
                    ${product.isBestSeller ? '<div class="best-seller-badge">Best Seller</div>' : ''}
                    <div class="product-logo">
                        ${logoUrl ? `<img src="${logoUrl}" alt="${product.name} logo">` : `<i class="fas fa-tag"></i>`}
                    </div>
                    <h3>${product.name}</h3>
                    ${product.description ? `<p class="product-description">${product.description}</p>` : ''}
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

                let priceHtml = '';
                if (subproduct.oldPrice) {
                    priceHtml = `
                        <div class="price-tag price-with-change">
                            <div class="old-price">Rp${subproduct.oldPrice.toLocaleString()}</div>
                            <div class="new-price">
                                <span>Rp${subproduct.price.toLocaleString()}</span>
                                <span class="price-increase-arrow">↗️</span>
                            </div>
                        </div>
                    `;
                } else {
                    priceHtml = `<div class="price-tag">Rp${subproduct.price.toLocaleString()}</div>`;
                }

                subproductItem.innerHTML = `
                    <div class="product-logo small-logo">
                        ${logoUrl ? `<img src="${logoUrl}" alt="${product.name} logo">` : `<i class="fas fa-tag"></i>`}
                    </div>
                    <h4>${subproduct.name}</h4>
                    ${descriptionHtml}
                    ${priceHtml}
                    <button class="add-to-cart-btn" data-name="${product.name}" data-subname="${subproduct.name}" data-price="${subproduct.price}"><i class="fas fa-cart-plus"></i> Tambah ke Keranjang</button>
                `;
            }
            subproductList.appendChild(subproductItem);
        });
        productList.style.display = 'none';
        subproductSection.style.display = 'block';

        // Wait for DOM to update then scroll to first subproduct
        setTimeout(() => {
            const firstSubproduct = document.querySelector('.subproduct-item');
            if (firstSubproduct) {
                firstSubproduct.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
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

        // Animate cart badge when items added (desktop only)
        if (!isMobile) {
            const cartBadge = document.getElementById('cart-badge');
            cartBadge.classList.add('badge-pulse');
            setTimeout(() => {
                cartBadge.classList.remove('badge-pulse');
            }, 300);
        }

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
        // Handle trash icon click
        if (e.target.classList.contains('fa-trash-alt')) {
            const button = e.target.closest('.remove-btn');
            if (button) {
                const index = parseInt(button.dataset.index);
                cartArray.splice(index, 1);
                updateCart();
                return;
            }
        }

        // Handle other buttons
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
        if(cartPageItems.contains(e.target)) {
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

        // Create payment options modal
        const paymentModal = document.createElement('div');
        paymentModal.className = 'payment-modal';
        paymentModal.style.display = 'flex';
        paymentModal.innerHTML = `
            <div class="payment-modal-content">
                <h3>Pilih Opsi Pembayaran</h3>
                <div class="payment-options">
                    <button class="payment-option" data-option="Bayar Sekarang">Bayar Sekarang</button>
                    <button class="payment-option" data-option="Bayar Belakangan (Setelah Akun Diterima)">Bayar Belakangan (Setelah Akun Diterima)</button>
                    <button class="payment-option" data-option="Kasbon">Kasbon</button>
                </div>
            </div>
        `;
        document.body.appendChild(paymentModal);

        // Handle payment option selection
        const handlePaymentSelection = (option) => {
            if (option === "Kasbon") {
                alert("Dih Jangan Kasbon Lah !!!");
                return;
            }
            if (option === "Bayar Belakangan (Setelah Akun Diterima)") {
                alert("Iih kamu kenapa gak mau bayar sekarang aja sih wkwkk... Yaudah aku izinin ya ! Tapi nanti harus bayar ya ! 😇");
            }
            paymentModal.remove();
            message += `%0A%0AOpsi Pembayaran: ${option}`;
            message += `%0A%0ATolong diproses ya Kak Tomy! 😇%0ATerimakasih`;
            window.open(`https://wa.me/+6285159772620?text=${message}`);
        };

        paymentModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('payment-option')) {
                handlePaymentSelection(e.target.dataset.option);
            }
        });
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

        // Create payment options modal
        const paymentModal = document.createElement('div');
        paymentModal.className = 'payment-modal';
        paymentModal.style.display = 'flex';
        paymentModal.innerHTML = `
            <div class="payment-modal-content">
                <h3>Pilih Opsi Pembayaran</h3>
                <div class="payment-options">
                    <button class="payment-option" data-option="Bayar Sekarang">Bayar Sekarang</button>
                    <button class="payment-option" data-option="Bayar Belakangan (Setelah Akun Diterima)">Bayar Belakangan (Setelah Akun Diterima)</button>
                    <button class="payment-option" data-option="Kasbon">Kasbon</button>
                </div>
            </div>
        `;
        document.body.appendChild(paymentModal);

        // Handle payment option selection
        const handlePaymentSelection = (option) => {
            if (option === "Kasbon") {
                alert("Dih Jangan Kasbon Lah !!!");
                return;
            }
            if (option === "Bayar Belakangan (Setelah Akun Diterima)") {
                alert("Iih kamu kenapa gak mau bayar sekarang aja sih wkwkk... Yaudah aku izinin ya ! Tapi nanti harus bayar ya ! 😇");
            }
            paymentModal.remove();
            message += `%0A%0AOpsi Pembayaran: ${option}`;
            message += `%0A%0ATolong diproses ya Kak Tomy! 😇%0ATerimakasih`;
            window.open(`https://wa.me/+6285159772620?text=${message}`);
        };

        paymentModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('payment-option')) {
                handlePaymentSelection(e.target.dataset.option);
            }
        });
    });

    renderProducts();
    
    // Optimize scroll animations for performance
    const isMobile = window.innerWidth <= 768;
    
    if (!isMobile) {
        const observerOptions = {
            threshold: 0.2,
            rootMargin: '0px 0px -30px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        // Observe elements for animation (desktop only)
        setTimeout(() => {
            const animateElements = document.querySelectorAll('.product-item, .subproduct-item, .section-title');
            animateElements.forEach(el => observer.observe(el));
        }, 200);
    }
    
    // Add loading states for better UX
    function addLoadingState(element) {
        element.classList.add('loading');
        setTimeout(() => {
            element.classList.remove('loading');
        }, 800);
    }
    
    // Optimized button click feedback (desktop only)
    if (!isMobile) {
        document.addEventListener('click', (e) => {
            if (e.target.matches('button')) {
                const ripple = document.createElement('span');
                ripple.style.cssText = `
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.4);
                    transform: scale(0);
                    animation: ripple 0.4s ease-out;
                    pointer-events: none;
                `;
                
                const rect = e.target.getBoundingClientRect();
                const size = Math.min(rect.width, rect.height);
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
                ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
                
                e.target.style.position = 'relative';
                e.target.appendChild(ripple);
                
                setTimeout(() => ripple.remove(), 400);
            }
        });
    }
    
    // Add CSS for ripple animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});
