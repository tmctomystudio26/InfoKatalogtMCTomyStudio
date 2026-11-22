/**
 * Pure Phone Intelligence, ITU-T E.164 Parser, Indonesian Telecom HLR & Area Code Engine,
 * Official Directory Verifier, Anti-Fraud Pattern Detector, & Community Tag Aggregator.
 * Zero DOM dependencies so all core rules are deterministically unit-testable.
 */

export const COUNTRY_CALLING_CODES = [
  { iso: 'ID', code: '62', name: 'Indonesia', flag: '🇮🇩', tz: 'WIB / WITA / WIT (UTC+7..+9)', minLen: 8, maxLen: 13 },
  { iso: 'MY', code: '60', name: 'Malaysia', flag: '🇲🇾', tz: 'MYT (UTC+8)', minLen: 8, maxLen: 11 },
  { iso: 'SG', code: '65', name: 'Singapura', flag: '🇸🇬', tz: 'SGT (UTC+8)', minLen: 8, maxLen: 8 },
  { iso: 'US', code: '1', name: 'Amerika Serikat & Kanada', flag: '🇺🇸', tz: 'EST..PST (UTC-5..-8)', minLen: 10, maxLen: 10 },
  { iso: 'GB', code: '44', name: 'Inggris (UK)', flag: '🇬🇧', tz: 'GMT / BST (UTC+0/+1)', minLen: 9, maxLen: 11 },
  { iso: 'AU', code: '61', name: 'Australia', flag: '🇦🇺', tz: 'AEST (UTC+10)', minLen: 9, maxLen: 10 },
  { iso: 'JP', code: '81', name: 'Jepang', flag: '🇯🇵', tz: 'JST (UTC+9)', minLen: 9, maxLen: 11 },
  { iso: 'KR', code: '82', name: 'Korea Selatan', flag: '🇰🇷', tz: 'KST (UTC+9)', minLen: 9, maxLen: 11 },
  { iso: 'CN', code: '86', name: 'Tiongkok', flag: '🇨🇳', tz: 'CST (UTC+8)', minLen: 10, maxLen: 12 },
  { iso: 'HK', code: '852', name: 'Hong Kong', flag: '🇭🇰', tz: 'HKT (UTC+8)', minLen: 8, maxLen: 8 },
  { iso: 'TW', code: '886', name: 'Taiwan', flag: '🇹🇼', tz: 'TST (UTC+8)', minLen: 8, maxLen: 10 },
  { iso: 'TH', code: '66', name: 'Thailand', flag: '🇹🇭', tz: 'ICT (UTC+7)', minLen: 8, maxLen: 10 },
  { iso: 'VN', code: '84', name: 'Vietnam', flag: '🇻🇳', tz: 'ICT (UTC+7)', minLen: 9, maxLen: 11 },
  { iso: 'PH', code: '63', name: 'Filipina', flag: '🇵🇭', tz: 'PHT (UTC+8)', minLen: 9, maxLen: 10 },
  { iso: 'IN', code: '91', name: 'India', flag: '🇮🇳', tz: 'IST (UTC+5:30)', minLen: 10, maxLen: 10 },
  { iso: 'SA', code: '966', name: 'Arab Saudi', flag: '🇸🇦', tz: 'AST (UTC+3)', minLen: 9, maxLen: 9 },
  { iso: 'AE', code: '971', name: 'Uni Emirat Arab', flag: '🇦🇪', tz: 'GST (UTC+4)', minLen: 8, maxLen: 9 },
  { iso: 'DE', code: '49', name: 'Jerman', flag: '🇩🇪', tz: 'CET (UTC+1)', minLen: 8, maxLen: 12 },
  { iso: 'NL', code: '31', name: 'Belanda', flag: '🇳🇱', tz: 'CET (UTC+1)', minLen: 9, maxLen: 9 },
  { iso: 'FR', code: '33', name: 'Prancis', flag: '🇫🇷', tz: 'CET (UTC+1)', minLen: 9, maxLen: 9 },
  { iso: 'RU', code: '7', name: 'Rusia & Kazakhstan', flag: '🇷🇺', tz: 'MSK (UTC+3)', minLen: 10, maxLen: 10 },
  { iso: 'BR', code: '55', name: 'Brasil', flag: '🇧🇷', tz: 'BRT (UTC-3)', minLen: 10, maxLen: 11 },
  { iso: 'TR', code: '90', name: 'Turki', flag: '🇹🇷', tz: 'TRT (UTC+3)', minLen: 10, maxLen: 10 },
  { iso: 'NG', code: '234', name: 'Nigeria', flag: '🇳🇬', tz: 'WAT (UTC+1)', minLen: 10, maxLen: 10 },
  { iso: 'KH', code: '855', name: 'Kamboja', flag: '🇰🇭', tz: 'ICT (UTC+7)', minLen: 8, maxLen: 9 },
  { iso: 'MM', code: '95', name: 'Myanmar', flag: '🇲🇲', tz: 'MMT (UTC+6:30)', minLen: 8, maxLen: 10 },
  { iso: 'TL', code: '670', name: 'Timor Leste', flag: '🇹🇱', tz: 'TLT (UTC+9)', minLen: 7, maxLen: 8 },
  { iso: 'BN', code: '673', name: 'Brunei Darussalam', flag: '🇧🇳', tz: 'BNT (UTC+8)', minLen: 7, maxLen: 7 },
];

