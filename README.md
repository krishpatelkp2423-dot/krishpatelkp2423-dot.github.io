# Krish Patel · Engineering Portfolio

Live site: **https://krishpatelkp2423-dot.github.io**

Static portfolio site (plain HTML, CSS and JavaScript, no build step). GitHub Pages serves it straight from the `main` branch.

## Structure

```
index.html                       Home: hero, projects, GitHub repos, research, skills, about, contact
projects/*.html                  One page per project (flowcharts, video, photos)
projects/oscilloscope.html       Includes "The math behind it": Laplace transforms, sampling,
                                 noise and firmware math, with equations pre-rendered as HTML
projects/chess.html              Includes a playable version of the modified chess game
research/quantum-photonics.html  Integrated quantum photonics research (Shcherbakov Nanophotonics Lab)
assets/css/style.css             All styles (light + dark theme)
assets/js/main.js                Theme toggle, menu, lightbox, oscilloscope simulations
assets/js/chess-engine.js        Chess rules and AI (no DOM; also runs inside the worker)
assets/js/chess-worker.js        Web Worker that runs the chess AI off the main thread
assets/js/chess.js               The chess board, panel and controls on projects/chess.html
assets/img/                      Project images, research photos and posters, and headshot
assets/research/                 High school research papers (PDF) linked from the Research section
assets/video/                    Demo videos (H.264 MP4) and poster frames
assets/vendor/katex/             KaTeX 0.16.11 stylesheet and fonts for the math (MIT license)
assets/vendor/dejavu/LICENSE     License for the DejaVu chess glyphs used as the chess pieces
assets/Krish_Patel_Resume.pdf    Resume linked across the site
tools/math/                      Optional script that regenerates the oscilloscope math section
tools/chess/                     Optional script that regenerates the chess piece shapes
.nojekyll                        Tells GitHub Pages to serve the files as-is
```

## Updating

- Edit the HTML files and push to `main`; the site updates a minute or two later.
- Replace `assets/Krish_Patel_Resume.pdf` to update the resume link everywhere.
- Replace `assets/img/headshot.jpg` to change the About photo (portrait orientation works best).

## The oscilloscope math section

The "math behind it" section of `projects/oscilloscope.html` comes from the "Theory and math" chapter of the [Oscilloscope repository's README](https://github.com/krishpatelkp2423-dot/Oscilloscope#theory-and-math). The README is the source; the page is generated from it. Every equation is rendered to static HTML ahead of time with [KaTeX](https://katex.org), so the page shows math without running any JavaScript. Only `assets/vendor/katex/katex.min.css` and its fonts are needed in the browser.

The site itself still has no build step. The script below is only needed when the chapter changes. It needs Node.js and Python 3:

```bash
(cd tools/math && npm install)          # once: installs KaTeX into tools/math/node_modules
pip install markdown                    # once
python3 tools/math/build_math.py ../Oscilloscope/README.md
```

The script replaces everything between the `MATH:START` and `MATH:END` comments in `projects/oscilloscope.html`, so don't hand-edit inside them. It stops with an error if any equation fails to render.

## The chess game

`projects/chess.html` has a playable version of the [modified chess game](https://github.com/krishpatelkp2423-dot/Chess_): no check or checkmate, the king is a 2-point piece, and the first player to 15 capture points wins. It's plain JavaScript with no build step:

- `assets/js/chess-engine.js` is a port of the desktop game's `pieces.py` (rules) and `ai.py` (minimax with alpha-beta pruning, quiescence search and piece-square tables). Keep the two in sync when the rules change.
- `assets/js/chess-worker.js` runs the AI in a Web Worker so the page never freezes while it thinks. If a worker can't start (for example when the page is opened straight from a file), the AI thinks on the page instead.
- `assets/js/chess.js` draws the board and handles clicks, the keyboard, promotion, the scoreboard, the AI level and the New game button.

The pieces are the chess symbols from DejaVu Sans Bold, the font the desktop game uses, stored as SVG paths inside `chess.js`. To regenerate them (needs Python 3 and fontTools):

```bash
pip install fonttools
python3 tools/chess/build_pieces.py ../Chess_/DejaVuSans-Bold.ttf
```

The script replaces everything between the `PIECES:START` and `PIECES:END` comments in `assets/js/chess.js`.
