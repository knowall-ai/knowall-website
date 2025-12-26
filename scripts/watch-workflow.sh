#!/bin/bash
# Monitors a GitHub Actions workflow run and reports when it completes
# Usage: ./watch-workflow.sh <run-id>

RUN_ID=$1

if [ -z "$RUN_ID" ]; then
  echo "Usage: $0 <run-id>"
  exit 1
fi

while true; do
  JSON=$(gh run view $RUN_ID --json status,conclusion 2>&1)
  STATUS=$(echo "$JSON" | jq -r '.status')
  CONCLUSION=$(echo "$JSON" | jq -r '.conclusion')

  if [ "$STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
      echo "✅ DEPLOYMENT SUCCEEDED"
    else
      echo "❌ DEPLOYMENT FAILED: $CONCLUSION"
      gh run view $RUN_ID --log-failed 2>&1 | tail -50
    fi
    exit 0
  fi
  sleep 10
done
