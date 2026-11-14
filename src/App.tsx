import { useState, useMemo, useCallback } from 'react';

/* ──────────────── Types ──────────────── */
interface StockItem {
  id: number;
  length: number;
  quantity: number;
}

interface RequiredPiece {
  id: number;
  length: number;
  quantity: number;
}

interface PlacedPiece {
  length: number;
  start: number;
  end: number;
}

interface CutBoard {
  stockLength: number;
  stockId: number;
  pieces: PlacedPiece[];
  usedLength: number;
  waste: number;
}

/* ──────────────── Palette ──────────────── */
const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#d946ef',
];

function colorFor(length: number, map: Map<number, string>): string {
  if (!map.has(length)) {
    map.set(length, PALETTE[map.size % PALETTE.length]);
  }
  return map.get(length)!;
}

/* ──────────────── Optimiser ────────────────
   Best Fit Decreasing — для каждой детали ищем рейку,
   где остаток минимален, но достаточен. Учитываем
   ограниченное количество материала каждого размера.
*/
function optimise(
  stock: StockItem[],
  required: RequiredPiece[],
  kerf: number,
): { boards: CutBoard[]; unplaced: { length: number; count: number }[] } {
  // Раскрываем склад в список доступных реек
  type Available = { length: number; stockId: number; remaining: number };
  const available: Available[] = stock
    .filter(s => s.quantity > 0 && s.length > 0)
    .map(s => ({ length: s.length, stockId: s.id, remaining: s.quantity }));

  // Активные рейки (частично заполненные)
  const boards: CutBoard[] = [];

  // Раскрываем все детали
  const allPieces: { length: number }[] = [];
  required.forEach(r => {
    for (let i = 0; i < r.quantity; i++) allPieces.push({ length: r.length });
  });
  // Сортируем по убыванию
  allPieces.sort((a, b) => b.length - a.length);

  const unplacedMap = new Map<number, number>();

  for (const piece of allPieces) {
    let bestBoardIdx = -1;
    let bestWaste = Infinity;

    // Ищем лучшую существующую рейку (минимальный остаток, но достаточный)
    for (let i = 0; i < boards.length; i++) {
      const b = boards[i];
      const needed = piece.length + (b.pieces.length > 0 ? kerf : 0);
      const remaining = b.stockLength - b.usedLength;
      if (remaining >= needed) {
        const waste = remaining - needed;
        if (waste < bestWaste) {
          bestWaste = waste;
          bestBoardIdx = i;
        }
      }
    }

    if (bestBoardIdx >= 0) {
      const b = boards[bestBoardIdx];
      const start = b.usedLength + (b.pieces.length > 0 ? kerf : 0);
      b.pieces.push({ length: piece.length, start, end: start + piece.length });
      b.usedLength = start + piece.length;
      b.waste = b.stockLength - b.usedLength;
    } else {
      // Нужна новая рейка — ищем минимально подходящий размер из доступных
      let bestAvailIdx = -1;
      let bestAvailWaste = Infinity;

      for (let i = 0; i < available.length; i++) {
        const a = available[i];
        if (a.remaining > 0 && a.length >= piece.length) {
          const waste = a.length - piece.length;
          if (waste < bestAvailWaste) {
            bestAvailWaste = waste;
            bestAvailIdx = i;
          }
        }
      }

      if (bestAvailIdx >= 0) {
        const a = available[bestAvailIdx];
        a.remaining--;
        boards.push({
          stockLength: a.length,
          stockId: a.stockId,
          pieces: [{ length: piece.length, start: 0, end: piece.length }],
          usedLength: piece.length,
          waste: a.length - piece.length,
        });
      } else {
        // Нет подходящего материала
        unplacedMap.set(piece.length, (unplacedMap.get(piece.length) || 0) + 1);
      }
    }
  }

  const unplaced = Array.from(unplacedMap.entries()).map(([length, count]) => ({ length, count }));
  return { boards, unplaced };
}

/* ──────────────── Unique ID helper ──────────────── */
let _nextId = 100;
const nextId = () => ++_nextId;

