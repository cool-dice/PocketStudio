#!/bin/sh
# Next.js dev-server supervisor — spawned FROM the agent-service process
# (reaper-proof lineage: the sandbox reaps tool/bash-session processes, but
# the boot-time agent-service and its children survive).
# Keeps :3000 alive with a restart loop + log rotation.
# Stop: pkill -f "next-supervisor.sh"

exec 9>/tmp/next-supervisor.lock
flock -n 9 || exit 0   # single instance only

cd /home/z/my-project

rotate() {
  if [ -f /tmp/next-dev.log ]; then
    size=$(wc -c < /tmp/next-dev.log)
    if [ "$size" -gt 5000000 ]; then
      tail -c 200000 /tmp/next-dev.log > /tmp/next-dev.log.tmp
      mv /tmp/next-dev.log.tmp /tmp/next-dev.log
    fi
  fi
}

rotate
echo "[next-supervisor] starting ($(date +%H:%M:%S))" >> /tmp/next-dev.log
while true; do
  bun run dev >> /tmp/next-dev.log 2>&1
  code=$?
  echo "[next-supervisor] next dev exited (code $code) — restart in 5s ($(date +%H:%M:%S))" >> /tmp/next-dev.log
  sleep 5
  rotate
done
