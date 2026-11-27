import { useEffect, useState } from 'react';

export function CanvasNumberField({ label, value, min, max, step = 1, disabled = false, onCommit }: {
  label: string; value: number; min: number; max: number; step?: number; disabled?: boolean; onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label className="inspector-field"><span>{label}</span><input type="number" value={draft} min={min} max={max} step={step} disabled={disabled}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={() => { const parsed = Number(draft); if (draft.trim() && Number.isFinite(parsed) && parsed >= min && parsed <= max) onCommit(parsed); else setDraft(String(value)); }}
    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
  /></label>;
}

export function CanvasColorField({ label, value, disabled = false, onCommit }: {
  label: string; value: string; disabled?: boolean; onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <label className="inspector-field color-field"><span>{label}</span><input type="color" value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onCommit(draft); }} /></label>;
}

export function CanvasTextField({ label, value, disabled = false, multiline = false, onCommit }: {
  label: string; value: string; disabled?: boolean; multiline?: boolean; onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft !== value) onCommit(draft); };
  return <label className={`inspector-field text-field ${multiline ? 'multiline' : ''}`}><span>{label}</span>{multiline
    ? <textarea value={draft} disabled={disabled} rows={2} onChange={(event) => setDraft(event.target.value)} onBlur={commit} />
    : <input value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />}</label>;
}
