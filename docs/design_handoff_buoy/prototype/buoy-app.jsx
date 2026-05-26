// buoy-app.jsx
// Top-level Buoy composition. Owns todo state, sync state, current scene,
// and threads tweaks into both the CSS root and the canvas physics.

const { useState, useEffect, useRef, useMemo } = React;

const SEED_TODOS = [
{ id: 'ed-001', title: 'Ship the PR', priority: 5, description: 'Buoy redesign branch — needs a screenshot in the PR body.', created: '2026-05-25 09:41' },
{ id: 'ed-002', title: 'Read the matter.js bodies docs', priority: 3, description: 'Want to understand Body.applyForce vs setVelocity.', created: '2026-05-24 14:02' },
{ id: 'ed-003', title: 'Set up backups', priority: 4, description: 'todos.md is the database. Back it up.', created: '2026-05-23 22:10' },
{ id: 'ed-004', title: 'Buy milk', priority: 2, description: 'From the corner store. Whole, not skim.', created: '2026-05-25 08:00' },
{ id: 'ed-005', title: 'Second-coat the trim', priority: 1, description: '', created: '2026-05-20 19:30' },
{ id: 'ed-006', title: 'Reply to Sara', priority: 3, description: 'About the photo print order.', created: '2026-05-25 11:12' },
{ id: 'ed-007', title: 'Refill prescription', priority: 4, description: '', created: '2026-05-25 07:30' }];


const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "daydream",
  "theme": "light",
  "motion": "normal",
  "density": "normal",
  "scene": "active"
} /*EDITMODE-END*/;

const DENSITY_COUNTS = { sparse: 3, normal: 7, full: 12, swarm: 20 };

function uid() {return Math.random().toString(36).slice(2, 10);}

function todosForDensity(level) {
  const target = DENSITY_COUNTS[level] || 7;
  const base = SEED_TODOS.slice();
  if (target <= base.length) return base.slice(0, target);
  // Pad with synthetic items
  const filler = [
  'Pay parking ticket', 'Finish notion doc', 'Pick up keys',
  'Email landlord', 'Cancel old subscription', 'Plan trip dates',
  'Reschedule dentist', 'Try the new pasta place', 'Order birthday gift',
  'Stretch — actually stretch', 'Read one chapter', 'Refactor App.jsx',
  'Renew passport'];

  const out = base.slice();
  while (out.length < target) {
    const title = filler[(out.length - base.length) % filler.length];
    out.push({
      id: 'syn-' + uid(),
      title,
      priority: 1 + Math.floor(Math.random() * 5),
      description: '',
      created: '2026-05-25 12:00'
    });
  }
  return out;
}

