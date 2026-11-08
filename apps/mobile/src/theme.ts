/**
 * Graphite: soft charcoal, off-white text and an off-white accent. One restrained red for live.
 * Colour comes from clubs and competitions, not from the chrome.
 */
const theme = {
  background: '#121315',
  surface: 'rgba(34, 35, 39, 0.78)',
  /** For bars and anything content scrolls under, where translucency would muddy the text. */
  solid: '#1a1b1e',
  text: '#f2f2f0',
  muted: '#9b9ca1',
  border: 'rgba(242, 242, 240, 0.1)',
  accent: '#f2f2f0',
  accentText: '#111214',
  live: '#e5484d',
  todo: '#c9cacc',
};

export type Theme = typeof theme;

export function useTheme(): Theme {
  return theme;
}

/** Display type. A custom face carries its own weight, so these never take a fontWeight. */
export const font = {
  title: 'Sora_600SemiBold',
  display: 'Sora_700Bold',
  heavy: 'Sora_800ExtraBold',
};
