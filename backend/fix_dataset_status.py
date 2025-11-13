#!/usr/bin/env python3
"""
Migration script to fix invalid dataset status values.

Replaces:
- "processing" -> "analyzing"
- "failed" -> "error"

Run this once after fixing the anomaly_routes.py code.
"""

import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

# Get MongoDB connection
ENV = os.getenv("APP_ENV")
PROJECT_VARIANT = os.getenv("PROJECT_VARIANT")

if ENV == "production":
    MONGO_URI = os.getenv("MONGO_SOF_DB_URI") if PROJECT_VARIANT == "sof" else os.getenv("MONGO_CASE_AND_CUSTOM_DB_URI")
else:
    MONGO_URI = "mongodb://mongodb:27017/?directConnection=true"

print("=" * 80)
print("Dataset Status Migration Script")
print("=" * 80)
print(f"MongoDB URI: {MONGO_URI[:50]}...")
print(f"Environment: {ENV}")
print()

# Connect to MongoDB
client = MongoClient(MONGO_URI, uuidRepresentation='standard')
db = client.staraidocdb

print("Processing collection: datasets")
print("-" * 60)

datasets = db.datasets

# Find documents with invalid status values
invalid_processing = list(datasets.find({"status": "processing"}))
invalid_failed = list(datasets.find({"status": "failed"}))

print(f"Found {len(invalid_processing)} documents with status='processing'")
print(f"Found {len(invalid_failed)} documents with status='failed'")
print()

fixed_count = 0

# Fix "processing" -> "analyzing"
if invalid_processing:
    print("Fixing 'processing' -> 'analyzing':")
    for doc in invalid_processing:
        try:
            result = datasets.update_one(
                {"_id": doc["_id"]},
                {"$set": {"status": "analyzing"}}
            )
            if result.modified_count > 0:
                print(f"  ✓ Fixed dataset {doc['_id']}: {doc.get('filename', 'unknown')}")
                fixed_count += 1
        except Exception as e:
            print(f"  ✗ Error fixing {doc['_id']}: {e}")

# Fix "failed" -> "error"
if invalid_failed:
    print("\nFixing 'failed' -> 'error':")
    for doc in invalid_failed:
        try:
            result = datasets.update_one(
                {"_id": doc["_id"]},
                {"$set": {"status": "error"}}
            )
            if result.modified_count > 0:
                print(f"  ✓ Fixed dataset {doc['_id']}: {doc.get('filename', 'unknown')}")
                fixed_count += 1
        except Exception as e:
            print(f"  ✗ Error fixing {doc['_id']}: {e}")

print("\n" + "=" * 80)
print("Migration Complete")
print("=" * 80)
print(f"Total documents fixed: {fixed_count}")
print()

# Verify the fix
print("=" * 80)
print("Verification")
print("=" * 80)

remaining_invalid = datasets.count_documents({"status": {"$in": ["processing", "failed"]}})
print(f"Remaining invalid status values: {remaining_invalid}")

# Show status distribution
print("\nCurrent status distribution:")
pipeline = [
    {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    {"$sort": {"count": -1}}
]
for result in datasets.aggregate(pipeline):
    print(f"  {result['_id']}: {result['count']}")

if remaining_invalid == 0:
    print("\n✅ Migration complete! All status values are now valid.")
else:
    print(f"\n⚠️  Warning: {remaining_invalid} documents still have invalid status values.")
