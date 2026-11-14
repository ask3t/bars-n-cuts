import { useState, useMemo } from 'react';

interface CutPiece {
  length: number;
  quantity: number;
  label: string;
}

interface PlacedPiece {
  length: number;
  label: string;
  start: number;
  end: number;
}

interface Board {
  pieces: PlacedPiece[];
  usedLength: number;
  waste: number;
}

const KERF = 3; // ширина реза в мм
const BOARD_LENGTH = 2000; // длина рейки в мм

// Цвета для разных размеров деталей
const COLORS: Record<number, string> = {
  500: '#3b82f6',
  460: '#10b981',
  330: '#f59e0b',
  310: '#8b5cf6',
  260: '#ef4444',
};

function optimizeCutStock(pieces: CutPiece[], kerfWidth: number, boardLen: number): Board[] {
  // Создаём список всех деталей
  const allPieces: { length: number; label: string }[] = [];
  pieces.forEach(p => {
    for (let i = 0; i < p.quantity; i++) {
      allPieces.push({ length: p.length, label: p.label });
    }
  });

  // Сортируем по убыванию (First Fit Decreasing)
  allPieces.sort((a, b) => b.length - a.length);

  const boards: Board[] = [];

  for (const piece of allPieces) {
    let placed = false;

    // Пытаемся разместить в существующую рейку
    for (const board of boards) {
      const neededLength = piece.length + (board.pieces.length > 0 ? kerfWidth : 0);
      if (board.usedLength + neededLength <= boardLen) {
        const start = board.usedLength + (board.pieces.length > 0 ? kerfWidth : 0);
        board.pieces.push({
          length: piece.length,
          label: piece.label,
          start,
          end: start + piece.length,
        });
        board.usedLength = start + piece.length;
        board.waste = boardLen - board.usedLength;
        placed = true;
        break;
      }
    }

    // Если не разместили — создаём новую рейку
    if (!placed) {
      const newBoard: Board = {
        pieces: [{
          length: piece.length,
          label: piece.label,
          start: 0,
          end: piece.length,
        }],
        usedLength: piece.length,
        waste: boardLen - piece.length,
      };
      boards.push(newBoard);
    }
  }

  return boards;
}

