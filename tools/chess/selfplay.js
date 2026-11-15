/* Self-play experiments for the modified chess engine (assets/js/chess-engine.js).

   Plays the engine against itself at fixed search depths and prints what happened:
   who won, how long games lasted, and where the 15 winning points came from. The
   numbers in the "What the engine shows" section of projects/chess.html come from
   this script.

   Run from the repository root:   node tools/chess/selfplay.js
   Options:  --games 200   games per pairing (default 200)
             --seed 1      random seed (default 1)
             --json out.json   also write the results as JSON

   Everything is reproducible: searches are limited by depth, not by time, and all
   randomness (the opening moves) comes from a seeded generator. Each game starts
   with four random moves (two per side) so the games differ. When the two depths
   differ, every opening is played twice with the sides swapped, so neither engine
   gets the easier openings. When they are the same, every game gets its own opening
   (swapping sides would only replay the same game). */
"use strict";
var path = require("path");
var fs = require("fs");
// Outside a browser the engine attaches itself to the module's exports.
var E = require(path.join(__dirname, "..", "..", "assets", "js", "chess-engine.js")).ChessEngine;

var args = process.argv.slice(2);
function opt(name, fallback) {
  var i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}
var GAMES = parseInt(opt("games", "200"), 10);
var SEED = parseInt(opt("seed", "1"), 10);
var JSON_OUT = opt("json", null);
var MAX_PLIES = 400; // a game still going after this many moves counts as unfinished

// Small seeded random number generator (mulberry32).
function rng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function level(depth) { return { depth: depth, timeMs: 1e9, slack: 0 }; }

/* Four random opening moves (two per side), none of them captures. */
function randomOpening(random) {
  var board = E.START.slice(), color = "white", moves = [];
  for (var i = 0; i < 4; i++) {
    var quiet = E.allMoves(board, color).filter(function (m) { return board[m[1]] === ""; });
    var m = quiet[Math.floor(random() * quiet.length)];
    board = E.applyMove(board, m[0], m[1]).board;
    moves.push(m);
    color = E.other(color);
  }
  return moves;
}

/* Play one game. `levels` is {white, black}; `opening` is a list of [from, to] moves. */
function playGame(levels, opening) {
  var board = E.START.slice(), turn = "white", pts = { white: 0, black: 0 };
  var seen = {}, plies = 0, nodes = 0, searches = 0, skips = 0;
  var byPiece = { white: {}, black: {} }; // points scored, by the kind of piece captured
  var kingTaken = { white: false, black: false }; // whose king was captured
  var firstQueen = null; // who captured a queen first
  var result = null;
  seen[E.positionKey(board, turn)] = 1;

  while (plies < MAX_PLIES) {
    var move;
    if (plies < opening.length) {
      move = { from: opening[plies][0], to: opening[plies][1] };
    } else {
      move = E.chooseMove(board, turn, pts.white, pts.black, levels[turn], seen);
      nodes += move.nodes || 0;
      searches++;
    }
    var res = E.applyMove(board, move.from, move.to);
    board = res.board;
    plies++;
    if (res.captured !== "") {
      var kind = res.captured.toLowerCase();
      pts[turn] += E.POINTS[kind];
      byPiece[turn][kind] = (byPiece[turn][kind] || 0) + E.POINTS[kind];
      if (kind === "k") kingTaken[E.other(turn)] = true;
      if (kind === "q" && firstQueen === null) firstQueen = turn;
      if (pts[turn] >= E.WIN_SCORE) { result = turn; break; }
    }
    var next = E.other(turn);
    if (E.allMoves(board, next).length === 0) {
      if (E.allMoves(board, turn).length === 0) { result = "draw"; break; }
      skips++; // the other player can't move, so the same player goes again
    } else {
      turn = next;
    }
    var key = E.positionKey(board, turn);
    seen[key] = (seen[key] || 0) + 1;
  }
  return {
    result: result || "unfinished", plies: plies, points: pts, byPiece: byPiece,
    kingTaken: kingTaken, firstQueen: firstQueen, nodes: nodes, searches: searches, skips: skips
  };
}

