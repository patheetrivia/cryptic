import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Playable Crossword (single-file React component)
 * -------------------------------------------------
 * Features
 * - Arrow‑key navigation, Tab to jump next clue, Shift+Tab previous clue
 * - Type letters to fill; Backspace/Delete to erase & move smartly
 * - Click any cell or clue to focus that entry
 * - Toggle direction with Space or by clicking the same cell
 * - Highlights current word; shows number badges in grid
 * - Check current cell / word / all, Reveal current word / all, Clear
 * - Mobile-friendly (touch to focus + on‑screen mini keypad)
 * - Lightweight: Tailwind classes only (no external UI libs required)
 *
 * How to use
 * - Drop this component into a Vite/Next/CRA app with Tailwind
 * - Replace `SAMPLE_PUZZLE` with your own (schema described below)
 * - Or pass a `puzzle` prop matching the schema
 *
 * Puzzle schema
 * {
 *   title: string,
 *   author: string,
 *   width: number,
 *   height: number,
 *   grid: string[]   // array of length `height`; each string length `width`; use '#' for black
 *   // OPTIONAL if you want built‑in checking: provide `solution` grid of same shape without '#'
 *   solution?: string[]
 *   clues: {
 *     across: Array<{ num: number, text: string }>,
 *     down:   Array<{ num: number, text: string }>
 *   }
 * }
 */

const SAMPLE_PUZZLE = {
  title: "Mini: Fall Favorites",
  author: "Pathee Trivia",
  width: 9,
  height: 9,
  grid: [
    "APPLE####",
    "P#A#L#E#S",
    "PUMPKIN#T",
    "E#I#O#A#T",
    "#####LEAF",
    "T#R#E#E#S",
    "TEA#####R",
    "A#U#T#U#M",
    "RT###HAY#",
  ],
  solution: [
    "APPLE####",
    "P#A#L#E#S",
    "PUMPKIN#T",
    "E#I#O#A#T",
    "#####LEAF",
    "T#R#E#E#S",
    "TEA#####R",
    "A#U#T#U#M",
    "RT###HAY#",
  ],
  clues: {
    across: [
      { num: 1, text: "Pie fruit" },
      { num: 6, text: "Selling events" },
      { num: 7, text: "Spice‑laden orange gourd" },
      { num: 9, text: "Hot drink" },
      { num: 10, text: "Autumn dropper" },
      { num: 12, text: "Plural woods" },
      { num: 13, text: "___ time (season seen in leaves)" },
      { num: 15, text: "Baled barn stuff" },
    ],
    down: [
      { num: 1, text: "Alphabet sequence start" },
      { num: 2, text: "Compass dir." },
      { num: 3, text: "Pronoun for a woman" },
      { num: 4, text: "Note after RE" },
      { num: 5, text: "Beverage temp." },
      { num: 8, text: "Trees in a wood" },
      { num: 11, text: "Opposite of cold" },
      { num: 14, text: "Farm building" },
    ],
  },
};

function clsx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function buildNumbering(grid, w, h) {
  const N = w * h;
  const numbers = Array(N).fill(null);
  const startsAcross = Array(N).fill(false);
  const startsDown = Array(N).fill(false);
  const mapAcross = new Map();
  const mapDown = new Map();
  let curNum = 1;
  const isBlack = (i) => grid[i] === '#';

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (isBlack(i)) continue;

      // PUZ-standard starts (require a following open square)
      const startA = (c === 0 || isBlack(i - 1)) && (c + 1 < w && !isBlack(i + 1));
      const startD = (r === 0 || isBlack(i - w)) && (r + 1 < h && !isBlack(i + w));

      if (startA || startD) {
        numbers[i] = curNum++;
      }

      if (startA) {
        startsAcross[i] = true;
        const run = [];
        let cc = c;
        while (cc < w && !isBlack(r * w + cc)) { run.push(r * w + cc); cc++; }
        mapAcross.set(numbers[i], run);
      }

      if (startD) {
        startsDown[i] = true;
        const run = [];
        let rr = r;
        while (rr < h && !isBlack(rr * w + c)) { run.push(rr * w + c); rr++; }
        mapDown.set(numbers[i], run);
      }
    }
  }

  return { numbers, startsAcross, startsDown, mapAcross, mapDown };
}


