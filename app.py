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
    0: None,
    1: None,
    2: "time.png",
    3: "wait.png",
    4: "wait.png",
}

MIN_STATUS = 0
MAX_STATUS = 4


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
        schema_row = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'performance_state'"
        ).fetchone()
        schema_sql = schema_row[0] if schema_row else ""

        if schema_sql and "BETWEEN 0 AND 4" not in schema_sql:
            connection.execute("ALTER TABLE performance_state RENAME TO performance_state_legacy")
            connection.execute(
                """
                CREATE TABLE performance_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    status INTEGER NOT NULL CHECK (status BETWEEN 0 AND 4),
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                INSERT INTO performance_state (id, status, updated_at)
                SELECT
                    id,
                    CASE
                        WHEN status < 0 THEN 0
                        WHEN status > 4 THEN 4
                        ELSE status
                    END,
                    COALESCE(updated_at, CURRENT_TIMESTAMP)
                FROM performance_state_legacy
                WHERE id = 1
                """
            )
            connection.execute("DROP TABLE performance_state_legacy")
        else:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS performance_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    status INTEGER NOT NULL CHECK (status BETWEEN 0 AND 4),
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                INSERT OR IGNORE INTO performance_state (id, status)
                VALUES (1, 0)
                """
            )
        connection.commit()


def read_status() -> int:
    row = get_db().execute(
        "SELECT status FROM performance_state WHERE id = 1"
    ).fetchone()
    return int(row["status"]) if row else 0


def write_status(status: int) -> int:
    status = max(MIN_STATUS, min(MAX_STATUS, status))
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
    return MIN_STATUS if status >= MAX_STATUS else status + 1


def previous_status(status: int) -> int:
    return MAX_STATUS if status <= MIN_STATUS else status - 1


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


@app.route("/control/reset", methods=["POST"])
def control_reset():
    status = write_status(0)
    if request.accept_mimetypes.best == "application/json":
        return jsonify({"status": status, "image": STATE_TO_IMAGE[status]})
    return redirect(url_for("control"))


@app.route("/api/state")
def api_state():
    return jsonify(current_payload())


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "6060")), debug=True)