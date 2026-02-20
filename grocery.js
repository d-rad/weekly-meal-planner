// ── GroceryTab ───────────────────────────────────────────────────────────────
// Grocery list backed by the same Firebase DB as the meal planner.
// mealPlanner/groceryList    — active items
// mealPlanner/groceryHistory — per-item defaults (unit, store, productUrl, notes)

const UNIT_SUGGESTIONS = ['lbs', 'pkg', 'cups', 'gallons', 'oz'];

// type: 1 = grocery store, 2 = non-grocery retailer, 3 = generic/uncategorized
const STORE_DATA = [
  { name: "Sam's Club",    url: 'samsclub.com',    type: 1 },
  { name: 'Costco',        url: 'costco.com',      type: 1 },
  { name: 'Kroger',        url: 'kroger.com',      type: 1 },
  { name: 'HEB',           url: 'heb.com',         type: 1 },
  { name: 'Walmart',       url: 'walmart.com',     type: 1 },
  { name: 'Amazon',        url: 'amazon.com',      type: 2 },
  { name: 'Walgreens',     url: 'walgreens.com',   type: 2 },
  { name: 'Pharmacy',      url: '',                type: 3 },
  { name: 'Grocery',       url: '',                type: 3 },
  { name: 'Uncategorized', url: '',                type: 3 },
];

const getStoreMeta = (name) =>
  STORE_DATA.find(s => s.name.toLowerCase() === name.toLowerCase()) ||
  { name, url: '', type: 2 };

const compareStores = (a, b) => {
  const ta = getStoreMeta(a).type, tb = getStoreMeta(b).type;
  return ta !== tb ? ta - tb : a.localeCompare(b);
};

