// ── GroceryTab ───────────────────────────────────────────────────────────────
// Grocery list backed by the same Firebase database as the meal planner.
// Items are stored under mealPlanner/groceryList and grouped by store.

function GroceryTab() {
  const { useState, useEffect, useRef, useMemo } = React;

  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [newItem, setNewItem]       = useState('');
  const [newQty, setNewQty]         = useState('');
  const [newUnit, setNewUnit]       = useState('');
  const [storeInput, setStoreInput] = useState('');
  const [showStoreSugg, setShowStoreSugg] = useState(false);

  const storeRef = useRef(null);
  const db = firebase.database();

  // ── Inject styles ───────────────────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .g-input {
        padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px;
        font-size: 14px; outline: none; box-sizing: border-box; font-family: sans-serif;
        width: 100%;
      }
      .g-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
      .g-row:hover { background: #f8fafc !important; }
      .g-store-sugg:hover { background: #eef2ff !important; cursor: pointer; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ── Close store dropdown on outside click ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (storeRef.current && !storeRef.current.contains(e.target))
        setShowStoreSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Firebase — real-time listener ──────────────────────────────────────────
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

  // ── Known stores for autocomplete ──────────────────────────────────────────
  const knownStores = useMemo(() => {
    return [...new Set(items.map(i => i.store).filter(Boolean))].sort();
  }, [items]);

  const filteredStores = storeInput.trim()
    ? knownStores.filter(s => s.toLowerCase().includes(storeInput.toLowerCase()))
    : knownStores;

  // ── CRUD helpers ────────────────────────────────────────────────────────────
  const saveItems = (updated) => db.ref('mealPlanner/groceryList').set(updated);

  const addItem = () => {
    const name = newItem.trim();
    if (!name) return;
    const item = {
      id: Date.now().toString(),
      name,
      qty: newQty.trim(),
      unit: newUnit.trim(),
      store: storeInput.trim() || 'Other',
      checked: false,
    };
    const updated = [...items, item];
    setItems(updated);
    saveItems(updated);
    setNewItem(''); setNewQty(''); setNewUnit(''); setStoreInput('');
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
      const s = item.store || 'Other';
      if (!map[s]) map[s] = [];
      map[s].push(item);
    });
    return Object.entries(map).sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });
  }, [items]);

  const checkedCount = items.filter(i => i.checked).length;

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

            {/* Item */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 160px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item</label>
              <input className="g-input" value={newItem} onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="e.g. Chicken breast" />
            </div>

            {/* Qty */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 1 75px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</label>
              <input className="g-input" value={newQty} onChange={e => setNewQty(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="2" />
            </div>

            {/* Unit */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 1 110px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unit</label>
              <input className="g-input" value={newUnit} onChange={e => setNewUnit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="lbs, oz, pkg…" />
            </div>

            {/* Store + autocomplete */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 130px', position: 'relative' }} ref={storeRef}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Store</label>
              <input className="g-input" value={storeInput}
                onChange={e => { setStoreInput(e.target.value); setShowStoreSugg(true); }}
                onFocus={() => setShowStoreSugg(true)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="e.g. Costco" />
              {showStoreSugg && filteredStores.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2,
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 200, overflow: 'hidden',
                }}>
                  {filteredStores.map(s => (
                    <div key={s} className="g-store-sugg"
                      style={{ padding: '8px 12px', fontSize: 14, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}
                      onMouseDown={() => { setStoreInput(s); setShowStoreSugg(false); }}>
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
        </div>
      </div>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* Clear checked */}
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

          {/* Empty state */}
          {grouped.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
              <div style={{ fontSize: 16 }}>No items yet — add one above!</div>
            </div>
          )}

          {/* Store groups */}
          {grouped.map(([store, storeItems]) => (
            <div key={store} style={{ marginBottom: 24 }}>

              {/* Store header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: '2px solid #6366f1', paddingBottom: 6, marginBottom: 8,
              }}>
                <span style={{ fontSize: 16 }}>🏪</span>
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
