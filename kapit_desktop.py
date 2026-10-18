"""
Kapit Desktop Application Launcher.
Starts the local Kapit calculation engine server on port 8760 and opens a dedicated
native Windows application window (Edge/Chrome App Mode or default browser).
"""

from __future__ import annotations
import os
import subprocess
import threading
import time
import webbrowser
from server import run_server


def launch_desktop_window(url: str = "http://127.0.0.1:8760") -> None:
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for p in edge_paths:
        if os.path.isfile(p):
            subprocess.Popen([p, f"--app={url}", "--window-size=1480,920"])
            return
    webbrowser.open(url)


def main() -> None:
    port = 8760
    t = threading.Thread(target=run_server, kwargs={"host": "127.0.0.1", "port": port}, daemon=True)
    t.start()
    time.sleep(0.6)
    launch_desktop_window(f"http://127.0.0.1:{port}")
    print(f"Kapit Desktop launched at http://127.0.0.1:{port}. Press Ctrl+C to exit.")
    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
