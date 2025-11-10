#!/usr/bin/env python3
"""
Migration script to convert string _id fields to ObjectId in MongoDB.

This fixes documents that were incorrectly inserted with string _id values
instead of proper ObjectId values.

Run this script once after deploying the fix to anomaly_repo.py
"""

import os
import sys
from pymongo import MongoClient
from bson import ObjectId
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
print("ObjectId Migration Script")
print("=" * 80)
print(f"MongoDB URI: {MONGO_URI[:50]}...")
print(f"Environment: {ENV}")
print()

# Connect to MongoDB
client = MongoClient(MONGO_URI, uuidRepresentation='standard')
db = client.staraidocdb

COLLECTIONS_TO_FIX = [
    'datasets',
    'anomalies',
    'anomaly_reports',
    'analysis_sessions',
    'llm_explanations'
]

total_fixed = 0
total_errors = 0

for coll_name in COLLECTIONS_TO_FIX:
    print(f"\nProcessing collection: {coll_name}")
    print("-" * 60)

    collection = db[coll_name]

    # Find all documents
    all_docs = list(collection.find({}))
    print(f"  Total documents: {len(all_docs)}")

    fixed_count = 0
    error_count = 0

    for doc in all_docs:
        # Check if _id is a string
        if isinstance(doc['_id'], str):
            try:
                old_id_str = doc['_id']
                new_id_obj = ObjectId(old_id_str)

                # Delete the old document
                collection.delete_one({'_id': old_id_str})

                # Update the _id to ObjectId
                doc['_id'] = new_id_obj

                # Re-insert with proper ObjectId
                collection.insert_one(doc)

                print(f"    ✓ Fixed: {old_id_str} -> {new_id_obj}")
                fixed_count += 1
                total_fixed += 1

            except Exception as e:
                print(f"    ✗ Error fixing {doc.get('_id')}: {e}")
                error_count += 1
                total_errors += 1

    if fixed_count == 0:
        print(f"  No string _id values found (all ObjectIds are correct)")
    else:
        print(f"  Fixed: {fixed_count} documents")

    if error_count > 0:
        print(f"  Errors: {error_count} documents")

print("\n" + "=" * 80)
print("Migration Complete")
print("=" * 80)
print(f"Total documents fixed: {total_fixed}")
print(f"Total errors: {total_errors}")
print()

# Verify the fix
print("=" * 80)
print("Verification")
print("=" * 80)
for coll_name in COLLECTIONS_TO_FIX:
    collection = db[coll_name]
    total = collection.count_documents({})

    # Count how many have string _id (should be 0)
    string_ids = 0
    for doc in collection.find({}).limit(100):
        if isinstance(doc['_id'], str):
            string_ids += 1

    print(f"{coll_name}: {total} documents, {string_ids} string IDs remaining")

print("\n✅ Migration complete! All _id fields should now be ObjectId types.")
