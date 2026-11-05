import type { DesktopStyle } from '@/appearance/preferences';
export function DesktopMark({ style }: { style: DesktopStyle }) {
  if (style === 'ubuntu') return <svg className="desktop-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="4" />{[[16, 5], [6.5, 21.5], [25.5, 21.5]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="4" fill="currentColor" stroke="var(--logo-cutout, #e95420)" strokeWidth="2" />)}</svg>;
  if (style === 'fuchsia') return <svg className="desktop-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M9 27V12a7 7 0 0 1 14 0M5 16h18M16 5v22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
  return <i className={`fa ${style === 'android' ? 'fa-android' : style === 'chromeos' ? 'fa-chrome' : 'fa-windows'}`} aria-hidden="true" />;
}