/* ──────────────── App ──────────────── */
export default function App() {
  /* --- state --- */
  const [kerf, setKerf] = useState(3);

  const [stock, setStock] = useState<StockItem[]>([
    { id: nextId(), length: 2000, quantity: 20 },
  ]);

  const [required, setRequired] = useState<RequiredPiece[]>([
    { id: nextId(), length: 460, quantity: 12 },
    { id: nextId(), length: 310, quantity: 2 },
    { id: nextId(), length: 330, quantity: 2 },
    { id: nextId(), length: 500, quantity: 4 },
    { id: nextId(), length: 260, quantity: 2 },
  ]);

  /* --- derived --- */
  const colorMap = useMemo(() => new Map<number, string>(), []);
  // rebuild colorMap each render so new sizes get colours
  required.forEach(r => colorFor(r.length, colorMap));

  const { boards, unplaced } = useMemo(
    () => optimise(stock, required, kerf),
    [stock, required, kerf],
  );

  const totalStockUsed = boards.reduce((s, b) => s + b.stockLength, 0);
  const totalPiecesCut = boards.reduce((s, b) => s + b.pieces.length, 0);
  const totalPiecesUsed = boards.reduce((s, b) => s + b.pieces.reduce((a, p) => a + p.length, 0), 0);
  const totalWaste = totalStockUsed - totalPiecesUsed - Math.max(0, totalPiecesCut - boards.length) * kerf;
  const efficiency = totalStockUsed > 0 ? ((totalPiecesUsed / totalStockUsed) * 100).toFixed(1) : '0';
  const totalUnplaced = unplaced.reduce((s, u) => s + u.count, 0);

  /* --- callbacks --- */
  const updateStock = useCallback((id: number, field: 'length' | 'quantity', value: number) => {
    setStock(prev => prev.map(s => s.id === id ? { ...s, [field]: Math.max(0, value) } : s));
  }, []);
  const addStock = useCallback(() => setStock(prev => [...prev, { id: nextId(), length: 2000, quantity: 1 }]), []);
  const removeStock = useCallback((id: number) => setStock(prev => prev.filter(s => s.id !== id)), []);

  const updateReq = useCallback((id: number, field: 'length' | 'quantity', value: number) => {
    setRequired(prev => prev.map(r => r.id === id ? { ...r, [field]: Math.max(0, value) } : r));
  }, []);
  const addReq = useCallback(() => setRequired(prev => [...prev, { id: nextId(), length: 300, quantity: 1 }]), []);
  const removeReq = useCallback((id: number) => setRequired(prev => prev.filter(r => r.id !== id)), []);

  /* --- render --- */
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <span className="text-3xl">🪚</span> Оптимизатор раскроя
          </h1>
          <p className="text-gray-500 text-sm sm:ml-4">Универсальный калькулятор оптимального раскроя длинномерных материалов</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Summary ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card label="Реек нужно" value={String(boards.length)} color="text-emerald-400" />
          <Card label="Деталей вырезано" value={String(totalPiecesCut)} color="text-blue-400" />
          <Card label="Материал использован" value={`${totalStockUsed} мм`} color="text-cyan-400" />
          <Card label="Отходы" value={`${Math.round(totalWaste)} мм`} color="text-red-400" />
          <Card label="Эффективность" value={`${efficiency}%`} color="text-purple-400" />
          <Card label="Не хватает материала" value={totalUnplaced > 0 ? `${totalUnplaced} шт` : '✓'} color={totalUnplaced > 0 ? 'text-red-400' : 'text-emerald-400'} />
        </div>

        {/* ── Parameters ── */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ширина реза (мм)</label>
            <input
              type="number" min={0} value={kerf}
              onChange={e => setKerf(Number(e.target.value))}
              className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* ── Stock ── */}
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-3 bg-gray-800/60 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-amber-400 flex items-center gap-2">
                <span className="text-lg">📦</span> Имеющийся материал
              </h2>
              <button onClick={addStock} className="text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg px-3 py-1.5 transition-colors">
                + Добавить
              </button>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-gray-500 px-1">
                <span>Длина (мм)</span>
                <span>Количество (шт)</span>
                <span className="w-8" />
              </div>
              {stock.map(s => (
                <div key={s.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center bg-gray-800/50 rounded-lg p-2">
                  <input
                    type="number" min={1} value={s.length}
                    onChange={e => updateStock(s.id, 'length', Number(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <input
                    type="number" min={0} value={s.quantity}
                    onChange={e => updateStock(s.id, 'quantity', Number(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <button onClick={() => removeStock(s.id)} className="text-red-400 hover:text-red-300 w-8 h-8 flex items-center justify-center rounded hover:bg-red-900/30 transition-colors">✕</button>
                </div>
              ))}
              {stock.length === 0 && <p className="text-gray-600 text-sm text-center py-4">Добавьте имеющийся материал</p>}
            </div>
          </section>

          {/* ── Required ── */}
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-3 bg-gray-800/60 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-emerald-400 flex items-center gap-2">
                <span className="text-lg">✂️</span> Необходимые детали
              </h2>
              <button onClick={addReq} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-1.5 transition-colors">
                + Добавить
              </button>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 text-xs text-gray-500 px-1">
                <span className="w-4" />
                <span>Длина (мм)</span>
                <span>Количество (шт)</span>
                <span className="w-8" />
              </div>
              {required.map(r => (
                <div key={r.id} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center bg-gray-800/50 rounded-lg p-2">
                  <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: colorFor(r.length, colorMap) }} />
                  <input
                    type="number" min={1} value={r.length}
                    onChange={e => updateReq(r.id, 'length', Number(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <input
                    type="number" min={0} value={r.quantity}
                    onChange={e => updateReq(r.id, 'quantity', Number(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button onClick={() => removeReq(r.id)} className="text-red-400 hover:text-red-300 w-8 h-8 flex items-center justify-center rounded hover:bg-red-900/30 transition-colors">✕</button>
                </div>
              ))}
              {required.length === 0 && <p className="text-gray-600 text-sm text-center py-4">Добавьте необходимые детали</p>}
            </div>
          </section>
        </div>

        {/* ── Unplaced warning ── */}
        {totalUnplaced > 0 && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-red-400">Не хватает материала!</p>
              <p className="text-sm text-red-300 mt-1">
                Не удалось разместить: {unplaced.map(u => `${u.count} шт × ${u.length}мм`).join(', ')}.
                Добавьте больше реек подходящей длины.
              </p>
            </div>
          </div>
        )}

        {/* ── Cut plan ── */}
        {boards.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
              <span className="text-xl">📐</span> План раскроя — {boards.length} {boards.length === 1 ? 'рейка' : boards.length < 5 ? 'рейки' : 'реек'}
            </h2>

            {boards.map((board, bi) => (
              <div key={bi} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span className="bg-gray-800 text-emerald-400 text-xs font-mono px-2 py-0.5 rounded">#{bi + 1}</span>
                    <span className="text-sm text-gray-400">исходная рейка {board.stockLength} мм</span>
                  </h3>
                  <span className="text-sm text-gray-400">
                    Остаток: <span className={`font-mono font-bold ${board.waste < 50 ? 'text-red-400' : board.waste < 150 ? 'text-amber-400' : 'text-emerald-400'}`}>{board.waste} мм</span>
                  </span>
                </div>

                {/* Visual bar */}
                <div className="relative h-14 bg-gray-800 rounded-lg overflow-hidden mb-3 border border-gray-700">
                  {board.pieces.map((p, pi) => {
                    const leftPct = (p.start / board.stockLength) * 100;
                    const widthPct = (p.length / board.stockLength) * 100;
                    const color = colorFor(p.length, colorMap);
                    return (
                      <div
                        key={pi}
                        className="absolute top-0 h-full flex items-center justify-center text-xs font-bold text-white border-r-2 border-gray-950"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: color }}
                        title={`${p.length} мм (${p.start}–${p.end})`}
                      >
                        <span className="truncate px-1 drop-shadow">{p.length}</span>
                      </div>
                    );
                  })}
                  {/* Waste zone */}
                  {board.waste > 0 && (
                    <div
                      className="absolute top-0 h-full flex items-center justify-center text-[10px] text-gray-600"
                      style={{
                        left: `${(board.usedLength / board.stockLength) * 100}%`,
                        width: `${(board.waste / board.stockLength) * 100}%`,
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.04) 4px, rgba(255,255,255,0.04) 8px)',
                      }}
                    >
                      {board.waste > 80 ? `${board.waste}` : ''}
                    </div>
                  )}
                </div>

                {/* Piece chips */}
                <div className="flex flex-wrap gap-1.5">
                  {board.pieces.map((p, pi) => (
                    <span key={pi} className="inline-flex items-center gap-1 text-xs bg-gray-800 rounded px-2 py-1 border border-gray-700">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorFor(p.length, colorMap) }} />
                      <span className="text-gray-300 font-mono">{p.length}мм</span>
                      <span className="text-gray-600 text-[10px]">({p.start}–{p.end})</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── Table ── */}
        {boards.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-3 bg-gray-800/60 border-b border-gray-800">
              <h2 className="font-semibold text-emerald-400 flex items-center gap-2">
                <span className="text-lg">📋</span> Карта распиловки
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                    <th className="text-left py-2 px-4">Рейка</th>
                    <th className="text-left py-2 px-4">Исходная длина</th>
                    <th className="text-left py-2 px-4">Распил</th>
                    <th className="text-right py-2 px-4">Остаток</th>
                  </tr>
                </thead>
                <tbody>
                  {boards.map((b, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-emerald-400">#{i + 1}</td>
                      <td className="py-2.5 px-4 text-gray-400">{b.stockLength} мм</td>
                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {b.pieces.map((p, j) => (
                            <span key={j} className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: colorFor(p.length, colorMap) }} />
                              <span className="text-gray-300 font-mono text-xs">{p.length}</span>
                              {j < b.pieces.length - 1 && <span className="text-gray-700 mx-0.5">|</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono ${b.waste < 50 ? 'text-red-400' : b.waste < 150 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {b.waste} мм
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {boards.length === 0 && totalUnplaced === 0 && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-5xl mb-4">🪚</p>
            <p className="text-lg">Добавьте материал и детали для расчёта</p>
          </div>
        )}
      </main>

      <footer className="text-center text-gray-700 text-xs py-6 border-t border-gray-900 mt-8">
        Алгоритм Best Fit Decreasing · ширина реза {kerf} мм
      </footer>
    </div>
  );
}

/* ──────────────── Small components ──────────────── */
function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800">
      <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
