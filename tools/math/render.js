// Reads [{tex, display}] as JSON on stdin and writes [{html} | {error}] as JSON
// on stdout. Used by build_math.py.
const katex = require('katex');

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  const out = JSON.parse(input).map(({ tex, display }) => {
    try {
      return { html: katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: 'error' }) };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  });
  process.stdout.write(JSON.stringify(out));
});
