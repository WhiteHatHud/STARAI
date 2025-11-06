#!/usr/bin/env python3
"""
Python script to test Excel file upload to FastAPI backend
"""
import requests
import sys
import os

BASE_URL = "http://127.0.0.1:8000/api"

def login(username="admin", password="password123"):
    """Login and get access token"""
    print("Step 1: Logging in...")
    response = requests.post(
        f"{BASE_URL}/token",
        data={
            "username": username,
            "password": password
        }
    )

    if response.status_code != 200:
        print(f"❌ Login failed! Status: {response.status_code}")
        print(f"Response: {response.text}")
        return None

    token = response.json().get("access_token")
    print(f"✅ Logged in successfully")
    return token

def create_case(token, case_name="Excel Upload Test Case"):
    """Create a test case"""
    print(f"\nStep 2: Creating case '{case_name}'...")
    response = requests.post(
        f"{BASE_URL}/cases",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={"name": case_name}
    )

    if response.status_code not in [200, 201]:
        print(f"❌ Failed to create case! Status: {response.status_code}")
        print(f"Response: {response.text}")
        return None

    case_id = response.json().get("_id")
    print(f"✅ Case created with ID: {case_id}")
    return case_id

def upload_excel(token, case_id, excel_file_path):
    """Upload Excel file to the case"""
    print(f"\nStep 3: Uploading Excel file '{excel_file_path}'...")

    if not os.path.exists(excel_file_path):
        print(f"❌ File not found: {excel_file_path}")
        return None

    with open(excel_file_path, 'rb') as f:
        files = {'file': (os.path.basename(excel_file_path), f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        response = requests.post(
            f"{BASE_URL}/cases/{case_id}/documents",
            headers={"Authorization": f"Bearer {token}"},
            params={"case_id": case_id},
            files=files
        )

    if response.status_code not in [200, 201]:
        print(f"❌ Upload failed! Status: {response.status_code}")
        print(f"Response: {response.text}")
        return None

    result = response.json()
    progress_id = result.get("progress_id")
    print(f"✅ Upload successful!")
    print(f"Progress ID: {progress_id}")
    print(f"Message: {result.get('message')}")
    return progress_id

def main():
    """Main test flow"""
    print("=" * 60)
    print("Excel Upload Test Script")
    print("=" * 60)
    print()

    # Get Excel file path from user
    if len(sys.argv) > 1:
        excel_file = sys.argv[1]
    else:
        excel_file = input("Enter path to your Excel file (.xlsx): ").strip()

    if not excel_file:
        print("❌ No file path provided!")
        return

    # Step 1: Login
    token = login()
    if not token:
        return

    # Step 2: Create case
    case_id = create_case(token)
    if not case_id:
        return

    # Step 3: Upload Excel
    progress_id = upload_excel(token, case_id, excel_file)
    if not progress_id:
        return

    print()
    print("=" * 60)
    print("✅ Test Complete!")
    print("=" * 60)
    print(f"\nYou can check upload progress at:")
    print(f"{BASE_URL}/reports/progress/{progress_id}")
    print(f"\nOr check documents in the case:")
    print(f"{BASE_URL}/cases/{case_id}/documents?case_id={case_id}")

if __name__ == "__main__":
    main()
