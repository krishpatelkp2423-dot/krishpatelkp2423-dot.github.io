/* Runs the chess AI in the background so the page stays responsive while it thinks. */
importScripts("chess-engine.js");

self.onmessage = function (e) {
  var d = e.data;
  var move = self.ChessEngine.chooseMove(d.board, d.color, d.white, d.black, d.level, d.seen);
  self.postMessage({ id: d.id, move: move });
};
