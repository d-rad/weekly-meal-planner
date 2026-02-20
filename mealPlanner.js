const { useState, useEffect, useRef } = React;
/* TODO:
	- scroll bar hitching
	- make ingredients a list section with quantities rather than free text input
	- "add to groceries list" item next to each ingredient in recipe
*/
// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAs7AWHtgNMWOrqYdaAguVOoxQq57RJ0r8",
  authDomain: "weekly-meal-p.firebaseapp.com",
  databaseURL: "https://weekly-meal-p-default-rtdb.firebaseio.com",
  projectId: "weekly-meal-p",
  storageBucket: "weekly-meal-p.firebasestorage.app",
  messagingSenderId: "1023198527324",
  appId: "1:1023198527324:web:6097ad91face472a2bcb99",
  measurementId: "G-W9HLPQF9VT"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

const pickerStyles = `
  .picker-scroll::-webkit-scrollbar {
    width: 8px;
  }
  .picker-scroll::-webkit-scrollbar-track {
    background: #f3f4f6;
    border-radius: 4px;
  }
  .picker-scroll::-webkit-scrollbar-thumb {
    background: #9ca3af;
    border-radius: 4px;
  }
  .picker-scroll::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
`;

let suppressHistoryFocus = false;

// ---- PickerWheel component ----
function PickerWheel({ value, onChange, min = 0, max = 720, step = 5, label = '' }) {
  const containerRef = React.useRef(null);
  const contentRef = React.useRef(null);

  // Build [0, 5, 10, ..., 720]
  const options = React.useMemo(() => {
    const arr = [];
    for (let v = min; v <= max; v += step) arr.push(v);
    return arr;
  }, [min, max, step]);

  const OPTION_HEIGHT = 32;              // height of a single row, in px
  const VISIBLE_ROWS = 3;                // show exactly 3 at a time
  const WHEEL_HEIGHT = OPTION_HEIGHT * VISIBLE_ROWS;

  // Find selected index
  const selectedIndex = Math.max(0, options.indexOf(Number(value)));

  // Center the current value on mount / when value changes
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = options.indexOf(Number(value));
    if (idx < 0) return;

    // Calculate scroll position to center the selected option
    const targetTop = idx * OPTION_HEIGHT;
    el.scrollTo({ top: targetTop, behavior: 'auto' });
  }, [value, options, OPTION_HEIGHT]);

  const snapToIndex = (rawIdx) => {
    const el = containerRef.current;
    if (!el) return;

    const maxIndex = options.length - 1;
    const idx = Math.max(0, Math.min(rawIdx, maxIndex));

    const snappedValue = options[idx];
    if (snappedValue !== Number(value)) {
      onChange(snappedValue);
    }

    const targetTop = idx * OPTION_HEIGHT;
    el.scrollTo({ top: targetTop, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    if (el._timeout) clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
      const idx = Math.round(el.scrollTop / OPTION_HEIGHT);
      snapToIndex(idx);
    }, 80);
  };

  const tapSelect = (targetIdx) => {
    snapToIndex(targetIdx);
  };

  return (
    <div style={{ width: '100%', marginBottom: 14 }}>
      {label && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 6,
            color: '#374151'
          }}
        >
          {label}
        </div>
      )}

      <div
        style={{
          height: WHEEL_HEIGHT,
          overflow: 'hidden',
          position: 'relative',
          borderRadius: 8,
          border: '1px solid #d1d5db',
          background: 'white',
        }}
      >
        {/* center highlight band */}
        <div
          style={{
            position: 'absolute',
            top: OPTION_HEIGHT,
            left: '10%',
            right: '10%',
            height: OPTION_HEIGHT,
            background: 'rgba(99,102,241,0.15)',
            borderRadius: 12,
            pointerEvents: 'none',
            zIndex: 2
          }}
        />

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="picker-scroll"
          style={{
            height: '100%',
            overflowY: 'scroll',
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div
            ref={contentRef}
            style={{
              paddingTop: OPTION_HEIGHT,
              paddingBottom: OPTION_HEIGHT
            }}
          >
            {options.map((opt, idx) => {
              const isSelected = opt === Number(value);
              const isAbove = idx === selectedIndex - 1;
              const isBelow = idx === selectedIndex + 1;

              return (
                <div
                  key={opt}
                  style={{
                    height: OPTION_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none',
                    fontSize: isSelected ? 18 : 15,
                    fontWeight: isSelected ? 700 : 400,
                    color: isSelected ? '#111827' : '#6b7280',
                    opacity: isSelected ? 1 : 0.75,
                    scrollSnapAlign: 'center',
                    cursor: (isAbove || isBelow) ? 'pointer' : 'default'
                  }}
                  onClick={() => {
                    if (isAbove) tapSelect(selectedIndex - 1);
                    if (isBelow) tapSelect(selectedIndex + 1);
                  }}
                >
                  {opt} min
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- end PickerWheel ----

// ── Recipe Ingredients Editor ────────────────────────────────────────────────
const RECIPE_UNIT_SUGGESTIONS = ['lbs', 'oz', 'pkg', 'cups', 'gallons', 'tsp', 'tbsp', 'cloves', 'slices', 'cans'];

function RecipeIngredientsEditor({ ingredients, onChange, groceryHistory, onAddToGrocery }) {
  const [addedSet, setAddedSet] = React.useState(new Set());
  const [dropState, setDropState] = React.useState({});
  const rowRefs = React.useRef({});

  const setRowDrop = (idx, patch) =>
    setDropState(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), ...patch } }));

  // Close dropdowns when clicking outside any row
  React.useEffect(() => {
    const handler = (e) => {
      Object.entries(rowRefs.current).forEach(([idx, ref]) => {
        if (ref && !ref.contains(e.target))
          setRowDrop(Number(idx), { showUnit: false, showItem: false });
      });
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const rows = (ingredients && ingredients.length) ? ingredients : [{ qty: '', unit: '', item: '' }];

  const updateRow = (idx, field, value) =>
    onChange(rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const addRow = () => onChange([...rows, { qty: '', unit: '', item: '' }]);

  const removeRow = (idx) => {
    if (rows.length === 1) { onChange([{ qty: '', unit: '', item: '' }]); return; }
    onChange(rows.filter((_, i) => i !== idx));
    // Shift addedSet indexes down
    setAddedSet(prev => {
      const s = new Set();
      prev.forEach(i => { if (i < idx) s.add(i); else if (i > idx) s.add(i - 1); });
      return s;
    });
  };

  const handleAddToGrocery = (idx) => {
    const row = rows[idx];
    if (!row.item.trim()) return;
    onAddToGrocery(row);
    setAddedSet(prev => new Set([...prev, idx]));
    setTimeout(() => setAddedSet(prev => { const s = new Set(prev); s.delete(idx); return s; }), 2500);
  };

  const inputStyle = { padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', width: '100%' };
  const dropStyle = { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 400, maxHeight: 150, overflowY: 'auto' };

  return (
    <div>
      {rows.map((row, idx) => {
        const ds = dropState[idx] || {};
        const unitSuggs = row.unit.trim()
          ? RECIPE_UNIT_SUGGESTIONS.filter(u => u.toLowerCase().startsWith(row.unit.toLowerCase()))
          : RECIPE_UNIT_SUGGESTIONS;
        const itemSuggs = Object.keys(groceryHistory || {})
          .filter(n => !row.item.trim() || n.toLowerCase().includes(row.item.toLowerCase()))
          .sort().slice(0, 10);
        const wasAdded = addedSet.has(idx);

        return (
          <div key={idx} ref={el => rowRefs.current[idx] = el}
            style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5 }}>

            {/* Qty */}
            <input value={row.qty} inputMode="decimal" placeholder="Qty"
              onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateRow(idx, 'qty', v); }}
              style={{ ...inputStyle, width: 55, flexShrink: 0 }} />

            {/* Unit with suggestions */}
            <div style={{ position: 'relative', width: 85, flexShrink: 0 }}>
              <input value={row.unit} placeholder="Unit"
                onChange={e => { updateRow(idx, 'unit', e.target.value); setRowDrop(idx, { showUnit: true, unitHl: -1 }); }}
                onFocus={() => setRowDrop(idx, { showUnit: true })}
                onKeyDown={e => {
                  const len = unitSuggs.length, hl = ds.unitHl ?? -1;
                  if (e.key === 'ArrowDown' && ds.showUnit) { e.preventDefault(); setRowDrop(idx, { unitHl: Math.min(hl+1,len-1) }); }
                  else if (e.key === 'ArrowUp' && ds.showUnit) { e.preventDefault(); setRowDrop(idx, { unitHl: Math.max(hl-1,0) }); }
                  else if ((e.key === 'Tab' || e.key === 'Enter') && ds.showUnit && hl >= 0) { e.preventDefault(); updateRow(idx, 'unit', unitSuggs[hl]); setRowDrop(idx, { showUnit: false, unitHl: -1 }); }
                  else if (e.key === 'Escape') setRowDrop(idx, { showUnit: false });
                }}
                style={inputStyle} />
              {ds.showUnit && unitSuggs.length > 0 && (
                <div style={dropStyle}>
                  {unitSuggs.map((u, i) => (
                    <div key={u} style={{ padding: '5px 9px', fontSize: 12, cursor: 'pointer', background: i === (ds.unitHl ?? -1) ? '#e0e7ff' : 'white', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={() => setRowDrop(idx, { unitHl: i })}
                      onMouseDown={() => { updateRow(idx, 'unit', u); setRowDrop(idx, { showUnit: false, unitHl: -1 }); }}>
                      {u}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Item with suggestions */}
            <div style={{ position: 'relative', flex: 1 }}>
              <input value={row.item} placeholder="Ingredient *"
                onChange={e => { updateRow(idx, 'item', e.target.value); setRowDrop(idx, { showItem: true, itemHl: -1 }); }}
                onFocus={() => setRowDrop(idx, { showItem: true })}
                onKeyDown={e => {
                  const len = itemSuggs.length, hl = ds.itemHl ?? -1;
                  if (e.key === 'ArrowDown' && ds.showItem) { e.preventDefault(); setRowDrop(idx, { itemHl: Math.min(hl+1,len-1) }); }
                  else if (e.key === 'ArrowUp' && ds.showItem) { e.preventDefault(); setRowDrop(idx, { itemHl: Math.max(hl-1,0) }); }
                  else if ((e.key === 'Tab' || e.key === 'Enter') && ds.showItem && hl >= 0) { e.preventDefault(); updateRow(idx, 'item', itemSuggs[hl]); setRowDrop(idx, { showItem: false, itemHl: -1 }); }
                  else if (e.key === 'Escape') setRowDrop(idx, { showItem: false });
                }}
                style={{ ...inputStyle, borderColor: '#d1d5db' }} />
              {ds.showItem && itemSuggs.length > 0 && (
                <div style={dropStyle}>
                  {itemSuggs.map((n, i) => (
                    <div key={n} style={{ padding: '5px 9px', fontSize: 12, cursor: 'pointer', background: i === (ds.itemHl ?? -1) ? '#e0e7ff' : 'white', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={() => setRowDrop(idx, { itemHl: i })}
                      onMouseDown={() => { updateRow(idx, 'item', n); setRowDrop(idx, { showItem: false, itemHl: -1 }); }}>
                      {n}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add to grocery */}
            <button title={wasAdded ? 'Added!' : 'Add to grocery list'} onClick={() => handleAddToGrocery(idx)}
              disabled={!row.item.trim()}
              style={{ width: 28, height: 28, borderRadius: 6, border: 'none', flexShrink: 0,
                background: wasAdded ? '#22c55e' : (row.item.trim() ? '#6366f1' : '#e5e7eb'),
                color: 'white', fontSize: 15, cursor: row.item.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
              {wasAdded ? '✓' : '+'}
            </button>

            {/* Remove row */}
            <button onClick={() => removeRow(idx)}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>×</button>
          </div>
        );
      })}
      <button onClick={addRow}
        style={{ marginTop: 6, width: '100%', background: 'none', border: '1px dashed #d1d5db',
          borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
        + Add ingredient
      </button>
    </div>
  );
}
// ── end RecipeIngredientsEditor ──────────────────────────────────────────────

function MealPlanner() {

	  // Inject picker styles
  React.useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      .picker-scroll::-webkit-scrollbar {
        width: 8px;
      }
      .picker-scroll::-webkit-scrollbar-track {
        background: #f3f4f6;
        border-radius: 4px;
      }
      .picker-scroll::-webkit-scrollbar-thumb {
        background: #9ca3af;
        border-radius: 4px;
      }
      .picker-scroll::-webkit-scrollbar-thumb:hover {
        background: #6b7280;
      }
    `;
    document.head.appendChild(styleTag);
    return () => document.head.removeChild(styleTag);
  }, []);

	// Mobile responsive layout
	React.useEffect(() => {
	  const styleTag = document.createElement("style");
	  styleTag.textContent = `
		/* portrait mobile */
		@media (max-width: 768px) {
		  .main-layout {
			flex-direction: column !important;
			height: auto !important;
		  }
		  .left-col, .right-col {
			width: 100% !important;
			min-width: 0 !important;
		  }
		}
		/* landscape mobile */
		@media (max-height: 500px) {
		  .main-layout {
			flex-direction: column !important;
			height: auto !important;
		  }

		  .left-col,
		  .right-col {
			width: 100% !important;
			min-width: 0 !important;
		  }
		}
	  `;
	  document.head.appendChild(styleTag);
	  return () => document.head.removeChild(styleTag);
	}, []);


  // Helper: convert to Start Case / Title Case
  const toStartCase = (str) => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

	  // Parse a variety of time strings into minutes (number)
  const parseTimeToMinutes = (input) => {
    if (input === null || input === undefined) return 0;
    if (typeof input === 'number') return input;
    let s = String(input).trim().toLowerCase();

    // common formats:
    // "45", "45m", "45 min", "45 minutes", "1:15", "1h 15m", "1 hr 15 min"
    // try "HH:MM"
    const hhmm = s.match(/^(\d{1,2}):(\d{1,2})$/);
    if (hhmm) {
      const h = parseInt(hhmm[1], 10);
      const m = parseInt(hhmm[2], 10);
      return h * 60 + m;
    }

    // match hours and minutes text
    const hrMatch = s.match(/(\d+)\s*h/);
    const minMatch = s.match(/(\d+)\s*m/);
    if (hrMatch || minMatch) {
      const hrs = hrMatch ? parseInt(hrMatch[1], 10) : 0;
      const mins = minMatch ? parseInt(minMatch[1], 10) : 0;
      return hrs * 60 + mins;
    }

    // plain number in minutes e.g. "45" or "45 minutes"
    const numMatch = s.match(/(\d+)/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }

    return 0;
  };


  const [currentWeek, setCurrentWeek] = useState([
    { day: 'Sunday', meal: 'blame ai' },
    { day: 'Monday', meal: 'Uh Oh' },
    { day: 'Tuesday', meal: 'You should never see this' },
    { day: 'Wednesday', meal: 'looks like I made' },
    { day: 'Thursday', meal: 'stinky in my pants' },
    { day: 'Friday', meal: 'sowwy :3' },
    { day: 'Saturday', meal: 'im just a baby' }    
  ]);

  const [ideas, setIdeas] = useState([]);
  const [lunchPrep, setLunchPrep] = useState([]);
  const [mealHistory, setMealHistory] = useState([]);
  const [lunchHistory, setLunchHistory] = useState([]);
  const [recipes, setRecipes] = useState({});
  const [lunchRecipes, setLunchRecipes] = useState({});
  const [groceryHistory, setGroceryHistory] = useState({});
  const [currentRecipeType, setCurrentRecipeType] = useState('dinner');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyMode, setHistoryMode] = useState('dinner'); 
  const [historySearch, setHistorySearch] = useState('');
  const [returnToHistoryOnClose, setReturnToHistoryOnClose] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState(null);
  const [toastMessage, setToastMessage] = useState("");



  const [newIdea, setNewIdea] = useState('');
  const [newLunchItem, setNewLunchItem] = useState('');

  const isTouchDevice = (typeof window !== 'undefined') && (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );

  // desktop drag states
  const [draggedIdea, setDraggedIdea] = useState(null);
  const [draggedIdeaIndex, setDraggedIdeaIndex] = useState(null);

  // placement mode (long-press)
  const [selectedIdeaForPlacement, setSelectedIdeaForPlacement] = useState(null);
  const [selectedIdeaIndexForPlacement, setSelectedIdeaIndexForPlacement] = useState(null);

  // Recipe modal state
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [currentRecipeMeal, setCurrentRecipeMeal] = useState('');
  const [currentRecipe, setCurrentRecipe] = useState({
	cookTime: '',
    prepTime: '',
    protein: '',
    ingredients: [],
    instructions: '',
	servings: 0
  });

  const longPressTimer = useRef(null);

  const inputRefs = React.useRef([]);
  const suggestionsRef = React.useRef(null);
  const lunchSuggestionsRef = React.useRef(null);

  const [dataLoaded, setDataLoaded] = useState({
    week: false,
    ideas: false,
    lunch: false,
    history: false,
    lunchHistory: false,
    recipes: false,
	lunchRecipes: false
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  
  const [showLunchSuggestions, setShowLunchSuggestions] = useState(false);
  const [filteredLunchSuggestions, setFilteredLunchSuggestions] = useState([]);

  const handleDragEnd = () => {
    setDraggedIdea(null);
    setDraggedIdeaIndex(null);
  };

  const allLoaded = dataLoaded.week && dataLoaded.ideas && dataLoaded.lunch && 
                    dataLoaded.history && dataLoaded.lunchHistory && dataLoaded.recipes && dataLoaded.lunchRecipes;

  // Convert Firebase object into array (robust)
  const objectToArray = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) {
      return obj.filter((item) => item !== null && item !== undefined && item !== '');
    }
    return Object.values(obj).filter((item) => item !== null && item !== undefined && item !== '');
  };

  // Add meal to history with case-insensitive duplicate prevention
  const addToMealHistory = (meal) => {
    if (!meal || meal.trim() === '') return;
    
    const trimmedMeal = meal.trim();
    const startCaseMeal = toStartCase(trimmedMeal);
    const cleanHistory = mealHistory.filter(item => item !== null && item !== undefined && item !== '');
    
    const existsInHistory = cleanHistory.some(item => item.toLowerCase() === startCaseMeal.toLowerCase());
    if (existsInHistory) return;
    
    const updatedHistory = [...cleanHistory, startCaseMeal];
    setMealHistory(updatedHistory);
    database.ref('mealPlanner/mealHistory').set(updatedHistory);
  };

  // Add lunch item to history
  const addToLunchHistory = (item) => {
    if (!item || item.trim() === '') return;
    
    const trimmedItem = item.trim();
    const startCaseItem = toStartCase(trimmedItem);
    const cleanHistory = lunchHistory.filter(i => i !== null && i !== undefined && i !== '');
    
    const existsInHistory = cleanHistory.some(i => i.toLowerCase() === startCaseItem.toLowerCase());
    if (existsInHistory) return;
    
    const updatedHistory = [...cleanHistory, startCaseItem];
    setLunchHistory(updatedHistory);
    database.ref('mealPlanner/lunchHistory').set(updatedHistory);
  };
 
// toast message
const showToast = (msg) => {
  setToastMessage(msg);
  setTimeout(() => setToastMessage(""), 1800);
};


// Firebase key sanitizer — forbidden chars: . $ # [ ] /
const toHistoryKey = (name) => name.replace(/[.$#[\]/]/g, '_');

// Helper: parse legacy string ingredients OR ensure array format
const parseIngredients = (raw) => {
  if (!raw) return [{ qty: '', unit: '', item: '' }];
  if (Array.isArray(raw)) return raw.length ? raw : [{ qty: '', unit: '', item: '' }];
  // Legacy freeform string — each line becomes an item row
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [{ qty: '', unit: '', item: '' }];
  return lines.map(line => ({ qty: '', unit: '', item: line }));
};

// Add a single ingredient row to the shared grocery list
const addIngredientToGrocery = (row) => {
  if (!row.item.trim()) return;
  const name = toStartCase(row.item.trim());
  const now = new Date();
  const mmdd = `${now.toLocaleDateString('en-US', { month: 'short' })}-${String(now.getDate()).padStart(2, '0')}`;
  const prev = groceryHistory[toHistoryKey(name)] || {};

  database.ref('mealPlanner/groceryList').once('value', snap => {
    const val = snap.val();
    const current = val
      ? (Array.isArray(val) ? val.filter(Boolean) : Object.values(val).filter(Boolean))
      : [];

    const newItem = {
      id: Date.now().toString(),
      name,
      qty: row.qty || '',
      unit: row.unit || '',
      store: prev.store || 'Uncategorized',
      checked: false,
      addedDate: mmdd,
      sourceRecipe: currentRecipeMeal,
      productUrl: prev.productUrl || '',
      notes: prev.notes || '',
    };

    database.ref('mealPlanner/groceryList').set([...current, newItem]);

    // Update history — preserve existing unit/store if we have them, otherwise use recipe row values
    const updatedHistory = {
      ...groceryHistory,
      [toHistoryKey(name)]: {
        displayName: name,
        unit: prev.unit || row.unit || '',
        store: prev.store || 'Uncategorized',
        productUrl: prev.productUrl || '',
        notes: prev.notes || '',
      }
    };
    setGroceryHistory(updatedHistory);
    database.ref('mealPlanner/groceryHistory').set(updatedHistory);
    showToast(`${name} added to grocery list`);
  });
};

// Open recipe modal for a specific meal
const openRecipeModal = (mealName, type = 'dinner') => {
  if (!mealName || !mealName.trim()) return;
  
  const normalizedName = toStartCase(mealName.trim());
  setCurrentRecipeMeal(normalizedName);
  setCurrentRecipeType(type); // Track type
  
  // Load existing recipe based on type
  const recipeSource = type === 'lunch' ? lunchRecipes : recipes;
  const existingRecipe = recipeSource[normalizedName] || {
    cookTime: '',
    prepTime: '',
    protein: '',
    ingredients: [],
    instructions: '',
	servings: 0
  };
  setCurrentRecipe({ ...existingRecipe, ingredients: parseIngredients(existingRecipe.ingredients) });
  setShowRecipeModal(true);
};

// Save recipe
const saveRecipe = () => {
  if (!currentRecipeMeal) return;
  
  if (currentRecipeType === 'lunch') {
    const updatedRecipes = {
      ...lunchRecipes,
      [currentRecipeMeal]: currentRecipe
    };
    setLunchRecipes(updatedRecipes);
    database.ref('mealPlanner/lunchRecipes').set(updatedRecipes);
  } else {
    const updatedRecipes = {
      ...recipes,
      [currentRecipeMeal]: currentRecipe
    };
    setRecipes(updatedRecipes);
    database.ref('mealPlanner/recipes').set(updatedRecipes);
  }

  // Auto-create groceryHistory entries for any ingredients not yet known
  const rows = Array.isArray(currentRecipe.ingredients) ? currentRecipe.ingredients : [];
  let historyChanged = false;
  const updatedGroceryHistory = { ...groceryHistory };
  rows.forEach(row => {
    if (!row.item || !row.item.trim()) return;
    const name = toStartCase(row.item.trim());
    if (!updatedGroceryHistory[toHistoryKey(name)]) {
      // Brand new ingredient — seed a default history entry
      updatedGroceryHistory[toHistoryKey(name)] = {
        displayName: name,
        unit: row.unit || '',
        store: 'Uncategorized',
        productUrl: '',
        notes: '',
      };
      historyChanged = true;
    }
  });
  if (historyChanged) {
    setGroceryHistory(updatedGroceryHistory);
    database.ref('mealPlanner/groceryHistory').set(updatedGroceryHistory);
  }
  
  setShowRecipeModal(false);
  
  // Return to history modal if that's where we came from
  if (returnToHistoryOnClose) {
    setShowHistoryModal(true);
    setReturnToHistoryOnClose(false);
  }
};

// Close modal without saving
const closeRecipeModal = () => {
  setShowRecipeModal(false);
  if (returnToHistoryOnClose) {
    setShowHistoryModal(true);     // reopen the history modal
    setReturnToHistoryOnClose(false); // reset flag
  }
  setCurrentRecipeMeal('');
  setCurrentRecipeType('dinner'); // NEW: Reset type
  setCurrentRecipe({
    cookTime: '',
    prepTime: '',
    protein: '',
    ingredients: [],
    instructions: '',
	servings: 0
  });
};

// open meal history modal
const openHistoryModal = (mode) => {
  setHistoryMode(mode);
  setHistorySearch('');
  setShowHistoryModal(true);
};

const closeHistoryModal = () => {
  setShowHistoryModal(false);
};

const getFilteredHistory = () => {
  const search = historySearch.toLowerCase().trim();

  const source = historyMode === 'dinner' ? mealHistory : lunchHistory;

  // Search name + protein (using recipes or lunchRecipes)
  return source.filter(item => {
    const nameMatch = item.toLowerCase().includes(search);

    let proteinMatch = false;
    if (historyMode === 'dinner' && recipes[item]?.protein) {
      proteinMatch = recipes[item].protein.toLowerCase().includes(search);
    }
    if (historyMode === 'lunch' && lunchRecipes[item]?.protein) {
      proteinMatch = lunchRecipes[item].protein.toLowerCase().includes(search);
    }

    return nameMatch || proteinMatch;
  });
};

// force styling to avoid zooming
useEffect(() => {
  // Create a style element
  const style = document.createElement("style");
  style.innerHTML = `
    input, textarea, select {
      font-size: 16px !important;
    }
  `;

  // Append it to the document head
  document.head.appendChild(style);

  // Cleanup on unmount
  return () => {
    document.head.removeChild(style);
  };
}, []);



  // Load all DB data once (initial load)
  useEffect(() => {
    const weekRef = database.ref('mealPlanner/currentWeek');
    const ideasRef = database.ref('mealPlanner/ideas');
    const lunchRef = database.ref('mealPlanner/lunchPrep');
    const historyRef = database.ref('mealPlanner/mealHistory');
    const lunchHistoryRef = database.ref('mealPlanner/lunchHistory');
    const recipesRef = database.ref('mealPlanner/recipes');
	const lunchRecipesRef = database.ref('mealPlanner/lunchRecipes');


    weekRef.once('value', (snapshot) => {
      const data = objectToArray(snapshot.val());
      if (data.length > 0) setCurrentWeek(data);
      setDataLoaded((prev) => ({ ...prev, week: true }));
    });

    ideasRef.once('value', (snapshot) => {
      const data = objectToArray(snapshot.val());
      if (data.length > 0) setIdeas(data);
      setDataLoaded((prev) => ({ ...prev, ideas: true }));
    });

    lunchRef.once('value', (snapshot) => {
      const data = objectToArray(snapshot.val());
      if (data.length > 0) setLunchPrep(data);
      setDataLoaded((prev) => ({ ...prev, lunch: true }));
    });

    historyRef.once('value', (snapshot) => {
      const data = objectToArray(snapshot.val());
      if (data.length > 0) setMealHistory(data);
      setDataLoaded((prev) => ({ ...prev, history: true }));
    });

    lunchHistoryRef.once('value', (snapshot) => {
      const data = objectToArray(snapshot.val());
      if (data.length > 0) setLunchHistory(data);
      setDataLoaded((prev) => ({ ...prev, lunchHistory: true }));
    });

    // Load recipes
    recipesRef.once('value', (snapshot) => {
      const data = snapshot.val();
      if (data) setRecipes(data);
      setDataLoaded((prev) => ({ ...prev, recipes: true }));
    });
	
 	lunchRecipesRef.once('value', (snapshot) => {
	  const data = snapshot.val();
	  if (data) setLunchRecipes(data);
	  setDataLoaded((prev) => ({ ...prev, lunchRecipes: true }));
	});

    // Load grocery history for ingredient suggestions
    database.ref('mealPlanner/groceryHistory').once('value', (snap) => {
      setGroceryHistory(snap.val() || {});
    });
  }, []);
  


  // Detect clicks outside suggestions dropdown to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
      if (lunchSuggestionsRef.current && !lunchSuggestionsRef.current.contains(event.target)) {
        setShowLunchSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save back to Firebase ONLY after all sections are loaded (prevents overwrites during initial load)
  useEffect(() => {
    if (allLoaded) {
      database.ref('mealPlanner/currentWeek').set(currentWeek);
    }
  }, [currentWeek, allLoaded]);

  useEffect(() => {
    if (allLoaded) {
      database.ref('mealPlanner/ideas').set(ideas);
    }
  }, [ideas, allLoaded]);

  useEffect(() => {
    if (allLoaded) {
      database.ref('mealPlanner/lunchPrep').set(lunchPrep);
    }
  }, [lunchPrep, allLoaded]);

  // ----------- Actions -----------

  const updateMeal = (index, value, options = {}) => {
    const { logOldMeal = true } = options;

    const updated = [...currentWeek];
    const oldMeal = updated[index].meal;
    updated[index].meal = value;
    setCurrentWeek(updated);

    // Only log the old meal when explicitly allowed (drag/drop, long-press, clear, etc.)
    if (logOldMeal && oldMeal && oldMeal.trim() !== '' && value !== oldMeal) {
      addToMealHistory(oldMeal);
    }
  };

  const handleMealBlur = (index) => {
    const value = currentWeek[index].meal;
    if (value && value.trim() !== '') {
      addToMealHistory(value);
    }
  };

  const clearAllMeals = () => {
    const confirmClear = window.confirm("Are you sure you want to clear all meals for this week?");
    if (!confirmClear) return;

    currentWeek.forEach(day => {
      if (day.meal && day.meal.trim() !== '') {
        addToMealHistory(day.meal);
      }
    });

    const cleared = currentWeek.map(item => ({ ...item, meal: "" }));
    setCurrentWeek(cleared);
  };

  const clearMeal = (index) => {
    const updated = [...currentWeek];
    const oldMeal = updated[index].meal;
    
    if (oldMeal && oldMeal.trim() !== '') {
      addToMealHistory(oldMeal);
    }
    
    updated[index].meal = "";
    setCurrentWeek(updated);
  };
  
  // Handle input change with autocomplete
  const handleIdeaInputChange = (e) => {
    const value = e.target.value;
    setNewIdea(value);

    if (value.trim() === '') {
      setShowSuggestions(false);
      setFilteredSuggestions([]);
      return;
    }

    const filtered = mealHistory.filter(meal => 
      meal.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 5);

    setFilteredSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  // Handle lunch input change with autocomplete
  const handleLunchInputChange = (e) => {
    const value = e.target.value;
    setNewLunchItem(value);

    if (value.trim() === '') {
      setShowLunchSuggestions(false);
      setFilteredLunchSuggestions([]);
      return;
    }

    const filtered = lunchHistory.filter(item => 
      item.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 5);

    setFilteredLunchSuggestions(filtered);
    setShowLunchSuggestions(filtered.length > 0);
  };

  // When user selects suggestion from dropdown: auto-submit into ideas (dinner)
  const selectSuggestion = (suggestion) => {
    if (!suggestion || !suggestion.trim()) return;
    const startCaseIdea = toStartCase(suggestion.trim());
    setIdeas(prev => [...prev, startCaseIdea]);
    addToMealHistory(startCaseIdea);
    
    setNewIdea('');
    setShowSuggestions(false);
    setFilteredSuggestions([]);
  };

// Remove item from meal history
const removeFromMealHistory = (meal) => {
const confirmRemoveMeal = window.confirm("Are you sure you want to remove " + meal + " from meal history?");
    if (!confirmRemoveMeal) return;
  const normalizedMeal = toStartCase(meal.trim());
  const updatedHistory = mealHistory.filter(item => 
    toStartCase(item) !== normalizedMeal
  );
  setMealHistory(updatedHistory);
  database.ref('mealPlanner/mealHistory').set(updatedHistory);
  setNewIdea('');
  if (!suppressHistoryFocus) {
   document.getElementById("ideafield").focus();
  }
  
  // Update filtered suggestions
  const filtered = updatedHistory.filter(m => 
    m.toLowerCase().includes(newIdea.toLowerCase())
  ).slice(0, 5);
  setFilteredSuggestions(filtered);
  
  if (filtered.length === 0) {
    setShowSuggestions(false);
  }
};

  // When user selects suggestion for lunch: auto-submit into lunchPrep
  const selectLunchSuggestion = (suggestion) => {
    if (!suggestion || !suggestion.trim()) return;
    const startCaseItem = toStartCase(suggestion.trim());
    setLunchPrep(prev => [...prev, startCaseItem]);
    addToLunchHistory(startCaseItem);

    setNewLunchItem('');
    setShowLunchSuggestions(false);
    setFilteredLunchSuggestions([]);
  };

// Remove item from lunch history
const removeFromLunchHistory = (item) => {
const confirmRemoveLunch = window.confirm("Are you sure you want to remove " + item + " from meal history?");
    if (!confirmRemoveLunch) return;
  const normalizedItem = toStartCase(item.trim());
  const updatedHistory = lunchHistory.filter(i => 
    toStartCase(i) !== normalizedItem
  );
  setLunchHistory(updatedHistory);
  database.ref('mealPlanner/lunchHistory').set(updatedHistory);
  setNewLunchItem('');
  if (!suppressHistoryFocus) {
	document.getElementById('lunchfield').focus();
  }
  
  // Update filtered suggestions
  const filtered = updatedHistory.filter(i => 
    i.toLowerCase().includes(newLunchItem.toLowerCase())
  ).slice(0, 5);
  setFilteredLunchSuggestions(filtered);
  
  if (filtered.length === 0) {
    setShowLunchSuggestions(false);
  }
};
  const addIdea = () => {
    if (newIdea.trim()) {
      const startCaseIdea = toStartCase(newIdea.trim());
      setIdeas(prev => [...prev, startCaseIdea]);
      addToMealHistory(startCaseIdea);
      setNewIdea('');
      setShowSuggestions(false);
      setFilteredSuggestions([]);
    }
  };

  const removeIdea = (index) => {
    setIdeas(prev => prev.filter((_, i) => i !== index));
    if (selectedIdeaIndexForPlacement === index) {
      setSelectedIdeaForPlacement(null);
      setSelectedIdeaIndexForPlacement(null);
    } else if (selectedIdeaIndexForPlacement !== null && selectedIdeaIndexForPlacement > index) {
      setSelectedIdeaIndexForPlacement((idx) => (idx === null ? null : idx - 1));
    }
  };

  const addLunchItem = () => {
    if (newLunchItem.trim()) {
      const startCaseItem = toStartCase(newLunchItem.trim());
      setLunchPrep(prev => [...prev, startCaseItem]);
      addToLunchHistory(startCaseItem);
      setNewLunchItem('');
      setShowLunchSuggestions(false);
      setFilteredLunchSuggestions([]);
    }
  };

  const removeLunchItem = (index) => {
    const item = lunchPrep[index];
    if (item && item.trim() !== '') {
      addToLunchHistory(item);
    }
    setLunchPrep(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragStart = (idea, index) => {
    setDraggedIdea(idea);
    setDraggedIdeaIndex(index);
  };

  const handleEnterKey = (e, index) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) nextInput.focus();
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (index) => {
    if (draggedIdea !== null) {
      const oldMeal = currentWeek[index].meal;
      
      if (oldMeal && oldMeal.trim() !== '') {
        addToMealHistory(oldMeal);
      }
      
      updateMeal(index, draggedIdea);
      
      if (draggedIdeaIndex !== null) {
        removeIdea(draggedIdeaIndex);
      }

      setDraggedIdea(null);
      setDraggedIdeaIndex(null);
    }
  };

  // ----------- LONG-PRESS SELECTION LOGIC (for mobile/touch) -----------

  const startLongPress = (idea, index, e) => {
	if (e.type === 'mousedown') return;
    if (e && e.type && e.type.startsWith('touch')) {
      e.preventDefault();
    }

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    longPressTimer.current = setTimeout(() => {
      setSelectedIdeaForPlacement(idea);
      setSelectedIdeaIndexForPlacement(index);

      longPressTimer.current = null;
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDayClick = (index) => {
    if (selectedIdeaForPlacement !== null) {
      const oldMeal = currentWeek[index].meal;
      if (oldMeal && oldMeal.trim() !== '') {
        addToMealHistory(oldMeal);
      }

      updateMeal(index, selectedIdeaForPlacement);

      if (selectedIdeaIndexForPlacement !== null && selectedIdeaIndexForPlacement >= 0 && selectedIdeaIndexForPlacement < ideas.length) {
        removeIdea(selectedIdeaIndexForPlacement);
      } else {
        const idx = ideas.indexOf(selectedIdeaForPlacement);
        if (idx !== -1) removeIdea(idx);
      }

      setSelectedIdeaForPlacement(null);
      setSelectedIdeaIndexForPlacement(null);
    }
  };

  const cancelPlacement = () => {
    setSelectedIdeaForPlacement(null);
    setSelectedIdeaIndexForPlacement(null);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        cancelPlacement();
        if (showRecipeModal) closeRecipeModal(); // Also close modal on Escape
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showRecipeModal]);

  useEffect(() => {
    const cancelOnOutsideClick = (e) => {
      if (!selectedIdeaForPlacement) return;

      const dayBox = e.target.closest("[data-day-index]");
      const ideaBox = e.target.closest("[data-idea-index]");
      const inputs = e.target.closest("input, textarea");
      const suggestions = e.target.closest(".suggestions-dropdown");

      if (dayBox || ideaBox || inputs || suggestions) return;

      setSelectedIdeaForPlacement(null);
      setSelectedIdeaIndexForPlacement(null);
    };

    document.addEventListener("click", cancelOnOutsideClick);
    return () => document.removeEventListener("click", cancelOnOutsideClick);
  }, [selectedIdeaForPlacement]);

  // ----------- Loading Screen -----------
  if (!allLoaded) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', fontSize: '20px'
      }}>
        Loading...
      </div>
    );
  }

  // ----------- UI -----------
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #ffedd5, #fef3c7)',
      padding: '6px',
      boxSizing: 'border-box'
    }}>
      {/* Recipe Modal */}
      {showRecipeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
        onClick={closeRecipeModal}
        >
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
              Recipe: {currentRecipeMeal}
            </h2>
			
			<div style={{ display: 'flex', gap: '12px', width: '100%' }}>
			  <div style={{ flex: 1 }}>
				<PickerWheel
				  label="Cook Time"
				  value={parseTimeToMinutes(currentRecipe.cookTime)}
				  onChange={(minutes) => 
					setCurrentRecipe({ ...currentRecipe, cookTime: String(minutes) })
				  }
				/>
			  </div>

			  <div style={{ flex: 1 }}>
				<PickerWheel
				  label="Prep Time"
				  value={parseTimeToMinutes(currentRecipe.prepTime)}
				  onChange={(minutes) =>
					setCurrentRecipe({ ...currentRecipe, prepTime: String(minutes) })
				  }
				/>
			  </div>
			</div>


            {/* Protein + Servings row */}
<div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>

  {/* Protein (80%) */}
  <div style={{ flex: 4 }}>
    <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
      Protein
    </label>
    <input
      type="text"
      value={currentRecipe.protein}
      onChange={(e) => setCurrentRecipe({ ...currentRecipe, protein: e.target.value })}
      placeholder="e.g. Chicken"
      style={{
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '16px',
        boxSizing: 'border-box'
      }}
    />
  </div>

  {/* Servings (20%) */}
  <div style={{ flex: 1 }}>
    <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
      Servings
    </label>

    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {/* – button */}
      <button
        onClick={() =>
          setCurrentRecipe(prev => ({
            ...prev,
            servings: Math.max(0, prev.servings - 1)   // 🔥 never below 0
          }))
        }
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          background: '#f3f4f6',
          fontSize: '18px',
          lineHeight: '18px',
          textAlign: 'center',
          padding: 0
        }}
      >
        –
      </button>

      {/* numeric input */}
      <input
        type="number"
        min="0"
        value={currentRecipe.servings}
        onChange={(e) => {
          const value = Number(e.target.value);
          if (!isNaN(value)) {
            setCurrentRecipe(prev => ({
              ...prev,
              servings: Math.max(0, value)  // 🔥 enforce >= 0
            }));
          }
        }}
        style={{
          width: '40px',
          padding: '6px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '16px',
          textAlign: 'center'
        }}
      />

      {/* + button */}
      <button
        onClick={() =>
          setCurrentRecipe(prev => ({
            ...prev,
            servings: prev.servings + 1
          }))
        }
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          background: '#f3f4f6',
          fontSize: '18px',
          lineHeight: '18px',
          textAlign: 'center',
          padding: 0
        }}
      >
        +
      </button>
    </div>
  </div>
</div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px', color: '#374151' }}>
                Ingredients
                <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                  (Qty · Unit · Item — hit + to add to grocery list)
                </span>
              </label>
              <RecipeIngredientsEditor
                ingredients={currentRecipe.ingredients}
                onChange={(rows) => setCurrentRecipe({ ...currentRecipe, ingredients: rows })}
                groceryHistory={groceryHistory}
                onAddToGrocery={addIngredientToGrocery}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Instructions
              </label>
              <textarea
                value={currentRecipe.instructions}
                onChange={(e) => setCurrentRecipe({ ...currentRecipe, instructions: e.target.value })}
                placeholder="Step-by-step instructions..."
                rows="8"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeRecipeModal}
                style={{
                  padding: '8px 16px',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveRecipe}
                style={{
                  padding: '8px 16px',
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'white'
                }}
              >
                Save Recipe
              </button>
            </div>
          </div>
        </div>
      )}
	  
	  {showHistoryModal && (
  <div
    onClick={closeHistoryModal}
    style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px"
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
		position: "relative",
        background: "white",
        borderRadius: "14px",
        padding: "20px",
        width: "100%",
        maxWidth: "500px",
		height: "75vh",
		display: "flex",
		flexDirection: "column",
        boxShadow: "0 10px 20px rgba(0,0,0,0.1)"
      }}
    >
	
	      <button
        onClick={closeHistoryModal}
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          background: "#e5e7eb",
          border: "none",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: "18px",
          color: "#374151"
        }}
      >
        ✕
      </button>
	
      <h2 style={{ marginTop: 0, marginBottom: "12px" }}>
        {historyMode === "dinner" ? "Dinner Ideas History" : "Lunch Prep History"}
      </h2>

<div style={{ position: "relative", marginBottom: "12px" }}>
  <input
    type="text"
    placeholder="Search by name or protein..."
    value={historySearch}
    onChange={(e) => setHistorySearch(e.target.value)}
    style={{
      width: "100%",
      boxSizing: "border-box",
      padding: "8px 36px 8px 12px",
      borderRadius: "6px",
      border: "1px solid #d1d5db",
    }}
  />

  {/* Clear button shown only if there is text */}
  {historySearch.length > 0 && (
    <button
      onClick={() => setHistorySearch("")}
      style={{
        position: "absolute",
        right: "8px",
        top: "50%",
        transform: "translateY(-50%)",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: "18px",
        color: "#9ca3af",
        padding: 0,
        lineHeight: "1",
      }}
    >
      ×
    </button>
  )}
</div>

{/* Add Idea button - shows when there's a search term */}
{historySearch.trim().length > 0 && (
  <button
    onClick={() => {
      const trimmedSearch = historySearch.trim();
      const startCaseItem = toStartCase(trimmedSearch);
      
      if (historyMode === "dinner") {
        setIdeas(prev => [...prev, startCaseItem]);
        addToMealHistory(startCaseItem);
        showToast(`${startCaseItem} added to ideas for next week`);
      } else {
        setLunchPrep(prev => [...prev, startCaseItem]);
        addToLunchHistory(startCaseItem);
        showToast(`${startCaseItem} added to lunch meal prep`);
      }
      
      setHistorySearch("");
    }}
    style={{
      width: "100%",
      padding: "10px",
      marginBottom: "12px",
      background: historyMode === "dinner" ? "#43b56d" : "#3b82f6",
      border: "none",
      borderRadius: "8px",
      color: "white",
      fontSize: "15px",
      fontWeight: "600",
      cursor: "pointer"
    }}
  >
    + Add "{historySearch.trim()}" to {historyMode === "dinner" ? "Ideas" : "Lunch Prep"}
  </button>
)}

<div style={{
  flex: 1,
  overflowY: "auto",
  paddingRight: "6px"
}}>
{getFilteredHistory().map((item, idx) => (
  <div
    key={idx}
style={{
		padding: "10px",
		marginBottom: "8px",
		background: "#f9fafb",
		borderRadius: "8px",
		border: "1px solid #d1d5db",            // stronger border
		boxShadow: "0 2px 4px rgba(0,0,0,0.12)", // slightly stronger shadow
		position: "relative",
		overflow: "hidden",
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "12px",
		transition: "transform 0.08s ease, box-shadow 0.12s ease", // animation
		cursor: "pointer"
	  }}
	  onTouchStart={(e) => {
		e.currentTarget.style.transform = "scale(0.97)";
		e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.15)";
	  }}
	  onTouchEnd={(e) => {
		e.currentTarget.style.transform = "scale(1)";
		e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.12)";
	  }}
	  onMouseDown={(e) => {
		e.currentTarget.style.transform = "scale(0.97)";
		e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.15)";
	  }}
	  onMouseUp={(e) => {
		e.currentTarget.style.transform = "scale(1)";
		e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.12)";
	  }}
	  onMouseLeave={(e) => {
		e.currentTarget.style.transform = "scale(1)";
		e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.12)";
	  }}
  >
  
  {recentlyAdded === item && (
  <div style={{
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(74, 222, 128, 0.85)", // green translucent
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "32px",
    color: "white",
    animation: "quickFade 0.6s forwards",
    pointerEvents: "none"
  }}>
    ✓
  </div>
)}

  
    {/* GREEN PLUS BUTTON */}
    <button
onClick={(e) => {
  e.stopPropagation();

  // Add the item
  if (historyMode === "dinner") {
    setIdeas(prev => [...prev, item]);
  } else {
    setLunchPrep(prev => [...prev, item]);
  }

  // Trigger checkmark animation
  setRecentlyAdded(item);
  setTimeout(() => setRecentlyAdded(null), 600);

  // Show toast
  showToast(`${item} added to ${historyMode === "dinner" ? "ideas for next week" : "lunch meal prep"}`);
}}
      style={{
        background: "#4ade80",
        border: "none",
        width: "18px",
        height: "18px",
        borderRadius: "6px",
        color: "white",
        fontSize: "20px",
        cursor: "pointer",
		display: "flex",
        alignItems: "center",
        justifyContent: "center",
		padding: 0,
		lineHeight: "1"
      }}
    >
      +
    </button>

    {/* CLICKING THE ROW OPENS THE RECIPE MODAL */}
    <div
      onClick={() => {
		
		setReturnToHistoryOnClose(true);
		
        if (historyMode === "dinner") {
          openRecipeModal(item, "dinner");
        } else {
          openRecipeModal(item, "lunch");
        }
        closeHistoryModal();
      }}
      style={{ flex: 1, cursor: "pointer" }}
    >
      <strong>{item}</strong>

      {(recipes[item] || lunchRecipes[item])?.protein && (
        <div style={{ fontSize: "13px", color: "#6b7280" }}>
          Protein: {(recipes[item] || lunchRecipes[item]).protein}
        </div>
      )}
    </div>

    {/* RED DELETE BUTTON */}
    <button
      onClick={(e) => {
        e.stopPropagation();
		
		suppressHistoryFocus = true;
        if (historyMode === "dinner") {
          removeFromMealHistory(item);
        } else {
          removeFromLunchHistory(item);
        }
		suppressHistoryFocus = false;
		
      }}
      style={{
        background: "#ef4444",
        border: "none",
        width: "18px",
        height: "18px",
        borderRadius: "6px",
        color: "white",
        fontSize: "15px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
		padding: 0,
		lineHeight: "1"
      }}
    >
      X
    </button>
  </div>

))}
</div>

	<button
        onClick={closeHistoryModal}
        style={{
          marginTop: "12px",
          width: "100%",
          padding: "10px 0",
          background: "#4b5563",
          border: "none",
          borderRadius: "8px",
          color: "white",
          fontSize: "16px",
          cursor: "pointer"
        }}
      >
        Close
      </button>

    </div>
  </div>
)}

{toastMessage && (
  <div style={{
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0D822C",
    color: "white",
    padding: "10px 18px",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "700",
    fontFamily: "Calibri, Arial, sans-serif", 
    boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
    zIndex: 99999,
    animation: "fadeInOut 1.5s"
  }}>
    {toastMessage}
  </div>
)}



<style>
{`
@keyframes fadeInOut {
  0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
  10% { opacity: 1; transform: translateX(-50%) translateY(0); }
  90% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(10px); }
}

@keyframes quickFade {
  0% { opacity: 0; transform: scale(0.8); }
  20% { opacity: 1; transform: scale(1); }
  80% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.1); }
}
`}
</style>






      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        <div className="main-layout" style={{ display: 'flex', gap: '12px', height: 'calc(100vh - 13px)' }}>

          {/* LEFT COLUMN */}
          <div className="left-col" style={{
            width: '50%', background: 'white', borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column'
          }}>
		  <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              borderBottom: '2px solid #fb923c',
              paddingBottom: '4px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#1f2937',
                margin: 0
              }}>
                This Week's Dinners
              </h2>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selectedIdeaForPlacement && (
                  <div style={{
                    padding: '6px 8px',
                    background: '#fff7ed',
                    border: '1px dashed #fb923c',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#92400e'
                  }}>
                    Placing: {selectedIdeaForPlacement}
                    <button
                      onClick={cancelPlacement}
                      style={{
                        marginLeft: '8px',
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}

                <button
                  onClick={clearAllMeals}
                  style={{
                    background: '#f87171',
                    color: 'white',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>

            <div
			  style={{
				flex: 1,
				overflowY: 'auto',
				boxSizing: 'border-box'
			  }}
			>

              {currentWeek.map((day, index) => (
                <div
                  key={index}
                  data-day-index={index}
                  onClick={() => handleDayClick(index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  style={{
                    background: '#ffedd5', borderRadius: '6px',
                    padding: '8px', marginBottom: '6px',
                    border: draggedIdea
                      ? '2px dashed #fb923c'
                      : '2px solid transparent',
                    cursor: selectedIdeaForPlacement ? 'pointer' : 'default'
                  }}
                >
                  <label style={{
                    fontSize: '13px', fontWeight: '600',
                    color: '#c2410c', marginBottom: '3px', display: 'block'
                  }}>
                    {day.day}
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
  {/* Recipe button - moved to the left */}
  <button
    tabIndex="-1"
    onClick={(e) => {
      e.stopPropagation();
      openRecipeModal(day.meal);
    }}
    style={{
      background: recipes[toStartCase(day.meal)] ? '#10b981' : '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      width: '24px',
      height: '24px',
      cursor: 'pointer',
      fontWeight: 'bold',
      lineHeight: '1',
      fontSize: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}
    title={recipes[toStartCase(day.meal)] ? "Edit Recipe" : "Add Recipe"}
  >
    {recipes[toStartCase(day.meal)] ? '📒' : '📝'}
  </button>
  
  <input
    ref={el => inputRefs.current[index] = el}
    type="text"
    value={day.meal}
    onChange={(e) => updateMeal(index, e.target.value, { logOldMeal: false })}
    onKeyDown={(e) => handleEnterKey(e, index)}
    // When the user is done editing this day, log the final meal once
    onBlur={() => handleMealBlur(index)}
    style={{
      flex: 1,
      minWidth: 0,
      padding: '6px 8px',
      border: '1px solid #fed7aa',
      borderRadius: '6px',
      outline: 'none',
      fontSize: '14px',
      boxSizing: 'border-box'
    }}
  />

  
  <button
    tabIndex="-1"
    onClick={(e) => {
      e.stopPropagation();
      clearMeal(index);
    }}
    style={{
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      width: '24px',
      height: '24px',
      cursor: 'pointer',
      fontWeight: 'bold',
      lineHeight: '1'
    }}
  >
    ×
  </button>
</div>
						</div>
						))}
						</div>
						</div>
						</div>
{/* RIGHT COLUMN */}
      <div className="right-col" style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* IDEAS */}
        <div style={{
          height: '70%', background: 'white', borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          padding: '12px', display: 'flex', flexDirection: 'column'
        }}>
<div style={{ 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center',
  borderBottom: '2px solid #7ad599',
  paddingBottom: '4px',
  marginBottom: '8px'
}}>
  <h2 style={{
    fontSize: '20px', fontWeight: 'bold',
    margin: 0
  }}>
    Ideas for Next Week ({ideas.length})
  </h2>

  <button
    onClick={() => openHistoryModal("dinner")}
    style={{
      background: "#43b56d",
      border: "none",
      padding: "4px 8px",
      borderRadius: "6px",
      color: "white",
      fontSize: "13px",
      cursor: "pointer"
    }}
  >
    View All
  </button>
</div>


<div style={{ flex: 1, overflowY: 'auto', marginBottom: '8px' }}>
  {ideas.map((idea, index) => {
    const isSelected = selectedIdeaForPlacement !== null && selectedIdeaIndexForPlacement === index;
    return (
      <div
        key={index}
        data-idea-index={index}
        draggable={!isTouchDevice}
        onDragStart={(e) => {
		  cancelLongPress();
		  handleDragStart(idea, index);
		}}

        onDragEnd={handleDragEnd}

        onMouseDown={(e) => {
          if (e.button === 0) startLongPress(idea, index, e);
        }}
        onMouseUp={(e) => {
          cancelLongPress();
        }}
        onMouseLeave={() => cancelLongPress()}

        onTouchStart={(e) => startLongPress(idea, index, e)}
        onTouchEnd={(e) => {
          cancelLongPress();
        }}
        onTouchCancel={() => cancelLongPress()}

        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: isSelected ? '#bbf7d0' : '#ccf1d8', padding: '8px', borderRadius: '6px',
          marginBottom: '6px', cursor: 'move',
          boxShadow: isSelected ? 'inset 0 0 0 2px #34d399' : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          msUserSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1 }}>
          {/* Recipe button on the left */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openRecipeModal(idea);
            }}
            style={{
              background: recipes[toStartCase(idea)] ? '#10b981' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              fontWeight: 'bold',
              lineHeight: '1',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title={recipes[toStartCase(idea)] ? "Edit Recipe" : "Add Recipe"}
          >
            {recipes[toStartCase(idea)] ? '📒' : '📝'}
          </button>

          <span style={{ flex: 1 }}>{idea}</span>
        </div>

        <button
          onClick={() => removeIdea(index)}
          style={{
            background: 'none', border: 'none',
            color: '#ef4444', fontSize: '22px', cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
            flexShrink: 0
          }}
        >
          ×
        </button>
      </div>
    );
  })}
</div>

          <div style={{ position: 'relative' }} ref={suggestionsRef}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input id="ideafield"
                type="text"
                value={newIdea}
                onChange={handleIdeaInputChange}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addIdea();
                  }
                }}
                placeholder="Add new idea..."
                style={{
                  flex: 1, padding: '8px 10px',
                  border: '1px solid #7ad599', borderRadius: '6px',
                  outline: 'none', fontSize: '14px', boxSizing: 'border-box'
                }}
              />

              <button
                onClick={addIdea}
                style={{
                  background: '#43b56d', color: 'white',
                  borderRadius: '6px', padding: '8px 14px',
                  cursor: 'pointer', fontSize: '20px', border: 'none',
                  lineHeight: 1
                }}
              >
                +
              </button>
            </div>

			{showSuggestions && filteredSuggestions.length > 0 && (
			  <div
				className="suggestions-dropdown"
				style={{
				  position: 'absolute',
				  top: '100%',
				  left: 0,
				  right: '52px',
				  marginTop: '4px',
				  background: 'white',
				  border: '1px solid #bbf7d0',
				  borderRadius: '6px',
				  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
				  maxHeight: '200px',
				  overflowY: 'auto',
				  zIndex: 1000
				}}
			  >
				{filteredSuggestions.map((suggestion, idx) => (
				  <div
					key={idx}
					style={{
					  display: 'flex',
					  justifyContent: 'space-between',
					  alignItems: 'center',
					  padding: '8px 10px',
					  borderBottom: idx < filteredSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
					  fontSize: '14px',
					  color: '#1f2937'
					}}
					onMouseEnter={(e) => e.currentTarget.style.background = '#dcfce7'}
					onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
				  >
					<span 
					  onClick={() => selectSuggestion(suggestion)}
					  style={{ flex: 1, cursor: 'pointer' }}
					>
					  {suggestion}
					</span>
					<button
					  onClick={(e) => {
						e.stopPropagation();
						removeFromMealHistory(suggestion);
					  }}
					  style={{
						background: 'none',
						border: 'none',
						color: '#ef4444',
						fontSize: '18px',
						cursor: 'pointer',
						padding: '0 4px',
						lineHeight: 1
					  }}
					  title="Remove from history"
					>
					  ×
					</button>
				  </div>
				))}
			  </div>
			)}
          </div>
        </div>

        {/* LUNCH PREP */}
        <div style={{
          height: '30%', background: 'white', borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          padding: '12px', display: 'flex', flexDirection: 'column'
        }}>
<div style={{ 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center',
  borderBottom: '2px solid #60a5fa',
  paddingBottom: '4px',
  marginBottom: '8px'
}}>
  <h2 style={{
    fontSize: '20px', fontWeight: 'bold',
    margin: 0
  }}>
    Lunch Meal Prep ({lunchPrep.length})
  </h2>

  <button
    onClick={() => openHistoryModal("lunch")}
    style={{
      background: "#60a5fa",
      border: "none",
      padding: "4px 8px",
      borderRadius: "6px",
      color: "white",
      fontSize: "13px",
      cursor: "pointer"
    }}
  >
    View All
  </button>
</div>


		<div style={{ flex: 1, overflowY: 'auto', marginBottom: '8px' }}>
		  {lunchPrep.map((item, index) => (
			<div
			  key={index}
			  style={{
				display: 'flex', justifyContent: 'space-between', alignItems: 'center',
				background: '#dbeafe', padding: '6px 8px',
				borderRadius: '6px', marginBottom: '6px',
				userSelect: 'none',
				WebkitUserSelect: 'none',
				WebkitTouchCallout: 'none',
			  }}
			>
			  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1 }}>
				{/* Lunch Recipe button */}
				<button
				  onClick={(e) => {
					e.stopPropagation();
					openRecipeModal(item, 'lunch');
				  }}
				  style={{
					background: lunchRecipes[toStartCase(item)] ? '#10b981' : '#3b82f6',
					color: 'white',
					border: 'none',
					borderRadius: '4px',
					width: '24px',
					height: '24px',
					cursor: 'pointer',
					fontWeight: 'bold',
					lineHeight: '1',
					fontSize: '16px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					flexShrink: 0
				  }}
				  title={lunchRecipes[toStartCase(item)] ? "Edit Recipe" : "Add Recipe"}
				>
				  {lunchRecipes[toStartCase(item)] ? '📒' : '📝'}
				</button>

				<span style={{ flex: 1, fontSize: '16px' }}>{item}</span>
			  </div>

			  <button
				onClick={() => removeLunchItem(index)}
				style={{
				  background: 'none', border: 'none',
				  color: '#ef4444', fontSize: '20px', cursor: 'pointer',
				  padding: 0,
				  lineHeight: 1,
				  flexShrink: 0
				}}
			  >
				×
			  </button>
			</div>
		  ))}
		</div>

          <div style={{ position: 'relative' }} ref={lunchSuggestionsRef}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input id="lunchfield"
                type="text"
                value={newLunchItem}
                onChange={handleLunchInputChange}
                onKeyPress={(e) => e.key === 'Enter' && addLunchItem()}
                placeholder="Add lunch prep item..."
                style={{
                  flex: 1, padding: '6px 8px',
                  border: '1px solid #bfdbfe', borderRadius: '6px',
                  outline: 'none', fontSize: '13px', boxSizing: 'border-box'
                }}
              />

              <button
                onClick={addLunchItem}
                style={{
                  background: '#3b82f6', color: 'white',
                  borderRadius: '6px', padding: '6px 12px',
                  cursor: 'pointer', fontSize: '18px', border: 'none',
                  lineHeight: 1
                }}
              >
                +
              </button>
            </div>

			{showLunchSuggestions && filteredLunchSuggestions.length > 0 && (
			  <div
				className="suggestions-dropdown"
				style={{
				  position: 'absolute',
				  bottom: '100%',
				  left: 0,
				  right: '52px',
				  marginBottom: '4px',
				  background: 'white',
				  border: '1px solid #bfdbfe',
				  borderRadius: '6px',
				  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
				  maxHeight: '150px',
				  overflowY: 'auto',
				  zIndex: 1000
				}}
			  >
				{filteredLunchSuggestions.map((suggestion, idx) => (
				  <div
					key={idx}
					style={{
					  display: 'flex',
					  justifyContent: 'space-between',
					  alignItems: 'center',
					  padding: '6px 8px',
					  borderBottom: idx < filteredLunchSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
					  fontSize: '13px',
					  color: '#1f2937'
					}}
					onMouseEnter={(e) => e.currentTarget.style.background = '#dbeafe'}
					onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
				  >
					<span 
					  onClick={() => selectLunchSuggestion(suggestion)}
					  style={{ flex: 1, cursor: 'pointer' }}
					>
					  {suggestion}
					</span>
					<button
					  onClick={(e) => {
						e.stopPropagation();
						removeFromLunchHistory(suggestion);
					  }}
					  style={{
						background: 'none',
						border: 'none',
						color: '#ef4444',
						fontSize: '16px',
						cursor: 'pointer',
						padding: '0 4px',
						lineHeight: 1
					  }}
					  title="Remove from history"
					>
					  ×
					</button>
				  </div>
				))}
			  </div>
			)}
          </div>

        </div>
      </div>
    </div>

  </div>
</div>
);
}
ReactDOM.render(<MealPlanner />, document.getElementById('root'));