function ScenePicker({ scene, setScene }) {
  const scenes = [
  ['active', 'Active'],
  ['empty', 'Empty'],
  ['loading', 'Loading'],
  ['reconnecting', 'Reconnecting']];

  return (
    <nav className="buoy-scene" aria-label="Prototype scene">
      {scenes.map(([k, label]) =>
      <button
        key={k}
        data-active={scene === k}
        onClick={() => setScene(k)}>
        
          {label}
        </button>
      )}
    </nav>);

}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [todos, setTodos] = useState(() => todosForDensity(t.density));
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [retryAttempt, setRetryAttempt] = useState(4);

  // Sync tweaks → root attributes
  useEffect(() => {
    document.documentElement.setAttribute('data-direction', t.direction);
    document.documentElement.setAttribute('data-theme',
    t.direction === 'nightswim' ? 'dark' : t.theme);
  }, [t.direction, t.theme]);

  // When density changes, regenerate todo list
  useEffect(() => {
    setTodos(todosForDensity(t.density));
  }, [t.density]);

  // Sync state simulation
  const [syncState, setSyncState] = useState('live');
  useEffect(() => {
    if (t.scene === 'reconnecting') setSyncState('reconnecting');else
    if (t.scene === 'loading') setSyncState('reconnecting');else
    setSyncState('live');
  }, [t.scene]);

  // Reconnecting attempt counter (purely cosmetic)
  useEffect(() => {
    if (t.scene !== 'reconnecting') return;
    const id = setInterval(() => setRetryAttempt((a) => a + 1), 4500);
    return () => clearInterval(id);
  }, [t.scene]);

  // Demo: "live sync" tick — small subtle pulse of the wordmark when a new
  // item arrives. Wired in but not strictly necessary for the prototype.

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleAdd = ({ title, priority, description }) => {
    const newTodo = {
      id: uid(),
      title,
      priority,
      description,
      created: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };
    setTodos((arr) => [...arr, newTodo]);
    setAddOpen(false);
  };
  const handleToggle = (id) => {
    setTodos((arr) => arr.filter((x) => x.id !== id)); // popping = done = remove for this prototype
  };
  const handleDelete = (id) => {
    setTodos((arr) => arr.filter((x) => x.id !== id));
  };

  const detailTodo = detailId ? todos.find((x) => x.id === detailId) : null;

  const active = todos.length;
  const done = 2; // demo: cosmetic

  // ─── Scene rendering ─────────────────────────────────────────────────────
  const sceneIsActive = t.scene === 'active';
  const sceneIsEmpty = t.scene === 'empty';
  const sceneIsLoading = t.scene === 'loading';
  const sceneIsRecon = t.scene === 'reconnecting';

  const displayedTodos = sceneIsEmpty || sceneIsLoading ? [] : todos;

  return (
    <div className="buoy-app">
      <ScenePicker scene={t.scene} setScene={(v) => setTweak('scene', v)} />

      <BuoyHeader
        active={sceneIsEmpty || sceneIsLoading ? 0 : active}
        done={sceneIsEmpty || sceneIsLoading ? 0 : done}
        sync={syncState} />
      

      <div className="buoy-canvas-wrap">
        {sceneIsRecon &&
        <BuoyBanner attempt={retryAttempt} onRetry={() => setRetryAttempt(1)} />
        }

        {sceneIsLoading && <BuoyLoading />}
        {sceneIsEmpty && <BuoyEmpty onAdd={() => setAddOpen(true)} />}

        {(sceneIsActive || sceneIsRecon) &&
        <BuoyCanvas
          todos={displayedTodos}
          density={t.density}
          motion={t.motion}
          onToggle={handleToggle}
          onOpenDetail={(id) => setDetailId(id)}
          onDelete={handleDelete}
          paused={false} />

        }
      </div>

      <BuoyFooter open={addOpen} onToggleFab={() => setAddOpen((v) => !v)} />

      {addOpen &&
      <BuoyAddModal
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd} />

      }
      {detailTodo &&
      <BuoyDetailOverlay
        todo={detailTodo}
        onClose={() => setDetailId(null)}
        onDelete={handleDelete}
        onToggle={handleToggle} />

      }

      <TweaksPanel title="Tweaks">
        <TweakSection label="Direction" />
        <TweakRadio
          label="Direction"
          value={t.direction}
          options={['daydream', 'nightswim']}
          onChange={(v) => setTweak('direction', v)} />
        
        {t.direction === 'daydream' &&
        <TweakRadio
          label="Theme"
          value={t.theme}
          options={['light', 'dark']}
          onChange={(v) => setTweak('theme', v)} />

        }

        <TweakSection label="Motion" />
        <TweakRadio
          label="Intensity"
          value={t.motion}
          options={['calm', 'normal', 'lively']}
          onChange={(v) => setTweak('motion', v)} />
        

        <TweakSection label="Density" />
        <TweakSelect
          label="Bubbles on screen"
          value={t.density}
          options={[
          { value: 'sparse', label: '3 — sparse' },
          { value: 'normal', label: '7 — normal' },
          { value: 'full', label: '12 — full' },
          { value: 'swarm', label: '20 — swarm' }]
          }
          onChange={(v) => setTweak('density', v)} />
        

        <TweakSection label="Quick actions" />
        <TweakButton label="Open add modal" onClick={() => setAddOpen(true)} />
        <TweakButton label="Open detail (first bubble)" onClick={() => todos[0] && setDetailId(todos[0].id)} />
      </TweaksPanel>
    </div>);

}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);