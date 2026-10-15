# Deploy blip to Cloud Run

One container serves the web app, the API, and the health check on `$PORT` (Cloud Run sets 8080).
The image is built from the `Dockerfile` at the project root.

## 1. One-time GCP setup

1. In the [GCP Console](https://console.cloud.google.com), select or create a project and make sure billing is enabled.
2. Enable the APIs: **Cloud Run**, **Cloud Build**, and **Artifact Registry**.
   Console: *APIs & Services → Library*, search for each name, and click **Enable**.

## 2. Create the service (Console)

Cloud Run → **Create service** → **Continuously deploy new revisions from a source repository** → **Set up with Cloud Build**.

1. Connect your GitHub account and select the `blip` repository, branch `main`.
2. Build type: **Dockerfile**, source location `/Dockerfile`.
3. Service name `blip`, region of your choice (for example `asia-south1`).
4. **Authentication:** *Allow unauthenticated invocations*, since this is a public site.
5. Open **Container, networking, security → Container → Settings**:
   - Memory: **512 MiB**, CPU: **1**.
   - Container port: **8080**.
6. Open **Autoscaling**:
   - Minimum instances: **1**
   - Maximum instances: **1**
7. Open **Container → CPU allocation**: select **CPU is always allocated**.
   The sky poller runs in the background between requests. Without this, it stops and data stops updating.
8. Click **Create**. The first build takes a few minutes.

### Why these settings matter

| Setting | Value | Reason |
|---|---|---|
| CPU allocation | Always allocated | The poller refreshes aircraft data in the background. |
| Max instances | 1 | Each instance keeps its own sky snapshot and polls upstream. Two instances would double the load on adsb.lol. |
| Min instances | 1 | Avoids a cold start that would leave the map on simulated traffic for minutes. |

## 3. Deploy from the command line (alternative)

```bash
gcloud run deploy blip \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --no-cpu-throttling \
  --min-instances 1 \
  --max-instances 1 \
  --memory 512Mi \
  --port 8080
```

Replace `asia-south1` with your region. `--source .` builds with the `Dockerfile` through Cloud Build.

## 4. Verify

```bash
curl -s https://YOUR-SERVICE-URL/healthz
```

Expect `{"ok":true}`. Open the service URL in a browser. The header should move from "Warming up" to "Live" once the first hub answers, usually within a minute or two.

## Things to know

- **Data is in memory and on the instance disk.** Each new revision starts with an empty snapshot and shows simulated traffic until the regions are verified live again. The high-score file (`server/data/scores.json`) is also lost on redeploy. Move it to Firestore or Cloud Storage before you need scores to persist.
- **Upstream limits:** adsb.lol rate-limits bursts. The refresh loop is paced for that, so expect a few minutes before all six regions are live after a cold start.
- **Environment variables:** none are required. Optional: `ADSB_BASE` to point at a different upstream.
- **Local Docker test:** the corporate networks some developers use intercept HTTPS. Inside the container that breaks upstream calls with `SELF_SIGNED_CERT_IN_CHAIN`. Cloud Run is not affected.
