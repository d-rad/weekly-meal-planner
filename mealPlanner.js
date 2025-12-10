const { useState, useEffect, useRef } = React;
/* TODO:
    - add ability to view all/sort dinner & lunch ideas based on search/ingredients/proteins/carbs
    - add gui for adding/editing "recipes" of meals
    - create elements for "recipe": prep time, protein, ingredients, instructions
    - fix layout on vertical phone orientation
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

function MealPlanner() {
  // Helper: convert to Start Case / Title Case
  const toStartCase = (str) => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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

  const [newIdea, setNewIdea] = useState('');
  const [newLunchItem, setNewLunchItem] = useState('');

  // desktop drag states
  const [draggedIdea, setDraggedIdea] = useState(null);
  const [draggedIdeaIndex, setDraggedIdeaIndex] = useState(null);

  // placement mode (long-press)
  const [selectedIdeaForPlacement, setSelectedIdeaForPlacement] = useState(null);
  const [selectedIdeaIndexForPlacement, setSelectedIdeaIndexForPlacement] = useState(null);

  const longPressTimer = useRef(null);

  const inputRefs = React.useRef([]);
  const suggestionsRef = React.useRef(null);
  const lunchSuggestionsRef = React.useRef(null);

  const [dataLoaded, setDataLoaded] = useState({
    week: false,
    ideas: false,
    lunch: false,
    history: false,
    lunchHistory: false
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  
  const [showLunchSuggestions, setShowLunchSuggestions] = useState(false);
  const [filteredLunchSuggestions, setFilteredLunchSuggestions] = useState([]);

  const handleDragEnd = () => {
    setDraggedIdea(null);
    setDraggedIdeaIndex(null);
  };

  const allLoaded = dataLoaded.week && dataLoaded.ideas && dataLoaded.lunch && dataLoaded.history && dataLoaded.lunchHistory;

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

  // Load all DB data once (initial load)
  useEffect(() => {
    const weekRef = database.ref('mealPlanner/currentWeek');
    const ideasRef = database.ref('mealPlanner/ideas');
    const lunchRef = database.ref('mealPlanner/lunchPrep');
    const historyRef = database.ref('mealPlanner/mealHistory');
    const lunchHistoryRef = database.ref('mealPlanner/lunchHistory');

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

  const updateMeal = (index, value) => {
    const updated = [...currentWeek];
    const oldMeal = updated[index].meal;
    updated[index].meal = value;
    setCurrentWeek(updated);

    if (oldMeal && oldMeal.trim() !== '' && value !== oldMeal) {
      addToMealHistory(oldMeal);
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
    // if the removed one was selected for placement, clear selection
    if (selectedIdeaIndexForPlacement === index) {
      setSelectedIdeaForPlacement(null);
      setSelectedIdeaIndexForPlacement(null);
    } else if (selectedIdeaIndexForPlacement !== null && selectedIdeaIndexForPlacement > index) {
      // if removing earlier item, shift selected index down to stay in sync
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
    // Prevent default on touch to stop text selection / callouts
    if (e && e.type && e.type.startsWith('touch')) {
      e.preventDefault();
    }

    // Clear any existing timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    longPressTimer.current = setTimeout(() => {
      setSelectedIdeaForPlacement(idea);
      setSelectedIdeaIndexForPlacement(index);
      longPressTimer.current = null;
    }, 500); // 500ms long-press
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // do not clear selectedIdea here; selection persists until placement or explicit cancel
  };

  // When a day is clicked/tapped, if there's a selected idea for placement, assign it
  const handleDayClick = (index) => {
    if (selectedIdeaForPlacement !== null) {
      const oldMeal = currentWeek[index].meal;
      if (oldMeal && oldMeal.trim() !== '') {
        addToMealHistory(oldMeal);
      }

      updateMeal(index, selectedIdeaForPlacement);

      // remove idea from ideas list if it was placed (use saved index if possible)
      if (selectedIdeaIndexForPlacement !== null && selectedIdeaIndexForPlacement >= 0 && selectedIdeaIndexForPlacement < ideas.length) {
        removeIdea(selectedIdeaIndexForPlacement);
      } else {
        // fallback: remove first matching idea by exact string match
        const idx = ideas.indexOf(selectedIdeaForPlacement);
        if (idx !== -1) removeIdea(idx);
      }

      // clear selection afterward
      setSelectedIdeaForPlacement(null);
      setSelectedIdeaIndexForPlacement(null);
    }
  };

  // Cancel placement mode explicitly
  const cancelPlacement = () => {
    setSelectedIdeaForPlacement(null);
    setSelectedIdeaIndexForPlacement(null);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Pressing Escape cancels selection (desktop)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') cancelPlacement();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Cancel placement when clicking blank space (but ignore clicks inside days, ideas, inputs, or suggestion dropdowns)
  useEffect(() => {
    const cancelOnOutsideClick = (e) => {
      if (!selectedIdeaForPlacement) return;

      const dayBox = e.target.closest("[data-day-index]");
      const ideaBox = e.target.closest("[data-idea-index]");
      const inputs = e.target.closest("input, textarea");
      const suggestions = e.target.closest(".suggestions-dropdown");

      if (dayBox || ideaBox || inputs || suggestions) return;

      // otherwise cancel
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
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '12px', height: 'calc(100vh - 13px)' }}>

          {/* LEFT COLUMN */}
          <div style={{
            width: '50%', background: 'white', borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            padding: '12px', display: 'flex', flexDirection: 'column'
          }}>
            {/* HEADER WITH CLEAR BUTTON */}
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

            <div style={{ flex: 1, overflowY: 'auto' }}>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      ref={el => inputRefs.current[index] = el}
                      type="text"
                      value={day.meal}
                      onChange={(e) => updateMeal(index, e.target.value)}
                      onKeyDown={(e) => handleEnterKey(e, index)}
                      style={{
                        flex: 1,
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
                      onClick={() => clearMeal(index)}
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

          {/* RIGHT COLUMN */}
          <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* IDEAS */}
            <div style={{
              height: '70%', background: 'white', borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              padding: '12px', display: 'flex', flexDirection: 'column'
            }}>
              <h2 style={{
                fontSize: '20px', fontWeight: 'bold',
                borderBottom: '2px solid #4ade80', paddingBottom: '4px',
                margin: '0 0 8px 0'
              }}>
                Ideas for Next Week ({ideas.length})
              </h2>

              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '8px' }}>
                {ideas.map((idea, index) => {
                  const isSelected = selectedIdeaForPlacement !== null && selectedIdeaIndexForPlacement === index;
                  return (
                    <div
                      key={index}
                      data-idea-index={index}
                      draggable
                      onDragStart={() => handleDragStart(idea, index)}
                      onDragEnd={handleDragEnd}

                      // long-press (mouse) start
                      onMouseDown={(e) => {
                        if (e.button === 0) startLongPress(idea, index, e);
                      }}
                      onMouseUp={(e) => {
                        cancelLongPress();
                      }}
                      onMouseLeave={() => cancelLongPress()}

                      // touch handlers for long-press (prevent default to avoid highlight/callout)
                      onTouchStart={(e) => startLongPress(idea, index, e)}
                      onTouchEnd={(e) => {
                        // release before timer cancels; selection persists if timer had fired
                        cancelLongPress();
                      }}
                      onTouchCancel={() => cancelLongPress()}

                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: isSelected ? '#bbf7d0' : '#dcfce7', padding: '8px', borderRadius: '6px',
                        marginBottom: '6px', cursor: 'move',
                        boxShadow: isSelected ? 'inset 0 0 0 2px #34d399' : 'none',
                        // Prevent text selection and touch callouts on long-press
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        msUserSelect: 'none',
                      }}
                    >
                      <span>{idea}</span>

                      <button
                        onClick={() => removeIdea(index)}
                        style={{
                          background: 'none', border: 'none',
                          color: '#ef4444', fontSize: '22px', cursor: 'pointer'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Autocomplete input container */}
              <div style={{ position: 'relative' }} ref={suggestionsRef}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
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
                      border: '1px solid #bbf7d0', borderRadius: '6px',
                      outline: 'none', fontSize: '14px', boxSizing: 'border-box'
                    }}
                  />

                  <button
                    onClick={addIdea}
                    style={{
                      background: '#22c55e', color: 'white',
                      borderRadius: '6px', padding: '8px 14px',
                      cursor: 'pointer', fontSize: '20px', border: 'none',
                      lineHeight: 1
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Suggestions dropdown */}
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
                        onClick={() => selectSuggestion(suggestion)}
                        style={{
                          padding: '8px 10px',
                          cursor: 'pointer',
                          borderBottom: idx < filteredSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                          fontSize: '14px',
                          color: '#1f2937'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#dcfce7'}
                        onMouseLeave={(e) => e.target.style.background = 'white'}
                      >
                        {suggestion}
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
              <h2 style={{
                fontSize: '20px', fontWeight: 'bold',
                borderBottom: '2px solid #60a5fa', paddingBottom: '4px',
                margin: '0 0 8px 0'
              }}>
                Lunch Meal Prep ({lunchPrep.length})
              </h2>

              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '8px' }}>
                {lunchPrep.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex', justifyContent: 'space-between',
                      background: '#dbeafe', padding: '6px 8px',
                      borderRadius: '6px', marginBottom: '6px',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none',
                    }}
                  >
                    <span>{item}</span>

                    <button
                      onClick={() => removeLunchItem(index)}
                      style={{
                        background: 'none', border: 'none',
                        color: '#ef4444', fontSize: '20px', cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Autocomplete input container for lunch */}
              <div style={{ position: 'relative' }} ref={lunchSuggestionsRef}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
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

                {/* Suggestions dropdown for lunch */}
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
                        onClick={() => selectLunchSuggestion(suggestion)}
                        style={{
                          padding: '6px 8px',
                          cursor: 'pointer',
                          borderBottom: idx < filteredLunchSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                          fontSize: '13px',
                          color: '#1f2937'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#dbeafe'}
                        onMouseLeave={(e) => e.target.style.background = 'white'}
                      >
                        {suggestion}
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
