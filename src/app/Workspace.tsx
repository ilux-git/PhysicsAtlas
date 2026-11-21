import { useAtlas, TABS } from './state.tsx';
import { FilterPanel } from '../ui/FilterPanel.tsx';
import { Inspector } from '../ui/Inspector.tsx';
import { Legend } from '../ui/Legend.tsx';
import { LevelSwitch, DomainPicker } from '../ui/LevelSwitch.tsx';
import { MapCanvas } from '../ui/MapCanvas.tsx';
import { SearchBox } from '../ui/SearchBox.tsx';
import { ToolPanel } from '../ui/ToolPanel.tsx';

export function Workspace() {
  const { state, dispatch } = useAtlas();
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            Φ
          </span>
          <div>
            <h1>Physics Atlas</h1>
            <p>атлас физических знаний · 7–11 класс</p>
          </div>
        </div>
        <SearchBox />
        <div className="header-controls">
          <button
            type="button"
            className="text-button back-button"
            disabled={state.history.length === 0}
            onClick={() => dispatch({ type: 'back' })}
          >
            ← Назад
          </button>
          <LevelSwitch />
          <DomainPicker />
        </div>
      </header>

      <main className="workspace">
        <section className="map-area" aria-label="Интерактивная карта">
          <MapCanvas />
          <div className="map-overlays">
            <FilterPanel />
            <Legend />
          </div>
        </section>

        <aside className="panel">
          <nav className="tabs" role="tablist" aria-label="Режимы панели">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={state.tab === tab.id}
                aria-controls="panel-content"
                className={`tab ${state.tab === tab.id ? 'is-active' : ''}`}
                onClick={() => dispatch({ type: 'tab', tab: tab.id })}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="panel-content" id="panel-content" role="tabpanel">
            {state.tab === 'card' ? <Inspector /> : <ToolPanel tab={state.tab} />}
          </div>
        </aside>
      </main>
    </div>
  );
}