export const ID_MOBILE_HLR_PREFIXES = [
  { prefix: '0811', operator: 'Telkomsel', brand: 'Telkomsel Halo', network: '4G LTE / 5G · GSM' },
  { prefix: '0812', operator: 'Telkomsel', brand: 'Simpati / Halo', network: '4G LTE / 5G · GSM' },
  { prefix: '0813', operator: 'Telkomsel', brand: 'Simpati', network: '4G LTE / 5G · GSM' },
  { prefix: '0821', operator: 'Telkomsel', brand: 'Simpati Loop / Prabayar', network: '4G LTE / 5G · GSM' },
  { prefix: '0822', operator: 'Telkomsel', brand: 'Simpati Loop', network: '4G LTE / 5G · GSM' },
  { prefix: '0823', operator: 'Telkomsel', brand: 'Kartu As', network: '4G LTE · GSM' },
  { prefix: '0851', operator: 'Telkomsel', brand: 'Kartu As / by.U', network: '4G LTE / 5G · GSM' },
  { prefix: '0852', operator: 'Telkomsel', brand: 'Kartu As', network: '4G LTE · GSM' },
  { prefix: '0853', operator: 'Telkomsel', brand: 'Kartu As', network: '4G LTE · GSM' },

  { prefix: '0814', operator: 'Indosat Ooredoo Hutchison', brand: 'IM3 M2M / Broadband', network: '4G LTE · GSM' },
  { prefix: '0815', operator: 'Indosat Ooredoo Hutchison', brand: 'Mentari / Matrix', network: '4G LTE / 5G · GSM' },
  { prefix: '0816', operator: 'Indosat Ooredoo Hutchison', brand: 'Mentari / Matrix', network: '4G LTE / 5G · GSM' },
  { prefix: '0855', operator: 'Indosat Ooredoo Hutchison', brand: 'Matrix Pascabayar', network: '4G LTE · GSM' },
  { prefix: '0856', operator: 'Indosat Ooredoo Hutchison', brand: 'IM3 Ooredoo', network: '4G LTE / 5G · GSM' },
  { prefix: '0857', operator: 'Indosat Ooredoo Hutchison', brand: 'IM3 Ooredoo', network: '4G LTE / 5G · GSM' },
  { prefix: '0858', operator: 'Indosat Ooredoo Hutchison', brand: 'Mentari Ooredoo', network: '4G LTE · GSM' },
  { prefix: '0895', operator: 'Indosat Ooredoo Hutchison', brand: 'Tri (3) Indonesia', network: '4G LTE / 4.5G · GSM' },
  { prefix: '0896', operator: 'Indosat Ooredoo Hutchison', brand: 'Tri (3) Indonesia', network: '4G LTE · GSM' },
  { prefix: '0897', operator: 'Indosat Ooredoo Hutchison', brand: 'Tri (3) Indonesia', network: '4G LTE · GSM' },
  { prefix: '0898', operator: 'Indosat Ooredoo Hutchison', brand: 'Tri (3) Indonesia', network: '4G LTE · GSM' },
  { prefix: '0899', operator: 'Indosat Ooredoo Hutchison', brand: 'Tri (3) Indonesia', network: '4G LTE · GSM' },

  { prefix: '0817', operator: 'XL Axiata', brand: 'XL Prioritas / Prabayar', network: '4G LTE / 5G · GSM' },
  { prefix: '0818', operator: 'XL Axiata', brand: 'XL Prabayar / Prioritas', network: '4G LTE / 5G · GSM' },
  { prefix: '0819', operator: 'XL Axiata', brand: 'XL Prabayar', network: '4G LTE · GSM' },
  { prefix: '0859', operator: 'XL Axiata', brand: 'XL Prabayar / Live.On', network: '4G LTE · GSM' },
  { prefix: '0877', operator: 'XL Axiata', brand: 'XL Prabayar', network: '4G LTE · GSM' },
  { prefix: '0878', operator: 'XL Axiata', brand: 'XL Prabayar', network: '4G LTE · GSM' },
  { prefix: '0831', operator: 'XL Axiata', brand: 'AXIS', network: '4G LTE · GSM' },
  { prefix: '0832', operator: 'XL Axiata', brand: 'AXIS', network: '4G LTE · GSM' },
  { prefix: '0833', operator: 'XL Axiata', brand: 'AXIS', network: '4G LTE · GSM' },
  { prefix: '0838', operator: 'XL Axiata', brand: 'AXIS', network: '4G LTE · GSM' },

  { prefix: '0881', operator: 'Smartfren', brand: 'Smartfren 4G LTE', network: 'VoLTE / 4G LTE' },
  { prefix: '0882', operator: 'Smartfren', brand: 'Smartfren 4G LTE', network: 'VoLTE / 4G LTE' },
  { prefix: '0883', operator: 'Smartfren', brand: 'Smartfren 4G LTE', network: 'VoLTE / 4G LTE' },
  { prefix: '0884', operator: 'Smartfren', brand: 'Smartfren 4G LTE', network: 'VoLTE / 4G LTE' },
  { prefix: '0885', operator: 'Smartfren', brand: 'Smartfren 4G LTE', network: 'VoLTE / 4G LTE' },
  { prefix: '0886', operator: 'Smartfren', brand: 'Smartfren 4G LTE', network: 'VoLTE / 4G LTE' },
  { prefix: '0887', operator: 'Smartfren', brand: 'Smartfren 4G LTE', network: 'VoLTE / 4G LTE' },
  { prefix: '0888', operator: 'Smartfren', brand: 'Smartfren eSIM / 4G', network: 'VoLTE / 4G LTE' },
  { prefix: '0889', operator: 'Smartfren', brand: 'Smartfren 4G LTE', network: 'VoLTE / 4G LTE' },

  { prefix: '0868', operator: 'PSN / Byru', brand: 'Satelit / Seluler Khusus', network: 'Satelit / MSS' },
];

