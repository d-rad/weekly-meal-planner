// ── App ──────────────────────────────────────────────────────────────────────
// Root component. Owns the tab bar and renders whichever tab is active.
// To add a new tab later:
//   1. Add an entry to the TABS array below
//   2. Add a case in the renderTab() function

const TABS = [
  { id: 'meals',   label: '🍽️  Meals',   title: 'Weekly Meal Planner' },
  { id: 'weather',   label: '🌤️  Weather',  title: '7-Day Forecast' },
  { id: 'grocery',   label: '🛒  Groceries', title: 'Grocery List' },
];

function App() {
  const [activeTab, setActiveTab] = React.useState('meals');

  // ── Inject global nav styles once ────────────────────────────────────────
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }

      #app-root {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
      }

      /* ── Nav bar ── */
      .app-navbar {
        display: flex;
        align-items: center;
        gap: 4px;
        background: #1e293b;
        padding: 0 16px;
        height: 52px;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .app-navbar::-webkit-scrollbar { display: none; }

      .nav-brand {
        font-size: 17px;
        font-weight: 700;
        color: white;
        margin-right: 12px;
        white-space: nowrap;
        letter-spacing: -0.3px;
      }

      .nav-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 16px;
        border-radius: 8px;
        border: none;
        background: transparent;
        color: #94a3b8;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s, color 0.15s;
        font-family: sans-serif;
      }
      .nav-tab:hover {
        background: rgba(255,255,255,0.08);
        color: #e2e8f0;
      }
      .nav-tab.active {
        background: rgba(99,102,241,0.25);
        color: white;
        font-weight: 600;
      }
      .nav-tab.active::after {
        content: '';
        display: block;
        position: absolute;
        bottom: 0;
        left: 16px;
        right: 16px;
        height: 3px;
        background: #818cf8;
        border-radius: 3px 3px 0 0;
      }
      .nav-tab { position: relative; }

      /* ── Content area ── */
      .app-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'meals':   return <MealPlanner />;
      case 'weather': return <WeatherTab />;
      case 'grocery': return <GroceryTab />;
      // Add cases here as you add more tabs
      default:        return <MealPlanner />;
    }
  };

  return (
    <div id="app-root">
      {/* ── Navigation bar ── */}
      <nav className="app-navbar">
        <span className="nav-brand">🏠 Dashboard</span>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.title}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Active tab content ── */}
      <div className="app-content">
        {renderTab()}
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
