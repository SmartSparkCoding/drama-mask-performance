# drama-mask-performance

This project is a small Flask app for a performance display. The root route `/` shows the stage screen, and `/control` changes what the display shows by updating a SQLite database.

## What It Does

- `/` shows `static/images/wait.png` when the status is `1` or `3`.
- `/` shows `static/images/time.png` when the status is `2`.
- `/control` provides Back and Forward buttons.
- Pressing the space bar on `/control` triggers Forward.
- The app creates its SQLite database automatically when you start it with `python3 app.py`.

## Setup

Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

## Run

Start the app with:

```bash
python3 app.py
```

On startup, the app creates `data/performance.db` if it does not already exist and seeds the status to `1`.

Open these pages in your browser:

- `http://localhost:5000/` for the display screen
- `http://localhost:5000/control` for the operator controls

## Files

- `app.py` contains the Flask app and SQLite state handling.
- `static/images/wait.png` and `static/images/time.png` are the display assets.
- `templates/` contains the HTML for the two routes.
- `static/display.js` keeps the main screen in sync with the database.
- `static/control.js` maps the space bar to the Forward action.

## Audio Later

Audio is not wired yet, but the app structure is ready for it. The natural next step is to add audio playback hooks alongside the state changes and fade the sound between scenes.