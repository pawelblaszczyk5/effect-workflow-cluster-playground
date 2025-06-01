#!/bin/bash

COUNT=${1:-10}

echo "Starting shard-manager in background..."
node --no-warnings=ExperimentalWarning shard-manager.ts 2>&1 | sed 's/^/[SHARD_MANAGER] /' &

# Trap Ctrl+C and clean up everything
trap "echo 'Stopping all servers...'; kill 0; exit" SIGINT SIGTERM

for i in $(seq 1 $COUNT); do
  echo "Starting runner server #$i"
  node --no-warnings=ExperimentalWarning runner.ts "$i" 2>&1 | sed "s/^/[RUNNER_$i] /" &
done

wait