function App() {
  const [kerf, setKerf] = useState(KERF);
  const [boardLength, setBoardLength] = useState(BOARD_LENGTH);

  const [pieces, setPieces] = useState<CutPiece[]>([
    { length: 460, quantity: 12, label: '460мм' },
    { length: 310, quantity: 2, label: '310мм' },
    { length: 330, quantity: 2, label: '330мм' },
    { length: 500, quantity: 4, label: '500мм' },
    { length: 260, quantity: 2, label: '260мм' },
  ]);

  const boards = useMemo(() => {
    return optimizeCutStock(pieces, kerf, boardLength);
  }, [pieces, kerf, boardLength]);

  const totalBoards = boards.length;
  const totalUsed = boards.reduce((sum, b) => sum + b.usedLength, 0);
  const totalPieces = pieces.reduce((sum, p) => sum + p.quantity, 0);
  const totalMaterial = totalBoards * boardLength;
  const totalWaste = totalMaterial - totalUsed - (totalPieces - totalBoards) * kerf;
  const efficiency = ((totalUsed / totalMaterial) * 100).toFixed(1);

  const updatePieceQuantity = (index: number, value: number) => {
    const newPieces = [...pieces];
    newPieces[index] = { ...newPieces[index], quantity: Math.max(0, value) };
    setPieces(newPieces);
  };

  const updatePieceLength = (index: number, value: number) => {
    const newPieces = [...pieces];
    newPieces[index] = { ...newPieces[index], length: Math.max(1, value) };
    setPieces(newPieces);
  };

  const addPiece = () => {
    setPieces([...pieces, { length: 300, quantity: 1, label: '300мм' }]);
  };

  const removePiece = (index: number) => {
    setPieces(pieces.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-emerald-400">
          🪑 Оптимизация раскроя реек для стула
        </h1>
        <p className="text-gray-400 mt-1">Алгоритм First Fit Decreasing с учётом ширины реза</p>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-emerald-400">{totalBoards}</div>
            <div className="text-sm text-gray-400">Реек 2000мм</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-blue-400">{totalPieces}</div>
            <div className="text-sm text-gray-400">Деталей всего</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-amber-400">{totalMaterial}мм</div>
            <div className="text-sm text-gray-400">Общий материал</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-red-400">{Math.round(totalWaste)}мм</div>
            <div className="text-sm text-gray-400">Отходы</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-3xl font-bold text-purple-400">{efficiency}%</div>
            <div className="text-sm text-gray-400">Эффективность</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4 text-emerald-400">⚙️ Параметры</h2>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Длина рейки (мм)</label>
              <input
                type="number"
                value={boardLength}
                onChange={e => setBoardLength(Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Ширина реза (мм)</label>
              <input
                type="number"
                value={kerf}
                onChange={e => setKerf(Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <h3 className="text-md font-semibold mb-3 text-gray-300">Детали для раскроя:</h3>

            <div className="space-y-3 mb-4">
              {pieces.map((piece, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-700 rounded-lg p-2">
                  <div
                    className="w-4 h-4 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: COLORS[piece.length] || '#6b7280' }}
                  />
                  <input
                    type="number"
                    value={piece.length}
                    onChange={e => updatePieceLength(index, Number(e.target.value))}
                    className="w-16 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
                  />
                  <span className="text-xs text-gray-400">мм ×</span>
                  <input
                    type="number"
                    value={piece.quantity}
                    onChange={e => updatePieceQuantity(index, Number(e.target.value))}
                    className="w-14 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white"
                  />
                  <span className="text-xs text-gray-400">шт</span>
                  <button
                    onClick={() => removePiece(index)}
                    className="ml-auto text-red-400 hover:text-red-300 text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addPiece}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              + Добавить деталь
            </button>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h4 className="text-sm text-gray-400 mb-2">Легенда:</h4>
              <div className="space-y-1">
                {pieces.map((piece, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: COLORS[piece.length] || '#6b7280' }}
                    />
                    <span className="text-gray-300">{piece.length}мм — {piece.quantity}шт</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Visualization */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400">
              📐 План раскроя ({totalBoards} {totalBoards === 1 ? 'рейка' : totalBoards < 5 ? 'рейки' : 'реек'})
            </h2>

            {boards.map((board, boardIndex) => (
              <div key={boardIndex} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-white">
                    Рейка #{boardIndex + 1}
                  </h3>
                  <span className="text-sm text-gray-400">
                    Остаток: <span className="text-amber-400 font-mono">{board.waste}мм</span>
                  </span>
                </div>

                {/* Visual bar */}
                <div className="relative h-12 bg-gray-700 rounded-lg overflow-hidden mb-3 border border-gray-600">
                  {board.pieces.map((piece, pieceIndex) => {
                    const leftPercent = (piece.start / boardLength) * 100;
                    const widthPercent = (piece.length / boardLength) * 100;
                    const color = COLORS[piece.length] || '#6b7280';

                    return (
                      <div
                        key={pieceIndex}
                        className="absolute top-0 h-full flex items-center justify-center text-xs font-bold text-white border-r border-gray-900/30"
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          backgroundColor: color,
                        }}
                      >
                        <span className="truncate px-1">{piece.length}</span>
                      </div>
                    );
                  })}
                  {/* Waste area */}
                  {board.waste > 0 && (
                    <div
                      className="absolute top-0 h-full flex items-center justify-center text-xs text-gray-500"
                      style={{
                        left: `${(board.usedLength / boardLength) * 100}%`,
                        width: `${(board.waste / boardLength) * 100}%`,
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 6px)',
                      }}
                    >
                      {board.waste > 60 ? `${board.waste}мм` : ''}
                    </div>
                  )}
                </div>

                {/* Cut details */}
                <div className="flex flex-wrap gap-2">
                  {board.pieces.map((piece, pieceIndex) => (
                    <div
                      key={pieceIndex}
                      className="flex items-center gap-1 text-xs bg-gray-700 rounded px-2 py-1"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: COLORS[piece.length] || '#6b7280' }}
                      />
                      <span className="text-gray-300 font-mono">{piece.length}мм</span>
                      <span className="text-gray-500">
                        ({piece.start}–{piece.end})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Detailed cut list */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mt-6">
              <h2 className="text-lg font-semibold text-emerald-400 mb-4">📋 Карта распиловки</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">Рейка</th>
                      <th className="text-left py-2 px-3 text-gray-400">Распил</th>
                      <th className="text-left py-2 px-3 text-gray-400">Остаток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boards.map((board, i) => (
                      <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 px-3 font-medium text-white">#{i + 1}</td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {board.pieces.map((piece, j) => (
                              <span key={j} className="inline-flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-sm inline-block"
                                  style={{ backgroundColor: COLORS[piece.length] || '#6b7280' }}
                                />
                                <span className="text-gray-300 font-mono text-xs">
                                  {piece.length}мм
                                </span>
                                {j < board.pieces.length - 1 && (
                                  <span className="text-gray-600">|</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`font-mono ${board.waste < 100 ? 'text-red-400' : board.waste < 200 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {board.waste}мм
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
