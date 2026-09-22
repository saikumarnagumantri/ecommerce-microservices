import React, { useRef, useState } from 'react';
import * as productsApi from '../api/products';
import * as mediaApi from '../api/media';
import { ProductMedia } from '../api/types';
import { extractErrorMessage } from '../api/client';

interface Props {
  productId: number;
  media: ProductMedia[];
  onChanged: () => void;
}

export default function MediaManager({ productId, media, onChanged }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...media].sort((a, b) => a.sortOrder - b.sortOrder);

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const uploaded = await mediaApi.uploadFile(file);
      await productsApi.addMedia(productId, { type: uploaded.type, url: uploaded.url });
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not upload that file'));
    } finally {
      setUploading(false);
    }
  };

  const onSetPrimary = async (mediaId: number) => {
    await productsApi.updateMedia(productId, mediaId, { isPrimary: true });
    onChanged();
  };

  const onMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[target];
    await Promise.all([
      productsApi.updateMedia(productId, a.id, { sortOrder: b.sortOrder }),
      productsApi.updateMedia(productId, b.id, { sortOrder: a.sortOrder }),
    ]);
    onChanged();
  };

  const onRemove = async (mediaId: number) => {
    await productsApi.removeMedia(productId, mediaId);
    onChanged();
  };

  return (
    <div>
      <div style={styles.grid}>
        {sorted.map((m, i) => (
          <div key={m.id} style={styles.tile}>
            {m.isPrimary && <div style={styles.starBadge}>★ Primary</div>}
            <div style={styles.tag}>{m.type}</div>
            {m.type === 'IMAGE' ? (
              <img src={m.url} alt="" style={styles.thumb} />
            ) : (
              <video src={m.url} style={styles.thumb} muted />
            )}
            <div style={styles.tileActions}>
              <button type="button" className="btn-ghost" style={styles.tileBtn} disabled={i === 0} onClick={() => onMove(i, -1)}>◀</button>
              {!m.isPrimary && (
                <button type="button" className="btn-ghost" style={styles.tileBtn} onClick={() => onSetPrimary(m.id)}>★</button>
              )}
              <button type="button" className="btn-ghost" style={{ ...styles.tileBtn, color: 'var(--danger)' }} onClick={() => onRemove(m.id)}>✕</button>
              <button type="button" className="btn-ghost" style={styles.tileBtn} disabled={i === sorted.length - 1} onClick={() => onMove(i, 1)}>▶</button>
            </div>
          </div>
        ))}

        <label style={styles.uploadTile}>
          {uploading ? 'Uploading…' : '+ Upload'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            style={{ display: 'none' }}
            onChange={onFileChosen}
            disabled={uploading}
          />
        </label>
      </div>
      <p style={styles.hint}>JPG, PNG, WebP up to 5MB · MP4 up to 10MB. ★ sets the catalog thumbnail.</p>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 },
  tile: { position: 'relative', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)', aspectRatio: '1' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover' },
  tag: { position: 'absolute', top: 4, left: 4, fontSize: 9, fontWeight: 700, background: 'var(--ink)', color: '#fff', padding: '1px 5px', borderRadius: 3 },
  starBadge: { position: 'absolute', top: 4, right: 4, fontSize: 9, fontWeight: 700, background: 'var(--admin)', color: '#fff', padding: '1px 5px', borderRadius: 3, zIndex: 1 },
  tileActions: { position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', background: 'rgba(18,32,43,0.65)', padding: '2px 4px' },
  tileBtn: { padding: '2px 4px', fontSize: 11, color: '#fff', background: 'transparent' },
  uploadTile: {
    aspectRatio: '1',
    border: '1.5px dashed var(--edge)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    color: 'var(--muted)',
    cursor: 'pointer',
    textAlign: 'center',
    padding: 8,
  },
  hint: { fontSize: 11, color: 'var(--muted)', marginTop: 10 },
};
