import { useAppearance } from '@/appearance/context';
import { WALLPAPERS, type DesktopStyle } from '@/appearance/preferences';
const styles: { id: DesktopStyle; name: string; description: string }[] = [
  { id: 'ubuntu', name: 'Ubuntu', description: 'Activities bar · Side dock · Warm aubergine' },
  { id: 'win11', name: 'Windows 11', description: 'Centered taskbar · Start menu · Glass surfaces' },
  { id: 'fuchsia', name: 'Google Fuchsia', description: 'Magenta accents · Floating dock · Layered cards' },
  { id: 'winretro', name: 'Windows retro', description: 'Classic Start · Beveled edges · Teal desktop' },
  { id: 'android', name: 'Android', description: 'Material colors · Pill controls · Rounded panels' },
  { id: 'matrix', name: 'Matrix terminal', description: 'Phosphor green · Monospace · Scanline grid' },
  { id: 'cyberpunk', name: 'Cyberpunk terminal', description: 'Neon cyan · Magenta glow · Circuit grid' },
  { id: 'pda', name: 'PDA Color', description: 'Pocket organizer · Blue title bars · Colorful icons' },
  { id: 'eink', name: 'PDA E-ink', description: 'Monochrome paper · Crisp borders · Quiet display' },
  { id: 'chromeos', name: 'ChromeOS', description: 'Floating shelf · Rounded cards · Soft colors' },
];
export function AppearanceChooser() {
  const { preferences, update, saving, error } = useAppearance();
  return <div className="settings-card appearance-card">
    <h3>Desktop style</h3>
    <p>Choose the workspace that feels like home.</p>
    <div className="appearance-options" aria-label="Desktop style">
      {styles.map(style => <button key={style.id} className={`appearance-option ${preferences.desktopStyle === style.id ? 'selected' : ''}`} aria-pressed={preferences.desktopStyle === style.id} onClick={() => update({ desktopStyle: style.id })}>
        <span className={`appearance-preview preview-${style.id}`} style={{ background: WALLPAPERS[style.id] }} aria-hidden="true"><span className="preview-panel" /><span className="preview-dock"><i /><i /><i /><i /></span><span className="preview-window"><i /><i /><i /></span></span>
        <span className="appearance-option-name">{style.name}<i className={`fa ${preferences.desktopStyle === style.id ? 'fa-check-circle' : 'fa-circle-o'}`} aria-hidden="true" /></span>
        <span className="appearance-option-description">{style.description}</span>
      </button>)}
    </div>
    <p className={`appearance-save-state ${error ? 'has-error' : ''}`} role="status">{error ? 'Appearance changes have not been saved. Use Retry save in the banner.' : saving ? 'Saving appearance…' : 'Saved to SQLite · Restored when you return'}</p>
  </div>;
}
