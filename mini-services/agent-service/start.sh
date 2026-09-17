#!/bin/sh
# agent-service supervisor — keeps the mini-service alive.
# Usage (detached):  setsid nohup sh /home/z/my-project/mini-services/agent-service/start.sh >/dev/null 2>&1 &
# Stop:              pkill -f "agent-service/start.sh"; pkill -f "bun --hot index.ts"

cd "$(dirname "$0")"

# Single-instance guard: several things (boot script, health endpoint,
# manual restarts) may spawn this supervisor — the flock makes every extra
# copy exit immediately instead of racing bun instances for port 3003.
exec 8>/tmp/agent-service-supervisor.lock
flock -n 8 || exit 0

# Rotate the log if it grew beyond ~5MB.
if [ -f /tmp/agent-service.log ]; then
  size=$(wc -c < /tmp/agent-service.log)
  if [ "$size" -gt 5000000 ]; then
    tail -c 100000 /tmp/agent-service.log > /tmp/agent-service.log.tmp
    mv /tmp/agent-service.log.tmp /tmp/agent-service.log
  fi
fi

echo "[supervisor] starting agent-service ($(date +%H:%M:%S))" >> /tmp/agent-service.log
while true; do
  bun --hot index.ts >> /tmp/agent-service.log 2>&1
  code=$?
  echo "[supervisor] agent-service exited (code $code) — restart in 3s ($(date +%H:%M:%S))" >> /tmp/agent-service.log
  sleep 3
done
