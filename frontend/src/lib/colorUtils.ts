export interface ColorMatchResult {
  color: string;
  isExact: boolean;
  preferred: string;
}

export const COLOR_FAMILIES_ORDER: string[][] = [
  ['pink', 'rose', 'blush', 'peach', 'red', 'burgundy', 'dusty pink', 'rose pink', 'blush pink', 'terracotta'],
  ['white', 'off white', 'off-white', 'cream', 'beige', 'champagne', 'ivory', 'carrara', 'clear glass', 'frosted'],
  ['brown', 'walnut', 'oak', 'dark brown', 'wood', 'teak', 'mahogany', 'rattan', 'cognac'],
  ['grey', 'gray', 'charcoal', 'black', 'graphite', 'slate', 'concrete', 'black metal', 'marquina', 'wenge'],
  ['blue', 'navy', 'royal blue', 'sky blue', 'powder blue', 'dusty blue', 'teal', 'ocean']
];

export function getBestColorMatch(available: string[], preferences: string[]): ColorMatchResult {
  if (!available || available.length === 0) {
    return { color: '', isExact: false, preferred: '' };
  }
  if (!preferences || preferences.length === 0) {
    return { color: available[0], isExact: false, preferred: '' };
  }

  // 1. Exact match (case insensitive)
  for (const pref of preferences) {
    const found = available.find(c => c.toLowerCase().trim() === pref.toLowerCase().trim());
    if (found) {
      return { color: found, isExact: true, preferred: pref };
    }
  }

  // 2. Family match
  for (const pref of preferences) {
    const prefLower = pref.toLowerCase().trim();
    const family = COLOR_FAMILIES_ORDER.find(fam => fam.some(shade => prefLower.includes(shade) || shade.includes(prefLower)));
    if (family) {
      for (const shade of family) {
        const found = available.find(c => c.toLowerCase().includes(shade) || shade.includes(c.toLowerCase()));
        if (found) {
          return { color: found, isExact: false, preferred: pref };
        }
      }
    }
  }

  // 3. Neutral fallback
  const neutrals = ['white', 'grey', 'gray', 'black', 'cream', 'beige', 'off-white', 'off white', 'charcoal'];
  for (const neut of neutrals) {
    const found = available.find(c => c.toLowerCase().includes(neut));
    if (found) {
      return { color: found, isExact: false, preferred: preferences[0] };
    }
  }

  // 4. Final fallback
  return { color: available[0], isExact: false, preferred: preferences[0] };
}

export function getColorHex(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower.includes('white')) return '#FFFFFF';
  if (lower.includes('off-white') || lower.includes('off white')) return '#FAF9F6';
  if (lower.includes('cream')) return '#FFFDD0';
  if (lower.includes('beige')) return '#F5F5DC';
  if (lower.includes('champagne')) return '#F7E7CE';
  if (lower.includes('walnut')) return '#5C4033';
  if (lower.includes('brown')) return '#8B4513';
  if (lower.includes('oak')) return '#C2B280';
  if (lower.includes('terracotta') || lower.includes('terra cotta')) return '#E2725B';
  if (lower.includes('wenge')) return '#645452';
  if (lower.includes('mahogany')) return '#C04000';
  if (lower.includes('teak')) return '#B28750';
  if (lower.includes('rattan') || lower.includes('wood')) return '#D2B48C';
  if (lower.includes('charcoal')) return '#36454F';
  if (lower.includes('black')) return '#000000';
  if (lower.includes('dark grey') || lower.includes('dark gray')) return '#4F4F4F';
  if (lower.includes('graphite')) return '#4A4A4A';
  if (lower.includes('grey') || lower.includes('gray')) return '#808080';
  if (lower.includes('concrete')) return '#D3D3D3';
  if (lower.includes('olive')) return '#808000';
  if (lower.includes('sage')) return '#9C9F84';
  if (lower.includes('forest green')) return '#228B22';
  if (lower.includes('emerald')) return '#50C878';
  if (lower.includes('green')) return '#008000';
  if (lower.includes('sky blue')) return '#87CEEB';
  if (lower.includes('navy')) return '#000080';
  if (lower.includes('royal blue')) return '#4169E1';
  if (lower.includes('powder blue')) return '#B0E0E6';
  if (lower.includes('dusty blue')) return '#5C8A99';
  if (lower.includes('teal')) return '#008080';
  if (lower.includes('blue')) return '#3B82F6';
  if (lower.includes('pink') || lower.includes('blush') || lower.includes('rose')) return '#FFC0CB';
  if (lower.includes('red')) return '#FF0000';
  if (lower.includes('burnt orange')) return '#CC5500';
  if (lower.includes('mustard')) return '#FFDB58';
  if (lower.includes('burgundy')) return '#800020';
  if (lower.includes('copper')) return '#B87333';
  if (lower.includes('gold')) return '#FFD700';
  if (lower.includes('silver') || lower.includes('chrome')) return '#C0C0C0';
  if (lower.includes('bronze')) return '#CD7F32';
  
  // Fallback: stable color generation
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = '#' + ('000000' + ((hash & 0x00FFFFFF) >>> 0).toString(16)).slice(-6);
  return color;
}

export function getColorFamily(name: string): string {
  const lower = name.toLowerCase().trim();
  if (['white', 'beige', 'cream', 'champagne', 'ivory', 'glass', 'frosted'].some(kw => lower.includes(kw))) return 'Neutral';
  if (['walnut', 'brown', 'oak', 'terracotta', 'wood', 'mahogany', 'teak', 'rattan', 'cognac'].some(kw => lower.includes(kw))) return 'Earth';
  if (['charcoal', 'black', 'dark grey', 'dark gray', 'graphite', 'slate', 'wenge', 'concrete', 'grey', 'gray'].some(kw => lower.includes(kw))) return 'Dark';
  if (['olive', 'sage', 'green', 'emerald'].some(kw => lower.includes(kw))) return 'Nature';
  if (['blue', 'navy', 'royal', 'powder', 'dusty', 'teal', 'ocean'].some(kw => lower.includes(kw))) return 'Cool';
  return 'Accent';
}
