# Troubleshooting: "Dataset not found" 404 Error

## Problem
Calling `/api/anomaly/datasets/{dataset_id}/analyze` returns:
```json
{
  "detail": "Dataset not found or access denied"
}
```

---

## Common Causes

### 1. Using Example ID Instead of Real ID ❌

**Wrong:**
```bash
GET /api/anomaly/datasets/673abcd1234567890abcdef0/analyze
                          ^^^^^^^^^^^^^^^^^^^^^^^^
                          This is a placeholder ID from docs!
```

**Right:**
```bash
# First upload a file and get the REAL ID
POST /api/anomaly/datasets/upload
→ Response: { "id": "6911fbc59f5fd0ac0f1fe677" }  ← Use THIS ID

# Then use the real ID
POST /api/anomaly/datasets/6911fbc59f5fd0ac0f1fe677/analyze
```

---

### 2. Dataset Belongs to Different User 🔐

Each dataset is owned by a specific user. If you're logged in as User A but trying to access User B's dataset, you'll get "access denied".

**Solution:**
- Make sure you're using the same account that uploaded the file
- Check your authentication token is correct
- Upload a new file with your current account

---

### 3. Dataset Was Deleted 🗑️

The dataset may have been deleted from the database.

**Solution:**
- Upload a new file first
- Get the fresh dataset ID
- Use that ID for analysis

---

## Step-by-Step Fix

### Step 1: Get Your Authentication Token

