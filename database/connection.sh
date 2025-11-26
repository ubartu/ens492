#!/bin/bash
set -euo pipefail

#REQUIRMENTS:
#MUST INSTALL gcloud-cli, cloud-sql-proxy, psql

PROJECT_ID="ens492-477215"
INSTANCE_CONN_NAME="ens492-477215:europe-west9:db"
PORT=5432
LOG_FILE="cloud-sql-proxy.log"
ADC_FILE="$HOME/.config/gcloud/application_default_credentials.json"

# 1. Ensure Application Default Credentials exist
if [[ ! -f "$ADC_FILE" ]]; then
  echo "[INFO] Application Default Credentials not found."
  echo "[ACTION] Logging in to create ADC..."
  gcloud auth application-default login
else
  echo "[INFO] Application Default Credentials found."
fi

# 2. Set the project for consistency
gcloud config set project "$PROJECT_ID"

# 3. Start the Cloud SQL Proxy using ADC in the background
echo "[INFO] Starting Cloud SQL Proxy on port $PORT..."
nohup cloud-sql-proxy \
  --debug \
  --port "$PORT" \
  "$INSTANCE_CONN_NAME" \
  > "$LOG_FILE" 2>&1 &

PROXY_PID=$!
echo "[SUCCESS] Cloud SQL Proxy started (PID: $PROXY_PID)"
echo "[LOGS] → $LOG_FILE"


#FOR TEST RUN:
#psql "host=127.0.0.1 port=5432 dbname=492db user=postgres password=492database sslmode=disable"