// ── GroceryTab ───────────────────────────────────────────────────────────────
// Grocery list backed by the same Firebase DB as the meal planner.
// Stored under mealPlanner/groceryList (active items) and
// mealPlanner/groceryHistory (per-item defaults for autofill).

const UNIT_SUGGESTIONS = ['lbs', 'pkg', 'cups', 'gallons', 'oz'];

// type: 1 = grocery store, 2 = non-grocery retailer, 3 = generic/uncategorized
// Suggestion dropdown is sorted by type ASC then name ASC.
// The grouped list on the page uses the same sort order.
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

// Look up metadata for any store name (custom names not in STORE_DATA get type 2)
const getStoreMeta = (name) =>
  STORE_DATA.find(s => s.name.toLowerCase() === name.toLowerCase()) ||
  { name, url: '', type: 2 };

// Compare two store names for the shared sort order
const compareStores = (a, b) => {
  const ta = getStoreMeta(a).type;
  const tb = getStoreMeta(b).type;
  if (ta !== tb) return ta - tb;
  return a.localeCompare(b);
};

// Derive icon path from store name: strip non-alphanumeric, lowercase
const storeIconSrc = (store) =>
  `res/${store.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;

// Icon with emoji fallback
function StoreIcon({ store, size = 24 }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [store]);
  if (failed) return <span style={{ fontSize: size }}>🏪</span>;
  return (
    <img
      src={storeIconSrc(store)}
      alt=""
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

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
      .store-header-link { text-decoration: none; display: flex; align-items: center; gap: 8px; }
      .store-header-link:hover h3 { text-decoration: underline; }
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
      const arr = Array.isArray(val)
        ? val.filter(Boolean)
        : Object.values(val).filter(Boolean);
      setItems(arr);
      setLoading(false);
    });
    return () => ref.off();
  }, []);

  // ── Firebase: item history ──────────────────────────────────────────────────
  useEffect(() => {
    db.ref('mealPlanner/groceryHistory').once('value', (snap) => {
      setHistory(snap.val() || {});
    });
  }, []);

  // ── Item autofill suggestions ───────────────────────────────────────────────
  const activeUncheckedNames = useMemo(() =>
    new Set(items.filter(i => !i.checked).map(i => i.name.toLowerCase())),
  [items]);

  const itemSuggestions = useMemo(() => {
    const q = newItem.trim().toLowerCase();
    return Object.keys(history)
      .filter(n => !activeUncheckedNames.has(n.toLowerCase()))
      .filter(n => !q || n.toLowerCase().includes(q))
      .sort();
  }, [history, activeUncheckedNames, newItem]);

  // ── Store / unit filtered suggestions ──────────────────────────────────────
  const filteredUnits = newUnit.trim()
    ? UNIT_SUGGESTIONS.filter(u => u.toLowerCase().startsWith(newUnit.toLowerCase()))
    : UNIT_SUGGESTIONS;

  // Store suggestions: sorted by type then alpha, filtered by query
  const filteredStores = useMemo(() => {
    const q = newStore.trim().toLowerCase();
    return STORE_DATA
      .filter(s => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.type !== b.type ? a.type - b.type : a.name.localeCompare(b.name));
  }, [newStore]);

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
    const name  = newItem.trim();

    const item = { id: Date.now().toString(), name, qty: newQty.trim(), unit, store, checked: false, addedDate: mmdd };

    const updatedItems   = [...items, item];
    const updatedHistory = { ...history, [name]: { unit, store } };

    setItems(updatedItems);   saveItems(updatedItems);
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

  // ── Group by store, sorted by type then alpha ───────────────────────────────
  const grouped = useMemo(() => {
    const map = {};
    items.forEach(item => {
      const s = item.store || 'Uncategorized';
      if (!map[s]) map[s] = [];
      map[s].push(item);
    });
    return Object.entries(map).sort(([a], [b]) => compareStores(a, b));
  }, [items]);

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

      {/* ── Add Item Form ──────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>🛒 Grocery List</h2>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {/* Item — required, history autofill */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 160px', position: 'relative' }} ref={itemRef}>
              <label style={{ fontSize: 11, fontWeight: 600, color: errors.item ? '#ef4444' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Item <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input className={`g-input${errors.item ? ' error' : ''}`} value={newItem}
                onChange={e => { setNewItem(e.target.value); setShowItemSugg(true); if (errors.item) setErrors({}); }}
                onFocus={() => setShowItemSugg(true)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="e.g. Chicken breast" />
              {showItemSugg && itemSuggestions.length > 0 && (
                <div style={dropdownStyle}>
                  {itemSuggestions.map(name => (
                    <div key={name} className="g-sugg-item"
                      style={{ padding: '7px 12px', fontSize: 14, color: '#1e293b', borderBottom: '1px solid #f1f5f9',
                               display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                      onMouseDown={() => selectItemSuggestion(name)}>
                      <span>{name}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {[history[name]?.unit, history[name]?.store].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Qty — numeric only */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 1 75px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</label>
              <input className="g-input" value={newQty} inputMode="decimal"
                onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setNewQty(v); }}
                onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="2" />
            </div>

            {/* Unit — preset suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 1 110px', position: 'relative' }} ref={unitRef}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unit</label>
              <input className="g-input" value={newUnit}
                onChange={e => { setNewUnit(e.target.value); setShowUnitSugg(true); }}
                onFocus={() => setShowUnitSugg(true)}
                onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="lbs, oz…" />
              {showUnitSugg && filteredUnits.length > 0 && (
                <div style={dropdownStyle}>
                  {filteredUnits.map(u => (
                    <div key={u} className="g-sugg-item"
                      style={{ padding: '8px 12px', fontSize: 14, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}
                      onMouseDown={() => { setNewUnit(u); setShowUnitSugg(false); }}>{u}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Store — optional, preset + type-sorted suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', position: 'relative' }} ref={storeRef}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Store</label>
              <input className="g-input" value={newStore}
                onChange={e => { setNewStore(e.target.value); setShowStoreSugg(true); }}
                onFocus={() => setShowStoreSugg(true)}
                onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="Uncategorized" />
              {showStoreSugg && filteredStores.length > 0 && (
                <div style={dropdownStyle}>
                  {filteredStores.map(s => (
                    <div key={s.name} className="g-sugg-item"
                      style={{ padding: '8px 12px', fontSize: 14, color: '#1e293b', borderBottom: '1px solid #f1f5f9',
                               display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseDown={() => { setNewStore(s.name); setShowStoreSugg(false); }}>
                      <StoreIcon store={s.name} size={16} />
                      <span style={{ flex: 1 }}>{s.name}</span>
                      {s.url && <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.url}</span>}
                    </div>
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

          {checkedCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={clearChecked} style={{
                background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca',
                borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
              }}>
                ✕ Remove {checkedCount} checked item{checkedCount !== 1 ? 's' : ''}
              </button>
            </div>
          )}

          {grouped.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
              <div style={{ fontSize: 16 }}>No items yet — add one above!</div>
            </div>
          )}

          {grouped.map(([store, storeItems]) => {
            const meta    = getStoreMeta(store);
            const hasLink = !!meta.url;
            // Icon + label — optionally wrapped in an <a> if we have a URL
            const StoreHeaderContent = () => (
              <>
                <StoreIcon store={store} size={24} />
                <h3 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: '#312e81' }}>{store}</h3>
              </>
            );

            return (
              <div key={store} style={{ marginBottom: 24 }}>
                {/* Store header */}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StoreHeaderContent />
                    </div>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                    {storeItems.filter(i => !i.checked).length} / {storeItems.length} remaining
                  </span>
                </div>

                {/* Items */}
                {storeItems.map(item => (
                  <div key={item.id} className="g-row" style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                    background: item.checked ? '#f8fafc' : 'white',
                    border: '1px solid #f1f5f9', transition: 'background 0.1s',
                  }}>
                    <input type="checkbox" checked={item.checked} onChange={() => toggleChecked(item.id)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }} />

                    <span style={{
                      flex: 1, fontSize: 15,
                      color: item.checked ? '#94a3b8' : '#1e293b',
                      textDecoration: item.checked ? 'line-through' : 'none',
                      fontWeight: item.checked ? 400 : 500,
                    }}>{item.name}</span>

                    {(item.qty || item.unit) && (
                      <span style={{
                        background: '#ede9fe', color: '#5b21b6', borderRadius: 20,
                        padding: '2px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                        {[item.qty, item.unit].filter(Boolean).join(' ')}
                      </span>
                    )}

                    {item.addedDate && (
                      <span style={{ fontSize: 11, color: '#cbd5e1', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {item.addedDate}
                      </span>
                    )}

                    <button onClick={() => removeItem(item.id)} style={{
                      background: 'none', border: 'none', color: '#cbd5e1',
                      fontSize: 20, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0,
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                    >×</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
