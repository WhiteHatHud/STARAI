#!/usr/bin/env python3
"""
Script to clear duplicate analysis sessions.
No external dependencies needed - just use your MongoDB URI directly.
"""

from pymongo import MongoClient
from datetime import datetime

# MongoDB URI - update this with your connection string
MONGO_URI = "mongodb+srv://starai_user:MF5hklEyqIN4L5GY@starai-cluster.ltossgo.mongodb.net/starai_case_custom?retryWrites=true&w=majority&appName=starai-cluster"

def clear_duplicate_sessions():
    """Remove duplicate sessions, keeping only the most recent for each dataset"""
    print("=" * 60)
    print("CLEAR DUPLICATE ANALYSIS SESSIONS")
    print("=" * 60)

    try:
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

    except Exception as e:
        print(f"\n✗ Error: {str(e)}")
        print("\nMake sure pymongo is installed: pip3 install pymongo")

if __name__ == "__main__":
    clear_duplicate_sessions()
