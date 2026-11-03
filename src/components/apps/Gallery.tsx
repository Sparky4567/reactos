import { useEffect, useMemo, useRef, useState } from 'react';
import { useOS } from '@/os/store';
import { formatSize } from '@/os/fs';
import { fileSystemImages, MAX_IMAGE_BYTES, type GalleryImage, type ViewerImage } from '@/gallery/images';

function Thumbnail({ image }: { image: ViewerImage }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image.src]);
  return image.src && !failed ? <img src={image.src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <i className="fa fa-file-image-o" aria-hidden="true" />;
}

export function Gallery({ windowId }: { windowId: string }) {
  const { state } = useOS();
  const [saved, setSaved] = useState<GalleryImage[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [rotation, setRotation] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const path = state.windows.find(w => w.id === windowId)?.filePath;
  const pathKey = path ? `fs:${JSON.stringify(path)}` : '';
  const virtual = useMemo(() => fileSystemImages(state.fs), [state.fs]);
  const allImages = useMemo<ViewerImage[]>(() => [
    ...saved.map(image => ({ ...image, src: `/api/gallery/images/${image.id}` })), ...virtual,
  ], [saved, virtual]);
  const images = useMemo(() => allImages.filter(image => image.name.toLowerCase().includes(query.toLowerCase())), [allImages, query]);
  const selected = images.find(image => image.id === selectedId) || images[0];
  const index = selected ? images.indexOf(selected) : -1;

  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/gallery/images', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load the gallery.');
      if (!Array.isArray(data)) throw new Error('Invalid gallery response.');
      if (mounted.current) setSaved(data);
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { if (mounted.current) setLoading(false); }
  };
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (pathKey) { setSelectedId(pathKey); setQuery(''); } }, [pathKey]);
  useEffect(() => { setZoom('fit'); setRotation(0); setDimensions({ width: 0, height: 0 }); setFailed(false); }, [selected?.id, selected?.src]);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBounds({ width: el.clientWidth - 32, height: el.clientHeight - 32 }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const navigate = (delta: number) => {
    if (images.length) setSelectedId(images[(index + delta + images.length) % images.length]!.id);
  };
  const rotated = rotation % 180 !== 0;
  const naturalWidth = rotated ? dimensions.height : dimensions.width;
  const naturalHeight = rotated ? dimensions.width : dimensions.height;
  const scale = zoom === 'fit' ? Math.max(0.01, Math.min(1, bounds.width / (naturalWidth || 1), bounds.height / (naturalHeight || 1))) : zoom;
  const changeZoom = (delta: number) => setZoom(Math.max(0.1, Math.min(4, Math.round((scale + delta) * 10) / 10)));

  const upload = async (files: File[]) => {
    if (busyRef.current || !files.length) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    const failures: string[] = [];
    let count = 0;
    for (const file of files) {
      if (!mounted.current) break;
      if (file.size > MAX_IMAGE_BYTES) { failures.push(`${file.name}: exceeds 20 MB.`); continue; }
      try {
        const res = await fetch('/api/gallery/images', { method: 'POST', headers: { 'X-Image-Name': encodeURIComponent(file.name), 'Content-Type': 'application/octet-stream' }, body: file });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed.');
        count++;
        if (mounted.current) { setSaved(items => [data, ...items]); setSelectedId(data.id); setQuery(''); }
      } catch (e) { failures.push(`${file.name}: ${(e as Error).message}`); }
    }
    busyRef.current = false;
    if (mounted.current) { setBusy(false); setError(failures.join(' ')); setNotice(count ? `${count} image${count === 1 ? '' : 's'} saved to SQLite.` : ''); }
  };
  const remove = async () => {
    if (!selected || selected.path || busyRef.current || !confirm(`Delete “${selected.name}” from the gallery?`)) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch(`/api/gallery/images/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Could not delete the image.'); }
      if (mounted.current) { setSaved(items => items.filter(image => image.id !== selected.id)); setSelectedId(images[index + 1]?.id || images[index - 1]?.id || ''); setNotice('Image deleted.'); }
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };

  return <div className={`app-gallery ${dragging ? 'gallery-dragging' : ''}`}
    onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={e => { e.preventDefault(); setDragging(false); void upload(Array.from(e.dataTransfer.files)); }}
    onKeyDown={e => {
      if (state.activeId !== windowId || (e.target as HTMLElement).closest('input, select, textarea, button, a')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); changeZoom(0.1); }
      if (e.key === '-') { e.preventDefault(); changeZoom(-0.1); }
      if (e.key === '0' || e.key === 'Escape') setZoom('fit');
    }}>
    <div className="gallery-toolbar">
      <button disabled={busy} onClick={() => inputRef.current?.click()}><i className="fa fa-plus" /> {busy ? 'Working…' : 'Add images'}</button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/bmp" multiple hidden onChange={e => { void upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
      <input className="gallery-search" aria-label="Search images" placeholder="Search images…" value={query} onChange={e => setQuery(e.target.value)} />
      <button disabled={loading || busy} onClick={() => void refresh()} title="Refresh gallery" aria-label="Refresh gallery"><i className={`fa fa-refresh ${loading ? 'fa-spin' : ''}`} /></button>
    </div>
    {error && <div className="gallery-alert" role="alert">{error}</div>}
    <div className="gallery-body">
      <aside className="gallery-sidebar" aria-label="Image thumbnails">
        <div className="gallery-count">{loading ? 'Loading gallery…' : `${images.length} images`}</div>
        <div className="gallery-grid">
          {images.map(image => <button key={image.id} className={`gallery-thumbnail ${selected?.id === image.id ? 'selected' : ''}`} aria-pressed={selected?.id === image.id} title={image.path ? image.path.join('/') : image.name} onClick={() => setSelectedId(image.id)}>
            <Thumbnail image={image} /><span>{image.name}</span>
          </button>)}
        </div>
        {!images.length && !loading && <p className="gallery-empty">{query ? 'No matching images.' : 'Add images or drop them here to start a collection.'}</p>}
      </aside>
      <main className="gallery-viewer">
        <div className="gallery-view-controls" aria-label="Image controls">
          <button disabled={images.length < 2} onClick={() => navigate(-1)} aria-label="Previous image" title="Previous image"><i className="fa fa-chevron-left" /></button>
          <span>{selected ? `${index + 1} / ${images.length}` : '0 / 0'}</span>
          <button disabled={images.length < 2} onClick={() => navigate(1)} aria-label="Next image" title="Next image"><i className="fa fa-chevron-right" /></button>
          <button disabled={!selected?.src || failed} onClick={() => changeZoom(-0.1)} aria-label="Zoom out" title="Zoom out"><i className="fa fa-search-minus" /></button>
          <button disabled={!selected?.src || failed} onClick={() => setZoom('fit')}>Fit</button>
          <button disabled={!selected?.src || failed} onClick={() => setZoom(1)} title="Actual size">{Math.round(scale * 100)}%</button>
          <button disabled={!selected?.src || failed} onClick={() => changeZoom(0.1)} aria-label="Zoom in" title="Zoom in"><i className="fa fa-search-plus" /></button>
          <button disabled={!selected?.src || failed} onClick={() => setRotation(r => (r + 90) % 360)} aria-label="Rotate clockwise" title="Rotate clockwise"><i className="fa fa-repeat" /></button>
          {selected?.src && <a href={selected.src} download={selected.name} title="Download original" aria-label="Download original"><i className="fa fa-download" /></a>}
          <button disabled={!selected || !!selected.path || busy} onClick={() => void remove()} aria-label="Delete image" title={selected?.path ? 'Manage this file in File Explorer' : 'Delete image'}><i className="fa fa-trash-o" /></button>
        </div>
        <div className="gallery-stage" ref={stageRef} tabIndex={0} aria-label="Image preview. Use left and right arrows to browse, plus and minus to zoom, zero to fit.">
          {selected?.src && !failed ? <div className="gallery-canvas"><div className="gallery-image-frame" style={{ width: naturalWidth * scale, height: naturalHeight * scale }}>
            <img key={selected.id} src={selected.src} alt={selected.name} draggable={false}
              style={{ width: dimensions.width ? dimensions.width * scale : undefined, height: dimensions.height ? dimensions.height * scale : undefined, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
              onLoad={e => setDimensions({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} onError={() => setFailed(true)} />
          </div></div> : <div className="gallery-empty">
            <i className="fa fa-picture-o" />
            <p>{failed ? 'This image could not be displayed. It may be damaged or unsupported by your browser.' : selected ? 'This simulated file has no image data. Add the original image to view it.' : query ? 'No matching images.' : 'Your image collection'}</p>
            {!selected && !query && <p>Add PNG, JPEG, GIF, WebP, AVIF, or BMP files, up to 20 MB each. Images are saved on this server.</p>}
          </div>}
        </div>
        <div className="gallery-info">
          <strong>{selected?.name || 'No image selected'}</strong>
          <span>{dimensions.width > 0 && !failed ? `${dimensions.width} × ${dimensions.height} · ` : ''}{formatSize(selected?.size)}{selected?.path ? ` · ${selected.path.join('/')}` : selected ? ' · Saved on server' : ''}</span>
        </div>
      </main>
    </div>
    <div className="gallery-status" role="status">{dragging ? 'Drop images to add them to the gallery' : notice || 'Drop images anywhere · Arrow keys to browse · + / − to zoom · 0 to fit'}</div>
  </div>;
}
