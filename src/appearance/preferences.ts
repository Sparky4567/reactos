export type DesktopStyle = 'ubuntu' | 'win11' | 'chromeos';
export interface AppearancePreferences { desktopStyle: DesktopStyle; theme: 'light' | 'dark'; wallpaper: string }
export const WALLPAPERS = {
  ubuntu: 'radial-gradient(ellipse at 78% 24%, #c54b45 0%, transparent 48%), radial-gradient(ellipse at 12% 90%, #8b246a 0%, transparent 55%), linear-gradient(135deg, #241134 0%, #582052 54%, #b44245 100%)',
  chromeos: 'radial-gradient(ellipse at 22% 24%, #d4e8c2 0%, transparent 48%), radial-gradient(ellipse at 82% 76%, #a6c9eb 0%, transparent 54%), linear-gradient(130deg, #8aaeb8 0%, #c1d7c2 48%, #98bbd6 100%)',
  win11: 'linear-gradient(135deg, #2b5876 0%, #4e4376 50%, #1a1a2e 100%)',
};
export const DEFAULT_APPEARANCE: AppearancePreferences = { desktopStyle: 'ubuntu', theme: 'dark', wallpaper: WALLPAPERS.ubuntu };
export function isAppearance(value: unknown): value is AppearancePreferences {
  if (!value || typeof value !== 'object') return false;
  const p = value as AppearancePreferences;
  return (p.desktopStyle === 'ubuntu' || p.desktopStyle === 'win11' || p.desktopStyle === 'chromeos') && (p.theme === 'dark' || p.theme === 'light') && typeof p.wallpaper === 'string' && p.wallpaper.length > 0 && p.wallpaper.length <= 4000 && !/[;{}<>]/.test(p.wallpaper);
}
// Coordinates are relative to the workspace, excluding shell panels.
export function workspace(style: DesktopStyle, width: number, height: number) {
  const compact = width <= 768 || height <= 540;
  return { width: style === 'ubuntu' && !compact ? Math.max(260, width - 76) : width,
    height: Math.max(180, height - (style === 'ubuntu' ? (compact ? 96 : 36) : style === 'chromeos' ? 76 : 48)) };
}
