# drama-mask-performance

This project is a small Flask app for a performance display. The root route `/` shows the stage screen, and `/control` changes what the display shows by updating a SQLite database and coordinating audio playback.

## What It Does

- Status `0` shows no image and no audio.
- Status `1` shows no image and fades in `static/audio/kill.mp3` over 3 seconds.
- Status `2` shows `static/images/time.png`, fades out `kill.mp3`, and fades in `static/audio/will.mp3`.
- Status `3` shows `static/images/wait.png` and keeps `will.mp3` playing.
- Status `4` shows `static/images/wait.png`, keeps `will.mp3` in the background, and plays `static/audio/doorbell.mp3` on top at 150% volume.
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

On startup, the app creates `data/performance.db` if it does not already exist and seeds the status to `0`.

Open these pages in your browser:

- `http://localhost:5000/` for the display screen
- `http://localhost:5000/control` for the operator controls

## Files

- `app.py` contains the Flask app and SQLite state handling.
- `static/images/wait.png` and `static/images/time.png` are the display assets.
- `static/audio/` should contain `kill.mp3`, `will.mp3`, and `doorbell.mp3`.
- `templates/` contains the HTML for the two routes.
- `static/display.js` keeps the main screen in sync with the database.
- `static/control.js` maps the space bar to the Forward action.

## Audio Files

Place these files in `static/audio/`:

- `kill.mp3`
- `will.mp3`
- `doorbell.mp3`

The browser client will fade and layer them according to the active status.