export const ID_AREA_CODES = [
  { code: '021', region: 'Jakarta, Bogor, Depok, Tangerang, Bekasi (Jabodetabek)', tz: 'WIB (UTC+7)' },
  { code: '022', region: 'Bandung, Cimahi, Soreang (Jawa Barat)', tz: 'WIB (UTC+7)' },
  { code: '024', region: 'Semarang, Ungaran, Demak (Jawa Tengah)', tz: 'WIB (UTC+7)' },
  { code: '031', region: 'Surabaya, Gresik, Sidoarjo, Bangkalan (Jawa Timur)', tz: 'WIB (UTC+7)' },
  { code: '061', region: 'Medan, Binjai, Deli Serdang (Sumatera Utara)', tz: 'WIB (UTC+7)' },
  { code: '0251', region: 'Bogor & Sekitarnya (Jawa Barat)', tz: 'WIB (UTC+7)' },
  { code: '0254', region: 'Serang, Cilegon (Banten)', tz: 'WIB (UTC+7)' },
  { code: '0231', region: 'Cirebon (Jawa Barat)', tz: 'WIB (UTC+7)' },
  { code: '0271', region: 'Surakarta / Solo, Karanganyar, Sukoharjo', tz: 'WIB (UTC+7)' },
  { code: '0274', region: 'Yogyakarta, Sleman, Bantul (DIY)', tz: 'WIB (UTC+7)' },
  { code: '0281', region: 'Purwokerto, Banyumas (Jawa Tengah)', tz: 'WIB (UTC+7)' },
  { code: '0293', region: 'Magelang (Jawa Tengah)', tz: 'WIB (UTC+7)' },
  { code: '0341', region: 'Malang & Batu (Jawa Timur)', tz: 'WIB (UTC+7)' },
  { code: '0351', region: 'Madiun & Magetan (Jawa Timur)', tz: 'WIB (UTC+7)' },
  { code: '0354', region: 'Kediri (Jawa Timur)', tz: 'WIB (UTC+7)' },
  { code: '0331', region: 'Jember (Jawa Timur)', tz: 'WIB (UTC+7)' },
  { code: '0361', region: 'Denpasar, Badung, Gianyar, Singaraja Selatan (Bali)', tz: 'WITA (UTC+8)' },
  { code: '0362', region: 'Singaraja / Buleleng (Bali Utara)', tz: 'WITA (UTC+8)' },
  { code: '0370', region: 'Mataram & Lombok (NTB)', tz: 'WITA (UTC+8)' },
  { code: '0380', region: 'Kupang (NTT)', tz: 'WITA (UTC+8)' },
  { code: '0411', region: 'Makassar, Maros, Gowa (Sulawesi Selatan)', tz: 'WITA (UTC+8)' },
  { code: '0431', region: 'Manado, Tomohon, Minahasa (Sulawesi Utara)', tz: 'WITA (UTC+8)' },
  { code: '0451', region: 'Palu (Sulawesi Tengah)', tz: 'WITA (UTC+8)' },
  { code: '0511', region: 'Banjarmasin & Banjarbaru (Kalimantan Selatan)', tz: 'WITA (UTC+8)' },
  { code: '0541', region: 'Samarinda & Tenggarong (Kalimantan Timur)', tz: 'WITA (UTC+8)' },
  { code: '0542', region: 'Balikpapan (Kalimantan Timur)', tz: 'WITA (UTC+8)' },
  { code: '0561', region: 'Pontianak (Kalimantan Barat)', tz: 'WIB (UTC+7)' },
  { code: '0651', region: 'Banda Aceh (Aceh)', tz: 'WIB (UTC+7)' },
  { code: '0711', region: 'Palembang (Sumatera Selatan)', tz: 'WIB (UTC+7)' },
  { code: '0721', region: 'Bandar Lampung (Lampung)', tz: 'WIB (UTC+7)' },
  { code: '0751', region: 'Padang (Sumatera Barat)', tz: 'WIB (UTC+7)' },
  { code: '0761', region: 'Pekanbaru (Riau)', tz: 'WIB (UTC+7)' },
  { code: '0778', region: 'Batam (Kepulauan Riau)', tz: 'WIB (UTC+7)' },
  { code: '0911', region: 'Ambon (Maluku)', tz: 'WIT (UTC+9)' },
  { code: '0967', region: 'Jayapura (Papua)', tz: 'WIT (UTC+9)' },
  { code: '0800', region: 'Nomor Bebas Pulsa Nasional (Toll-Free)', tz: 'Nasional (WIB–WIT)' },
  { code: '0804', region: 'Layanan Berbagi Biaya Nasional (Contact Center)', tz: 'Nasional (WIB–WIT)' },
];

