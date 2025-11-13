#!/usr/bin/env python3
"""
Diagnostic script to check MongoDB dataset persistence.
Run this to see all datasets in the database and check for TTL indexes.
"""

import os
import sys
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

# Connect to MongoDB
MONGO_URI = "mongodb://mongodb:27017/?directConnection=true"
client = MongoClient(MONGO_URI, uuidRepresentation='standard')
db = client.staraidocdb

print("=" * 80)
print("MongoDB Diagnostic Report")
print("=" * 80)
print(f"\nConnected to: {MONGO_URI}")
print(f"Database: {db.name}")
print(f"Timestamp: {datetime.now().isoformat()}\n")

# 1. Check all collections
print("=" * 80)
print("COLLECTIONS IN DATABASE")
print("=" * 80)
collections = db.list_collection_names()
print(f"Total collections: {len(collections)}")
for coll_name in sorted(collections):
    count = db[coll_name].count_documents({})
    print(f"  - {coll_name}: {count} documents")

# 2. Check datasets collection in detail
print("\n" + "=" * 80)
print("DATASETS COLLECTION ANALYSIS")
print("=" * 80)
datasets_coll = db.datasets

# Check indexes
print("\nIndexes:")
for idx in datasets_coll.list_indexes():
    print(f"  - {idx['name']}")
    for key, value in idx.items():
        if key != 'name':
            print(f"      {key}: {value}")

    # Check for TTL index
    if 'expireAfterSeconds' in idx:
        print(f"      ⚠️  WARNING: TTL INDEX FOUND! Documents expire after {idx['expireAfterSeconds']} seconds")

# Get all datasets
print("\nAll Datasets:")
all_datasets = list(datasets_coll.find({}))
print(f"Total datasets: {len(all_datasets)}")

if len(all_datasets) == 0:
    print("  No datasets found in database")
else:
    for i, doc in enumerate(all_datasets, 1):
        print(f"\n  Dataset #{i}:")
        print(f"    _id: {doc['_id']}")
        print(f"    user_id: {doc.get('user_id', 'N/A')}")
        print(f"    filename: {doc.get('filename', 'N/A')}")
        print(f"    status: {doc.get('status', 'N/A')}")
        print(f"    uploaded_at: {doc.get('uploaded_at', 'N/A')}")
        if 'analyzed_at' in doc:
            print(f"    analyzed_at: {doc['analyzed_at']}")

# 3. Check anomalies collection
print("\n" + "=" * 80)
print("ANOMALIES COLLECTION ANALYSIS")
print("=" * 80)
anomalies_coll = db.anomalies

# Check for TTL indexes
print("\nIndexes:")
for idx in anomalies_coll.list_indexes():
    print(f"  - {idx['name']}")
    if 'expireAfterSeconds' in idx:
        print(f"      ⚠️  WARNING: TTL INDEX FOUND! Documents expire after {idx['expireAfterSeconds']} seconds")

total_anomalies = anomalies_coll.count_documents({})
print(f"\nTotal anomalies: {total_anomalies}")

# 4. Check analysis_sessions collection
print("\n" + "=" * 80)
print("ANALYSIS SESSIONS COLLECTION ANALYSIS")
print("=" * 80)
sessions_coll = db.analysis_sessions

print("\nIndexes:")
for idx in sessions_coll.list_indexes():
    print(f"  - {idx['name']}")
    if 'expireAfterSeconds' in idx:
        print(f"      ⚠️  WARNING: TTL INDEX FOUND! Documents expire after {idx['expireAfterSeconds']} seconds")
    if 'unique' in idx and idx['unique']:
        print(f"      UNIQUE index on: {idx['key']}")

total_sessions = sessions_coll.count_documents({})
print(f"\nTotal sessions: {total_sessions}")

all_sessions = list(sessions_coll.find({}))
for i, sess in enumerate(all_sessions, 1):
    print(f"\n  Session #{i}:")
    print(f"    _id: {sess['_id']}")
    print(f"    dataset_id: {sess.get('dataset_id', 'N/A')}")
    print(f"    user_id: {sess.get('user_id', 'N/A')}")
    print(f"    status: {sess.get('status', 'N/A')}")
    print(f"    started_at: {sess.get('started_at', 'N/A')}")

# 5. Check database-level configurations
print("\n" + "=" * 80)
print("DATABASE CONFIGURATION")
print("=" * 80)
try:
    server_status = db.command("serverStatus")
    print(f"MongoDB Version: {server_status.get('version', 'Unknown')}")
    print(f"Storage Engine: {server_status.get('storageEngine', {}).get('name', 'Unknown')}")
except Exception as e:
    print(f"Could not get server status: {e}")

# 6. Check for any scheduled operations or capped collections
print("\n" + "=" * 80)
print("COLLECTION PROPERTIES")
print("=" * 80)
for coll_name in ['datasets', 'anomalies', 'analysis_sessions']:
    try:
        stats = db.command("collStats", coll_name)
        print(f"\n{coll_name}:")
        print(f"  Capped: {stats.get('capped', False)}")
        if stats.get('capped'):
            print(f"  ⚠️  WARNING: This is a CAPPED collection (auto-deletes old documents)!")
            print(f"  Max size: {stats.get('maxSize', 'N/A')}")
            print(f"  Max documents: {stats.get('max', 'N/A')}")
    except Exception as e:
        print(f"  Error getting stats for {coll_name}: {e}")

print("\n" + "=" * 80)
print("DIAGNOSTIC COMPLETE")
print("=" * 80)
