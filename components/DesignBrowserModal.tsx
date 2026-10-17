import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Workspace, WorkspaceItem } from '../services/workspace/workspace';
import { DesignFile, WEAVE_CLASSES, WeaveClass } from '../services/workspace/formats';
import { COLOR_FAMILIES, ColorFamily, familiesOf } from '../services/workspace/colors';
import { askConfirm, askText, toast } from '../services/ui/dialogs';

interface DesignBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDesign: (file: DesignFile, filename: string) => void;
  /** Called when the user wants to bring in designs saved by older versions of the app. */
  onMigrateLegacy?: () => Promise<string>;
  hasLegacyData?: boolean;
}

type SortKey = 'newest' | 'oldest' | 'name' | 'ends';

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; count?: number }> = ({ active, onClick, children, count }) => (
  <button onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
    {children}{typeof count === 'number' && <span className={active ? 'text-blue-100' : 'text-gray-400'}>{count}</span>}
  </button>
);

export const DesignBrowserModal: React.FC<DesignBrowserModalProps> = ({ isOpen, onClose, onLoadDesign, onMigrateLegacy, hasLegacyData }) => {
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ root: string; description: string; canChooseFolder: boolean; canReveal: boolean } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [types, setTypes] = useState<Set<WeaveClass>>(new Set());
  const [colors, setColors] = useState<Set<ColorFamily>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [shafts, setShafts] = useState<number | 'any'>('any');
  const [sort, setSort] = useState<SortKey>('newest');
  const [busy, setBusy] = useState(false);
  const [newTag, setNewTag] = useState('');
  const runId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++runId.current;
    setLoading(true);
    try {
      setInfo(await Workspace.info());
      const result = await Workspace.list('design', partial => { if (id === runId.current) setItems(partial); });
      if (id === runId.current) setItems(result);
    } catch (e) {
      console.error(e);
      toast('Could not read the design folder.', 'error');
    } finally {
      if (id === runId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    const un = Workspace.subscribe(refresh);
    return un;
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const itemFamilies = useMemo(() => {
    const m = new Map<string, Set<ColorFamily>>();
    items.forEach(i => m.set(i.filename, familiesOf(i.meta.colors)));
    return m;
  }, [items]);

  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach(i => (i.meta.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const shaftOptions = useMemo(() => [...new Set(items.map(i => i.meta.harnesses).filter((h): h is number => !!h))].sort((a, b) => a - b), [items]);

  const countBy = useMemo(() => {
    const t = new Map<WeaveClass, number>();
    const c = new Map<ColorFamily, number>();
    items.forEach(i => {
      if (i.meta.weaveClass) t.set(i.meta.weaveClass, (t.get(i.meta.weaveClass) || 0) + 1);
      itemFamilies.get(i.filename)?.forEach(f => c.set(f, (c.get(f) || 0) + 1));
    });
    return { t, c };
  }, [items, itemFamilies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = items.filter(i => {
      if (q) {
        const hay = `${i.meta.name} ${(i.meta.tags || []).join(' ')} ${i.meta.notes || ''} ${i.meta.weaveClass || ''}`.toLowerCase();
        if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
      }
      if (types.size && !(i.meta.weaveClass && types.has(i.meta.weaveClass))) return false;
      if (colors.size) {
        const fam = itemFamilies.get(i.filename);
        if (!fam || ![...colors].some(c => fam.has(c))) return false;
      }
      if (tagFilter.size && ![...tagFilter].every(t => (i.meta.tags || []).includes(t))) return false;
      if (shafts !== 'any' && i.meta.harnesses !== shafts) return false;
      return true;
    });
    out.sort((a, b) => {
      if (sort === 'newest') return b.modified - a.modified;
      if (sort === 'oldest') return a.modified - b.modified;
      if (sort === 'ends') return (b.meta.ends || 0) - (a.meta.ends || 0);
      return a.meta.name.localeCompare(b.meta.name, undefined, { sensitivity: 'base', numeric: true });
    });
    return out;
  }, [items, search, types, colors, tagFilter, shafts, sort, itemFamilies]);

  const current = useMemo(() => items.find(i => i.filename === selected) || null, [items, selected]);

  useEffect(() => {
    if (selected && !items.some(i => i.filename === selected)) setSelected(null);
  }, [items, selected]);

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };

  const anyFilter = !!search || types.size > 0 || colors.size > 0 || tagFilter.size > 0 || shafts !== 'any';
  const clearFilters = () => { setSearch(''); setTypes(new Set()); setColors(new Set()); setTagFilter(new Set()); setShafts('any'); };

  const doLoad = async (item: WorkspaceItem) => {
    setBusy(true);
    try {
      const file = await Workspace.load<DesignFile>('design', item.filename);
      onLoadDesign(file, item.filename);
    } catch (e: any) {
      toast(e?.message || 'Could not open this design.', 'error');
    } finally { setBusy(false); }
  };

  const doRename = async (item: WorkspaceItem) => {
    const name = await askText('Rename design', item.meta.name, { confirmLabel: 'Rename' });
    if (!name || name === item.meta.name) return;
    try { const f = await Workspace.rename('design', item.filename, name); setSelected(f); toast('Renamed.', 'success'); }
    catch (e: any) { toast(e?.message || 'Could not rename.', 'error'); }
  };

  const doDelete = async (item: WorkspaceItem) => {
    const ok = await askConfirm('Delete design?', `"${item.meta.name}" will be removed from your folder.`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await Workspace.remove('design', item.filename); toast('Deleted.', 'success'); }
    catch (e: any) { toast(e?.message || 'Could not delete.', 'error'); }
  };

  const doImport = async () => {
    try {
      const r = await Workspace.importFromPicker();
      if (r.added) toast(`Added ${r.added} file${r.added > 1 ? 's' : ''} to your library.`, 'success');
      if (r.skipped.length) toast(`Skipped ${r.skipped.length} file(s) that are not WonderWeaves files.`, 'error');
    } catch (e: any) { toast(e?.message || 'Import failed.', 'error'); }
  };

  const doMigrate = async () => {
    if (!onMigrateLegacy) return;
    setBusy(true);
    try { toast(await onMigrateLegacy(), 'success'); } catch (e: any) { toast(e?.message || 'Could not bring in older designs.', 'error'); }
    finally { setBusy(false); }
  };

  const addTag = async (item: WorkspaceItem) => {
    const t = newTag.trim().toLowerCase();
    if (!t || (item.meta.tags || []).includes(t)) { setNewTag(''); return; }
    await Workspace.update('design', item.filename, { tags: [...(item.meta.tags || []), t] });
    setNewTag('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-gray-900/80 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[1500px] h-[92vh] flex flex-col overflow-hidden text-gray-900">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">Design Browser</h2>
            <p className="text-xs text-gray-500 truncate" title={info?.root}>
              {info ? `${info.description}: ${info.root}` : 'Opening your library...'}
            </p>
          </div>
          <div className="flex-1 min-w-[180px]">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, tag, note or weave type"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)} className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A to Z</option>
            <option value="ends">Most ends</option>
          </select>
          {info?.canChooseFolder && (
            <button onClick={async () => { if (await Workspace.chooseFolder()) toast('Folder changed.', 'success'); }}
              className="px-3 py-2 text-sm font-semibold border border-gray-300 rounded-lg bg-white hover:bg-gray-50">Change folder</button>
          )}
          <button onClick={doImport} className="px-3 py-2 text-sm font-semibold border border-gray-300 rounded-lg bg-white hover:bg-gray-50">Import files</button>
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-500">Close</button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Filters */}
          <aside className="w-60 shrink-0 border-r border-gray-200 overflow-y-auto p-4 hidden md:block bg-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Filters</span>
              {anyFilter && <button onClick={clearFilters} className="text-xs text-blue-600 font-semibold hover:underline">Clear</button>}
            </div>

            <div className="mb-5">
              <div className="text-xs font-bold text-gray-500 mb-2">Weave type</div>
              <div className="flex flex-wrap gap-1.5">
                {WEAVE_CLASSES.map(t => (
                  <Chip key={t} active={types.has(t)} count={countBy.t.get(t) || 0} onClick={() => toggle(types, t, setTypes)}>{t}</Chip>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-xs font-bold text-gray-500 mb-2">Colour</div>
              <div className="flex flex-wrap gap-2">
                {COLOR_FAMILIES.map(c => {
                  const n = countBy.c.get(c.name) || 0;
                  const on = colors.has(c.name);
                  return (
                    <button key={c.name} onClick={() => toggle(colors, c.name, setColors)} title={`${c.name} (${n})`} disabled={!n && !on}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${on ? 'border-blue-600 scale-110 ring-2 ring-blue-200' : 'border-gray-200'} ${!n && !on ? 'opacity-30' : 'hover:scale-105'}`}
                      style={{ background: c.swatch }} aria-label={c.name} aria-pressed={on} />
                  );
                })}
              </div>
            </div>

            {shaftOptions.length > 0 && (
              <div className="mb-5">
                <div className="text-xs font-bold text-gray-500 mb-2">Shafts</div>
                <select value={String(shafts)} onChange={e => setShafts(e.target.value === 'any' ? 'any' : parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                  <option value="any">Any</option>
                  {shaftOptions.map(h => <option key={h} value={h}>{h} shafts</option>)}
                </select>
              </div>
            )}

            {allTags.length > 0 && (
              <div className="mb-5">
                <div className="text-xs font-bold text-gray-500 mb-2">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.slice(0, 40).map(([t, n]) => (
                    <Chip key={t} active={tagFilter.has(t)} count={n} onClick={() => toggle(tagFilter, t, setTagFilter)}>{t}</Chip>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Grid */}
          <main className="flex-1 min-w-0 overflow-y-auto p-4 bg-gray-50">
            {loading && items.length === 0 && <div className="text-sm text-gray-500 p-6">Reading your designs...</div>}

            {!loading && items.length === 0 && (
              <div className="max-w-md mx-auto text-center mt-16">
                <h3 className="text-lg font-bold mb-2">No designs yet</h3>
                <p className="text-sm text-gray-500 mb-5">Designs you save appear here with a preview. You can also import .wwdesign files or older .weave files.</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={doImport} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-500">Import files</button>
                  {hasLegacyData && onMigrateLegacy && (
                    <button onClick={doMigrate} disabled={busy} className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded-lg bg-white hover:bg-gray-50">Bring in designs from older versions</button>
                  )}
                </div>
              </div>
            )}

            {items.length > 0 && filtered.length === 0 && (
              <div className="text-center mt-16 text-sm text-gray-500">
                No designs match these filters. <button onClick={clearFilters} className="text-blue-600 font-semibold hover:underline">Clear filters</button>
              </div>
            )}

            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
              {filtered.map(i => {
                const on = i.filename === selected;
                return (
                  <button key={i.filename} onClick={() => setSelected(i.filename)} onDoubleClick={() => doLoad(i)}
                    className={`text-left bg-white rounded-xl border overflow-hidden transition-shadow [content-visibility:auto] [contain-intrinsic-size:230px] ${on ? 'border-blue-600 ring-2 ring-blue-200 shadow-md' : 'border-gray-200 hover:shadow-md'}`}>
                    <div className="aspect-[16/10] bg-gray-200 overflow-hidden">
                      {i.thumbnail
                        ? <img src={i.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No preview</div>}
                    </div>
                    <div className="p-2.5">
                      <div className="text-sm font-bold truncate">{i.meta.name}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {[i.meta.weaveClass, i.meta.harnesses ? `${i.meta.harnesses}H` : '', i.meta.ends && i.meta.picks ? `${i.meta.ends}x${i.meta.picks}` : ''].filter(Boolean).join(' · ')}
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        {(i.meta.colors || []).slice(0, 6).map((c, k) => <span key={k} className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: c }} />)}
                        <span className="ml-auto text-[10px] text-gray-400">{fmtDate(i.modified)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {loading && items.length > 0 && <div className="text-xs text-gray-400 text-center py-3">Reading more designs...</div>}
          </main>

          {/* Preview */}
          <aside className="w-[340px] shrink-0 border-l border-gray-200 overflow-y-auto bg-white hidden lg:flex flex-col">
            {!current ? (
              <div className="p-6 text-sm text-gray-400 mt-10 text-center">Select a design to see its preview and details before you open it.</div>
            ) : (
              <div className="p-4 flex flex-col gap-4">
                <div className="aspect-[16/10] bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
                  {current.thumbnail ? <img src={current.thumbnail} alt={current.meta.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No preview</div>}
                </div>
                <div>
                  <div className="flex items-start gap-2">
                    <h3 className="text-lg font-bold leading-tight flex-1 break-words">{current.meta.name}</h3>
                    <button onClick={() => doRename(current)} className="text-xs text-blue-600 font-semibold hover:underline shrink-0 mt-1">Rename</button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Saved {fmtDate(current.modified)}</div>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  {[
                    ['Weave', current.meta.weaveClass],
                    ['Shafts', current.meta.harnesses],
                    ['Ends', current.meta.ends],
                    ['Picks', current.meta.picks],
                    ['EPI', current.meta.epi],
                    ['PPI', current.meta.ppi],
                  ].filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => (
                    <div key={String(k)}><dt className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{k}</dt><dd className="font-semibold">{String(v)}</dd></div>
                  ))}
                </dl>

                {(current.meta.colors || []).length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5">Colours</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(current.meta.colors || []).map((c, k) => <span key={k} title={c} className="w-6 h-6 rounded-md border border-black/10" style={{ background: c }} />)}
                    </div>
                  </div>
                )}

                {(current.meta.fibers || []).length > 0 && (
                  <div className="text-xs text-gray-600"><span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block mb-1">Yarns</span>{(current.meta.fibers || []).join(', ')}</div>
                )}

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5">Tags</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(current.meta.tags || []).map(t => (
                      <span key={t} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs rounded-full pl-2 pr-1 py-0.5">
                        {t}<button aria-label={`Remove ${t}`} onClick={() => Workspace.update('design', current.filename, { tags: (current.meta.tags || []).filter(x => x !== t) })} className="w-4 h-4 rounded-full hover:bg-gray-300 text-gray-500 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={e => { e.preventDefault(); addTag(current); }} className="flex gap-1.5">
                    <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Add a tag" className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500" />
                    <button type="submit" className="px-2.5 py-1 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-50">Add</button>
                  </form>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5">Notes</div>
                  <textarea key={current.filename} defaultValue={current.meta.notes || ''} rows={3}
                    onBlur={e => { if ((e.target.value || '') !== (current.meta.notes || '')) Workspace.update('design', current.filename, { notes: e.target.value }); }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" placeholder="Customer, order, ideas..." />
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button onClick={() => doLoad(current)} disabled={busy} className="w-full py-2.5 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-60">Open design</button>
                  <div className="flex gap-2">
                    <button onClick={async () => { const ok = await Workspace.exportCopy('design', current.filename); if (ok) toast('Copy saved.', 'success'); }}
                      className="flex-1 py-2 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-50">Save a copy</button>
                    {info?.canReveal && (
                      <button onClick={() => Workspace.reveal('design', current.filename)} className="flex-1 py-2 text-sm font-semibold border border-gray-300 rounded-lg hover:bg-gray-50">Show in folder</button>
                    )}
                  </div>
                  <button onClick={() => doDelete(current)} className="w-full py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Delete</button>
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="px-5 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center gap-3">
          <span>{filtered.length === items.length ? `${items.length} design${items.length === 1 ? '' : 's'}` : `Showing ${filtered.length} of ${items.length}`}</span>
          <span className="text-gray-400">Double-click a design to open it.</span>
          {hasLegacyData && onMigrateLegacy && items.length > 0 && (
            <button onClick={doMigrate} disabled={busy} className="ml-auto text-blue-600 font-semibold hover:underline">Bring in designs from older versions</button>
          )}
        </div>
      </div>
    </div>
  );
};
