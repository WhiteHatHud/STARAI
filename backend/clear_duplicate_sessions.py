#!/usr/bin/env python3
"""
Script to clear duplicate analysis sessions.
Keeps only the most recent session for each dataset.
"""

from dotenv import load_dotenv
load_dotenv('.env.local')

from pymongo import MongoClient
import os
from datetime import datetime

# Get MongoDB URI based on PROJECT_VARIANT
PROJECT_VARIANT = os.getenv('PROJECT_VARIANT')
if PROJECT_VARIANT == 'sof':
    MONGO_URI = os.getenv('MONGO_SOF_DB_URI')
else:
    MONGO_URI = os.getenv('MONGO_CASE_AND_CUSTOM_DB_URI')

def clear_duplicate_sessions():
    """Remove duplicate sessions, keeping only the most recent for each dataset"""
    print("=" * 60)
    print("CLEAR DUPLICATE ANALYSIS SESSIONS")
    print("=" * 60)

    # Connect to MongoDB
    client = MongoClient(MONGO_URI)
    db = client.staraidocdb
    sessions = db.analysis_sessions

    # Find all sessions
    total_sessions = sessions.count_documents({})
    print(f"\nTotal sessions: {total_sessions}")

    # Find duplicates
    pipeline = [
        {
            "$group": {
                "_id": "$dataset_id",
                "count": {"$sum": 1},
                "sessions": {"$push": {"id": "$_id", "started_at": "$started_at"}}
            }
        },
        {
            "$match": {"count": {"$gt": 1}}
        }
    ]

    duplicates = list(sessions.aggregate(pipeline))
    print(f"Datasets with duplicate sessions: {len(duplicates)}")

    if not duplicates:
        print("\n✓ No duplicate sessions found!")
        client.close()
        return

    print("\nDuplicate details:")
    for dup in duplicates:
        print(f"  Dataset {dup['_id']}: {dup['count']} sessions")

    response = input("\nRemove duplicates (keep most recent)? Type 'YES' to confirm: ")

    if response != 'YES':
        print("Operation cancelled.")
        client.close()
        return

    deleted_count = 0

    for dup in duplicates:
        dataset_id = dup['_id']
        session_list = dup['sessions']

        # Sort by started_at (most recent first)
        session_list.sort(key=lambda x: x.get('started_at', datetime.min), reverse=True)

        # Keep the first (most recent), delete the rest
        to_delete = [s['id'] for s in session_list[1:]]

        if to_delete:
            result = sessions.delete_many({"_id": {"$in": to_delete}})
            deleted_count += result.deleted_count
            print(f"✓ Removed {result.deleted_count} old sessions for dataset {dataset_id}")

    print(f"\n✓ Removed {deleted_count} duplicate sessions!")
    print(f"Remaining sessions: {sessions.count_documents({})}")

    client.close()

if __name__ == "__main__":
    clear_duplicate_sessions()
