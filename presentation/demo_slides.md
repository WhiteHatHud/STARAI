---
title: STARAI Demo
subtitle: End-to-end anomaly detection + LLM triage
---

# Demo goal

Walk through a complete demo showing:

- Log in
- Upload Excel spreadsheet
- Spreadsheet uploaded to S3
- Backend runs Autoencoder ML and detects anomalies
- Output is sent to Foundation7b LLM for triage
- LLM releases triage summary
- Export triage info to PDF

---

# Slide 1 — Overview

- Quick architecture (frontend → backend → S3 → ML → LLM → export)

Speaker notes:
- Emphasize flow of data and where the heavy lifting happens.
- Mention components: frontend app, backend services, S3, Autoencoder model, LLM.

---

# Slide 2 — 1) Log in

- Show login page screenshot (placeholder)
- Expected result: user authenticated and redirected to upload page

Speaker notes:
- Credentials: demo account (replace with yours).
- If auth is backed by a test user created by `backend/create_admin_user.py`, note that.

Placeholder image: `/presentation/assets/login.png`

---

# Slide 3 — 2) Upload Excel spreadsheet

- Show upload UI screenshot (placeholder)
- Accepts .xlsx/.xls/.csv
- Client triggers upload request to backend route (e.g., `/upload`)

Speaker notes:
- Mention validation: file format, size limits.
- Show expected success toast once accepted.

Placeholder image: `/presentation/assets/upload.png`

---

# Slide 4 — 3) Spreadsheet uploads to S3 bucket

- Backend receives file and streams it to S3
- S3 path example: `s3://<bucket>/uploads/<user>/<timestamp>.xlsx`
- Use presigned URL or server-side upload depending on your flow

Speaker notes:
- Quick note on S3 bucket permissions and environment variables (AWS keys, region).
- Mention how to verify in AWS Console.

Diagram (text):
Frontend -> Backend API -> S3 (object stored)

---

# Slide 5 — 4) Autoencoder ML runs in backend and identifies anomalies

- Backend triggers ML pipeline (sync or async job)
- Autoencoder reads file from S3, preprocesses data, computes reconstruction error
- Thresholding marks anomalies
- Output: anomalies CSV and summary metrics

Speaker notes:
- If job is async, show how the job status is reported (websocket/polling/tasks endpoint).
- Point to `Model/AutoEncoder/` scripts used for inference.

---

# Slide 6 — 5) Output is sent to Foundation7b model (LLM)

- Backend formats triage payload (top anomalies, contextual columns, short summary)
- Payload sent to Foundation7b via its API client
- LLM returns triage notes: severity, recommended action, explanation

Speaker notes:
- Show an example JSON payload and an example LLM response.
- Mention rate limits and prompt design considerations.

---

# Slide 7 — 6) LLM releases triage information

- Triage data stored in DB and displayed in UI
- UI shows: anomaly list, LLM summary, recommended actions
- Allow user to accept/reject or annotate items

Speaker notes:
- Explain how LLM confidence or hallucination risk is surfaced (e.g., score or assistant note).

Placeholder image: `/presentation/assets/triage_ui.png`

---

# Slide 8 — 7) Export to PDF

- From UI: click "Export PDF" to generate report
- Backend generates PDF (server-side) or frontend prints styled HTML to PDF
- PDF includes: input metadata, anomaly table, LLM triage notes, visuals (charts)

Speaker notes:
- Show options for generating PDF: server library (WeasyPrint, wkhtmltopdf) or client-side print.

---

# Slide 9 — Demo script (step-by-step)

1. Start backend and frontend (local dev instructions)
2. Log in with demo account
3. Upload sample Excel (use `presentation/sample_data.xlsx` or `Model/X_test_scaled.npy` to show expected columns)
4. Watch upload hit S3; confirm object exists
5. Wait for ML job to finish; open triage view
6. Inspect LLM notes and export PDF

Speaker notes:
- Include exact UI clicks and code paths where helpful.

---

# Slide 10 — Quick verification commands

- Backend (example):

```bash
# start backend (project-specific)
cd backend
./start.sh
```

- Frontend (example):

```bash
# start frontend dev server
cd frontend
npm install
npm run dev
```

Speaker notes:
- Replace with your project's actual start commands if different.

---

# Slide 11 — Troubleshooting

- Upload fails: check backend logs and S3 credentials
- ML job fails: check model logs under `Model/AutoEncoder/` and ensure dependencies are installed
- LLM calls error: check API keys, prompt size, and model availability

---

# Slide 12 — Next steps (optional enhancements)

- Add automated screenshots recorded during demo
- Create a `.pptx` export version for offline sharing
- Add diagrams (generated with Mermaid or an image) for architecture slide

---

# Thank you

Questions?

---

Notes:
- Replace placeholder images in `/presentation/assets/` with real screenshots for a polished demo.
- If you want a `.pptx` file, I can generate one programmatically and add it here.
