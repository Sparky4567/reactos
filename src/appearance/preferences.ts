export type DesktopStyle = 'ubuntu' | 'win11' | 'chromeos' | 'fuchsia' | 'winretro' | 'android' | 'matrix' | 'cyberpunk' | 'pda' | 'eink';
export const DESKTOP_NAMES: Record<DesktopStyle, string> = { ubuntu: 'Ubuntu', win11: 'Windows 11', chromeos: 'ChromeOS', fuchsia: 'Google Fuchsia', winretro: 'Windows retro', android: 'Android', matrix: 'Matrix terminal', cyberpunk: 'Cyberpunk terminal', pda: 'PDA Color', eink: 'PDA E-ink' };
export const isWindowsStyle = (style: DesktopStyle) => style === 'win11' || style === 'winretro';
export interface AppearancePreferences { desktopStyle: DesktopStyle; theme: 'light' | 'dark'; wallpaper: string }
export const WALLPAPERS = {
  ubuntu: 'radial-gradient(ellipse at 78% 24%, #c54b45 0%, transparent 48%), radial-gradient(ellipse at 12% 90%, #8b246a 0%, transparent 55%), linear-gradient(135deg, #241134 0%, #582052 54%, #b44245 100%)',
  chromeos: 'radial-gradient(ellipse at 22% 24%, #d4e8c2 0%, transparent 48%), radial-gradient(ellipse at 82% 76%, #a6c9eb 0%, transparent 54%), linear-gradient(130deg, #8aaeb8 0%, #c1d7c2 48%, #98bbd6 100%)',
  fuchsia: 'radial-gradient(ellipse at 25% 20%, #ff82bc 0%, transparent 50%), radial-gradient(ellipse at 85% 80%, #7650ce 0%, transparent 55%), linear-gradient(140deg, #60206f, #c62c85 55%, #302460)',
  winretro: '#008080',
  android: 'radial-gradient(ellipse at 80% 15%, #e4edbb 0%, transparent 55%), radial-gradient(ellipse at 15% 85%, #80a995 0%, transparent 60%), linear-gradient(145deg, #b7cdb4, #426c5b)',
  matrix: 'repeating-linear-gradient(90deg, transparent 0 38px, #00ff4110 39px 40px), repeating-linear-gradient(0deg, #00ff4108 0 1px, transparent 1px 4px), radial-gradient(ellipse at top, #073d1b, #010804 75%)',
  cyberpunk: 'repeating-linear-gradient(0deg, #00e5ff12 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, transparent 0 47px, #ff2bd612 47px 48px), radial-gradient(ellipse at 85% 20%, #77135e, transparent 55%), linear-gradient(145deg, #080b24, #181034 60%, #043b49)',
  pda: 'linear-gradient(160deg, #c2e8ed, #6fa9bc 55%, #40758d)',
  eink: 'repeating-linear-gradient(0deg, #00000006 0 1px, transparent 1px 3px), linear-gradient(#e8e8e8, #d5d5d5)',
  win11: 'linear-gradient(135deg, #2b5876 0%, #4e4376 50%, #1a1a2e 100%)',
};
export const DEFAULT_APPEARANCE: AppearancePreferences = { desktopStyle: 'ubuntu', theme: 'dark', wallpaper: WALLPAPERS.ubuntu };
export function isAppearance(value: unknown): value is AppearancePreferences {
  if (!value || typeof value !== 'object') return false;
  const p = value as AppearancePreferences;
  return Object.hasOwn(DESKTOP_NAMES, p.desktopStyle) && (p.theme === 'dark' || p.theme === 'light') && typeof p.wallpaper === 'string' && p.wallpaper.length > 0 && p.wallpaper.length <= 4000 && !/[;{}<>]/.test(p.wallpaper);
}
// Coordinates are relative to the workspace, excluding shell panels.
export function workspace(style: DesktopStyle, width: number, height: number) {
  const compact = width <= 768 || height <= 540;
  return { width: style === 'ubuntu' && !compact ? Math.max(260, width - 76) : width,
    height: Math.max(180, height - (style === 'ubuntu' ? (compact ? 96 : 36) : style === 'chromeos' || style === 'android' || style === 'fuchsia' ? 76 : 48)) };
}
