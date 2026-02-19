// ── GroceryTab ───────────────────────────────────────────────────────────────
// Grocery list backed by the same Firebase DB as the meal planner.
// Stored under mealPlanner/groceryList (active items) and
// mealPlanner/groceryHistory (per-item defaults for autofill).

const UNIT_SUGGESTIONS  = ['lbs', 'pkg', 'cups', 'gallons', 'oz'];
const STORE_SUGGESTIONS = [
  "Sam's Club", 'Costco', 'Kroger', 'HEB', 'Walmart',
  'Grocery', 'Walgreens', 'Pharmacy', 'Amazon', 'Uncategorized'
];

// Derive icon path from store name: strip spaces + punctuation, lowercase
const storeIconSrc = (store) =>
  `res/${store.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;

// Component that renders the store icon with emoji fallback
function StoreIcon({ store, size = 20 }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [store]); // reset if store changes
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

  const [items, setItems]           = useState([]);
  const [history, setHistory]       = useState({});  // { "Item Name": { unit, store } }
  const [loading, setLoading]       = useState(true);

  // Form fields
  const [newItem, setNewItem]   = useState('');
  const [newQty, setNewQty]     = useState('');
  const [newUnit, setNewUnit]   = useState('');
  const [newStore, setNewStore] = useState('');

  // Dropdown visibility
  const [showItemSugg, setShowItemSugg]   = useState(false);
  const [showUnitSugg, setShowUnitSugg]   = useState(false);
  const [showStoreSugg, setShowStoreSugg] = useState(false);

  // Validation
  const [errors, setErrors] = useState({});

  const itemRef  = useRef(null);
  const unitRef  = useRef(null);
  const storeRef = useRef(null);
  const db = firebase.database();

  // ── Inject styles ───────────────────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .g-input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px;
        font-size: 14px; outline: none; box-sizing: border-box; font-family: sans-serif; width: 100%; }
      .g-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
      .g-input.error { border-color: #ef4444; box-shadow: 0 0 0 2px rgba(239,68,68,0.15); }
      .g-row:hover   { background: #f8fafc !important; }
      .g-sugg-item:hover { background: #eef2ff !important; cursor: pointer; }
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

  // ── Firebase: active list (real-time) ──────────────────────────────────────
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

  // ── Firebase: item history (load once) ─────────────────────────────────────
  useEffect(() => {
    db.ref('mealPlanner/groceryHistory').once('value', (snap) => {
      setHistory(snap.val() || {});
    });
  }, []);

  // ── Item autofill suggestions ───────────────────────────────────────────────
  // Names currently unchecked on the active list — excluded from suggestions
  const activeUncheckedNames = useMemo(() => {
    return new Set(items.filter(i => !i.checked).map(i => i.name.toLowerCase()));
  }, [items]);

  const itemSuggestions = useMemo(() => {
    const query = newItem.trim().toLowerCase();
    return Object.keys(history)
      .filter(name => !activeUncheckedNames.has(name.toLowerCase()))
      .filter(name => !query || name.toLowerCase().includes(query))
      .sort();
  }, [history, activeUncheckedNames, newItem]);

  // ── Unit / store filtered suggestions ──────────────────────────────────────
  const filteredUnits = newUnit.trim()
    ? UNIT_SUGGESTIONS.filter(u => u.toLowerCase().startsWith(newUnit.toLowerCase()))
    : UNIT_SUGGESTIONS;

  const filteredStores = newStore.trim()
    ? STORE_SUGGESTIONS.filter(s => s.toLowerCase().includes(newStore.toLowerCase()))
    : STORE_SUGGESTIONS;

  // ── Select an item autofill suggestion ─────────────────────────────────────
  const selectItemSuggestion = (name) => {
    const defaults = history[name] || {};
    setNewItem(name);
    setNewQty('');                           // qty always blank
    setNewUnit(defaults.unit  || '');        // pre-fill unit from last time
    setNewStore(defaults.store || '');       // pre-fill store from last time
    setShowItemSugg(false);
  };

  // ── Save helpers ────────────────────────────────────────────────────────────
  const saveItems   = (updated) => db.ref('mealPlanner/groceryList').set(updated);
  const saveHistory = (updated) => db.ref('mealPlanner/groceryHistory').set(updated);

  // ── Add item ────────────────────────────────────────────────────────────────
  const addItem = () => {
    const errs = {};
    if (!newItem.trim()) errs.item = true;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    const now   = new Date();
    const MMM   = now.toLocaleDateString('en-US', { month: 'short' });
    const mmdd  = `${MMM}-${String(now.getDate()).padStart(2, '0')}`;
    const store = newStore.trim() || 'Uncategorized';
    const unit  = newUnit.trim();
    const name  = newItem.trim();

    const item = {
      id:      Date.now().toString(),
      name,
      qty:     newQty.trim(),
      unit,
      store,
      checked: false,
      addedDate: mmdd,
    };

    // Update active list
    const updatedItems = [...items, item];
    setItems(updatedItems);
    saveItems(updatedItems);

    // Update history — store last-used unit + store for this item name
    const updatedHistory = { ...history, [name]: { unit, store } };
    setHistory(updatedHistory);
    saveHistory(updatedHistory);

    setNewItem(''); setNewQty(''); setNewUnit(''); setNewStore('');
  };

  const toggleChecked = (id) => {
    const updated = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i);
    setItems(updated);
    saveItems(updated);
  };

  const removeItem = (id) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    saveItems(updated);
  };

  const clearChecked = () => {
    const updated = items.filter(i => !i.checked);
    setItems(updated);
    saveItems(updated);
  };

  // ── Group by store ──────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = {};
    items.forEach(item => {
      const s = item.store || 'Uncategorized';
      if (!map[s]) map[s] = [];
      map[s].push(item);
    });
    return Object.entries(map).sort(([a], [b]) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
  }, [items]);

  const checkedCount = items.filter(i => i.checked).length;

  const dropdownStyle = {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2,
    background: 'white', border: '1px solid #e2e8f0', borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 200, overflow: 'hidden',
    maxHeight: 180, overflowY: 'auto',
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
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

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc', boxSizing: 'border-box' }}>

      {/* ── Add Item Form ──────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>🛒 Grocery List</h2>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {/* Item — required, with history autofill */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 160px', position: 'relative' }} ref={itemRef}>
              <label style={{ fontSize: 11, fontWeight: 600, color: errors.item ? '#ef4444' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Item <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                className={`g-input${errors.item ? ' error' : ''}`}
                value={newItem}
                onChange={e => { setNewItem(e.target.value); setShowItemSugg(true); if (errors.item) setErrors(p => ({ ...p, item: false })); }}
                onFocus={() => setShowItemSugg(true)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="e.g. Chicken breast"
              />
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

            {/* Qty — optional, numeric only */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 1 75px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</label>
              <input
                className="g-input"
                value={newQty}
                onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setNewQty(v); }}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="2"
                inputMode="decimal"
              />
            </div>

            {/* Unit — optional, preset suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 1 110px', position: 'relative' }} ref={unitRef}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unit</label>
              <input
                className="g-input"
                value={newUnit}
                onChange={e => { setNewUnit(e.target.value); setShowUnitSugg(true); }}
                onFocus={() => setShowUnitSugg(true)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="lbs, oz…"
              />
              {showUnitSugg && filteredUnits.length > 0 && (
                <div style={dropdownStyle}>
                  {filteredUnits.map(u => (
                    <div key={u} className="g-sugg-item"
                      style={{ padding: '8px 12px', fontSize: 14, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}
                      onMouseDown={() => { setNewUnit(u); setShowUnitSugg(false); }}>
                      {u}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Store — optional (defaults to Uncategorized), preset suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', position: 'relative' }} ref={storeRef}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Store</label>
              <input
                className="g-input"
                value={newStore}
                onChange={e => { setNewStore(e.target.value); setShowStoreSugg(true); }}
                onFocus={() => setShowStoreSugg(true)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="Uncategorized"
              />
              {showStoreSugg && filteredStores.length > 0 && (
                <div style={dropdownStyle}>
                  {filteredStores.map(s => (
                    <div key={s} className="g-sugg-item"
                      style={{ padding: '8px 12px', fontSize: 14, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}
                      onMouseDown={() => { setNewStore(s); setShowStoreSugg(false); }}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add button */}
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

          {grouped.map(([store, storeItems]) => (
            <div key={store} style={{ marginBottom: 24 }}>

              {/* Store header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: '2px solid #6366f1', paddingBottom: 6, marginBottom: 8,
              }}>
                <StoreIcon store={store} size={20} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#312e81' }}>{store}</h3>
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
                  border: '1px solid #f1f5f9',
                  transition: 'background 0.1s',
                }}>
                  <input type="checkbox" checked={item.checked} onChange={() => toggleChecked(item.id)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#6366f1', flexShrink: 0 }} />

                  <span style={{
                    flex: 1, fontSize: 15,
                    color: item.checked ? '#94a3b8' : '#1e293b',
                    textDecoration: item.checked ? 'line-through' : 'none',
                    fontWeight: item.checked ? 400 : 500,
                  }}>
                    {item.name}
                  </span>

                  {(item.qty || item.unit) && (
                    <span style={{
                      background: '#ede9fe', color: '#5b21b6', borderRadius: 20,
                      padding: '2px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {[item.qty, item.unit].filter(Boolean).join(' ')}
                    </span>
                  )}

                  {/* Date added */}
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
          ))}
        </div>
      </div>
    </div>
  );
}
