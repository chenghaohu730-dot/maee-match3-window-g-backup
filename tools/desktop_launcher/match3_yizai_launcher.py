from __future__ import annotations

import contextlib
import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import socket
from socketserver import ThreadingMixIn
import sys
import time
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import urlopen
import webbrowser


APP_KEY = "match3-yizai-local"
HOST = "127.0.0.1"
BASE_PORT = 18831
PORT_COUNT = 60
HEALTH_PATH = "/__match3_yizai_health__"
IDLE_EXIT_SECONDS = 2 * 60 * 60
MAX_RUN_SECONDS = 8 * 60 * 60


class AlreadyRunningError(RuntimeError):
    def __init__(self, url: str):
        super().__init__(url)
        self.url = url


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def local_state_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA")
    root = Path(base) if base else Path.home() / "AppData" / "Local"
    path = root / "Match3YizaiLocal"
    path.mkdir(parents=True, exist_ok=True)
    return path


def state_file() -> Path:
    return local_state_dir() / "server.json"


def bundled_dist_dir() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / "dist"

    env_dist = os.environ.get("MATCH3_YIZAI_DIST")
    if env_dist:
        return Path(env_dist)

    return Path(__file__).resolve().parent / "dist"


def is_our_server(port: int) -> bool:
    try:
        with urlopen(f"http://{HOST}:{port}{HEALTH_PATH}", timeout=0.8) as response:
            return response.read().decode("utf-8", errors="ignore").strip() == APP_KEY
    except (OSError, URLError, TimeoutError, socket.timeout):
        return False


def existing_url() -> str | None:
    with contextlib.suppress(OSError, json.JSONDecodeError, TypeError, ValueError):
        data = json.loads(state_file().read_text(encoding="utf-8"))
        port = int(data.get("port", 0))
        if port and is_our_server(port):
            return f"http://{HOST}:{port}/"
    return None


def make_handler(root: Path):
    class Match3YizaiHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, format: str, *args) -> None:
            return

        def end_headers(self) -> None:
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def do_GET(self) -> None:
            self.server.last_request_at = time.monotonic()
            if urlparse(self.path).path == HEALTH_PATH:
                payload = APP_KEY.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            super().do_GET()

    return Match3YizaiHandler


def start_server(root: Path) -> tuple[ThreadingHTTPServer, int]:
    handler = make_handler(root)
    for port in range(BASE_PORT, BASE_PORT + PORT_COUNT):
        if is_our_server(port):
            raise AlreadyRunningError(f"http://{HOST}:{port}/")
        try:
            server = ThreadingHTTPServer((HOST, port), handler)
        except OSError:
            if is_our_server(port):
                raise AlreadyRunningError(f"http://{HOST}:{port}/")
            continue
        server.timeout = 5
        server.last_request_at = time.monotonic()
        return server, port
    raise RuntimeError("No available local port for Match3 Yizai.")


def write_state(port: int) -> None:
    payload = {
        "app": APP_KEY,
        "port": port,
        "pid": os.getpid(),
        "startedAt": int(time.time()),
    }
    state_file().write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def open_game(url: str) -> None:
    webbrowser.open(url, new=2, autoraise=True)


def main() -> int:
    running_url = existing_url()
    if running_url:
        open_game(running_url)
        return 0

    root = bundled_dist_dir()
    if not (root / "index.html").exists():
        raise FileNotFoundError(f"Missing bundled game files: {root}")

    try:
        server, port = start_server(root)
    except AlreadyRunningError as error:
        open_game(error.url)
        return 0

    write_state(port)
    open_game(f"http://{HOST}:{port}/")

    started_at = time.monotonic()
    with contextlib.suppress(KeyboardInterrupt):
        while True:
            server.handle_request()
            now = time.monotonic()
            if now - started_at > MAX_RUN_SECONDS:
                break
            if now - getattr(server, "last_request_at", started_at) > IDLE_EXIT_SECONDS:
                break
    server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
