# DavidNesbitt

## The Nesbitt Atlas

An independent interactive guide to David J. Nesbitt’s research, publications, people and scientific concepts, with interview preparation tailored to Salma’s rotational spectroscopy experience.

### Included

- 506 searchable publication discovery records and 13 guided reading cards.
- 18 lessons, 78 linked scientific terms and a clickable research map.
- Four adjustable visual labs covering rovibrational spectra, gas–liquid scattering, FRET and quantum-dot blinking.
- 83 directory and alumni entries, with historical and unverified information identified.
- 21 oral interview questions, suggested answers, research ideas and 20/90-minute study paths.
- Browser-local notes, bookmarks, learning progress and JSON notebook import/export.

### Run locally

This is a static HTML, CSS and JavaScript application. It requires no installation, build step, API key or backend.

From the repository directory, run:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 in a browser. You can also open `index.html` directly for offline use.

### Host the app

Upload the repository contents to a static web host. The entry point is `index.html` at the repository root. On Netlify, use an empty build command and `.` as the publish directory. Routes use URL fragments, so no server rewrite rules are needed.

### Edit the content

| File | Purpose |
| --- | --- |
| `index.html` | Document shell and script/style loading |
| `app.js` | Navigation, pages, filters and learning tools |
| `data.js` | Research records, lessons, glossary, people and interview content |
| `labs.js` | Interactive numerical models and charts |
| `style.css`, `labs.css` | Layout and visual styling |
| `assets/` | Local images and fonts |

Notes and progress remain in the browser where they were entered. Export the notebook before changing browsers or clearing browser data. The repository contains the application and learning content, with no individual saved notebook state.

### Research scope and credits

Research snapshot dated November 18, 2026. Publication discovery metadata may contain duplicate versions or incomplete records. Source links appear throughout the app. Several alumni affiliations are historical. Missing education and employment details are explicitly identified.

Interview responses are suggested preparation drafts. Research proposals require novelty and feasibility review with the research group.

The application is an independent educational resource. It is not an official JILA, CU Boulder or NIST publication. Photography and research illustrations retain their original ownership and attribution. See the Sources & credits page and `assets/credits.json` for individual sources, including the CC BY-SA 4.0 dye-laser photographs. Third-party images, fonts and publications retain their applicable licenses.
