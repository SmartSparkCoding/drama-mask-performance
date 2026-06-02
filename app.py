from __future__ import annotations

import os
import sqlite3
from contextlib import closing
from pathlib import Path

from flask import Flask, g, jsonify, redirect, render_template, request, url_for


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "performance.db"

STATE_TO_IMAGE = {
    1: "wait.png",
    2: "time.png",
    3: "wait.png",
}


app = Flask(__name__)


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        connection = sqlite3.connect(DB_PATH)
        connection.row_factory = sqlite3.Row
        g.db = connection
    return g.db


@app.teardown_appcontext
def close_db(_exception: BaseException | None) -> None:
    connection = g.pop("db", None)
    if connection is not None:
        connection.close()


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(DB_PATH)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS performance_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                status INTEGER NOT NULL CHECK (status BETWEEN 1 AND 3),
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            INSERT OR IGNORE INTO performance_state (id, status)
            VALUES (1, 1)
            """
        )
        connection.commit()


def read_status() -> int:
    row = get_db().execute(
        "SELECT status FROM performance_state WHERE id = 1"
    ).fetchone()
    return int(row["status"]) if row else 1


def write_status(status: int) -> int:
    status = max(1, min(3, status))
    get_db().execute(
        """
        UPDATE performance_state
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        """,
        (status,),
    )
    get_db().commit()
    return status


def next_status(status: int) -> int:
    return 1 if status >= 3 else status + 1


def previous_status(status: int) -> int:
    return 3 if status <= 1 else status - 1


def current_payload() -> dict[str, object]:
    status = read_status()
    return {
        "status": status,
        "image": STATE_TO_IMAGE[status],
    }


@app.route("/")
def display() -> str:
    payload = current_payload()
    return render_template(
        "display.html",
        status=payload["status"],
        image=payload["image"],
    )


@app.route("/control")
def control() -> str:
    payload = current_payload()
    return render_template(
        "control.html",
        status=payload["status"],
    )


@app.route("/control/next", methods=["POST"])
def control_next():
    status = write_status(next_status(read_status()))
    if request.accept_mimetypes.best == "application/json":
        return jsonify({"status": status, "image": STATE_TO_IMAGE[status]})
    return redirect(url_for("control"))


@app.route("/control/prev", methods=["POST"])
def control_prev():
    status = write_status(previous_status(read_status()))
    if request.accept_mimetypes.best == "application/json":
        return jsonify({"status": status, "image": STATE_TO_IMAGE[status]})
    return redirect(url_for("control"))


@app.route("/api/state")
def api_state():
    return jsonify(current_payload())


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "6060")), debug=True)