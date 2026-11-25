/**
 * 108+ Curated Visual Themes for Manifestudio Peramban Proxy (v91)
 * Pure data & filter helpers — zero DOM dependencies, unit-testable.
 * Every theme defines high-contrast chrome, toolbar, surface, text, accent, and border tokens.
 */

export const WEBPROXY_THEME_CATEGORIES = Object.freeze([
  { id: 'all', label: 'Semua (108)' },
  { id: 'dark-pro', label: 'Dark Pro' },
  { id: 'cyber', label: 'Cyber & Neon' },
  { id: 'classic', label: 'Klasik & Bersih' },
  { id: 'nature', label: 'Alam & Zen' },
  { id: 'pastel', label: 'Pastel & Estetik' },
  { id: 'luxury', label: 'Mewah & Metalik' },
]);

/**
 * Compact curated specs: [id, name, category, chromeBg, toolbarBg, surfaceBg, textColor, mutedColor, accentColor, borderColor, isDark]
 * 108 handcrafted themes across 6 distinct collections (18 themes per category).
 */
const RAW_THEME_SPECS = [
  // 1. DARK PRO (18)
  ['midnight-stealth', 'Midnight Stealth', 'dark-pro', '#090d16', '#111827', '#0f172a', '#f8fafc', '#94a3b8', '#38bdf8', '#1e293b', true],
  ['obsidian-shield', 'Obsidian Shield', 'dark-pro', '#0a0a0d', '#141419', '#101014', '#f4f4f5', '#a1a1aa', '#10b981', '#27272a', true],
  ['carbon-slate', 'Carbon Slate', 'dark-pro', '#0f172a', '#1e293b', '#0b1120', '#f1f5f9', '#94a3b8', '#6366f1', '#334155', true],
  ['nordic-night', 'Nordic Night', 'dark-pro', '#1e2430', '#2e3440', '#242933', '#eceff4', '#a3b3cc', '#88c0d0', '#3b4252', true],
  ['github-dimmed', 'GitHub Dimmed', 'dark-pro', '#0d1117', '#161b22', '#0d1117', '#e6edf3', '#8b949e', '#58a6ff', '#30363d', true],
  ['dracula-pro', 'Dracula Pro', 'dark-pro', '#1e1f29', '#282a36', '#21222c', '#f8f8f2', '#bd93f9', '#ff79c6', '#44475a', true],
  ['tokyo-night', 'Tokyo Night', 'dark-pro', '#16161e', '#1a1b26', '#1f2335', '#c0caf5', '#7aa2f7', '#bb9af7', '#292e42', true],
  ['catppuccin-mocha', 'Catppuccin Mocha', 'dark-pro', '#181825', '#1e1e2e', '#11111b', '#cdd6f4', '#a6adc8', '#89b4fa', '#313244', true],
  ['gruvbox-dark', 'Gruvbox Dark', 'dark-pro', '#1d2021', '#282828', '#222425', '#ebdbb2', '#a89984', '#fabd2f', '#3c3836', true],
  ['monokai-carbon', 'Monokai Carbon', 'dark-pro', '#1b1c17', '#272822', '#1e1f1a', '#f8f8f2', '#a6a69c', '#a6e22e', '#3e3d32', true],
  ['one-dark-studio', 'One Dark Studio', 'dark-pro', '#1e222a', '#282c34', '#21252b', '#abb2bf', '#7f848e', '#61afef', '#383e4a', true],
  ['ayu-mirage', 'Ayu Mirage', 'dark-pro', '#191e2a', '#1f2430', '#171b24', '#cbccc6', '#707a8c', '#ffcc66', '#2f3646', true],
  ['material-ocean', 'Material Ocean', 'dark-pro', '#090b10', '#0f111a', '#0b0d14', '#e2e8f0', '#8f93a2', '#82aaff', '#1f2233', true],
  ['rose-pine-moon', 'Rosé Pine Moon', 'dark-pro', '#1d1a2e', '#232136', '#2a273f', '#e0def4', '#908caa', '#ea9a97', '#393552', true],
  ['everforest-dark', 'Everforest Dark', 'dark-pro', '#232a2e', '#2d353b', '#272e33', '#d3c6aa', '#9da9a0', '#a7c080', '#3d484d', true],
  ['solarized-abyss', 'Solarized Abyss', 'dark-pro', '#001e26', '#002b36', '#073642', '#eee8d5', '#93a1a1', '#2aa198', '#144452', true],
  ['graphite-ink', 'Graphite Ink', 'dark-pro', '#121316', '#1c1e24', '#16181d', '#f1f3f5', '#9aa0a6', '#4dabf7', '#2c303a', true],
  ['deep-indigo', 'Deep Indigo', 'dark-pro', '#0f1029', '#191b42', '#131535', '#eef2ff', '#a5b4fc', '#818cf8', '#2e3168', true],

  // 2. CYBER & NEON (18)
  ['cyber-owl', 'Cyber Owl Emerald', 'cyber', '#06121b', '#0b1e2d', '#081722', '#ecfeff', '#67e8f9', '#10b981', '#164e63', true],
  ['neon-pulse', 'Neon Pulse', 'cyber', '#0c0617', '#170b2b', '#110820', '#faf5ff', '#c084fc', '#f43f5e', '#3b1c69', true],
  ['matrix-terminal', 'Matrix Terminal', 'cyber', '#030f06', '#071c0b', '#041408', '#dcfce7', '#4ade80', '#22c55e', '#14532d', true],
  ['synthwave-84', 'Synthwave 84', 'cyber', '#1a102c', '#261742', '#201336', '#fdf2f8', '#f472b6', '#38bdf8', '#4c1d95', true],
  ['electric-cobalt', 'Electric Cobalt', 'cyber', '#061029', '#0c1c47', '#081538', '#eff6ff', '#93c5fd', '#3b82f6', '#1d4ed8', true],
  ['laser-crimson', 'Laser Crimson', 'cyber', '#1a060b', '#2b0b13', '#22080e', '#fff1f2', '#fda4af', '#fb7185', '#7f1d1d', true],
  ['quantum-cyan', 'Quantum Cyan', 'cyber', '#04171d', '#082730', '#061f26', '#ecfeff', '#67e8f9', '#06b6d4', '#155e75', true],
  ['plasma-violet', 'Plasma Violet', 'cyber', '#120826', '#1e0f3d', '#170b30', '#f5f3ff', '#c4b5fd', '#a855f7', '#4c1d95', true],
  ['cyber-amber', 'Cyber Amber', 'cyber', '#1a1103', '#291b06', '#211504', '#fffbeb', '#fcd34d', '#f59e0b', '#78350f', true],
  ['hyper-lime', 'Hyper Lime', 'cyber', '#0c1404', '#162408', '#101b05', '#f7fee7', '#bef264', '#84cc16', '#365314', true],
  ['ultraviolet-grid', 'Ultraviolet Grid', 'cyber', '#0e0724', '#1b0e42', '#130a30', '#ede9fe', '#a78bfa', '#e879f9', '#3b0764', true],
  ['arctic-hologram', 'Arctic Hologram', 'cyber', '#081726', '#0f2740', '#0b1e33', '#f0f9ff', '#7dd3fc', '#2dd4bf', '#1e3a5f', true],
  ['magma-core', 'Magma Core', 'cyber', '#1c0a05', '#2e1108', '#240d06', '#fff7ed', '#fdba74', '#f97316', '#7c2d12', true],
  ['phantom-teal', 'Phantom Teal', 'cyber', '#041517', '#0a2629', '#071d20', '#f0fdfa', '#5eead4', '#14b8a6', '#134e4a', true],
  ['vapor-magenta', 'Vapor Magenta', 'cyber', '#1f081c', '#330e2e', '#260a22', '#fdf4ff', '#f0abfc', '#ec4899', '#701a75', true],
  ['arcade-pixel', 'Arcade Pixel', 'cyber', '#0d0f29', '#171a45', '#111436', '#e0e7ff', '#818cf8', '#facc15', '#312e81', true],
  ['nova-turquoise', 'Nova Turquoise', 'cyber', '#051a1f', '#0a2d36', '#072229', '#ecfeff', '#22d3ee', '#34d399', '#155e75', true],
  ['stealth-infrared', 'Stealth Infrared', 'cyber', '#170709', '#260c10', '#1f090c', '#ffe4e6', '#fb7185', '#ef4444', '#881337', true],

  // 3. KLASIK & BERSIH (18)
  ['studio-light', 'Studio Light', 'classic', '#f1f5f9', '#ffffff', '#f8fafc', '#0f172a', '#475569', '#2563eb', '#cbd5e1', false],
  ['pure-paper', 'Pure Paper', 'classic', '#f5f5f4', '#ffffff', '#fafaf9', '#1c1917', '#57534e', '#0ea5e9', '#d6d3d1', false],
  ['nordic-frost', 'Nordic Frost', 'classic', '#e5e9f0', '#eceff4', '#f4f6fa', '#2e3440', '#4c566a', '#5e81ac', '#cfd7e3', false],
  ['swiss-minimal', 'Swiss Minimal', 'classic', '#f3f4f6', '#ffffff', '#f9fafb', '#111827', '#4b5563', '#dc2626', '#d1d5db', false],
  ['chrome-breeze', 'Chrome Breeze', 'classic', '#e8eef7', '#ffffff', '#f4f7fb', '#1f2937', '#4b5563', '#1d4ed8', '#cbd5e1', false],
  ['safari-pearl', 'Safari Pearl', 'classic', '#ededf0', '#fbfbfc', '#f5f5f7', '#1d1d1f', '#6e6e73', '#0071e3', '#d2d2d7', false],
  ['arc-cloud', 'Arc Cloud', 'classic', '#eef2ff', '#ffffff', '#f5f7ff', '#1e1b4b', '#4338ca', '#4f46e5', '#c7d2fe', false],
  ['firefox-crisp', 'Firefox Crisp', 'classic', '#f0f0f4', '#ffffff', '#f9f9fb', '#15141a', '#5b5b66', '#ea580c', '#d7d7db', false],
  ['editorial-ivory', 'Editorial Ivory', 'classic', '#f4efe6', '#fcfaf5', '#f8f4ec', '#292524', '#57534e', '#b45309', '#dfd6c5', false],
  ['newspaper-ink', 'Newspaper Ink', 'classic', '#e7e5e4', '#fafaf9', '#f5f5f4', '#18181b', '#52525b', '#27272a', '#d4d4d8', false],
  ['mint-clean', 'Mint Clean', 'classic', '#ecfdf5', '#ffffff', '#f0fdf4', '#064e3b', '#047857', '#059669', '#a7f3d0', false],
  ['sky-workspace', 'Sky Workspace', 'classic', '#e0f2fe', '#ffffff', '#f0f9ff', '#0c4a6e', '#0369a1', '#0284c7', '#bae6fd', false],
  ['warm-sand', 'Warm Sand', 'classic', '#fef3c7', '#fffbeb', '#fef9e7', '#451a03', '#78350f', '#d97706', '#fde68a', false],
  ['cool-silver', 'Cool Silver', 'classic', '#e2e8f0', '#f8fafc', '#f1f5f9', '#0f172a', '#475569', '#334155', '#cbd5e1', false],
  ['porcelain-blue', 'Porcelain Blue', 'classic', '#dbeafe', '#ffffff', '#eff6ff', '#1e3a8a', '#1d4ed8', '#2563eb', '#bfdbfe', false],
  ['linen-notebook', 'Linen Notebook', 'classic', '#f5f0e8', '#fffdf9', '#faf6ef', '#2c2520', '#6b5e54', '#0f766e', '#e2d7c5', false],
  ['clarity-teal', 'Clarity Teal', 'classic', '#e6f7f5', '#ffffff', '#f0fdfa', '#134e4a', '#0f766e', '#0d9488', '#99f6e4', false],
  ['zen-slate', 'Zen Slate', 'classic', '#e4e8ee', '#f7f9fc', '#eef2f6', '#1e293b', '#475569', '#4f46e5', '#cbd5e1', false],

  // 4. ALAM & ZEN (18)
  ['emerald-rainforest', 'Emerald Rainforest', 'nature', '#051f16', '#0a3324', '#07261b', '#ecfdf5', '#6ee7b7', '#10b981', '#065f46', true],
  ['kyoto-bamboo', 'Kyoto Bamboo', 'nature', '#142417', '#1e3522', '#182b1b', '#f0fdf4', '#86efac', '#4ade80', '#166534', true],
  ['ocean-abyss', 'Ocean Abyss', 'nature', '#041a2b', '#092c47', '#062136', '#e0f2fe', '#7dd3fc', '#0ea5e9', '#075985', true],
  ['sahara-dusk', 'Sahara Dusk', 'nature', '#291a0d', '#3d2815', '#301f10', '#fef3c7', '#fcd34d', '#f59e0b', '#78350f', true],
  ['alpine-glacier', 'Alpine Glacier', 'nature', '#e6f4f8', '#f7fcfe', '#eff9fc', '#0c4a6e', '#0369a1', '#0284c7', '#bae6fd', false],
  ['cherry-blossom', 'Cherry Blossom', 'nature', '#fce7f3', '#fff5f9', '#fdf2f8', '#500724', '#9d174d', '#db2777', '#fbcfe8', false],
  ['autumn-maple', 'Autumn Maple', 'nature', '#26100a', '#3b1a10', '#2e140c', '#ffedd5', '#fdba74', '#ea580c', '#7c2d12', true],
  ['pacific-coral', 'Pacific Coral', 'nature', '#fff1f0', '#ffffff', '#fff5f4', '#450a0a', '#991b1b', '#ef4444', '#fecaca', false],
  ['moss-terrace', 'Moss Terrace', 'nature', '#ecf4e8', '#f9fcf7', '#f2f8ef', '#1a2e05', '#3f6212', '#65a30d', '#d9f99d', false],
  ['nordic-fjord', 'Nordic Fjord', 'nature', '#0d1f2d', '#153147', '#102638', '#e0f2fe', '#93c5fd', '#38bdf8', '#1e40af', true],
  ['volcanic-ash', 'Volcanic Ash', 'nature', '#1c1917', '#292524', '#211e1c', '#f5f5f4', '#a8a29e', '#f97316', '#44403c', true],
  ['bali-lagoon', 'Bali Lagoon', 'nature', '#062629', '#0b3c40', '#083033', '#ccfbf1', '#5eead4', '#14b8a6', '#115e59', true],
  ['lavender-meadow', 'Lavender Meadow', 'nature', '#f3e8ff', '#faf5ff', '#f7efff', '#3b0764', '#6b21a8', '#9333ea', '#e9d5ff', false],
  ['pine-mist', 'Pine Mist', 'nature', '#132622', '#1d3832', '#172e29', '#e6fffa', '#81e6d9', '#2dd4bf', '#234e52', true],
  ['sunset-horizon', 'Sunset Horizon', 'nature', '#24101d', '#38182c', '#2b1322', '#fdf2f8', '#f9a8d4', '#fb7185', '#831843', true],
  ['canyon-terracotta', 'Canyon Terracotta', 'nature', '#f8ece6', '#fff8f5', '#fcf2ed', '#431407', '#9a3412', '#c2410c', '#fed7aa', false],
  ['aurora-borealis', 'Aurora Borealis', 'nature', '#081b24', '#0f2d3b', '#0b222e', '#ecfeff', '#6ee7b7', '#22d3ee', '#155e75', true],
  ['matcha-garden', 'Matcha Garden', 'nature', '#eaf2e3', '#f8fbf5', '#f1f7ec', '#1e3315', '#4d7c0f', '#65a30d', '#cfe3bd', false],

  // 5. PASTEL & ESTETIK (18)
  ['cotton-candy', 'Cotton Candy', 'pastel', '#fce7f3', '#fff5fa', '#fdf2f8', '#4a044e', '#86198f', '#ec4899', '#f5d0fe', false],
  ['peach-milk', 'Peach Milk', 'pastel', '#ffedd5', '#fff7ed', '#fff3e6', '#431407', '#9a3412', '#f97316', '#fed7aa', false],
  ['sky-marshmallow', 'Sky Marshmallow', 'pastel', '#e0f2fe', '#f5fbff', '#ecf8ff', '#082f49', '#0369a1', '#0ea5e9', '#bae6fd', false],
  ['lilac-dream', 'Lilac Dream', 'pastel', '#ede9fe', '#f9f7ff', '#f3f0ff', '#2e1065', '#6d28d9', '#7c3aed', '#ddd6fe', false],
  ['mint-macaron', 'Mint Macaron', 'pastel', '#d1fae5', '#f0fdf7', '#e6fcf2', '#064e3b', '#047857', '#10b981', '#a7f3d0', false],
  ['butter-cream', 'Butter Cream', 'pastel', '#fef9c3', '#fefce8', '#fefbe0', '#422006', '#854d0e', '#ca8a04', '#fde047', false],
  ['rose-latte', 'Rose Latte', 'pastel', '#ffe4e6', '#fff1f2', '#ffe9ec', '#4c0519', '#9f1239', '#e11d48', '#fecdd3', false],
  ['periwinkle-mist', 'Periwinkle Mist', 'pastel', '#e0e7ff', '#f5f7ff', '#eef2ff', '#1e1b4b', '#4338ca', '#6366f1', '#c7d2fe', false],
  ['apricot-sorbet', 'Apricot Sorbet', 'pastel', '#fde8d7', '#fff6ee', '#fef0e4', '#4a1d06', '#9a3412', '#ea580c', '#fbd3b0', false],
  ['aqua-soda', 'Aqua Soda', 'pastel', '#cffafe', '#effdff', '#e0faff', '#164e63', '#0e7490', '#06b6d4', '#a5f3fc', false],
  ['pistachio-soft', 'Pistachio Soft', 'pastel', '#e4f2d8', '#f5faf0', '#edf6e5', '#1a2e05', '#4d7c0f', '#65a30d', '#cce5b8', false],
  ['strawberry-cream', 'Strawberry Cream', 'pastel', '#fddde6', '#fff2f6', '#fee7ee', '#500724', '#9d174d', '#db2777', '#f9bdd0', false],
  ['blueberry-milk', 'Blueberry Milk', 'pastel', '#dbeafe', '#f3f8ff', '#e8f1ff', '#172554', '#1d4ed8', '#3b82f6', '#bfdbfe', false],
  ['vanilla-cloud', 'Vanilla Cloud', 'pastel', '#f7f1e3', '#fffdf7', '#fbf7ee', '#2c2219', '#6b5744', '#b45309', '#e6dcc6', false],
  ['orchid-blush', 'Orchid Blush', 'pastel', '#f5d0fe', '#fdf4ff', '#fae8ff', '#4a044e', '#86198f', '#c026d3', '#f0abfc', false],
  ['sage-whisper', 'Sage Whisper', 'pastel', '#e3ede6', '#f4f8f5', '#ebf3ee', '#143322', '#2f6646', '#15803d', '#c5dbc9', false],
  ['lemon-chiffon', 'Lemon Chiffon', 'pastel', '#fcf5c7', '#fffdf0', '#fefae0', '#3f2e05', '#854d0e', '#d97706', '#f3e596', false],
  ['iris-velvet', 'Iris Velvet', 'pastel', '#e4e1fa', '#f6f5ff', '#eeecfd', '#1e1b4b', '#4f46e5', '#6366f1', '#cdc7f5', false],

  // 6. MEWAH & METALIK (18)
  ['royal-gold', 'Royal Gold', 'luxury', '#14110a', '#211c10', '#1a160d', '#fef9e7', '#d4af37', '#f59e0b', '#4d3e1c', true],
  ['platinum-noir', 'Platinum Noir', 'luxury', '#111317', '#1c1f26', '#16181e', '#f8fafc', '#cbd5e1', '#94a3b8', '#334155', true],
  ['velvet-burgundy', 'Velvet Burgundy', 'luxury', '#1f0810', '#330e1a', '#290b15', '#fff1f2', '#fda4af', '#e11d48', '#6b1833', true],
  ['emerald-crown', 'Emerald Crown', 'luxury', '#051a14', '#0b2b22', '#08221b', '#ecfdf5', '#6ee7b7', '#d4af37', '#115e46', true],
  ['sapphire-imperial', 'Sapphire Imperial', 'luxury', '#071229', '#0e2047', '#0a1938', '#eff6ff', '#93c5fd', '#eab308', '#1e3a8a', true],
  ['rose-gold-luxe', 'Rose Gold Luxe', 'luxury', '#241417', '#361e23', '#2c181c', '#fff1f2', '#f4b6c2', '#e89ba8', '#5c313a', true],
  ['champagne-silk', 'Champagne Silk', 'luxury', '#f3ece0', '#fcf9f2', '#f7f2e8', '#292014', '#6b563c', '#b4822c', '#dfd2bc', false],
  ['titanium-frost', 'Titanium Frost', 'luxury', '#1a1e24', '#262c35', '#20252d', '#f1f5f9', '#94a3b8', '#38bdf8', '#3b4454', true],
  ['bronze-atelier', 'Bronze Atelier', 'luxury', '#1c140e', '#2e2117', '#241a12', '#fef3c7', '#d6a273', '#d97706', '#573c28', true],
  ['amethyst-suite', 'Amethyst Suite', 'luxury', '#160c24', '#25143b', '#1d102e', '#f5f3ff', '#c4b5fd', '#d8b4fe', '#4c1d95', true],
  ['onyx-diamond', 'Onyx Diamond', 'luxury', '#08080a', '#121216', '#0d0d10', '#ffffff', '#a1a1aa', '#e4e4e7', '#27272a', true],
  ['pearl-atelier', 'Pearl Atelier', 'luxury', '#eeeae4', '#faf8f5', '#f5f2ed', '#1f1c18', '#5e564c', '#8b6f47', '#d9d1c5', false],
  ['cobalt-executive', 'Cobalt Executive', 'luxury', '#0b162c', '#132547', '#0f1d38', '#f0f7ff', '#93c5fd', '#38bdf8', '#1e3a5f', true],
  ['jade-dynasty', 'Jade Dynasty', 'luxury', '#0a1f1b', '#12332c', '#0e2923', '#f0fdfa', '#5eead4', '#34d399', '#1b5247', true],
  ['copper-forge', 'Copper Forge', 'luxury', '#1f120d', '#331d15', '#291711', '#fff7ed', '#f2a680', '#ea580c', '#633524', true],
  ['obsidian-violet', 'Obsidian Violet', 'luxury', '#0e0b16', '#181326', '#130f1e', '#f5f3ff', '#a78bfa', '#8b5cf6', '#2e2447', true],
  ['monaco-navy', 'Monaco Navy', 'luxury', '#0a1529', '#122444', '#0e1d36', '#f8fafc', '#94a3b8', '#f59e0b', '#1e3a5f', true],
  ['ivory-marble', 'Ivory Marble', 'luxury', '#f0ede8', '#fcfbf9', '#f6f4f0', '#1c1917', '#57534e', '#a16207', '#dcd6cc', false],
];

export const WEBPROXY_THEMES = Object.freeze(
  RAW_THEME_SPECS.map(
    ([
      id,
      name,
      category,
      chromeBg,
      toolbarBg,
      surfaceBg,
      textColor,
      mutedColor,
      accentColor,
      borderColor,
      isDark,
    ]) =>
      Object.freeze({
        id,
        name,
        category,
        chromeBg,
        toolbarBg,
        surfaceBg,
        textColor,
        mutedColor,
        accentColor,
        borderColor,
        isDark,
      })
  )
);

export function getWebProxyThemeById(id) {
  const clean = String(id || '').trim().toLowerCase();
  return WEBPROXY_THEMES.find((t) => t.id === clean) || WEBPROXY_THEMES[0];
}

export function filterWebProxyThemes({ category = 'all', query = '' } = {}) {
  const cat = String(category || 'all').trim().toLowerCase();
  const q = String(query || '').trim().toLowerCase();
  return WEBPROXY_THEMES.filter((t) => {
    if (cat && cat !== 'all' && t.category !== cat) return false;
    if (q) {
      return t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.id.includes(q);
    }
    return true;
  });
}