export const VERIFIED_OFFICIAL_DIRECTORY = [
  { id: 'off-ojk-wa', name: 'OJK Resmi (Kontak 157 WhatsApp)', category: 'Regulator Keuangan', numbers: ['081157157157', '+6281157157157'], short: 'WA Resmi OJK RI', website: 'https://ojk.go.id' },
  { id: 'off-ojk-call', name: 'OJK Call Center 157', category: 'Regulator Keuangan', numbers: ['157', '021157', '+6221157'], short: 'Layanan Konsumen Keuangan', website: 'https://ojk.go.id' },
  { id: 'off-bi', name: 'Bank Indonesia (BICARA 131)', category: 'Bank Sentral', numbers: ['131', '021131', '+6221131'], short: 'Call Center Bank Indonesia', website: 'https://bi.go.id' },
  { id: 'off-bca', name: 'Halo BCA Resmi', category: 'Perbankan', numbers: ['1500888', '0211500888', '+62211500888'], short: 'Tidak pernah pakai nomor HP pribadi', website: 'https://bca.co.id' },
  { id: 'off-bca-wa', name: 'Bank BCA (WhatsApp Resmi Tercentang)', category: 'Perbankan', numbers: ['08111500998', '+628111500998'], short: 'Akun Bisnis Resmi Bank BCA', website: 'https://bca.co.id' },
  { id: 'off-mandiri', name: 'Mandiri Call 14000', category: 'Perbankan', numbers: ['14000', '02152997777', '+622152997777'], short: 'Call Center Resmi Bank Mandiri', website: 'https://bankmandiri.co.id' },
  { id: 'off-mandiri-wa', name: 'Bank Mandiri (WhatsApp Resmi MITA)', category: 'Perbankan', numbers: ['08118414000', '+628118414000'], short: 'WhatsApp Resmi Bank Mandiri', website: 'https://bankmandiri.co.id' },
  { id: 'off-bri', name: 'Contact BRI (14017 / 1500017)', category: 'Perbankan', numbers: ['14017', '1500017', '0211500017', '+62211500017'], short: 'Call Center Resmi Bank BRI', website: 'https://bri.co.id' },
  { id: 'off-bri-wa', name: 'Bank BRI (WhatsApp Sabrina Resmi)', category: 'Perbankan', numbers: ['08121214017', '+628121214017'], short: 'WhatsApp Bisnis Resmi BRI', website: 'https://bri.co.id' },
  { id: 'off-bni', name: 'BNI Call 1500046', category: 'Perbankan', numbers: ['1500046', '0211500046', '+62211500046'], short: 'Call Center Resmi Bank BNI', website: 'https://bni.co.id' },
  { id: 'off-bsi', name: 'BSI Call 14040', category: 'Perbankan', numbers: ['14040', '02114040', '+622114040'], short: 'Bank Syariah Indonesia Resmi', website: 'https://bankbsi.co.id' },
  { id: 'off-cimb', name: 'CIMB Niaga Call 14041', category: 'Perbankan', numbers: ['14041', '02114041', '+622114041'], short: 'Call Center Resmi CIMB Niaga', website: 'https://cimbniaga.co.id' },
  { id: 'off-btn', name: 'BTN Call 150286 / 1500286', category: 'Perbankan', numbers: ['150286', '1500286', '0211500286'], short: 'Call Center Resmi Bank BTN', website: 'https://btn.co.id' },
  { id: 'off-danamon', name: 'Hello Danamon 1500090', category: 'Perbankan', numbers: ['1500090', '0211500090'], short: 'Call Center Resmi Bank Danamon', website: 'https://danamon.co.id' },
  { id: 'off-jago', name: 'Tanya Jago (Bank Jago)', category: 'Perbankan Digital', numbers: ['1500746', '02130000746', '+622130000746'], short: 'Call Center Resmi Bank Jago', website: 'https://jago.com' },
  { id: 'off-seabank', name: 'SeaBank Indonesia CS', category: 'Perbankan Digital', numbers: ['1500130', '0211500130'], short: 'Call Center Resmi SeaBank', website: 'https://seabank.co.id' },
  { id: 'off-dana', name: 'DANA Care Resmi', category: 'Dompet Digital', numbers: ['1500445', '0211500445', '08041500445'], short: 'Waspada nomor WA tiruan mengatasnamakan DANA', website: 'https://dana.id' },
  { id: 'off-ovo', name: 'OVO Care Resmi', category: 'Dompet Digital', numbers: ['1500696', '0211500696'], short: 'Call Center Resmi OVO', website: 'https://ovo.id' },
  { id: 'off-gopay', name: 'GoPay / Gojek Care Resmi', category: 'Dompet Digital', numbers: ['02150849000', '+622150849000'], short: 'Customer Care Resmi Gojek/GoPay', website: 'https://gojek.com' },
  { id: 'off-shopee', name: 'Shopee Customer Service', category: 'E-Commerce', numbers: ['1500702', '0211500702', '02139500300'], short: 'Layanan Resmi Shopee Indonesia', website: 'https://shopee.co.id' },
  { id: 'off-jne', name: 'JNE Express Customer Care', category: 'Ekspedisi & Kurir', numbers: ['02129278888', '+622129278888'], short: 'Resi resmi tidak pernah meminta instal file APK', website: 'https://jne.co.id' },
  { id: 'off-jnt', name: 'J&T Express Hotline', category: 'Ekspedisi & Kurir', numbers: ['02180661888', '+622180661888'], short: 'Hotline Resmi J&T Express', website: 'https://jet.co.id' },
  { id: 'off-sicepat', name: 'SiCepat Ekspres Call Center', category: 'Ekspedisi & Kurir', numbers: ['02150200050', '+622150200050'], short: 'Call Center Resmi SiCepat', website: 'https://sicepat.com' },
  { id: 'off-pos', name: 'Pos Indonesia (Hallo Pos 1500161)', category: 'Ekspedisi & Kurir', numbers: ['1500161', '161', '0211500161'], short: 'Layanan Resmi PT Pos Indonesia', website: 'https://posindonesia.co.id' },
  { id: 'off-pln', name: 'PLN 123 Resmi', category: 'Utilitas Publik', numbers: ['123', '021123', '+6221123'], short: 'Contact Center Resmi PT PLN', website: 'https://pln.co.id' },
  { id: 'off-pertamina', name: 'Pertamina Call Center 135', category: 'Energi & Publik', numbers: ['135', '021135'], short: 'Layanan Resmi PT Pertamina', website: 'https://pertamina.com' },
  { id: 'off-bpjs-kes', name: 'BPJS Kesehatan Care Center 165', category: 'Pemerintah & Kesehatan', numbers: ['165', '1500400'], short: 'Layanan Resmi BPJS Kesehatan', website: 'https://bpjs-kesehatan.go.id' },
  { id: 'off-bpjs-tk', name: 'BPJS Ketenagakerjaan 175', category: 'Pemerintah & Publik', numbers: ['175', '1500910'], short: 'Layanan Resmi BPJamsostek', website: 'https://bpjsketenagakerjaan.go.id' },
  { id: 'off-pajak', name: 'Kring Pajak 1500200 (DJP Kemenkeu)', category: 'Pemerintah', numbers: ['1500200', '0211500200'], short: 'Resmi Ditjen Pajak RI', website: 'https://pajak.go.id' },
  { id: 'off-beacukai', name: 'Bravo Bea Cukai 1500225', category: 'Pemerintah', numbers: ['1500225', '0211500225'], short: 'Waspada penipuan paket tertahan cukai', website: 'https://beacukai.go.id' },
  { id: 'off-kai', name: 'KAI 121 (Kereta Api Indonesia)', category: 'Transportasi Publik', numbers: ['121', '021121', '+6221121'], short: 'Contact Center Resmi PT KAI', website: 'https://kai.id' },
  { id: 'off-telkomsel', name: 'Call Center Telkomsel (188)', category: 'Operator Seluler', numbers: ['188', '08071811811'], short: 'Layanan Pelanggan Resmi Telkomsel', website: 'https://telkomsel.com' },
  { id: 'off-indosat', name: 'Indosat IM3 / Tri Care (185)', category: 'Operator Seluler', numbers: ['185', '02130003000'], short: 'Layanan Pelanggan Resmi Indosat', website: 'https://indosat.com' },
  { id: 'off-xl', name: 'XL Axiata Care (817)', category: 'Operator Seluler', numbers: ['817', '02157959817'], short: 'Layanan Pelanggan Resmi XL', website: 'https://xl.co.id' },
  { id: 'off-112', name: 'Darurat Nasional 112', category: 'Darurat', numbers: ['112'], short: 'Panggilan Darurat Terpadu Bebas Pulsa', website: 'https://layanan112.kominfo.go.id' },
  { id: 'off-110', name: 'Polri Call Center 110', category: 'Darurat & Kepolisian', numbers: ['110'], short: 'Layanan Darurat Kepolisian RI', website: 'https://polri.go.id' },
  { id: 'off-119', name: 'Ambulans & Kemenkes PSC 119', category: 'Darurat Medis', numbers: ['119', '1500567'], short: 'Layanan Gawat Darurat Medis', website: 'https://kemkes.go.id' },
  { id: 'off-113', name: 'Pemadam Kebakaran 113', category: 'Darurat', numbers: ['113'], short: 'Panggilan Darurat Damkar', website: '' },
  { id: 'off-115', name: 'Basarnas SAR 115', category: 'Darurat', numbers: ['115'], short: 'Badan Nasional Pencarian & Pertolongan', website: 'https://basarnas.go.id' },
  { id: 'off-manifestudio', name: 'Admin Resmi Manifestudio by Tomy', category: 'Layanan Resmi Situs Ini', numbers: ['085122936027', '+6285122936027'], short: 'Kontak WhatsApp Admin Resmi Manifestudio', website: 'https://manifestudio.my.id' },
];

export const COMMON_SCAM_PATTERNS_ID = [
  {
    id: 'apk-courier',
    title: 'Kurir Paket / Undangan File .APK',
    risk: 'Tinggi',
    summary: 'Mengaku kurir JNE/J&T/Pos atau mengirim file undangan pernikahan/surat tilang berformat .APK untuk mencuri OTP m-banking.',
    tip: 'Jangan pernah menginstal file .APK dari WhatsApp. Ekspedisi resmi melacak resi lewat situs/aplikasi resmi.',
  },
  {
    id: 'fake-bank-fee',
    title: 'Perubahan Tarif Transfer BI-FAST / Blokir Rekening',
    risk: 'Tinggi',
    summary: 'Nomor HP biasa (+62 8xx) mengaku dari BCA/BRI/Mandiri/BNI dan meminta klik link pengisian PIN/CVV/OTP untuk membatalkan tarif Rp150.000/bulan.',
    tip: 'Bank resmi hanya menghubungi dari hotline pendek terverifikasi (1500888, 14000, 14017, 1500046) atau WhatsApp bercentang resmi.',
  },
  {
    id: 'wrong-transfer',
    title: 'Salah Transfer & Tekanan Pinjol Ilegal',
    risk: 'Tinggi',
    summary: 'Pelaku mengirim sejumlah uang lalu meneror untuk mengembalikan ke rekening berbeda dengan bunga paksa.',
    tip: 'Jangan memindahkan dana ke rekening lain secara langsung; laporkan mutasi ke pihak bank resmi & OJK (157).',
  },
  {
    id: 'customs-hold',
    title: 'Paket Tertahan Bea Cukai / Imigrasi',
    risk: 'Tinggi',
    summary: 'Meminta transfer biaya tebusan pajak ke rekening pribadi atas nama petugas cukai atau kurir luar negeri.',
    tip: 'Pembayaran pajak kepabeanan hanya menggunakan kode billing resmi negara (MPN G2/G3), bukan rekening pribadi. Cek di Bravo Bea Cukai 1500225.',
  },
  {
    id: 'job-task-scam',
    title: 'Kerja Paruh Waktu Like/Subscribe Berdeposit',
    risk: 'Sedang–Tinggi',
    summary: 'Menawarkan komisi mudah dengan syarat transfer deposit makin besar yang akhirnya tidak bisa ditarik.',
    tip: 'Pekerjaan sah tidak pernah meminta pekerja menyetor uang deposit terlebih dahulu.',
  },
];

