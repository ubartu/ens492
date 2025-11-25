## Database & Cloud SQL Proxy Setup

This backend uses a PostgreSQL instance on Google Cloud SQL, accessed locally via the Cloud SQL Auth Proxy.

### 1. Prerequisites

Before you start, make sure you have:

- Python 3.10+ installed
- `gcloud` CLI installed and initialized (`gcloud init`)
- Cloud SQL Auth Proxy installed (`cloud-sql-proxy` on your PATH)
- A service account / ADC with access to the Cloud SQL instance

### 2. Start the Cloud SQL Proxy

From the project root, make the script executable and start the proxy:

```bash
chmod +x connection.sh
./connection.sh
