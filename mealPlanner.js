const { useState, useEffect } = React;

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

  const [newIdea, setNewIdea] = useState('');
  const [newLunchItem, setNewLunchItem] = useState('');

  const [draggedIdea, setDraggedIdea] = useState(null);
  const [draggedIdeaIndex, setDraggedIdeaIndex] = useState(null);

  const [dataLoaded, setDataLoaded] = useState({
    week: false,
    ideas: false,
    lunch: false
  });

  const inputRefs = React.useRef([]);
  
  const handleDragEnd = () => {
  setDraggedIdea(null);
  setDraggedIdeaIndex(null);
};

  const allLoaded = dataLoaded.week && dataLoaded.ideas && dataLoaded.lunch;

  // Convert Firebase object into array
  const objectToArray = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    return Object.values(obj).filter((item) => item !== null && item !== undefined);
  };

  // Load all DB data
  useEffect(() => {
    const weekRef = database.ref('mealPlanner/currentWeek');
    const ideasRef = database.ref('mealPlanner/ideas');
    const lunchRef = database.ref('mealPlanner/lunchPrep');

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
  }, []);

  //
  // Save back to Firebase ONLY after all three sections are loaded
  //

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
    updated[index].meal = value;
    setCurrentWeek(updated);
  };

const clearAllMeals = () => {
  const confirmClear = window.confirm("Are you sure you want to clear all meals for this week?");
  if (!confirmClear) return;

  const cleared = currentWeek.map(item => ({ ...item, meal: "" }));
  setCurrentWeek(cleared);
};

const clearMeal = (index) => {
  const updated = [...currentWeek];
  updated[index].meal = "";
  setCurrentWeek(updated);
};
  
  const addIdea = () => {
    if (newIdea.trim()) {
      setIdeas([...ideas, newIdea.trim()]);
      setNewIdea('');
    }
  };

  const removeIdea = (index) => {
    setIdeas(ideas.filter((_, i) => i !== index));
  };

  const addLunchItem = () => {
    if (newLunchItem.trim()) {
      setLunchPrep([...lunchPrep, newLunchItem.trim()]);
      setNewLunchItem('');
    }
  };

  const removeLunchItem = (index) => {
    setLunchPrep(lunchPrep.filter((_, i) => i !== index));
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
      updateMeal(index, draggedIdea);

      if (draggedIdeaIndex !== null) {
        removeIdea(draggedIdeaIndex);
      }

      setDraggedIdea(null);
      setDraggedIdeaIndex(null);
    }
  };

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

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {currentWeek.map((day, index) => (
                <div
                  key={index}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  style={{
                    background: '#ffedd5', borderRadius: '6px',
                    padding: '8px', marginBottom: '6px',
                    border: draggedIdea
                      ? '2px dashed #fb923c'
                      : '2px solid transparent'
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
    tabindex="-1"
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
                {ideas.map((idea, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleDragStart(idea, index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: '#dcfce7', padding: '8px', borderRadius: '6px',
                      marginBottom: '6px', cursor: 'move'
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
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addIdea()}
                  placeholder="Add new idea..."
                  style={{
                    flex: 1, padding: '8px 10px',
                    border: '1px solid #bbf7d0', borderRadius: '6px'
                  }}
                />

                <button
                  onClick={addIdea}
                  style={{
                    background: '#22c55e', color: 'white',
                    borderRadius: '6px', padding: '8px 14px',
                    cursor: 'pointer', fontSize: '20px'
                  }}
                >
                  +
                </button>
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
                      borderRadius: '6px', marginBottom: '6px'
                    }}
                  >
                    <span>{item}</span>

                    <button
                      onClick={() => removeLunchItem(index)}
                      style={{
                        background: 'none', border: 'none',
                        color: '#ef4444', fontSize: '20px'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={newLunchItem}
                  onChange={(e) => setNewLunchItem(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addLunchItem()}
                  placeholder="Add lunch prep item..."
                  style={{
                    flex: 1, padding: '6px 8px',
                    border: '1px solid #bfdbfe', borderRadius: '6px'
                  }}
                />

                <button
                  onClick={addLunchItem}
                  style={{
                    background: '#3b82f6', color: 'white',
                    borderRadius: '6px', padding: '6px 12px',
                    cursor: 'pointer', fontSize: '18px'
                  }}
                >
                  +
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

ReactDOM.render(<MealPlanner />, document.getElementById('root'));