function indexToRC(i, w) { return { r: Math.floor(i / w), c: i % w }; }

function useCrossword(puzzleProp) {
  const puzzle = puzzleProp || SAMPLE_PUZZLE;
  const { width: W, height: H } = puzzle;

  const flatGrid = useMemo(() => puzzle.grid.join("").split("") , [puzzle]);
  const flatSol  = useMemo(() => (puzzle.solution ? puzzle.solution.join("").split("") : null), [puzzle]);

  const numbering = useMemo(() => buildNumbering(flatGrid, W, H), [flatGrid, W, H]);
  const [cells, setCells] = useState(() => flatGrid.map(ch => (ch === '#' ? '#' : '')));
  const [dir, setDir] = useState('across'); // 'across' | 'down'
  const [focus, setFocus] = useState(null);

  useEffect(() => {
  // if focus hasn't been set yet, pick the first non-black cell once
  if (focus == null) {
    const first = flatGrid.findIndex(ch => ch !== '#');
    if (first !== -1) setFocus(first);
  }
}, [focus, flatGrid]);

  // Build clue lists keyed by number -> clue text
  const clueTextA = useMemo(() => new Map(puzzle.clues.across.map(c => [c.num, c.text])), [puzzle]);
  const clueTextD = useMemo(() => new Map(puzzle.clues.down.map(c => [c.num, c.text])), [puzzle]);

  const currentClue = useMemo(() => {
  if (focus == null) return null;
  const start = startIndexOf(focus, dir);
  if (start == null) return null;
  const n = numbering.numbers[start];
  if (!n) return null;
  const text = (dir === 'across' ? clueTextA : clueTextD).get(n) || '';
  return { num: n, dir, text };
}, [focus, dir, numbering, clueTextA, clueTextD]);

function startIndexOf(i, dir) {
  if (i == null) return null;
  const { r, c } = indexToRC(i, W);

  if (dir === 'across') {
    let cc = c;
    while (cc > 0 && flatGrid[r * W + (cc - 1)] !== '#') cc--;
    return r * W + cc;
  } else {
    let rr = r;
    while (rr > 0 && flatGrid[(rr - 1) * W + c] !== '#') rr--;
    return rr * W + c;
  }
}

// Returns the full run that CONTAINS index `i` in the given direction.
function runAt(i, dir) {
  const start = startIndexOf(i, dir);
  if (start == null) return [];
  const n = numbering.numbers[start];        // <-- number is on the START cell
  if (!n) return [];
  return dir === 'across'
    ? (numbering.mapAcross.get(n) || [])
    : (numbering.mapDown.get(n)   || []);
}

  // Helper to get current run indices
  function getCurrentRun() {
  if (focus == null) return [];
  const start = startIndexOf(focus, dir);      // ← find the start of the word
  if (start == null) return [];
  const n = numbering.numbers[start];          // ← numbers[] only exists at starts
  if (!n) return [];
  return dir === 'across'
    ? (numbering.mapAcross.get(n) || [])
    : (numbering.mapDown.get(n)   || []);
}

  // Move focus to next/prev cell respecting blacks
  function step(i, delta) {
    let j = i;
    do { j += delta; } while (j >= 0 && j < W*H && flatGrid[j] === '#');
    return (j >= 0 && j < W*H) ? j : i;
  }

  function move(dirKey) {
    if (focus == null) return;
    const { r, c } = indexToRC(focus, W);
    let target = focus;
    if (dirKey === 'left')  target = (c > 0)     ? focus - 1 : focus;
    if (dirKey === 'right') target = (c < W-1)   ? focus + 1 : focus;
    if (dirKey === 'up')    target = (r > 0)     ? focus - W : focus;
    if (dirKey === 'down')  target = (r < H-1)   ? focus + W : focus;
    if (flatGrid[target] === '#') target = focus; // block into wall
    setFocus(target);
  }

  function jumpToStartOfRun(run) { if (run.length) setFocus(run[0]); }
  function jumpToNextRun(forward = true) {
    // find current number in ordered list of that direction
    const map = dir === 'across' ? numbering.mapAcross : numbering.mapDown;
    const nums = Array.from(map.keys()).sort((a,b)=>a-b);
    if (!nums.length) return;
    let curNum = numbering.numbers[focus ?? 0];
    if (!curNum) {
      // find first available start in this direction near focus
      const n2 = nums[0];
      setFocus(map.get(n2)[0]);
      return;
    }
    const idx = nums.indexOf(curNum);
    const nextIdx = (idx + (forward ? 1 : -1) + nums.length) % nums.length;
    setFocus(map.get(nums[nextIdx])[0]);
  }

  function toggleDirection() { setDir(d => d === 'across' ? 'down' : 'across'); }

  function setCharAt(i, ch) {
    setCells(prev => {
      const next = [...prev];
      if (next[i] !== '#') next[i] = ch.toUpperCase();
      return next;
    });
  }

  function handleKey(e) {
  const key = e.key;

  // Only prevent defaults for keys we actually handle
  const handled =
    key === " " || key === "Tab" ||
    key === "Enter" ||
    key === "Backspace" || key === "Delete" ||
    key.startsWith("Arrow") ||
    /^[a-zA-Z]$/.test(key);

  if (!handled) return;

  e.preventDefault();

  setFocus(prevFocus => {
    if (prevFocus == null) return prevFocus;

    // Always compute run relative to the focus value we're updating from
    const run = runAt(prevFocus, dir);

    // Arrow keys
    if (key.startsWith("Arrow")) {
      setDir(key === "ArrowUp" || key === "ArrowDown" ? "down" : "across");
      const moveMap = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -W, ArrowDown: W };
      const delta = moveMap[key] || 0;
      const target = prevFocus + delta;
      if (target < 0 || target >= W * H || flatGrid[target] === "#") return prevFocus;
      return target;
    }

    // Toggle direction
    if (key === " ") {
      toggleDirection();
      return prevFocus;
    }

    // Tab navigation
    if (key === "Tab") {
      jumpToNextRun(!e.shiftKey);
      return prevFocus;
    }

    // Enter behaves like Tab (always forward)
    if (key === "Enter") {
      jumpToNextRun(true);
      return prevFocus;
    }

    // Backspace/Delete
    if (key === "Backspace" || key === "Delete") {
      setCells(prev => {
        const next = [...prev];
        if (next[prevFocus] && next[prevFocus] !== "#") {
          next[prevFocus] = "";
        } else {
          const pos = run.indexOf(prevFocus);
          const back = run[Math.max(0, pos - 1)];
          if (back != null) next[back] = "";
        }
        return next;
      });
      const pos = run.indexOf(prevFocus);
      const back = run[Math.max(0, pos - 1)];
      return back ?? prevFocus;
    }

    // Letters
    if (/^[a-zA-Z]$/.test(key)) {
      setCells(prev => {
        const next = [...prev];
        if (next[prevFocus] !== "#") next[prevFocus] = key.toUpperCase();
        return next;
      });
      const pos = run.indexOf(prevFocus);
      const nextIdx = run[pos + 1];
      return nextIdx ?? prevFocus;
    }

    return prevFocus;
  });
}



  function cellStatus(i) {
    // returns { isBlack, number, isFocused, inRun, isIncorrect }
    const isBlack = flatGrid[i] === '#';
    const number = numbering.numbers[i];
    const inRun = getCurrentRun().includes(i);
    const isFocused = i === focus;
    let isIncorrect = false;
    if (flatSol && cells[i] && cells[i] !== '#') {
      isIncorrect = cells[i] !== flatSol[i];
    }
    return { isBlack, number, isFocused, inRun, isIncorrect };
  }

  function selectCell(i) {
  if (flatGrid[i] === '#') return;

  // clicking the same cell toggles direction (keeps your old behavior)
  if (i === focus) { toggleDirection(); return; }

  // Prefer the Across clue when both exist, otherwise pick Down if only Down exists
  const a = runAt(i, 'across');
  const d = runAt(i, 'down');
  const newDir = a.length ? 'across' : (d.length ? 'down' : dir);

  setDir(newDir);
  setFocus(i);
}

  // Checking & revealing utilities
  function checkCurrent(runOnly = true) {
  if (!flatSol) return;
  setCells(prev => {
    const allIndexes = () => prev.map((_, i) => i);
    const run = focus == null ? [] : runAt(focus, dir);
    const scope = runOnly ? (Array.isArray(run) ? run : []) : allIndexes();
    if (!scope.length) return prev;

    const next = [...prev];
    for (let k = 0; k < scope.length; k++) {
      const i = scope[k];
      if (flatGrid[i] === '#') continue;
      if (next[i] && next[i] !== flatSol[i]) next[i] = '';
    }
    return next;
  });
}
  function revealCurrent(runOnly = true) {
  if (!flatSol) return;
  setCells(prev => {
    const allIndexes = () => prev.map((_, i) => i);
    const run = focus == null ? [] : runAt(focus, dir);
    const scope = runOnly ? (Array.isArray(run) ? run : []) : allIndexes();
    if (!scope.length) return prev;

    const next = [...prev];
    for (let k = 0; k < scope.length; k++) {
      const i = scope[k];
      if (flatGrid[i] === '#') continue;
      next[i] = flatSol[i];
    }
    return next;
  });
}
  function clearAll() {
    setCells(prev => prev.map((ch, i) => (flatGrid[i] === '#') ? '#' : ''));
  }

  function clickClue(dirWanted, n) {
    setDir(dirWanted);
    const map = dirWanted === 'across' ? numbering.mapAcross : numbering.mapDown;
    const run = map.get(n);
    if (run && run.length) setFocus(run[0]);
  }

  // Completion status
  const isComplete = useMemo(() => {
    if (!flatSol) return false;
    for (let i = 0; i < W*H; i++) {
      if (flatGrid[i] === '#') continue;
      if (cells[i] !== flatSol[i]) return false;
    }
    return true;
  }, [cells, flatSol, flatGrid, W, H]);

  return {
    puzzle,
    W, H,
    cells, setCells,
    dir, setDir,
    focus, setFocus,
    numbering,
    getCurrentRun,
    currentClue,
    handlers: { handleKey, selectCell, checkCurrent, revealCurrent, clearAll, jumpToStartOfRun, jumpToNextRun },
    clickClue,
    isComplete,
  };
}

