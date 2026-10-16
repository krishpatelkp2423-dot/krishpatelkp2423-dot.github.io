/* Modified chess: rules and computer opponent (no DOM, so it also runs in a Web Worker).
   A JavaScript port of the desktop game at github.com/krishpatelkp2423-dot/Chess_
   (pieces.py and ai.py).

   Rules: pieces move like normal chess, but there is no check or checkmate. The king is
   an ordinary piece worth 2 points and can be captured. Every capture scores the piece's
   value and the first player to 15 points wins. A player with no possible move skips their
   turn. Not included (same as the desktop game): castling and en passant.

   The board is an array of 64 strings, index = row * 8 + col. Row 0 is Black's back rank
   (the top of the board from White's side). Uppercase letters are White pieces, lowercase
   are Black and "" is an empty square. */
(function (global) {
  "use strict";

  var WIN_SCORE = 15;
  var POINTS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 2 };
  var START = [
    "r", "n", "b", "q", "k", "b", "n", "r",
    "p", "p", "p", "p", "p", "p", "p", "p",
    "", "", "", "", "", "", "", "",
    "", "", "", "", "", "", "", "",
    "", "", "", "", "", "", "", "",
    "", "", "", "", "", "", "", "",
    "P", "P", "P", "P", "P", "P", "P", "P",
    "R", "N", "B", "Q", "K", "B", "N", "R"
  ];

  /* ---------- rules ---------- */

  // Squares a knight or king can jump to from each square, worked out once.
  function jumps(steps) {
    var table = [];
    for (var sq = 0; sq < 64; sq++) {
      var r = sq >> 3, c = sq & 7, list = [];
      for (var i = 0; i < steps.length; i++) {
        var rr = r + steps[i][0], cc = c + steps[i][1];
        if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) list.push(rr * 8 + cc);
      }
      table.push(list);
    }
    return table;
  }
  var KNIGHT = jumps([[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]);
  var KING = jumps([[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]);
  var ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  var QUEEN_DIRS = ROOK_DIRS.concat(BISHOP_DIRS);

  function isWhite(piece) { return piece.charCodeAt(0) < 97; } // "A".."Z" sort before "a".."z"
  function colorOf(piece) { return isWhite(piece) ? "white" : "black"; }
  function other(color) { return color === "white" ? "black" : "white"; }

  /* Squares the piece on `sq` can move to. */
  function movesFrom(board, sq) {
    var piece = board[sq];
    if (piece === "") return [];
    var kind = piece.toLowerCase(), white = isWhite(piece), out = [];
    var r = sq >> 3, c = sq & 7, i, t, target;

    if (kind === "p") {
      var dir = white ? -1 : 1, nr = r + dir;
      if (nr >= 0 && nr < 8) {
        t = nr * 8 + c;
        if (board[t] === "") {
          out.push(t);
          var startRow = white ? 6 : 1;
          if (r === startRow && board[t + dir * 8] === "") out.push(t + dir * 8);
        }
        for (i = -1; i <= 1; i += 2) {
          var cc = c + i;
          if (cc < 0 || cc > 7) continue;
          target = board[nr * 8 + cc];
          if (target !== "" && isWhite(target) !== white) out.push(nr * 8 + cc);
        }
      }
    } else if (kind === "n" || kind === "k") {
      var table = (kind === "n" ? KNIGHT : KING)[sq];
      for (i = 0; i < table.length; i++) {
        target = board[table[i]];
        if (target === "" || isWhite(target) !== white) out.push(table[i]);
      }
    } else {
      var dirs = kind === "r" ? ROOK_DIRS : kind === "b" ? BISHOP_DIRS : QUEEN_DIRS;
      for (i = 0; i < dirs.length; i++) {
        var dr = dirs[i][0], dc = dirs[i][1], rr = r + dr, c2 = c + dc;
        while (rr >= 0 && rr < 8 && c2 >= 0 && c2 < 8) {
          t = rr * 8 + c2;
          target = board[t];
          if (target === "") {
            out.push(t);
          } else {
            if (isWhite(target) !== white) out.push(t);
            break;
          }
          rr += dr; c2 += dc;
        }
      }
    }
    return out;
  }

  /* Every move for `color` as [from, to] pairs. */
  function allMoves(board, color) {
    var white = color === "white", out = [];
    for (var sq = 0; sq < 64; sq++) {
      var piece = board[sq];
      if (piece === "" || isWhite(piece) !== white) continue;
      var targets = movesFrom(board, sq);
      for (var i = 0; i < targets.length; i++) out.push([sq, targets[i]]);
    }
    return out;
  }

  function isPromotion(board, from, to) {
    return board[from].toLowerCase() === "p" && (to < 8 || to >= 56);
  }

  /* Returns {board, captured} without changing `board`. A pawn reaching the far side
     becomes `promoteTo` ("q", "r", "b", "n" or "k"; a queen unless told otherwise). */
  function applyMove(board, from, to, promoteTo) {
    var next = board.slice(), piece = next[from], captured = next[to];
    next[to] = piece;
    next[from] = "";
    if (piece.toLowerCase() === "p" && (to < 8 || to >= 56)) {
      var p = promoteTo || "q";
      next[to] = isWhite(piece) ? p.toUpperCase() : p.toLowerCase();
    }
    return { board: next, captured: captured };
  }

  /* ---------- computer opponent ----------
     Minimax with alpha-beta pruning (negamax style), a captures-only quiescence search at
     the end of each line, and iterative deepening under a time limit. Positions are scored
     on material, the 15-point race, and where pieces stand (piece-square tables). */

  var WIN = 100000; // score for reaching WIN_SCORE; bigger than any normal evaluation
  var REPEAT_PENALTY = 25; // per earlier visit to the position a move leads to
  var MAX_QDEPTH = 6;
  var MATERIAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 200 };
  var POINT_VALUE = 100;    // what one scoreboard point is worth to the AI
  var ENDGAME_MATERIAL = 2600;

  // From White's side, row 0 first. Black pieces use the mirrored square (sq ^ 56).
  var PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
        0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
        -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
        -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
        0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20]
  };
  var KING_MIDDLEGAME = [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20];
  var KING_ENDGAME = [
    -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

  /* Score from White's point of view (positive = good for White). */
  function evaluate(board, whitePoints, blackPoints) {
    var total = (whitePoints - blackPoints) * POINT_VALUE, nonPawn = 0;
    for (var sq = 0; sq < 64; sq++) {
      var piece = board[sq];
      if (piece === "") continue;
      var kind = piece.toLowerCase();
      if (kind === "k") {
        // placement is added below, once we know whether it's the endgame
        total += isWhite(piece) ? MATERIAL.k : -MATERIAL.k;
        continue;
      }
      var value = MATERIAL[kind];
      if (kind !== "p") nonPawn += value;
      if (isWhite(piece)) total += value + PST[kind][sq];
      else total -= value + PST[kind][sq ^ 56];
    }
    var kingTable = nonPawn <= ENDGAME_MATERIAL ? KING_ENDGAME : KING_MIDDLEGAME;
    for (sq = 0; sq < 64; sq++) {
      var p = board[sq];
      if (p === "K") total += kingTable[sq];
      else if (p === "k") total -= kingTable[sq ^ 56];
    }
    return total;
  }

  function evaluateFor(board, color, points) {
    var v = evaluate(board, points[0], points[1]);
    return color === "white" ? v : -v;
  }

  /* Moves for `color`, best-looking first: captures of valuable pieces by cheap ones,
     then promotions, then quiet moves (during a search, quiet moves that caused cutoffs
     elsewhere go first). Each entry is [from, to, captured]. */
  function orderedMoves(board, color, capturesOnly, search, ply) {
    var white = color === "white", scored = [];
    for (var sq = 0; sq < 64; sq++) {
      var piece = board[sq];
      if (piece === "" || isWhite(piece) !== white) continue;
      var kind = piece.toLowerCase(), attacker = MATERIAL[kind];
      var targets = movesFrom(board, sq);
      for (var i = 0; i < targets.length; i++) {
        var to = targets[i], captured = board[to], order;
        var promotes = kind === "p" && (to < 8 || to >= 56);
        if (captured !== "") order = 10 * MATERIAL[captured.toLowerCase()] - attacker + 10000;
        else if (promotes) order = 9000;
        else if (capturesOnly) continue;
        else order = search ? search.quietOrder(sq, to, ply) : 0;
        scored.push([order, sq, to, captured]);
      }
    }
    scored.sort(function (a, b) { return b[0] - a[0]; });
    return scored.map(function (m) { return [m[1], m[2], m[3]]; });
  }

  function addPoints(color, captured, points) {
    if (captured === "") return points;
    var v = POINTS[captured.toLowerCase()];
    return color === "white" ? [points[0] + v, points[1]] : [points[0], points[1] + v];
  }

  function OutOfTime() {}

  function Search(deadline) {
    this.deadline = deadline;
    this.nodes = 0;
    this.killers = [];                    // per ply: the last two quiet moves that caused a cutoff
    this.history = new Int32Array(4096);  // per (from, to): how often it caused a cutoff
  }

  Search.prototype.quietOrder = function (from, to, ply) {
    var key = from * 64 + to, k = this.killers[ply];
    if (k && k[0] === key) return 8000;
    if (k && k[1] === key) return 7999;
    return Math.min(this.history[key], 7000);
  };

  Search.prototype.rememberCutoff = function (from, to, ply, depth) {
    var key = from * 64 + to, k = this.killers[ply] || (this.killers[ply] = [-1, -1]);
    if (k[0] !== key) { k[1] = k[0]; k[0] = key; }
    this.history[key] += depth * depth;
  };

  Search.prototype.tick = function () {
    this.nodes++;
    if (this.deadline !== null && (this.nodes & 1023) === 0 && now() > this.deadline) throw new OutOfTime();
  };

  /* Best score for `color` (the side to move) looking `depth` moves ahead. */
  Search.prototype.negamax = function (board, color, depth, alpha, beta, ply, points) {
    if (depth <= 0) return this.quiesce(board, color, alpha, beta, ply, points, 0);
    this.tick();
    var moves = orderedMoves(board, color, false, this, ply);
    if (moves.length === 0) return evaluateFor(board, color, points); // turn gets skipped
    var best = -WIN * 2, white = color === "white";
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], next = applyMove(board, m[0], m[1]).board;
      var np = addPoints(color, m[2], points);
      if ((white ? np[0] : np[1]) >= WIN_SCORE) return WIN - ply - 1; // this capture wins now
      var value = -this.negamax(next, other(color), depth - 1, -beta, -alpha, ply + 1, np);
      if (value > best) best = value;
      if (best > alpha) alpha = best;
      if (alpha >= beta) {
        if (m[2] === "") this.rememberCutoff(m[0], m[1], ply, depth);
        break;
      }
    }
    return best;
  };

  /* Only follow captures, so a position isn't scored in the middle of a trade. */
  Search.prototype.quiesce = function (board, color, alpha, beta, ply, points, qdepth) {
    this.tick();
    var standPat = evaluateFor(board, color, points);
    if (standPat >= beta || qdepth >= MAX_QDEPTH) return standPat;
    if (standPat > alpha) alpha = standPat;
    var moves = orderedMoves(board, color, true), white = color === "white";
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], np = addPoints(color, m[2], points);
      if ((white ? np[0] : np[1]) >= WIN_SCORE) return WIN - ply - 1;
      var value = -this.quiesce(applyMove(board, m[0], m[1]).board, other(color), -beta, -alpha, ply + 1, np, qdepth + 1);
      if (value >= beta) return value;
      if (value > alpha) alpha = value;
    }
    return alpha;
  };

  /* Scores every root move; with exact=false later moves only get an upper bound
     (faster), with exact=true every move gets its true score (for the Easy level).
     `seen` counts the positions already reached this game: going back to one costs
     REPEAT_PENALTY per earlier visit, so the AI tries something new instead of
     shuffling the same pieces back and forth forever. */
  Search.prototype.root = function (board, color, depth, rootMoves, points, exact, seen) {
    var alpha = -WIN * 2, beta = WIN * 2, results = [], white = color === "white";
    for (var i = 0; i < rootMoves.length; i++) {
      var m = rootMoves[i], res = applyMove(board, m[0], m[1]);
      var np = addPoints(color, res.captured, points), value;
      if ((white ? np[0] : np[1]) >= WIN_SCORE) {
        value = WIN - 1;
      } else {
        var penalty = seen ? (seen[positionKey(res.board, other(color))] || 0) * REPEAT_PENALTY : 0;
        // Search for the unpenalised score with a window that's right whether or not the
        // penalty ends up applying. A forced win or loss is never penalised: losing later
        // is always better than losing now, even if it means repeating a position.
        value = -this.negamax(res.board, other(color), depth - 1, -beta - penalty,
          exact ? WIN * 2 : -alpha, 1, np);
        if (Math.abs(value) < WIN - 100) value -= penalty;
      }
      results.push({ move: m, value: value, index: i });
      if (value > alpha) alpha = value;
    }
    // best first; ties keep the earlier (previously best) move first
    results.sort(function (a, b) { return b.value - a.value || a.index - b.index; });
    return results;
  };

  function now() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  // depth = most moves ahead, timeMs = most thinking time, slack = Easy picks at random
  // among moves scoring within this much (hundredths of a pawn) of the best one
  // Easy also widens its spread to `wildSlack` on a `wildChance` share of its moves, so
  // casual players can win; it still always takes a capture that wins the game.
  var LEVELS = {
    easy: { depth: 2, timeMs: 400, slack: 120, wildChance: 0.25, wildSlack: 350 },
    medium: { depth: 4, timeMs: 1500, slack: 0 },
    hard: { depth: 6, timeMs: 3000, slack: 0 }
  };

  /* A string naming a position and whose turn it is, for spotting repeated positions. */
  function positionKey(board, colorToMove) {
    return colorToMove.charAt(0) + board.map(function (p) { return p || "."; }).join("");
  }

  /* Pick a move for `color`. Returns {from, to, depth, score} or null if it has no move.
     `level` is "easy", "medium", "hard" or an options object; `seen` (optional) maps
     positionKey() strings to how many times that position has occurred this game. */
  function chooseMove(board, color, whitePoints, blackPoints, level, seen) {
    var opts = (typeof level === "string" ? LEVELS[level] : level) || LEVELS.medium;
    var rootMoves = allMoves(board, color);
    if (rootMoves.length === 0) return null;
    if (rootMoves.length === 1) return { from: rootMoves[0][0], to: rootMoves[0][1], depth: 0, score: 0 };

    // most promising first (captures, promotions)
    var rank = {};
    orderedMoves(board, color, false).forEach(function (m, i) { rank[m[0] * 64 + m[1]] = i; });
    rootMoves.sort(function (a, b) { return rank[a[0] * 64 + a[1]] - rank[b[0] * 64 + b[1]]; });

    var points = [whitePoints || 0, blackPoints || 0];
    var deadline = now() + opts.timeMs;
    var results = null, depthDone = 0, search = new Search(null);
    for (var depth = 1; depth <= opts.depth; depth++) {
      search.deadline = depth > 1 ? deadline : null; // depth 1 always finishes
      try {
        results = search.root(board, color, depth, rootMoves, points, opts.slack > 0, seen);
      } catch (e) {
        if (e instanceof OutOfTime) break;
        throw e;
      }
      depthDone = depth;
      rootMoves = results.map(function (r) { return r.move; });
      if (Math.abs(results[0].value) >= WIN - 100) break; // a sure win (or loss) was found
    }

    var pick = results[0];
    if (opts.slack > 0 && Math.abs(pick.value) < WIN - 100) {
      var slack = opts.wildChance && Math.random() < opts.wildChance ? opts.wildSlack : opts.slack;
      var close = results.filter(function (r) { return r.value >= pick.value - slack; });
      pick = close[Math.floor(Math.random() * close.length)];
    }
    return { from: pick.move[0], to: pick.move[1], depth: depthDone, score: pick.value };
  }

  global.ChessEngine = {
    WIN_SCORE: WIN_SCORE,
    POINTS: POINTS,
    START: START,
    LEVELS: LEVELS,
    isWhite: isWhite,
    colorOf: colorOf,
    other: other,
    movesFrom: movesFrom,
    allMoves: allMoves,
    isPromotion: isPromotion,
    applyMove: applyMove,
    evaluate: evaluate,
    positionKey: positionKey,
    chooseMove: chooseMove
  };
})(typeof self !== "undefined" ? self : this);
