# Garden: A To-Do List Where Tasks Grow into Trees

**Live demo:** [my-garden-todo.netlify.app](https://my-garden-todo.netlify.app/)

https://github.com/user-attachments/assets/71c7ee30-cd3e-4cf8-a86c-776232453647

A university lab project that applies functional programming (FP) principles to a web application built with plain HTML, CSS and JavaScript.

## Overview

Garden reimagines the classic to-do list as a living 3D landscape. Every task starts as a sprout, and completing it grows a tree in its place.

Each task produces its own distinct tree (oak, spruce, apple, cherry blossom or birch), and that tree looks exactly the same after a page reload. Its shape is derived by a **pure function** of the task ID, without any use of `Math.random`. The sky and lighting adapt to the time of day, switching between morning, evening and night.

All application logic lives in a pure core (`src/core/`). The three.js library acts purely as a renderer: it draws whatever the core describes as plain data. This separation is the central design decision of the project.

## Key Features

- **Pure functional core.** Business logic has no access to the DOM, `localStorage` or `Date.now()`, which makes it fully predictable and easy to test.
- **Deterministic generation.** Tree species and shape are computed from the task ID, so the garden is reproducible across sessions.
- **Unidirectional data flow.** DOM events are converted into actions, a reducer produces the next state, and the shell renders that state.
- **Custom FP utilities.** `pipe`, `compose`, `curry` and related helpers are implemented from scratch.
- **Time-of-day theming.** Three color palettes (morning, evening, night) are defined as design tokens.
- **Accessibility.** Animations respect the `prefers-reduced-motion` setting.
- **Works offline.** three.js is bundled locally, so no CDN or internet connection is required.
- **Custom test runner.** Core functions are covered by tests that run both in the browser and in Node.js.

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Markup    | HTML5                                           |
| Styling   | CSS with custom properties (design tokens)      |
| Logic     | JavaScript (ES modules)                         |
| 3D engine | [three.js](https://threejs.org/) (MIT License)  |
| Testing   | Custom minimal test framework                   |
| Hosting   | Netlify                                         |

## Getting Started

The code is split into native ES modules (`import` / `export`). Browsers block module loading from `file://` URLs, so the project must be served over a local HTTP server.

**Option 1: VS Code**

1. Install the **Live Server** extension.
2. Right-click `index.html` and select *Open with Live Server*.

**Option 2: Command line**

```bash
npx serve .
```

three.js is located in `vendor/three/` and is wired up in `index.html` through an import map (`<script type="importmap">`).

## Running Tests

In the browser, start a local server and open `tests/index.html`.

In the terminal:

```bash
node tests/core.test.js
```

## Architecture

The application follows the "functional core, imperative shell" pattern.

```
DOM event → events.js → action → reducer.js → new state → render.js / scene.js
                                                   ↓
                                              storage.js
```

- **Core (`src/core/`)** contains only pure functions: task operations, filtering, the reducer, tree generation and time-of-day rules.
- **Shell (`src/shell/`)** handles all side effects: DOM rendering, event handling, persistence and the 3D scene.
- **Entry point (`src/main.js`)** connects the core and the shell.

## Project Structure

```
fp-todo/
├── index.html              page markup (layout documented in comments)
├── styles/
│   ├── tokens.css          design tokens: morning, evening and night palettes
│   ├── base.css            CSS reset, typography, page layout
│   ├── components.css      garden canvas, panel, form, filters, cards
│   └── animations.css      card animations, reduced-motion support
├── src/
│   ├── core/               PURE CORE: no DOM, no localStorage, no Date.now()
│   │   ├── fp.js           FP utilities: pipe, compose, curry, etc.
│   │   ├── task.js         operations on a single task
│   │   ├── tasks.js        operations on the task list (map / filter / reduce)
│   │   ├── filters.js      predicates and selectors (derived data)
│   │   ├── reducer.js      (state, action) → newState
│   │   ├── plant.js        tree "DNA" and garden layout, derived from task ID
│   │   └── daytime.js      morning / evening / night rules and palettes
│   ├── shell/              IMPURE SHELL: everything that touches the outside world
│   │   ├── render.js       state → DOM
│   │   ├── events.js       DOM events → actions
│   │   ├── storage.js      localStorage persistence
│   │   └── scene.js        3D garden built with three.js
│   └── main.js             entry point: wires the core to the shell
├── vendor/three/           three.js (MIT), local copy
├── tests/
│   ├── index.html          test results page
│   ├── runner.js           custom minimal test framework
│   └── core.test.js        tests for pure functions
└── docs/                   theory, concept, architecture, plan, defense prep
```

Most source files begin with a short comment explaining their purpose.

## Documentation

The `docs/` folder is intended to be read in order:

| File                      | Contents                                                        |
|---------------------------|-----------------------------------------------------------------|
| `docs/01_ТЕОРИЯ.md`       | FP fundamentals, illustrated with examples outside this project |
| `docs/02_КОНЦЕПЦИЯ.md`    | The idea and visual style of Garden                             |
| `docs/03_АРХИТЕКТУРА.md`  | How data flows through the application                          |
| `docs/04_ПЛАН.md`         | Step-by-step code walkthrough, organized by stage               |
| `docs/05_ЗАЩИТА.md`       | Questions for the project defense                               |

## Preparing for the Defense

The implementation is complete. To prepare for presenting it:

1. Follow `docs/04_ПЛАН.md` as a reading guide: for each stage, study the listed files and answer the review questions.
2. Answer the questions in `docs/05_ЗАЩИТА.md` out loud.
3. Run a mock defense with an AI assistant acting as the examiner, asking questions without providing answers.

## License

This is an educational project. The bundled [three.js](https://github.com/mrdoob/three.js) library is distributed under the MIT License.