export function sanitizePhoneDigits(raw = '') {
  return String(raw || '').replace(/[^\d+]/g, '').trim();
}

export function formatIndonesianNational(digitsWithoutZero = '') {
  const local = digitsWithoutZero.startsWith('0') ? digitsWithoutZero : `0${digitsWithoutZero}`;
  if (local.length <= 4) return local;
  if (local.startsWith('08')) {
    const p1 = local.slice(0, 4);
    const p2 = local.slice(4, 8);
    const p3 = local.slice(8);
    return [p1, p2, p3].filter(Boolean).join('-');
  }
  const area3 = ID_AREA_CODES.find((a) => local.startsWith(a.code));
  if (area3) {
    const rest = local.slice(area3.code.length);
    if (rest.length > 4) {
      return `(${area3.code}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
    }
    return `(${area3.code}) ${rest}`;
  }
  return local;
}

/**
 * Parses any phone number string (local ID 08xx / 021 / shortcodes 1500888,
 * or E.164 +62 / +1 / +60 / +65 ...) into normalized telecom metadata.
 */
export function parsePhoneNumberInput(rawInput = '', defaultRegion = 'ID') {
  const raw = String(rawInput || '').trim();
  const cleaned = sanitizePhoneDigits(raw);
  const onlyDigits = cleaned.replace(/\D/g, '');

  if (!onlyDigits || onlyDigits.length < 3) {
    return {
      valid: false,
      reason: 'Masukkan minimal 3 digit nomor telepon yang valid.',
      raw,
      e164: '',
      nationalFormat: raw,
      internationalFormat: raw,
      whatsappDigits: '',
      country: null,
      lineType: 'TIDAK DIKETAHUI',
      carrier: '',
      carrierBrand: '',
      network: '',
      regionLabel: '',
      timezone: '',
      isIndonesian: false,
      isShortCode: false,
    };
  }

  // Handle Indonesian emergency & call center shortcodes (110, 112, 119, 123, 131, 157, 14000, 1500888)
  const isDefaultId = String(defaultRegion || 'ID').toUpperCase() === 'ID';
  if (!cleaned.startsWith('+') && isDefaultId && onlyDigits.length >= 3 && onlyDigits.length <= 7 && !onlyDigits.startsWith('0')) {
    return {
      valid: true,
      reason: '',
      raw,
      e164: onlyDigits,
      nationalFormat: onlyDigits,
      internationalFormat: `ID Shortcode ${onlyDigits}`,
      whatsappDigits: '',
      country: COUNTRY_CALLING_CODES[0],
      lineType: onlyDigits.length <= 3 ? 'KODE DARURAT / LAYANAN PUBLIK' : 'CALL CENTER / KODE PENDEK',
      carrier: 'Jaringan Nasional Indonesia',
      carrierBrand: 'Shortcode Resmi / Korporat',
      network: 'PSTN / Seluler Terpadu',
      regionLabel: 'Indonesia (Nasional)',
      timezone: 'WIB / WITA / WIT',
      isIndonesian: true,
      isShortCode: true,
    };
  }

  let e164 = '';
  let matchedCountry = null;

  if (cleaned.startsWith('+')) {
    e164 = `+${onlyDigits}`;
  } else if (onlyDigits.startsWith('00') && onlyDigits.length > 5) {
    e164 = `+${onlyDigits.slice(2)}`;
  } else if (isDefaultId && onlyDigits.startsWith('0')) {
    e164 = `+62${onlyDigits.slice(1)}`;
  } else if (isDefaultId && onlyDigits.startsWith('62') && onlyDigits.length >= 9) {
    e164 = `+${onlyDigits}`;
  } else {
    const defCountry =
      COUNTRY_CALLING_CODES.find((c) => c.iso === String(defaultRegion || 'ID').toUpperCase()) ||
      COUNTRY_CALLING_CODES[0];
    if (onlyDigits.startsWith(defCountry.code) && onlyDigits.length >= defCountry.minLen + defCountry.code.length - 1) {
      e164 = `+${onlyDigits}`;
    } else {
      e164 = `+${defCountry.code}${onlyDigits.replace(/^0+/, '')}`;
    }
  }

  const e164Digits = e164.slice(1);
  // Match longest country calling code first
  const sortedCodes = [...COUNTRY_CALLING_CODES].sort((a, b) => b.code.length - a.code.length);
  matchedCountry = sortedCodes.find((c) => e164Digits.startsWith(c.code)) || null;

  const isIndonesian = matchedCountry?.iso === 'ID';
  const nationalSubDigits = matchedCountry ? e164Digits.slice(matchedCountry.code.length) : e164Digits;
  const minAllowed = matchedCountry ? matchedCountry.minLen : 6;
  const maxAllowed = matchedCountry ? matchedCountry.maxLen : 15;
  const structurallyValid =
    e164Digits.length >= 7 &&
    e164Digits.length <= 15 &&
    nationalSubDigits.length >= minAllowed &&
    nationalSubDigits.length <= maxAllowed;

  let lineType = 'NOMOR INTERNASIONAL';
  let carrier = matchedCountry ? `Operator ${matchedCountry.name}` : 'Jaringan Telekomunikasi Global';
  let carrierBrand = '';
  let network = 'ITU-T E.164';
  let regionLabel = matchedCountry ? matchedCountry.name : 'Global / Tidak Terpetakan';
  let timezone = matchedCountry ? matchedCountry.tz : 'UTC';
  let nationalFormat = e164;
  let internationalFormat = e164;

  if (isIndonesian) {
    const idLocal = `0${nationalSubDigits}`;
    nationalFormat = formatIndonesianNational(idLocal);
    const localStripped = nationalSubDigits;
    internationalFormat = localStripped.startsWith('8')
      ? `+62 ${localStripped.slice(0, 3)}-${localStripped.slice(3, 7)}-${localStripped.slice(7)}`.replace(/-$/, '')
      : `+62 ${localStripped}`;

    const hlr = ID_MOBILE_HLR_PREFIXES.find((p) => idLocal.startsWith(p.prefix));
    const area = ID_AREA_CODES.find((a) => idLocal.startsWith(a.code));

    if (hlr) {
      lineType = 'SELULER (MOBILE)';
      carrier = hlr.operator;
      carrierBrand = hlr.brand;
      network = hlr.network;
      regionLabel = 'Indonesia (Nasional)';
      timezone = 'WIB / WITA / WIT';
    } else if (idLocal.startsWith('0800')) {
      lineType = 'BEBAS PULSA (TOLL-FREE)';
      carrier = 'Layanan Bebas Pulsa Indonesia';
      carrierBrand = '0800 Toll-Free';
      network = 'IN / PSTN';
      regionLabel = area?.region || 'Nasional Indonesia';
      timezone = area?.tz || 'WIB–WIT';
    } else if (idLocal.startsWith('0804') || idLocal.startsWith('0211500') || idLocal.startsWith('021140')) {
      lineType = 'CONTACT CENTER / PREMIUM';
      carrier = 'Layanan Contact Center Bisnis';
      carrierBrand = 'Berbagi Biaya / Call Center';
      network = 'IN / SIP Trunk';
      regionLabel = area?.region || 'Indonesia';
      timezone = area?.tz || 'WIB (UTC+7)';
    } else if (area) {
      lineType = 'TELEPON TETAP (PSTN / KANTOR)';
      carrier = 'Telkom Indonesia / PSTN Tetap';
      carrierBrand = `Kode Area ${area.code}`;
      network = 'PSTN / VoIP Korporat';
      regionLabel = area.region;
      timezone = area.tz;
    } else if (idLocal.startsWith('08')) {
      lineType = 'SELULER (PREFIX BARU / KHUSUS)';
      carrier = 'Operator Seluler Indonesia';
      carrierBrand = `Prefix ${idLocal.slice(0, 4)}`;
      network = '4G LTE / GSM';
    } else {
      lineType = 'NOMOR KHUSUS / PSTN';
      carrier = 'Jaringan Tetap Indonesia';
    }
  } else if (matchedCountry) {
    nationalFormat = nationalSubDigits;
    if (matchedCountry.iso === 'US' && nationalSubDigits.length === 10) {
      const npa = nationalSubDigits.slice(0, 3);
      const isTollFree = ['800', '833', '844', '855', '866', '877', '888'].includes(npa);
      lineType = isTollFree ? 'TOLL-FREE (NANP)' : 'SELULER / TETAP (NANP)';
      internationalFormat = `+1 (${npa}) ${nationalSubDigits.slice(3, 6)}-${nationalSubDigits.slice(6)}`;
      nationalFormat = `(${npa}) ${nationalSubDigits.slice(3, 6)}-${nationalSubDigits.slice(6)}`;
    } else {
      internationalFormat = `+${matchedCountry.code} ${nationalSubDigits}`;
    }
  }

  return {
    valid: structurallyValid,
    reason: structurallyValid
      ? ''
      : `Panjang digit (${nationalSubDigits.length}) tidak sesuai standar umum ${matchedCountry?.name || 'E.164'} (${minAllowed}–${maxAllowed} digit).`,
    raw,
    e164,
    nationalFormat,
    internationalFormat,
    whatsappDigits: e164Digits,
    country: matchedCountry,
    lineType,
    carrier,
    carrierBrand,
    network,
    regionLabel,
    timezone,
    isIndonesian,
    isShortCode: false,
  };
}

export function findOfficialDirectoryMatch(parsedPhone) {
  if (!parsedPhone || (!parsedPhone.e164 && !parsedPhone.nationalFormat)) return null;
  const rawDigits = String(parsedPhone.raw || '').replace(/\D/g, '');
  const e164Digits = String(parsedPhone.e164 || '').replace(/\D/g, '');
  const natDigits = String(parsedPhone.nationalFormat || '').replace(/\D/g, '');

  const candidates = new Set([rawDigits, e164Digits, natDigits].filter(Boolean));
  if (e164Digits.startsWith('62')) {
    candidates.add(`0${e164Digits.slice(2)}`);
  }

  for (const entry of VERIFIED_OFFICIAL_DIRECTORY) {
    for (const num of entry.numbers) {
      const clean = String(num).replace(/\D/g, '');
      if (candidates.has(clean)) {
        return entry;
      }
      if (clean.startsWith('62') && candidates.has(`0${clean.slice(2)}`)) {
        return entry;
      }
    }
  }
  return null;
}

export async function computeSha256Hex(text = '') {
  const value = String(text || '');
  if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(value);
    const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const nodeCrypto = await import('node:crypto');
  return nodeCrypto.createHash('sha256').update(value).digest('hex');
}

const SCAM_SIGNAL_RULES = [
  { re: /\.apk\b|aplikasi\s+undangan|surat\s+tilang\s+apk|resi\s+paket\.apk/i, label: 'Mengandung pola penipuan file .APK berbahaya', weight: 55 },
  { re: /bi-?fast|tarif\s*150\.?000|ubah\s*tarif|pemblokiran\s*rekening|rekening\s*terblokir/i, label: 'Pola phishing bank palsu (tarif BI-FAST / blokir rekening)', weight: 50 },
  { re: /\botp\b|\bpin\s*atm\b|\bcvv\b|kode\s*verifikasi|jangan\s*kasih\s*siapa/i, label: 'Meminta kode sensitif (OTP / PIN / CVV)', weight: 45 },
  { re: /bea\s*cukai|paket\s*tertahan|tebusan\s*pajak|barang\s*kiriman\s*luar\s*negeri/i, label: 'Indikasi modus penipuan paket Bea Cukai palsu', weight: 45 },
  { re: /salah\s*transfer|pinjol|sebar\s*data|bunga\s*harian/i, label: 'Pola intimidasi salah transfer / pinjol ilegal', weight: 40 },
  { re: /pemenang\s*undian|hadiah\s*jutaan|shopee\s*berhadiah|dana\s*kaget\s*link/i, label: 'Pola undian berhadiah / tautan phishing palsu', weight: 38 },
  { re: /kerja\s*paruh\s*waktu|like\s*subscribe|isi\s*deposit|misi\s*transfer/i, label: 'Pola lowongan tugas berdeposit (job scam)', weight: 40 },
  { re: /bit\.ly|tinyurl\.com|s\.id\/|shorturl/i, label: 'Menggunakan tautan pemendek URL yang rawan menyamarkan phishing', weight: 15 },
];

export function analyzeScamMessagePatterns(claimText = '', parsedPhone = null) {
  const text = String(claimText || '').trim();
  if (!text) {
    return { analyzed: false, riskPoints: 0, matchedSignals: [], verdict: 'Tidak ada klaim/pesan dianalisis' };
  }
  const matchedSignals = [];
  let riskPoints = 0;
  for (const rule of SCAM_SIGNAL_RULES) {
    if (rule.re.test(text)) {
      matchedSignals.push(rule.label);
      riskPoints += rule.weight;
    }
  }
  // Extra mismatch check: claims to be Bank/Ekspedisi while calling from personal Indonesian mobile 08xx
  const claimsInstitution = /\b(bca|bri|mandiri|bni|ojk|pajak|bea\s*cukai|dana|ovo|shopee)\b/i.test(text);
  if (claimsInstitution && parsedPhone?.lineType?.includes('SELULER') && !findOfficialDirectoryMatch(parsedPhone)) {
    matchedSignals.push('Mengklaim instansi/bank tetapi menggunakan nomor seluler pribadi (bukan hotline resmi)');
    riskPoints += 35;
  }

  riskPoints = Math.min(100, riskPoints);
  const verdict =
    riskPoints >= 50
      ? 'Risiko Penipuan Tinggi'
      : riskPoints >= 20
      ? 'Perlu Waspada'
      : 'Tidak Terdeteksi Pola Phishing Umum';

  return {
    analyzed: true,
    riskPoints,
    matchedSignals,
    verdict,
  };
}

export function normalizeCommunityVault(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const tagsByNumber = {};
  if (safe.tagsByNumber && typeof safe.tagsByNumber === 'object') {
    for (const [numKey, items] of Object.entries(safe.tagsByNumber)) {
      if (!Array.isArray(items)) continue;
      const cleanList = items
        .filter((it) => it && typeof it === 'object' && String(it.tag || '').trim())
        .map((it) => ({
          id: String(it.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
          tag: String(it.tag).trim().slice(0, 48),
          sentiment: ['safe', 'business', 'nuisance', 'spam'].includes(it.sentiment) ? it.sentiment : 'business',
          votes: Math.max(1, Math.round(Number(it.votes) || 1)),
          note: String(it.note || '').trim().slice(0, 160),
          updatedAt: String(it.updatedAt || new Date().toISOString()),
        }));
      if (cleanList.length > 0) tagsByNumber[numKey] = cleanList;
    }
  }

  const blockedNumbers = Array.isArray(safe.blockedNumbers)
    ? safe.blockedNumbers
        .filter((b) => b && (typeof b === 'string' || b.e164))
        .map((b) =>
          typeof b === 'string'
            ? { e164: b, reason: 'Diblokir Pengguna', blockedAt: new Date().toISOString() }
            : {
                e164: String(b.e164),
                label: String(b.label || ''),
                reason: String(b.reason || 'Diblokir Pengguna'),
                blockedAt: String(b.blockedAt || new Date().toISOString()),
              }
        )
    : [];

  const history = Array.isArray(safe.history)
    ? safe.history
        .filter((h) => h && h.e164)
        .slice(0, 40)
        .map((h) => ({
          e164: String(h.e164),
          nationalFormat: String(h.nationalFormat || h.e164),
          carrier: String(h.carrier || ''),
          verdictKey: String(h.verdictKey || 'neutral'),
          verdictLabel: String(h.verdictLabel || 'Teridentifikasi'),
          primaryTag: String(h.primaryTag || ''),
          checkedAt: String(h.checkedAt || new Date().toISOString()),
        }))
    : [];

  return { tagsByNumber, blockedNumbers, history };
}

export function upsertCommunityTag(vault, e164, { tag = '', sentiment = 'business', note = '' } = {}) {
  const cleanVault = normalizeCommunityVault(vault);
  const cleanKey = String(e164 || '').trim();
  const cleanTag = String(tag || '').trim().slice(0, 48);
  if (!cleanKey || !cleanTag) {
    throw new Error('Nomor E.164 dan label tag wajib diisi.');
  }
  const existing = [...(cleanVault.tagsByNumber[cleanKey] || [])];
  const idx = existing.findIndex((it) => it.tag.toLowerCase() === cleanTag.toLowerCase());
  const safeSentiment = ['safe', 'business', 'nuisance', 'spam'].includes(sentiment) ? sentiment : 'business';
  if (idx >= 0) {
    existing[idx] = {
      ...existing[idx],
      sentiment: safeSentiment,
      votes: existing[idx].votes + 1,
      note: String(note || existing[idx].note || '').trim().slice(0, 160),
      updatedAt: new Date().toISOString(),
    };
  } else {
    existing.unshift({
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tag: cleanTag,
      sentiment: safeSentiment,
      votes: 1,
      note: String(note || '').trim().slice(0, 160),
      updatedAt: new Date().toISOString(),
    });
  }
  return {
    ...cleanVault,
    tagsByNumber: {
      ...cleanVault.tagsByNumber,
      [cleanKey]: existing.slice(0, 30),
    },
  };
}

export function toggleBlockedNumber(vault, e164, { label = '', reason = 'Spam / Gangguan' } = {}) {
  const cleanVault = normalizeCommunityVault(vault);
  const cleanKey = String(e164 || '').trim();
  if (!cleanKey) return cleanVault;
  const exists = cleanVault.blockedNumbers.some((b) => b.e164 === cleanKey);
  const nextBlocked = exists
    ? cleanVault.blockedNumbers.filter((b) => b.e164 !== cleanKey)
    : [{ e164: cleanKey, label: String(label || ''), reason: String(reason || 'Spam / Gangguan'), blockedAt: new Date().toISOString() }, ...cleanVault.blockedNumbers];
  return {
    ...cleanVault,
    blockedNumbers: nextBlocked,
  };
}

export function upsertCheckHistory(vault, entry = {}) {
  const cleanVault = normalizeCommunityVault(vault);
  const cleanKey = String(entry.e164 || '').trim();
  if (!cleanKey) return cleanVault;
  const filtered = cleanVault.history.filter((h) => h.e164 !== cleanKey);
  return {
    ...cleanVault,
    history: [
      {
        e164: cleanKey,
        nationalFormat: String(entry.nationalFormat || cleanKey),
        carrier: String(entry.carrier || ''),
        verdictKey: String(entry.verdictKey || 'neutral'),
        verdictLabel: String(entry.verdictLabel || 'Teridentifikasi'),
        primaryTag: String(entry.primaryTag || ''),
        checkedAt: new Date().toISOString(),
      },
      ...filtered,
    ].slice(0, 40),
  };
}

export function mergeCommunityVaultJson(currentVault, importedRaw) {
  const base = normalizeCommunityVault(currentVault);
  const incoming = normalizeCommunityVault(importedRaw);
  const mergedTags = { ...base.tagsByNumber };

  for (const [num, items] of Object.entries(incoming.tagsByNumber)) {
    const cur = [...(mergedTags[num] || [])];
    for (const item of items) {
      const idx = cur.findIndex((c) => c.tag.toLowerCase() === item.tag.toLowerCase());
      if (idx >= 0) {
        cur[idx] = {
          ...cur[idx],
          votes: Math.max(cur[idx].votes, item.votes),
          note: cur[idx].note || item.note,
        };
      } else {
        cur.push(item);
      }
    }
    mergedTags[num] = cur;
  }

  const blockMap = new Map(base.blockedNumbers.map((b) => [b.e164, b]));
  for (const b of incoming.blockedNumbers) {
    if (!blockMap.has(b.e164)) blockMap.set(b.e164, b);
  }

  return {
    ...base,
    tagsByNumber: mergedTags,
    blockedNumbers: Array.from(blockMap.values()),
  };
}

/**
 * Combines outputs from all collaborative open-source & official engines
 * into one unified risk/trust verdict + aggregated tag cloud.
 */
export function aggregateCallerIntelligence({
  parsed,
  officialMatch = null,
  callShieldMatch = null,
  communityTags = [],
  isBlockedLocally = false,
  osintHits = [],
  wikidataMatch = null,
  scamAnalysis = null,
  libPhone = null,
} = {}) {
  const tags = [];
  const pushTag = (label, sentiment, count, source) => {
    const clean = String(label || '').trim();
    if (!clean) return;
    const existing = tags.find((t) => t.label.toLowerCase() === clean.toLowerCase());
    if (existing) {
      existing.count += count;
      if (!existing.sources.includes(source)) existing.sources.push(source);
    } else {
      tags.push({ label: clean, sentiment, count, sources: [source] });
    }
  };

  if (officialMatch) {
    pushTag(`${officialMatch.name} (Resmi)`, 'safe', 99, 'Direktori Resmi');
    pushTag(officialMatch.category, 'safe', 10, 'Direktori Resmi');
  }

  if (callShieldMatch?.found) {
    const reportCnt = Math.max(1, Number(callShieldMatch.reports || callShieldMatch.reporterCount || 1));
    const typeLabel = callShieldMatch.type ? `CallShield: ${callShieldMatch.type}` : 'Dilaporkan Spam (CallShield)';
    pushTag(typeLabel, 'spam', reportCnt, 'CallShield GitHub');
    if (callShieldMatch.description) {
      pushTag(callShieldMatch.description.slice(0, 42), 'spam', 1, 'CallShield GitHub');
    }
  }

  if (wikidataMatch?.label) {
    pushTag(`Wikidata: ${wikidataMatch.label}`, 'business', 2, 'Wikidata');
  }

  for (const t of communityTags || []) {
    pushTag(t.tag, t.sentiment || 'business', t.votes || 1, 'Tag Komunitas');
  }

  if (isBlockedLocally) {
    pushTag('Masuk Daftar Blokir Anda', 'spam', 1, 'Blokir Lokal');
  }

  let riskScore = 15;
  if (!parsed?.valid) riskScore += 18;
  if (officialMatch) riskScore = 2;

  if (callShieldMatch?.found) {
    const reports = Number(callShieldMatch.reports || callShieldMatch.reporterCount || 1);
    riskScore += Math.min(75, 42 + reports * 6);
  }

  let spamVotes = 0;
  let nuisanceVotes = 0;
  let safeVotes = 0;
  for (const t of communityTags || []) {
    const v = Number(t.votes) || 1;
    if (t.sentiment === 'spam') spamVotes += v;
    else if (t.sentiment === 'nuisance') nuisanceVotes += v;
    else if (t.sentiment === 'safe') safeVotes += v;
  }

  riskScore += Math.min(45, spamVotes * 22);
  riskScore += Math.min(25, nuisanceVotes * 12);
  riskScore -= Math.min(18, safeVotes * 6);
  if (isBlockedLocally) riskScore = Math.max(riskScore, 85);
  if (scamAnalysis?.analyzed) riskScore += Math.round(scamAnalysis.riskPoints * 0.65);
  if (Array.isArray(osintHits) && osintHits.some((h) => h.isSpamSignal)) riskScore += 22;

  riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));
  const trustScore = 100 - riskScore;

  let verdictKey = 'neutral';
  let verdictLabel = 'Belum Ada Laporan Spam';
  let verdictTone = 'info';
  let verdictSummary =
    'Nomor terstruktur valid secara telekomunikasi dan belum tercatat pada database spam open-source maupun laporan komunitas lokal.';

  if (officialMatch && !isBlockedLocally && (!scamAnalysis?.analyzed || scamAnalysis.riskPoints < 40)) {
    verdictKey = 'verified_official';
    verdictLabel = 'Terverifikasi Resmi';
    verdictTone = 'safe';
    verdictSummary = `Nomor resmi terverifikasi milik ${officialMatch.name} (${officialMatch.category}). ${officialMatch.short}.`;
  } else if (riskScore >= 65) {
    verdictKey = 'high_risk_spam';
    verdictLabel = 'Terindikasi Spam / Risiko Tinggi';
    verdictTone = 'danger';
    verdictSummary =
      'Terdapat laporan spam/penipuan atau indikator risiko tinggi dari mesin kolaboratif. Jangan berikan OTP, PIN, atau memasang file .APK.';
  } else if (riskScore >= 35) {
    verdictKey = 'caution';
    verdictLabel = 'Perlu Waspada / Telemarketer';
    verdictTone = 'warn';
    verdictSummary =
      'Terdeteksi sinyal kehati-hatian (pola pesan mencurigakan, keluhan gangguan, atau format nomor tidak lazim). Verifikasi identitas penelepon.';
  } else if (safeVotes > 0) {
    verdictKey = 'community_safe';
    verdictLabel = 'Dinilai Aman Komunitas';
    verdictTone = 'safe';
    verdictSummary =
      'Ditandai aman/terpercaya oleh komunitas pengguna lokal dan bersih dari database spam publik.';
  }

  tags.sort((a, b) => b.count - a.count);

  return {
    verdictKey,
    verdictLabel,
    verdictTone,
    verdictSummary,
    riskScore,
    trustScore,
    tags,
    primaryTag: tags[0]?.label || '',
    effectiveCarrier: libPhone?.carrier || parsed?.carrier || 'Operator Tidak Diketahui',
    effectiveRegion: libPhone?.regionName || parsed?.regionLabel || 'Global',
    effectiveLineType: libPhone?.lineTypeLabel || parsed?.lineType || 'UMUM',
  };
}
