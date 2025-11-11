#!/usr/bin/env python3
"""
Script to clear specific collections from the database.
Works in any environment (including production).
"""

from dotenv import load_dotenv
load_dotenv('.env.local')

from pymongo import MongoClient
import os

# Get MongoDB URI based on PROJECT_VARIANT
PROJECT_VARIANT = os.getenv('PROJECT_VARIANT')
if PROJECT_VARIANT == 'sof':
    MONGO_URI = os.getenv('MONGO_SOF_DB_URI')
else:
    MONGO_URI = os.getenv('MONGO_CASE_AND_CUSTOM_DB_URI')

def clear_database():
    """Clear all collections in the database"""
    print("=" * 60)
    print("CLEAR DATABASE COLLECTIONS")
    print("=" * 60)
    print(f"Environment: {os.getenv('APP_ENV')}")
    print(f"Project Variant: {PROJECT_VARIANT}")
    print(f"Database: staraidocdb")
    print("=" * 60)

    # Connect to MongoDB
    client = MongoClient(MONGO_URI)
    db = client.staraidocdb

    # Get all collection names
    collections = db.list_collection_names()

    print(f"\nFound {len(collections)} collections:")
    for coll in collections:
        count = db[coll].count_documents({})
        print(f"  - {coll}: {count} documents")

    print("\n" + "=" * 60)
    print("WARNING: This will DELETE ALL DATA in these collections!")
    print("=" * 60)

    response = input("\nType 'DELETE ALL' to confirm: ")

    if response != 'DELETE ALL':
        print("Operation cancelled.")
        client.close()
        return

    print("\nDeleting collections...")

    for collection_name in collections:
        try:
            db[collection_name].delete_many({})
            print(f"✓ Cleared collection: {collection_name}")
        except Exception as e:
            print(f"✗ Error clearing {collection_name}: {str(e)}")

    print("\n✓ All collections cleared!")
    print("\nRecreating indexes...")

    # Import and run create_indexes
    from app.database.connection import create_indexes
    create_indexes()

    print("\n✓ Database is now clean and ready to use.")
    client.close()

if __name__ == "__main__":
    clear_database()
