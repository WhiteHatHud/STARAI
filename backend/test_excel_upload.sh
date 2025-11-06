#!/bin/bash
# Test script to upload Excel file to FastAPI backend

BASE_URL="http://127.0.0.1:8000/api"

echo "=========================================="
echo "Excel Upload Test Script"
echo "=========================================="
echo ""

# Step 1: Login to get access token
echo "Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=password123")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed! Make sure the server is running and credentials are correct."
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Logged in successfully"
echo ""

# Step 2: Create a test case
echo "Step 2: Creating a test case..."
CASE_RESPONSE=$(curl -s -X POST "${BASE_URL}/cases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Excel Upload Test Case"}')

CASE_ID=$(echo $CASE_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

if [ -z "$CASE_ID" ]; then
    echo "❌ Failed to create case!"
    echo "Response: $CASE_RESPONSE"
    exit 1
fi

echo "✅ Case created with ID: $CASE_ID"
echo ""

# Step 3: Upload Excel file
echo "Step 3: Uploading Excel file..."
echo "Please provide the path to your Excel file:"
read -p "Excel file path: " EXCEL_FILE

if [ ! -f "$EXCEL_FILE" ]; then
    echo "❌ File not found: $EXCEL_FILE"
    exit 1
fi

UPLOAD_RESPONSE=$(curl -s -X POST "${BASE_URL}/cases/${CASE_ID}/documents?case_id=${CASE_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@${EXCEL_FILE}")

echo ""
echo "Upload Response:"
echo "$UPLOAD_RESPONSE"
echo ""

PROGRESS_ID=$(echo $UPLOAD_RESPONSE | grep -o '"progress_id":"[^"]*' | cut -d'"' -f4)

if [ -z "$PROGRESS_ID" ]; then
    echo "❌ Upload failed!"
else
    echo "✅ Upload successful!"
    echo "Progress ID: $PROGRESS_ID"
    echo ""
    echo "You can check the progress at:"
    echo "${BASE_URL}/reports/progress/${PROGRESS_ID}"
fi

echo ""
echo "=========================================="
echo "Test Complete"
echo "=========================================="
