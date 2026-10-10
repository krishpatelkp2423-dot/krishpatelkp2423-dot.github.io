# Krish Patel · Engineering Portfolio

Live site: **https://krishpatelkp2423-dot.github.io**

Static portfolio site (plain HTML, CSS and JavaScript, no build step). GitHub Pages serves it straight from the `main` branch.

## Structure

```
index.html                       Home: hero, projects, GitHub repos, research, skills, about, contact
projects/*.html                  One page per project (flowcharts, video, photos)
research/quantum-photonics.html  Integrated quantum photonics research (Shcherbakov Nanophotonics Lab)
assets/css/style.css             All styles (light + dark theme)
assets/js/main.js                Theme toggle, menu, lightbox, oscilloscope simulations
assets/img/                      Project images, research photos and posters, and headshot
assets/research/                 High school research papers (PDF) linked from the Research section
assets/video/                    Demo videos (H.264 MP4) and poster frames
assets/Krish_Patel_Resume.pdf    Resume linked across the site
.nojekyll                        Tells GitHub Pages to serve the files as-is
```

## Updating

- Edit the HTML files and push to `main`; the site updates a minute or two later.
- Replace `assets/Krish_Patel_Resume.pdf` to update the resume link everywhere.
- Replace `assets/img/headshot.jpg` to change the About photo (portrait orientation works best).