const toTitleCase = (str) =>
  str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const storeIconSrc = (store) =>
  `res/${store.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;

function StoreIcon({ store, size = 24 }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [store]);
  if (failed) return <span style={{ fontSize: size }}>🏪</span>;
  return (
    <img src={storeIconSrc(store)} alt="" onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
  );
}

// ── Edit Item Modal ───────────────────────────────────────────────────────────
function EditItemModal({ item, onSave, onClose }) {
  const [productUrl, setProductUrl] = React.useState(item.productUrl || '');
  const [notes, setNotes]           = React.useState(item.notes || '');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 24, width: '90%', maxWidth: 440,
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
            ✏️ Edit — <span style={{ color: '#6366f1' }}>{item.name}</span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
              Product Link
            </label>
            <input
              className="g-input"
              value={productUrl}
              onChange={e => setProductUrl(e.target.value)}
              placeholder="https://example.com/product"
            />
            {productUrl && (
              <a href={productUrl.startsWith('http') ? productUrl : `https://${productUrl}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#6366f1', display: 'inline-block', marginTop: 4 }}>
                Open link ↗
              </a>
            )}
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
              Notes
            </label>
            <textarea
              className="g-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Get the organic version, aisle 4…"
              rows={3}
              style={{ resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{
            background: '#f1f5f9', color: '#475569', border: 'none',
            borderRadius: 7, padding: '8px 16px', fontSize: 14, cursor: 'pointer', fontWeight: 600,
          }}>Cancel</button>
          <button onClick={() => onSave({ productUrl: productUrl.trim(), notes: notes.trim() })} style={{
            background: '#6366f1', color: 'white', border: 'none',
            borderRadius: 7, padding: '8px 16px', fontSize: 14, cursor: 'pointer', fontWeight: 600,
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Manage History Modal ──────────────────────────────────────────────────────
function ManageHistoryModal({ history, onDelete, onClose }) {
  const [search, setSearch] = React.useState('');
  const [confirmKey, setConfirmKey] = React.useState(null);

  const names = Object.keys(history)
    .filter(n => !search.trim() || n.toLowerCase().includes(search.toLowerCase()))
    .sort();

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 24, width: '90%', maxWidth: 500,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Manage Grocery History
        </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>

        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
          Remove items that were accidentally saved so they no longer appear as suggestions.
        </p>

        <input className="g-input" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search history…" style={{ marginBottom: 12 }} />

        <div style={{ flex: 1, overflowY: 'auto', borderRadius: 6, border: '1px solid #f1f5f9' }}>
          {names.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              {search ? 'No matches found.' : 'History is empty.'}
            </div>
          )}
          {names.map(name => {
            const meta = history[name];
            const isConfirming = confirmKey === name;
            return (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderBottom: '1px solid #f8fafc',
                background: isConfirming ? '#fff1f2' : 'white',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                    {[meta?.unit, meta?.store].filter(Boolean).join(' · ')}
                    {meta?.productUrl && ' · 🔗 has link'}
                    {meta?.notes     && ' · 📝 has notes'}
                  </div>
                </div>
                {isConfirming ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { onDelete(name); setConfirmKey(null); }} style={{
                      background: '#ef4444', color: 'white', border: 'none',
                      borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                    }}>Delete</button>
                    <button onClick={() => setConfirmKey(null)} style={{
                      background: '#f1f5f9', color: '#475569', border: 'none',
                      borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                    }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmKey(name)} style={{
                    background: 'none', border: '1px solid #fecaca', color: '#ef4444',
                    borderRadius: 5, padding: '3px 9px', fontSize: 12, cursor: 'pointer',
                  }}>Remove</button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={onClose} style={{
            background: '#6366f1', color: 'white', border: 'none',
            borderRadius: 7, padding: '8px 18px', fontSize: 14, cursor: 'pointer', fontWeight: 600,
          }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Main GroceryTab ───────────────────────────────────────────────────────────
function GroceryTab() {
  const { useState, useEffect, useRef, useMemo } = React;

  const [items, setItems]     = useState([]);
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);

  // Form fields
  const [newItem, setNewItem]   = useState('');
  const [newQty, setNewQty]     = useState('');
  const [newUnit, setNewUnit]   = useState('');
  const [newStore, setNewStore] = useState('');

  // Dropdown visibility
  const [showItemSugg, setShowItemSugg]   = useState(false);
  const [showUnitSugg, setShowUnitSugg]   = useState(false);
  const [showStoreSugg, setShowStoreSugg] = useState(false);

  // Dropdown keyboard-navigation highlight indexes (-1 = none)
  const [itemHlIdx,  setItemHlIdx]  = React.useState(-1);
  const [storeHlIdx, setStoreHlIdx] = React.useState(-1);
  const [unitHlIdx,  setUnitHlIdx]  = React.useState(-1);

  // Modals
  const [editingItem, setEditingItem]         = useState(null); // item object being edited
  const [showHistoryMgr, setShowHistoryMgr]   = useState(false);

  // Inline store editor — which item's store dropdown is open
  const [editingStoreId, setEditingStoreId]   = useState(null);
  const [storeEditQuery, setStoreEditQuery]   = useState('');
  const storeEditRef = useRef(null);

  // Completed section collapsed by default
  const [completedOpen, setCompletedOpen]     = useState(false);

  const [errors, setErrors] = useState({});

  const itemRef  = useRef(null);
  const unitRef  = useRef(null);
  const storeRef = useRef(null);
  const db = firebase.database();

  // ── Styles ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .g-input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px;
        font-size: 14px; outline: none; box-sizing: border-box; font-family: sans-serif; width: 100%; }
      .g-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
      .g-input.error { border-color: #ef4444; box-shadow: 0 0 0 2px rgba(239,68,68,0.15); }
      .g-row:hover   { background: #f8fafc !important; }
      .g-sugg-item:hover { background: #eef2ff !important; cursor: pointer; }
      .store-header-link:hover h3 { text-decoration: underline; }
      .g-edit-btn { opacity: 0.35; transition: opacity 0.15s; }
      .g-row:hover .g-edit-btn { opacity: 1; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ── Close dropdowns on outside click ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (itemRef.current  && !itemRef.current.contains(e.target))  setShowItemSugg(false);
      if (unitRef.current  && !unitRef.current.contains(e.target))  setShowUnitSugg(false);
      if (storeRef.current && !storeRef.current.contains(e.target)) setShowStoreSugg(false);
      if (storeEditRef.current && !storeEditRef.current.contains(e.target)) {
        setEditingStoreId(null);
        setStoreEditQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Firebase: active list ───────────────────────────────────────────────────
  useEffect(() => {
    const ref = db.ref('mealPlanner/groceryList');
    ref.on('value', (snap) => {
      const val = snap.val();
      if (!val) { setItems([]); setLoading(false); return; }
      const arr = Array.isArray(val) ? val.filter(Boolean) : Object.values(val).filter(Boolean);
      setItems(arr);
      setLoading(false);
    });
    return () => ref.off();
  }, []);

  // ── Firebase: item history ──────────────────────────────────────────────────
  useEffect(() => {
    db.ref('mealPlanner/groceryHistory').once('value', (snap) => setHistory(snap.val() || {}));
  }, []);

  // ── Suggestions ────────────────────────────────────────────────────────────
  const activeUncheckedNames = useMemo(() =>
    new Set(items.filter(i => !i.checked).map(i => i.name.toLowerCase())), [items]);

  const itemSuggestions = useMemo(() => {
    const q = newItem.trim().toLowerCase();
    return Object.keys(history)
      .filter(n => !activeUncheckedNames.has(n.toLowerCase()))
      .filter(n => !q || n.toLowerCase().includes(q))
      .sort();
  }, [history, activeUncheckedNames, newItem]);

  const filteredUnits = newUnit.trim()
    ? UNIT_SUGGESTIONS.filter(u => u.toLowerCase().startsWith(newUnit.toLowerCase()))
    : UNIT_SUGGESTIONS;

  const filteredStores = useMemo(() => {
    const q = newStore.trim().toLowerCase();
    return STORE_DATA
      .filter(s => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.type !== b.type ? a.type - b.type : a.name.localeCompare(b.name));
  }, [newStore]);

  // Reset highlight indexes when the suggestion lists change
  React.useEffect(() => setItemHlIdx(-1),  [itemSuggestions]);
  React.useEffect(() => setStoreHlIdx(-1), [filteredStores]);
  React.useEffect(() => setUnitHlIdx(-1),  [filteredUnits]);

  // ── Autofill item selection ─────────────────────────────────────────────────
  const selectItemSuggestion = (name) => {
    const d = history[name] || {};
    setNewItem(name);
    setNewQty('');
    setNewUnit(d.unit  || '');
    setNewStore(d.store || '');
    setShowItemSugg(false);
  };

  // ── Save helpers ────────────────────────────────────────────────────────────
  const saveItems   = (u) => db.ref('mealPlanner/groceryList').set(u);
  const saveHistory = (u) => db.ref('mealPlanner/groceryHistory').set(u);

  // ── Add item ────────────────────────────────────────────────────────────────
  const addItem = () => {
    if (!newItem.trim()) { setErrors({ item: true }); return; }
    setErrors({});

    const now   = new Date();
    const mmdd  = `${now.toLocaleDateString('en-US', { month: 'short' })}-${String(now.getDate()).padStart(2, '0')}`;
    const store = newStore.trim() || 'Uncategorized';
    const unit  = newUnit.trim();
    const name  = toTitleCase(newItem.trim());

    // Pull saved productUrl / notes from history (if any)
    const prev = history[name] || {};

    const item = {
      id: Date.now().toString(), name, qty: newQty.trim(), unit, store,
      checked: false, addedDate: mmdd,
      productUrl: prev.productUrl || '',
      notes:      prev.notes      || '',
    };

    const updatedItems   = [...items, item];
    const updatedHistory = { ...history, [name]: { unit, store, productUrl: item.productUrl, notes: item.notes } };

    setItems(updatedItems);     saveItems(updatedItems);
    setHistory(updatedHistory); saveHistory(updatedHistory);
    setNewItem(''); setNewQty(''); setNewUnit(''); setNewStore('');
  };

  const toggleChecked = (id) => {
    const u = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i);
    setItems(u); saveItems(u);
  };

  const removeItem = (id) => {
    const u = items.filter(i => i.id !== id);
    setItems(u); saveItems(u);
  };

  const clearChecked = () => {
    const u = items.filter(i => !i.checked);
    setItems(u); saveItems(u);
  };

  // ── Update store on an active item inline ───────────────────────────────────
  const updateItemStore = (id, newStore) => {
    const u = items.map(i => i.id === id ? { ...i, store: newStore } : i);
    setItems(u); saveItems(u);
    // Also update history so future adds of this item default to the new store
    const item = items.find(i => i.id === id);
    if (item) {
      const updatedHistory = { ...history, [item.name]: { ...(history[item.name] || {}), store: newStore } };
      setHistory(updatedHistory);
      saveHistory(updatedHistory);
    }
    setEditingStoreId(null);
    setStoreEditQuery('');
  };

  // ── Save edits from modal ───────────────────────────────────────────────────
  const saveItemEdit = ({ productUrl, notes }) => {
    const updatedItems = items.map(i =>
      i.id === editingItem.id ? { ...i, productUrl, notes } : i
    );
    // Also persist into history so it's recalled next add
    const updatedHistory = {
      ...history,
      [editingItem.name]: { ...(history[editingItem.name] || {}), productUrl, notes },
    };
    setItems(updatedItems);     saveItems(updatedItems);
    setHistory(updatedHistory); saveHistory(updatedHistory);
    setEditingItem(null);
  };

  // ── Purge item from history ─────────────────────────────────────────────────
  const deleteFromHistory = (name) => {
    const updated = { ...history };
    delete updated[name];
    setHistory(updated);
    saveHistory(updated);
  };

  // ── Group by store ──────────────────────────────────────────────────────────
  // Only unchecked items in store groups; checked items go to completed section
  const grouped = useMemo(() => {
    const map = {};
    items.filter(i => !i.checked).forEach(item => {
      const s = item.store || 'Uncategorized';
      if (!map[s]) map[s] = [];
      map[s].push(item);
    });
    return Object.entries(map).sort(([a], [b]) => compareStores(a, b));
  }, [items]);

  const completedItems = useMemo(() => items.filter(i => i.checked), [items]);

  const checkedCount = items.filter(i => i.checked).length;

  const dropdownStyle = {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2,
    background: 'white', border: '1px solid #e2e8f0', borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 200,
    maxHeight: 200, overflowY: 'auto',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6366f1' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Loading grocery list…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc', boxSizing: 'border-box' }}>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onSave={saveItemEdit}
          onClose={() => setEditingItem(null)}
        />
      )}
      {showHistoryMgr && (
        <ManageHistoryModal
          history={history}
          onDelete={deleteFromHistory}
          onClose={() => setShowHistoryMgr(false)}
        />
      )}

      {/* ── Add Item Form ──────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b', flex: 1 }}>🛒 Grocery List</h2>
            <button onClick={() => setShowHistoryMgr(true)} style={{
              background: '#fda4af', color: 'white', border: 'none',
              borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Manage History
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {/* Item */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 160px', position: 'relative' }} ref={itemRef}>
              <label style={{ fontSize: 11, fontWeight: 600, color: errors.item ? '#ef4444' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Item <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input className={`g-input${errors.item ? ' error' : ''}`} value={newItem}
                onChange={e => { setNewItem(e.target.value); setShowItemSugg(true); setItemHlIdx(-1); if (errors.item) setErrors({}); }}
                onFocus={() => setShowItemSugg(true)}
                onKeyDown={e => {
                  const len = itemSuggestions.length;
                  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && showItemSugg && len > 0) {
                    e.preventDefault();
                    setItemHlIdx(i => e.key === 'ArrowDown' ? Math.min(i + 1, len - 1) : Math.max(i - 1, 0));
                  } else if (e.key === 'Tab' && showItemSugg && itemHlIdx >= 0) {
                    e.preventDefault();
                    selectItemSuggestion(itemSuggestions[itemHlIdx]);
                  } else if (e.key === 'Escape') {
                    setShowItemSugg(false); setItemHlIdx(-1);
                  } else if (e.key === 'Enter') {
                    if (showItemSugg && itemHlIdx >= 0) { selectItemSuggestion(itemSuggestions[itemHlIdx]); }
                    else { addItem(); }
                  }
                }}
                placeholder="e.g. Chicken breast" />
              {showItemSugg && itemSuggestions.length > 0 && (
                <div style={dropdownStyle}>
                  {itemSuggestions.map((name, idx) => (
                    <div key={name} className="g-sugg-item"
                      style={{ padding: '7px 12px', fontSize: 14, color: '#1e293b', borderBottom: '1px solid #f1f5f9',
                               display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                               background: idx === itemHlIdx ? '#e0e7ff' : undefined }}
                      onMouseEnter={() => setItemHlIdx(idx)}
                      onMouseDown={() => selectItemSuggestion(name)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {name}
                        {history[name]?.productUrl && <span title="Has product link" style={{ fontSize: 10 }}>🔗</span>}
                        {history[name]?.notes      && <span title="Has notes"        style={{ fontSize: 10 }}>📝</span>}
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {[history[name]?.unit, history[name]?.store].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Store — moved here, immediately after Item */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', position: 'relative' }} ref={storeRef}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Store</label>
              <input className="g-input" value={newStore}
                onChange={e => { setNewStore(e.target.value); setShowStoreSugg(true); setStoreHlIdx(-1); }}
                onFocus={() => setShowStoreSugg(true)}
                onKeyDown={e => {
                  const len = filteredStores.length;
                  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && showStoreSugg && len > 0) {
                    e.preventDefault();
                    setStoreHlIdx(i => e.key === 'ArrowDown' ? Math.min(i + 1, len - 1) : Math.max(i - 1, 0));
                  } else if (e.key === 'Tab' && showStoreSugg && storeHlIdx >= 0) {
                    e.preventDefault();
                    setNewStore(filteredStores[storeHlIdx].name); setShowStoreSugg(false); setStoreHlIdx(-1);
                  } else if (e.key === 'Escape') {
                    setShowStoreSugg(false); setStoreHlIdx(-1);
                  } else if (e.key === 'Enter') {
                    if (showStoreSugg && storeHlIdx >= 0) { setNewStore(filteredStores[storeHlIdx].name); setShowStoreSugg(false); setStoreHlIdx(-1); }
                    else { addItem(); }
                  }
                }}
                placeholder="Uncategorized" />
              {showStoreSugg && filteredStores.length > 0 && (
                <div style={dropdownStyle}>
                  {filteredStores.map((s, idx) => (
                    <div key={s.name} className="g-sugg-item"
                      style={{ padding: '8px 12px', fontSize: 14, color: '#1e293b', borderBottom: '1px solid #f1f5f9',
                               display: 'flex', alignItems: 'center', gap: 8,
                               background: idx === storeHlIdx ? '#e0e7ff' : undefined }}
                      onMouseEnter={() => setStoreHlIdx(idx)}
                      onMouseDown={() => { setNewStore(s.name); setShowStoreSugg(false); setStoreHlIdx(-1); }}>
                      <StoreIcon store={s.name} size={16} />
                      <span style={{ flex: 1 }}>{s.name}</span>
                      {s.url && <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.url}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Qty */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 1 75px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</label>
              <input className="g-input" value={newQty} inputMode="decimal"
                onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setNewQty(v); }}
                onKeyDown={e => e.key === 'Enter' && addItem()} />
            </div>

            {/* Unit */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 1 110px', position: 'relative' }} ref={unitRef}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unit</label>
              <input className="g-input" value={newUnit}
                onChange={e => { setNewUnit(e.target.value); setShowUnitSugg(true); setUnitHlIdx(-1); }}
                onFocus={() => setShowUnitSugg(true)}
                onKeyDown={e => {
                  const len = filteredUnits.length;
                  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && showUnitSugg && len > 0) {
                    e.preventDefault();
                    setUnitHlIdx(i => e.key === 'ArrowDown' ? Math.min(i + 1, len - 1) : Math.max(i - 1, 0));
                  } else if (e.key === 'Tab' && showUnitSugg && unitHlIdx >= 0) {
                    e.preventDefault();
                    setNewUnit(filteredUnits[unitHlIdx]); setShowUnitSugg(false); setUnitHlIdx(-1);
                  } else if (e.key === 'Escape') {
                    setShowUnitSugg(false); setUnitHlIdx(-1);
                  } else if (e.key === 'Enter') {
                    if (showUnitSugg && unitHlIdx >= 0) { setNewUnit(filteredUnits[unitHlIdx]); setShowUnitSugg(false); setUnitHlIdx(-1); }
                    else { addItem(); }
                  }
                }}
                placeholder="lbs, oz…" />
              {showUnitSugg && filteredUnits.length > 0 && (
                <div style={dropdownStyle}>
                  {filteredUnits.map((u, idx) => (
                    <div key={u} className="g-sugg-item"
                      style={{ padding: '8px 12px', fontSize: 14, color: '#1e293b', borderBottom: '1px solid #f1f5f9',
                               background: idx === unitHlIdx ? '#e0e7ff' : undefined }}
                      onMouseEnter={() => setUnitHlIdx(idx)}
                      onMouseDown={() => { setNewUnit(u); setShowUnitSugg(false); setUnitHlIdx(-1); }}>{u}</div>
                  ))}
                </div>
              )}
            </div>



            <button onClick={addItem} style={{
              background: '#6366f1', color: 'white', border: 'none', borderRadius: 6,
              padding: '8px 18px', fontSize: 20, cursor: 'pointer', lineHeight: 1,
              flexShrink: 0, alignSelf: 'flex-end',
            }}>+</button>
          </div>

          {errors.item && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>Item name is required.</p>
          )}
        </div>
      </div>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {grouped.length === 0 && completedItems.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
              <div style={{ fontSize: 16 }}>No items yet — add one above!</div>
            </div>
          )}

          {/* ── Active items by store ── */}
          {grouped.map(([store, storeItems]) => {
            const meta    = getStoreMeta(store);
            const hasLink = !!meta.url;
            const StoreHeaderContent = () => (
              <>
                <StoreIcon store={store} size={24} />
                <h3 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: '#312e81' }}>{store}</h3>
              </>
            );

            return (
              <div key={store} style={{ marginBottom: 24 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  borderBottom: '2px solid #6366f1', paddingBottom: 6, marginBottom: 8,
                }}>
                  {hasLink ? (
                    <a href={`https://${meta.url}`} target="_blank" rel="noopener noreferrer"
                      className="store-header-link"
                      style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StoreHeaderContent />
                    </a>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><StoreHeaderContent /></div>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                    {storeItems.filter(i => !i.checked).length} / {storeItems.length} remaining
                  </span>
                </div>

                {storeItems.map(item => {
                  const isEditingStore = editingStoreId === item.id;
                  const storeEditSuggs = STORE_DATA
                    .filter(s => !storeEditQuery || s.name.toLowerCase().includes(storeEditQuery.toLowerCase()))
                    .sort((a, b) => a.type !== b.type ? a.type - b.type : a.name.localeCompare(b.name));

                  return (
                  <div key={item.id} className="g-row" style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                    background: item.checked ? '#f8fafc' : 'white',
                    border: '1px solid #f1f5f9', transition: 'background 0.1s',
                  }}>
                    <input type="checkbox" checked={item.checked} onChange={() => toggleChecked(item.id)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }} />

                    {/* Name + optional product link */}
                    <span style={{
                      flex: 1, fontSize: 15,
                      color: item.checked ? '#94a3b8' : '#1e293b',
                      textDecoration: item.checked ? 'line-through' : 'none',
                      fontWeight: item.checked ? 400 : 500,
                      display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
                    }}>
                      {item.productUrl ? (
                        <a href={item.productUrl.startsWith('http') ? item.productUrl : `https://${item.productUrl}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: 'inherit', textDecoration: 'none' }}
                          title="Open product page">
                          {item.name} <span style={{ fontSize: 11, opacity: 0.6 }}>🔗</span>
                        </a>
                      ) : item.name}
                      {item.notes && (
                        <span title={item.notes} style={{ fontSize: 11, color: '#a5b4fc', flexShrink: 0, cursor: 'default' }}>📝</span>
                      )}
                    </span>

                    {(item.qty || item.unit) && (
                      <span style={{
                        background: '#ede9fe', color: '#5b21b6', borderRadius: 20,
                        padding: '2px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                        {[item.qty, item.unit].filter(Boolean).join(' ')}
                      </span>
                    )}

                    {/* Inline store editor chip */}
                    <div style={{ position: 'relative', flexShrink: 0 }} ref={isEditingStore ? storeEditRef : null}>
                      {isEditingStore ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <input
                            autoFocus
                            className="g-input"
                            value={storeEditQuery}
                            onChange={e => setStoreEditQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Escape') { setEditingStoreId(null); setStoreEditQuery(''); } if (e.key === 'Enter' && storeEditQuery.trim()) updateItemStore(item.id, storeEditQuery.trim()); }}
                            placeholder="Store…"
                            style={{ width: 110, padding: '3px 7px', fontSize: 12, height: 26 }}
                          />
                          {storeEditSuggs.length > 0 && (
                            <div style={{
                              position: 'absolute', top: '100%', left: 0, width: 160, marginTop: 2,
                              background: 'white', border: '1px solid #e2e8f0', borderRadius: 6,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 300, maxHeight: 180, overflowY: 'auto',
                            }}>
                              {storeEditSuggs.map(s => (
                                <div key={s.name}
                                  style={{ padding: '6px 10px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, borderBottom: '1px solid #f1f5f9' }}
                                  onMouseDown={() => updateItemStore(item.id, s.name)}
                                  className="g-sugg-item">
                                  <StoreIcon store={s.name} size={14} />
                                  {s.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span
                          title="Click to change store"
                          onClick={() => { setEditingStoreId(item.id); setStoreEditQuery(''); }}
                          className="g-edit-btn"
                          style={{
                            fontSize: 11, color: '#94a3b8', background: '#f1f5f9',
                            borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
                            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                          <StoreIcon store={item.store || 'Uncategorized'} size={12} />
                          {item.store || 'Uncategorized'}
                        </span>
                      )}
                    </div>

                    {item.sourceRecipe && (
                      <span title={`Added from: ${item.sourceRecipe}`} style={{
                        fontSize: 11, color: '#a5b4fc', whiteSpace: 'nowrap', flexShrink: 0,
                        background: '#ede9fe', borderRadius: 4, padding: '1px 6px', fontStyle: 'italic',
                      }}>
                        {item.sourceRecipe}
                      </span>
                    )}

                    {item.addedDate && (
                      <span style={{ fontSize: 11, color: '#cbd5e1', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {item.addedDate}
                      </span>
                    )}

                    {/* Edit button — fades in on row hover via CSS */}
                    <button className="g-edit-btn" onClick={() => setEditingItem(item)} title="Edit item details" style={{
                      background: 'none', border: 'none', color: '#6366f1',
                      fontSize: 14, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0,
                    }}>✏️</button>

                    <button onClick={() => removeItem(item.id)} style={{
                      background: 'none', border: 'none', color: '#cbd5e1',
                      fontSize: 20, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0,
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                    >×</button>
                  </div>
                  );
                })}
              </div>
            );
          })}

          {/* ── Completed items collapsible section ── */}
          {completedItems.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {/* Section header / toggle */}
              <button onClick={() => setCompletedOpen(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                borderBottom: '2px solid #e2e8f0', paddingBottom: 6, marginBottom: completedOpen ? 8 : 0,
              }}>
                <span style={{ fontSize: 16, transition: 'transform 0.2s', display: 'inline-block',
                  transform: completedOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#94a3b8' }}>
                  Completed ({completedItems.length})
                </h3>
                {completedItems.length > 0 && (
                  <button onClick={e => { e.stopPropagation(); clearChecked(); }} style={{
                    marginLeft: 'auto', background: '#fef2f2', color: '#ef4444',
                    border: '1px solid #fecaca', borderRadius: 6,
                    padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                  }}>
                    ✕ Clear all
                  </button>
                )}
              </button>

              {completedOpen && completedItems.map(item => (
                <div key={item.id} className="g-row" style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                  background: '#f8fafc', border: '1px solid #f1f5f9', transition: 'background 0.1s',
                }}>
                  <input type="checkbox" checked={true} onChange={() => toggleChecked(item.id)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }} />

                  <span style={{
                    flex: 1, fontSize: 15, color: '#94a3b8',
                    textDecoration: 'line-through', fontWeight: 400,
                    display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
                  }}>
                    {item.productUrl ? (
                      <a href={item.productUrl.startsWith('http') ? item.productUrl : `https://${item.productUrl}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: 'inherit', textDecoration: 'inherit' }}>
                        {item.name} <span style={{ fontSize: 11, opacity: 0.5 }}>🔗</span>
                      </a>
                    ) : item.name}
                    {item.notes && (
                      <span title={item.notes} style={{ fontSize: 11, color: '#cbd5e1', flexShrink: 0, cursor: 'default' }}>📝</span>
                    )}
                  </span>

                  <span style={{ fontSize: 11, color: '#cbd5e1', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {item.store}
                  </span>

                  {item.sourceRecipe && (
                    <span title={`Added from: ${item.sourceRecipe}`} style={{
                      fontSize: 11, color: '#c4b5fd', whiteSpace: 'nowrap', flexShrink: 0,
                      background: '#f5f3ff', borderRadius: 4, padding: '1px 6px', fontStyle: 'italic',
                    }}>
                      {item.sourceRecipe}
                    </span>
                  )}

                  {(item.qty || item.unit) && (
                    <span style={{
                      background: '#f1f5f9', color: '#94a3b8', borderRadius: 20,
                      padding: '2px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {[item.qty, item.unit].filter(Boolean).join(' ')}
                    </span>
                  )}

                  {item.addedDate && (
                    <span style={{ fontSize: 11, color: '#e2e8f0', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {item.addedDate}
                    </span>
                  )}

                  <button onClick={() => removeItem(item.id)} style={{
                    background: 'none', border: 'none', color: '#e2e8f0',
                    fontSize: 20, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0,
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#e2e8f0'}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
