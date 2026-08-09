#!/usr/bin/env python3
# supervisor eventlistener — makes a genuine, repeated worker crash visible to Docker/Coolify.
#
# WHY THIS EXISTS: supervisord's autorestart=true (see supervisord-worker*.conf) hides *normal*
# hourly queue:work recycling from Docker entirely (supervisord itself never exits, so Docker's
# RestartCount stays 0 — the whole point of this split, see docker-compose.workers.yml). But that
# same property means a program supervisord has genuinely given up on (FATAL state — it crashed
# again within `startsecs` more than `startretries` times in a row) would otherwise just sit dead
# forever inside a container Docker still considers "running", with only the compose healthcheck
# (pgrep) eventually going unhealthy — and an `unhealthy` status does NOT trigger Docker's
# `restart: unless-stopped` policy on its own (that policy only reacts to the container actually
# exiting). A silent, permanently-dead worker is worse than a visible restart.
#
# This listener subscribes to PROCESS_STATE_FATAL. When the watched program reaches it, it kills
# supervisord itself (SIGTERM to its own parent — eventlistener processes are always direct
# children of supervisord) so the CONTAINER exits, Docker's restart policy restarts it fresh, and
# RestartCount climbs for this specific case only — a real, repeated crash — never for ordinary
# `--max-time` recycling, which never reaches FATAL because it never crashes within `startsecs`.
#
# Supervisor listener protocol reference: http://supervisord.org/events.html#event-listeners

import os
import signal
import sys


def write_stdout(msg: str) -> None:
    sys.stdout.write(msg)
    sys.stdout.flush()


def write_stderr(msg: str) -> None:
    sys.stderr.write(msg)
    sys.stderr.flush()


def read_event() -> tuple[dict, dict]:
    line = sys.stdin.readline()
    headers = dict(item.split(":", 1) for item in line.split())
    payload = sys.stdin.read(int(headers["len"]))
    payload_headers = dict(item.split(":", 1) for item in payload.split() if ":" in item)
    return headers, payload_headers


def main() -> None:
    while True:
        write_stdout("READY\n")
        headers, payload_headers = read_event()

        if headers.get("eventname") == "PROCESS_STATE_FATAL":
            process_name = payload_headers.get("processname", "?")
            write_stderr(
                f"[supervisor-fatal-exit] {process_name} reached FATAL "
                "(supervisord exhausted startretries) — terminating supervisord so the "
                "container exits and Docker/Coolify see a real failure signal.\n"
            )
            write_stdout("RESULT 2\nOK")
            # SIGTERM to our own parent = supervisord (eventlistener processes are always
            # direct children of supervisord). supervisord's default SIGTERM handling is a
            # clean shutdown — since nodaemon=true makes it the container's PID 1, that
            # shutdown IS the container exiting.
            os.kill(os.getppid(), signal.SIGTERM)
        else:
            write_stdout("RESULT 2\nOK")


if __name__ == "__main__":
    main()