function median(list) {
  var s = list.slice().sort(function (a, b) { return a - b; });
  var n = s.length;
  return n === 0 ? null : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
function pct(n, d) { return d === 0 ? "n/a" : (100 * n / d).toFixed(1) + "%"; }

/* Play `games` games between search depths a and b. */
function runPairing(a, b, games, random) {
  var out = {
    depthA: a, depthB: b, games: 0, winsA: 0, winsB: 0, draws: 0, unfinished: 0,
    whiteWins: 0, blackWins: 0, plies: [], winnerByPiece: {}, loserPoints: [],
    kingTakenGames: 0, winnerLostKing: 0, winnerTookKing: 0,
    queenGames: 0, firstQueenWon: 0, nodes: 0, searches: 0, skips: 0
  };
  var sides = a === b ? 1 : 2; // games per opening
  for (var g = 0; g < games / sides; g++) {
    var opening = randomOpening(random);
    for (var swap = 0; swap < sides; swap++) {
      var aIsWhite = swap === 0;
      var game = playGame({ white: level(aIsWhite ? a : b), black: level(aIsWhite ? b : a) }, opening);
      out.games++;
      out.nodes += game.nodes; out.searches += game.searches; out.skips += game.skips;
      if (game.result === "draw") { out.draws++; continue; }
      if (game.result === "unfinished") { out.unfinished++; continue; }
      var winner = game.result, loser = E.other(winner);
      if (winner === "white") out.whiteWins++; else out.blackWins++;
      if ((winner === "white") === aIsWhite) out.winsA++; else out.winsB++;
      out.plies.push(game.plies);
      out.loserPoints.push(game.points[loser]);
      Object.keys(game.byPiece[winner]).forEach(function (k) {
        out.winnerByPiece[k] = (out.winnerByPiece[k] || 0) + game.byPiece[winner][k];
      });
      if (game.kingTaken.white || game.kingTaken.black) out.kingTakenGames++;
      if (game.kingTaken[winner]) out.winnerLostKing++;
      if (game.kingTaken[loser]) out.winnerTookKing++;
      if (game.firstQueen !== null) {
        out.queenGames++;
        if (game.firstQueen === winner) out.firstQueenWon++;
      }
    }
  }
  return out;
}

function report(r) {
  var decided = r.winsA + r.winsB;
  var total = Object.keys(r.winnerByPiece).reduce(function (s, k) { return s + r.winnerByPiece[k]; }, 0);
  console.log("\nDepth " + r.depthA + " vs depth " + r.depthB + "  (" + r.games + " games)");
  if (r.depthA === r.depthB) console.log("  finished " + decided + ", draws " + r.draws + ", unfinished " + r.unfinished);
  else console.log("  depth " + r.depthA + " won " + r.winsA + ", depth " + r.depthB + " won " + r.winsB +
    ", draws " + r.draws + ", unfinished " + r.unfinished);
  console.log("  White won " + r.whiteWins + " (" + pct(r.whiteWins, decided) + "), Black won " + r.blackWins);
  console.log("  game length: median " + median(r.plies) + " moves (both sides counted), shortest " +
    Math.min.apply(null, r.plies) + ", longest " + Math.max.apply(null, r.plies));
  console.log("  loser's score at the end: median " + median(r.loserPoints));
  console.log("  winner's points by captured piece: " + ["q", "r", "b", "n", "p", "k"].map(function (k) {
    return k + " " + pct(r.winnerByPiece[k] || 0, total);
  }).join(", "));
  console.log("  a king was captured in " + pct(r.kingTakenGames, decided) + " of games; the winner took the loser's king in " +
    pct(r.winnerTookKing, decided) + " and lost its own king in " + pct(r.winnerLostKing, decided));
  console.log("  a queen was captured in " + pct(r.queenGames, decided) + " of games; whoever took a queen first won " +
    pct(r.firstQueenWon, r.queenGames) + " of those");
  console.log("  positions searched per move: " + Math.round(r.nodes / Math.max(1, r.searches)) + " on average; turns skipped: " + r.skips);
}

var PAIRINGS = [[4, 4], [4, 2], [4, 1], [2, 1]];
var started = Date.now();
var results = PAIRINGS.map(function (p, i) {
  var r = runPairing(p[0], p[1], GAMES, rng(SEED * 1000 + i)); // each pairing gets its own openings
  report(r);
  return r;
});
console.log("\nseed " + SEED + ", " + GAMES + " games per pairing, " + ((Date.now() - started) / 1000).toFixed(0) + " s");
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ seed: SEED, gamesPerPairing: GAMES, results: results }, null, 1));