export default function AppRouter() {
  // If URL has ?p=... treat it as a PUZ path (e.g., /puzzles/example.puz)
  const [puzzle, setPuzzle] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p');
    if (!p) return; // index mode
    setLoading(true);
    fetch(p)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(buf => puzToPuzzle(buf))
      .then(json => setPuzzle(json))
      .catch(e => setError(String(e)))
      .finally(()=>setLoading(false));
  }, []);

  if (new URLSearchParams(window.location.search).get('p')) {
    // Play mode
    if (loading) return <div className="min-h-screen grid place-items-center">Loading puzzle…</div>;
    if (error) return <div className="min-h-screen grid place-items-center text-red-600">{error}</div>;
    if (!puzzle) return null;
    return <CrosswordShell puzzle={puzzle} />;
  }

  // Index mode: list puzzles from /puzzles/index.json
  return <PuzzleIndex />;
}


function CrosswordShell({ puzzle }) {
  const {
    puzzle: P,
    W, H,
    cells,
    dir,
    focus,
    numbering,
    getCurrentRun,
    currentClue,
    handlers,
    clickClue,
    isComplete,
  } = useCrossword(puzzle);

  const boardRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
    console.log("KEY:", e.key);
    handlers.handleKey(e);
  };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);

  const buildClueList = (dir) => {
    const map = dir === 'across' ? numbering.mapAcross : numbering.mapDown;
    const nums = Array.from(map.keys()).sort((a,b)=>a-b);
    const textMap = dir === 'across' ? new Map(P.clues.across.map(c => [c.num, c.text]))
                                     : new Map(P.clues.down.map(c => [c.num, c.text]));
    return nums.map(n => ({ num: n, text: textMap.get(n) || '' }));
  };

  const acrossList = React.useMemo(() => buildClueList('across'), [numbering, P]);
  const downList   = React.useMemo(() => buildClueList('down'),   [numbering, P]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="max-w-6xl mx-auto px-4 py-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{P.title}</h1>
          <p className="text-sm text-gray-600">by {P.author}</p>
           {currentClue && (
      <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded">
        <p className="text-sm text-gray-800">
          <span className="font-bold uppercase">{currentClue.dir}</span>{' '}
          {currentClue.num}. {currentClue.text}
        </p>
      </div>
    )}
          {isComplete && (
            <div className="mt-2 inline-block rounded-xl px-3 py-1 bg-green-100 text-green-800 text-sm font-medium">Solved! 🎉</div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={import.meta.env.BASE_URL} className="px-3 py-2 rounded-2xl shadow bg-white hover:bg-gray-50">← All puzzles</a>
          <button onClick={()=>handlers.checkCurrent(true)} className="px-3 py-2 rounded-2xl shadow bg-white hover:bg-gray-50">Check word</button>
          <button onClick={()=>handlers.revealCurrent(true)} className="px-3 py-2 rounded-2xl shadow bg-white hover:bg-gray-50">Reveal word</button>
          <button onClick={()=>handlers.checkCurrent(false)} className="px-3 py-2 rounded-2xl shadow bg-white hover:bg-gray-50">Check all</button>
          <button onClick={()=>handlers.revealCurrent(false)} className="px-3 py-2 rounded-2xl shadow bg-white hover:bg-gray-50">Reveal all</button>
          <button onClick={handlers.clearAll} className="px-3 py-2 rounded-2xl shadow bg-white hover:bg-gray-50">Clear</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-16 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
        <div className="flex justify-center">
          <div ref={boardRef} tabIndex={0} className="relative outline-none">
            <Board W={W} H={H} cells={cells} numbering={numbering} focus={focus} getCurrentRun={getCurrentRun} dir={dir} />
            <GridOverlay
              W={W}
              H={H}
              numbering={numbering}
              onCellClick={(i) => {
                handlers.selectCell(i);
                boardRef.current?.focus(); // ← lets you type immediately
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CluePanel title="Across" list={acrossList} dir="across" active={dir} currentNum={currentClue?.num} onClick={clickClue} />
          <CluePanel title="Down"   list={downList}   dir="down"   active={dir} currentNum={currentClue?.num} onClick={clickClue} />
        </div>
      </main>
      <MobileKeys onKey={(k)=>{ const e = new KeyboardEvent('keydown', { key: k }); document.activeElement?.dispatchEvent(e); }} />
      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-gray-500">Crossword component © {new Date().getFullYear()}</footer>
    </div>
  );
}

// ------- Simple PUZ parser (ignores checksums) -------
// ------- Simple PUZ parser (ignores checksums) -------
function puzToPuzzle(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);

  const W = bytes[0x2C];
  const H = bytes[0x2D];
  const clueCount = dv.getUint16(0x2E, true);
  const N = W * H;

  let off = 0x34;

  // --- read solution and state grids (state unused) ---
  const solBytes = bytes.slice(off, off + N); off += N;
  const stateBytes = bytes.slice(off, off + N); off += N; // unused
  const sol = Array.from(solBytes, b => String.fromCharCode(b));

  // --- robust C-string reader: UTF-8 with CP-1252 fallback ---
  const decUtf8 = new TextDecoder('utf-8', { fatal: false });
  const dec1252 = new TextDecoder('windows-1252');

  function readCString() {
    const start = off;
    while (off < bytes.length && bytes[off] !== 0) off++;
    const view = bytes.subarray(start, off);
    off++; // skip NUL

    if (view.length === 0) return '';

    const utf = decUtf8.decode(view);
    if (!utf.includes('\uFFFD')) return utf;

    const win = dec1252.decode(view);
    if (!win.includes('\uFFFD')) return win;

    return win.length >= utf.length ? win : utf;
  }

  // --- metadata + clues ---
  const title = readCString();
  const author = readCString();
  const copyright = readCString();

  const cluesRaw = [];
  for (let i = 0; i < clueCount; i++) cluesRaw.push(readCString());

  const notes = off < bytes.length ? readCString() : '';

  // --- normalize grid to '#' or letters ---
  const grid = sol.map(ch => (ch === '.' || ch === '#') ? '#' : ch);

  // --- numbering maps ---
  const numbering = buildNumbering(grid, W, H);

  // --- determine Across/Down order by scanning grid row-major ---
  const order = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      if (grid[i] === '#') continue;

      const startA = (c === 0 || grid[i - 1] === '#') && (c + 1 < W && grid[i + 1] !== '#');
      const startD = (r === 0 || grid[i - W] === '#') && (r + 1 < H && grid[i + W] !== '#');

      if (startA) order.push({ dir: 'across', num: numbering.numbers[i] });
      if (startD) order.push({ dir: 'down',   num: numbering.numbers[i] });
    }
  }

  // --- assign clue text in that exact order ---
  let idx = 0;
  const acrossClues = [];
  const downClues = [];
  for (const entry of order) {
    const text = cluesRaw[idx++] || '';
    if (entry.dir === 'across') acrossClues.push({ num: entry.num, text });
    else                        downClues.push({   num: entry.num, text });
  }

  const asRows = (arr) =>
    Array.from({ length: H }, (_, r) => arr.slice(r * W, (r + 1) * W).join(''));

  return {
    title: title || 'Untitled',
    author: author || 'Unknown',
    width: W,
    height: H,
    grid: asRows(grid),
    solution: asRows(sol.map(ch => (ch === '.' || ch === '#') ? '#' : ch)),
    clues: { across: acrossClues, down: downClues },
    notes,
  };
}

