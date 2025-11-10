Viewing and exporting the demo slides

Overview

This folder contains a Markdown slide deck `demo_slides.md` designed for reveal.js-style presenters. It uses Markdown slide separators and speaker notes. You can view it locally and export to PDF.

Preferred quick option (no install):

- Use the VS Code Markdown Preview Enhanced / Live Preview extension and open `presentation/demo_slides.md`.

Option A — reveal-md (recommended)

1. Install (if you have Node):

```bash
# macOS / zsh
npm install -g reveal-md
```

2. Serve locally:

```bash
# from repo root
npx reveal-md presentation/demo_slides.md --open
```

3. To print/export to PDF, reveal-md supports printing via the browser's print dialog. Open the deck in Chrome and choose Print → Save as PDF.

Option B — Static HTML + print

```bash
# generate static build of the deck
npx reveal-md presentation/demo_slides.md --static presentation/out
# open presentation/out/index.html in Chrome and print to PDF
open presentation/out/index.html
```

Option C — Convert to PowerPoint / PDF programmatically

- If you'd like a `.pptx` export, I can generate one using `python-pptx` and add it to this folder.

Notes

- Replace images in `/presentation/assets/` with screenshots from your app for a polished demo.
- The slide deck uses simple Markdown separators (---). If you prefer separate vertical slides, add `---

` where needed.

If you'd like, I can:
- generate a `.pptx` version automatically,
- produce PNG slide images for printing,
- or insert actual screenshots by grabbing them from the repo (if present).

Tell me which next step you want.