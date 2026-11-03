import type { DesktopStyle } from '@/appearance/preferences';
export function DesktopMark({ style }: { style: DesktopStyle }) {
  if (style === 'ubuntu') return <svg className="desktop-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="4" />{[[16, 5], [6.5, 21.5], [25.5, 21.5]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="4" fill="currentColor" stroke="var(--logo-cutout, #e95420)" strokeWidth="2" />)}</svg>;
  return <i className={`fa ${style === 'chromeos' ? 'fa-chrome' : 'fa-windows'}`} aria-hidden="true" />;
}
