# JC2503 Web Application Development Coursework

This project is a Node.js and Express coursework website for JC2503 Web Application Development. It contains a personal introduction page, an about page, a puzzle game page, and a standalone project report page.

The application uses the default coursework stack:

- Node.js
- Express
- EJS
- Vanilla JavaScript
- CSS
- Socket.IO dependency from the supplied coursework environment

## Coursework Brief Summary

The assignment asks for a three-page website and a report:

- Introduction page at `/`
- About page at `/about`
- Game application page at `/game`
- Standalone report at `/report.html`

The game requirement in the PDF is a multiplayer, turn-based 4x4 puzzle game. Players should join with a display name, take turns, place randomly selected blocks from a shared pool, clear lines of matching shapes or colours, and maintain a shared scoreboard through Socket.IO.

## Requirements

Use the default environment provided for the coursework. The PDF recommends Node.js `24.13.0` LTS for testing.

Do not add extra runtime dependencies. The coursework instructions say the submitted server must run in the default marking environment, and `server.js` must start with:

```bash
npm start
```

## Installation

If `node_modules` is not already present, install the dependencies from the supplied `package.json`:

```bash
npm install
```

## Running the Website

Start the server:

```bash
npm start
```

The server listens on:

```text
http://localhost:8080
```

Available routes:

```text
/             Introduction page
/about        About page
/game         Puzzle game page
/report.html  Project report page
```

## Project Structure

```text
.
├── server.js
├── package.json
├── package-lock.json
├── report.html
├── public
│   ├── css
│   │   └── style.css
│   ├── js
│   │   ├── game.js
│   │   └── site.js
│   ├── images
│   │   └── avatar.png
│   └── favicon.ico
└── views
    ├── index.ejs
    ├── about.ejs
    ├── game.ejs
    └── partials
        ├── footer.ejs
        ├── head.ejs
        └── nav.ejs
```

## Main Files

`server.js` configures Express, serves static files from `public/`, renders the EJS pages, serves `report.html`, and handles unknown routes with a simple 404 response.

`views/index.ejs` contains the introduction page with profile content, page overview cards, and links to the about and game pages.

`views/about.ejs` contains the detailed personal interests page, including technical interests and example GitHub projects.

`views/game.ejs` contains the game page layout, including the join form, 4x4 board, current block display, turn badge, and scoreboard.

`report.html` is the standalone report page required by the coursework brief. It is available at `/report.html`.

`public/css/style.css` contains the shared responsive styling, layout system, theme colours, navigation styling, cards, game board, and report styling.

`public/js/site.js` controls the mobile navigation menu, light/dark theme toggle, and fallback image handling.

`public/js/game.js` handles the client-side Socket.IO game behaviour, including joining and leaving, rendering shared game state, displaying the active player's private block, enabling valid board placement, updating the turn timer, and showing the scoreboard.