In FastAPI docs (http://localhost:8000/docs):

1. Find `POST /api/auth/token` endpoint
2. Click "Try it out"
3. Enter your credentials:
   - `username`: admin (or your username)
   - `password`: password123 (or your password)
4. Click "Execute"
5. Copy the `access_token` from response

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### Step 2: Authorize in Docs

1. Click the **"Authorize"** button (🔓 lock icon) at top right
2. Paste your token
3. Click "Authorize"
4. Click "Close"

### Step 3: List Your Datasets

Call: `GET /api/anomaly/datasets`

This shows all datasets for your user:

```json
[
  {
    "id": "6911fbc59f5fd0ac0f1fe677",
    "filename": "my_data.xlsx",
    "status": "uploaded",
    "uploaded_at": "2024-11-10T10:30:00Z"
  }
]
```

**If empty list:** You need to upload a file first!

### Step 4: Upload a New File (If Needed)

Call: `POST /api/anomaly/datasets/upload`

1. Click "Try it out"
2. Choose your .xlsx or .csv file
3. Click "Execute"
4. **Copy the `id` from the response**

**Response:**
```json
{
  "id": "6911fbc59f5fd0ac0f1fe677",  ← COPY THIS!
  "filename": "dataset.xlsx",
  "status": "uploaded"
}
```

### Step 5: Use the Real ID for Analysis

Call: `POST /api/anomaly/datasets/6911fbc59f5fd0ac0f1fe677/analyze`

Replace `6911fbc59f5fd0ac0f1fe677` with YOUR actual ID from Step 3 or 4.

---

## Using cURL (Command Line)

If you prefer testing with cURL:

```bash
# 1. Login and get token
TOKEN=$(curl -X POST "http://localhost:8000/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=password123" \
  | jq -r '.access_token')

echo "Token: $TOKEN"

# 2. Upload file and save dataset ID
DATASET_ID=$(curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@your_file.xlsx" \
  | jq -r '.id')

echo "Dataset ID: $DATASET_ID"

# 3. Start analysis
curl -X POST "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/analyze" \
  -H "Authorization: Bearer $TOKEN"

# 4. Check status
curl "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/status" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Check Backend Logs

Look at your backend terminal to see the actual error:

```bash
# In your backend terminal, you should see:
INFO: 192.168.65.1:12345 - "POST /api/anomaly/datasets/673abc.../analyze HTTP/1.1" 404 Not Found

# Check if there's more detail:
ERROR: Dataset 673abc... not found in database
# OR
ERROR: User mismatch: dataset belongs to user_id=123, but requesting user is user_id=456
```

---

## Common Mistakes

### ❌ Using Placeholder ID from Documentation
```python
# DON'T use example IDs from docs
dataset_id = "673abcd1234567890abcdef0"  # This doesn't exist!
```

### ❌ Wrong ID Format
```python
# MongoDB ObjectIDs are 24 hex characters
"6911fbc59f5fd0ac0f1fe677"  # ✅ Valid (24 chars)
"123"                        # ❌ Too short
"not-a-valid-id"             # ❌ Not hex
```

### ❌ Using ID from Different Environment
```python
# Don't use IDs from production in development, or vice versa
production_id = "abc123..."  # Won't exist in local DB
```

---

## Quick Diagnostic Script

Save this as `test_upload_analyze.py`:

```python
import requests
import time

BASE_URL = "http://localhost:8000/api"

# 1. Login
print("1. Logging in...")
response = requests.post(f"{BASE_URL}/auth/token", data={
    "username": "admin",
    "password": "password123"
})
response.raise_for_status()
token = response.json()["access_token"]
print(f"   ✓ Token: {token[:20]}...")

headers = {"Authorization": f"Bearer {token}"}

# 2. Upload file
print("\n2. Uploading file...")
with open("test_data.xlsx", "rb") as f:
    files = {"file": f}
    response = requests.post(f"{BASE_URL}/anomaly/datasets/upload",
                            headers=headers, files=files)
    response.raise_for_status()
    dataset_id = response.json()["id"]
    print(f"   ✓ Dataset ID: {dataset_id}")

# 3. Start analysis
print("\n3. Starting analysis...")
response = requests.post(f"{BASE_URL}/anomaly/datasets/{dataset_id}/analyze",
                        headers=headers)
if response.status_code == 404:
    print(f"   ✗ ERROR 404: {response.json()}")
    print(f"   Dataset ID: {dataset_id}")
    print(f"   URL: {response.url}")
else:
    print(f"   ✓ Started: {response.json()}")

# 4. Poll status
print("\n4. Polling status...")
for i in range(10):
    time.sleep(3)
    response = requests.get(f"{BASE_URL}/anomaly/datasets/{dataset_id}/status",
                           headers=headers)
    status_data = response.json()
    print(f"   Progress: {status_data['progress']}% - Status: {status_data['status']}")

    if status_data['status'] in ['analyzed', 'completed', 'error']:
        break

print("\n✓ Test complete!")
```

Run it:
```bash
pip install requests
python test_upload_analyze.py
```

---

## Solution Checklist

- [ ] I'm authenticated (token is valid)
- [ ] I uploaded a file and got a real dataset ID
- [ ] I'm using the dataset ID from the upload response (not an example)
- [ ] The dataset belongs to my user account
- [ ] The dataset status is `"uploaded"` (not already analyzing)
- [ ] My backend is running on port 8000
- [ ] I'm using the correct API path: `/api/anomaly/datasets/{id}/analyze`

---

## Still Not Working?

### Check Database Directly

Connect to MongoDB and verify the dataset exists:

```bash
# If using Docker
docker exec -it mongodb mongosh

# In mongosh
use staraidocdb
db.datasets.find().pretty()

# Look for your dataset ID in the results
# Check the user_id field matches your user
```

### Check Backend Environment

```bash
cd backend

# Check which database you're connected to
grep MONGO .env.local

# For case_study variant:
MONGO_CASE_AND_CUSTOM_DB_URI="mongodb+srv://...staraidocdb/starai_case_custom..."

# Make sure APP_ENV and PROJECT_VARIANT are correct
```

---

## Summary

**The issue is most likely:** You're using an example ID instead of a real one.

**The fix:**
1. Upload a file first: `POST /datasets/upload`
2. Copy the `id` from the response
3. Use that REAL ID in your analyze call

**Example flow:**
```
Upload → { "id": "REAL_ID_HERE" }
         ↓
Analyze → POST /datasets/REAL_ID_HERE/analyze ✅
```