function PuzzleIndex() {
  const [items, setItems] = React.useState([]);
  const [err, setErr] = React.useState(null);

  // Always build URLs from the Vite base
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const url = `${window.location.origin}${import.meta.env.BASE_URL}puzzles/index.json`;

  React.useEffect(() => {
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.json(); })
      .then(setItems)
      .catch(e => setErr(String(e)));
  }, [url]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Cryptic Archives</h1>
      <p className="text-gray-600 mb-6">Click a puzzle to start solving! </p>
      {err && <div className="text-red-600 mb-4">{err}</div>}
      <ul className="space-y-3">
        {items.map((it) => {
          // Build a play URL like: /cryptic.github.io/?p=/cryptic.github.io/puzzles/foo.puz
          const playUrl = `${base}/?p=${encodeURIComponent(`${base}/puzzles/${it.file}`)}`;
          return (
            <li key={it.slug} className="bg-white rounded-2xl shadow p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{it.title}</div>
                <div className="text-sm text-gray-600">by {it.author} • {it.date}</div>
              </div>
              <a href={playUrl} className="px-3 py-2 rounded-xl bg-gray-900 text-white">Play</a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Board({ W, H, cells, numbering, focus, getCurrentRun, dir }) {
  const size = Math.min(520, Math.min(window.innerWidth - 32, 640));
  const cellPx = Math.floor(size / Math.max(W, H));
  return (
    <div className="relative" style={{ width: cellPx*W, height: cellPx*H }}>
      {/* Base grid */}
      <svg width={cellPx * W} height={cellPx * H} className="rounded-2xl shadow bg-white">
  {Array.from({ length: H }).map((_, r) =>
    Array.from({ length: W }).map((_, c) => {
      const i = r * W + c;
      const isBlack = cells[i] === '#';
      const inRun = getCurrentRun().includes(i);
      const isFocused = i === focus;

      return (
        <g key={i}>
          {/* Cell rectangle */}
          <rect
            x={c * cellPx}
            y={r * cellPx}
            width={cellPx}
            height={cellPx}
            className={clsx(
              'stroke-gray-300',
              isBlack ? 'fill-gray-900' : inRun ? 'fill-yellow-100' : 'fill-white',
              !isBlack && isFocused ? 'stroke-2 stroke-yellow-600' : ''
            )}
          />

          {/* Number badge */}
          {numbering.numbers[i] && (
            <text
              x={c * cellPx + 4}
              y={r * cellPx + 12}
              className="text-[10px] fill-gray-500 select-none"
            >
              {numbering.numbers[i]}
            </text>
          )}

          {/* Letter */}
          {!isBlack && (
            <text
              x={c * cellPx + cellPx / 2}
              y={r * cellPx + cellPx * 0.65}
              textAnchor="middle"
              fill="black"
              fontFamily="sans-serif"
              fontSize={Math.floor(cellPx * 0.6)}
              fontWeight="600"
              dominantBaseline="middle"
              className="select-none"
            >
              {cells[i] || ''}
            </text>
          )}
        </g>
      );
    })
  )}
</svg>
    </div>
  );
}

function GridOverlay({ W, H, onCellClick }) {
  return (
    <div className="absolute inset-0 z-10">
      <div
        className="grid w-full h-full"
        style={{
          gridTemplateColumns: `repeat(${W}, 1fr)`,
          gridTemplateRows: `repeat(${H}, 1fr)`,
        }}
      >
        {Array.from({ length: W * H }).map((_, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            className="w-full h-full bg-transparent focus:outline-none"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCellClick(i)}
            aria-label={`Cell ${i}`}
          />
        ))}
      </div>
    </div>
  );
}


function CluePanel({ title, list, dir, active, currentNum, onClick }) {
  return (
    <section className="bg-white rounded-2xl shadow p-4 max-h-[60vh] overflow-auto">
      <h2 className="font-semibold text-lg mb-2">{title}</h2>
      <ol className="space-y-1">
        {list.map(({ num, text }) => (
          <li key={num}>
            <button
              onClick={()=>onClick(dir, num)}
              className={clsx(
                'w-full text-left px-2 py-1 rounded-xl',
                active === dir && currentNum === num ? 'bg-yellow-100' : 'hover:bg-gray-50'
              )}
            >
              <span className="font-semibold w-10 inline-block">{num}</span>
              <span className="text-gray-700">{text}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MobileKeys({ onKey }) {
  // Shown on small screens; also handy for testing
  const keys = [
    'Q','W','E','R','T','Y','U','I','O','P',
    'A','S','D','F','G','H','J','K','L',
    'Z','X','C','V','B','N','M'
  ];
  return (
    <div className="fixed bottom-0 inset-x-0 md:hidden bg-white/90 backdrop-blur border-t border-gray-200 p-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 mb-2">
          <button onClick={()=>onKey(' ')} className="px-3 py-2 rounded-xl bg-gray-100">Dir</button>
          <button onClick={()=>onKey('Tab')} className="px-3 py-2 rounded-xl bg-gray-100">Next</button>
          <button onClick={()=>onKey('Backspace')} className="px-3 py-2 rounded-xl bg-gray-100">⌫</button>
        </div>
        <div className="grid grid-cols-10 gap-1">
          {keys.map(k => (
            <button key={k} onClick={()=>onKey(k)} className="px-2 py-2 rounded-md bg-gray-100 active:bg-gray-200">{k}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
