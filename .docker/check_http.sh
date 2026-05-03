#!/bin/sh
# Health check script usado pelo Kubernetes/Docker
set -e

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health)

if [ "$HTTP_STATUS" = "200" ]; then
  exit 0
else
  echo "Health check failed with status: $HTTP_STATUS"
  exit 1
fi
