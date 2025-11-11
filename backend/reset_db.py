#!/usr/bin/env python3
"""
Script to reset the database (drop all collections).
WARNING: This will delete ALL data in the database.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Temporarily override APP_ENV for reset
original_env = os.getenv('APP_ENV')
os.environ['APP_ENV'] = 'development'

from app.database.connection import reset_database, create_indexes

def main():
    print("=" * 60)
    print("DATABASE RESET UTILITY")
    print("=" * 60)
    print(f"\nOriginal APP_ENV: {original_env}")
    print("Temporarily set to: development (for reset)")
    print("\nWARNING: This will delete ALL data in your database!")
    print("=" * 60)

    response = input("\nAre you sure you want to continue? Type 'YES' to confirm: ")

    if response != 'YES':
        print("Reset cancelled.")
        return

    print("\nResetting database...")
    success = reset_database()

    if success:
        print("\n✓ Database reset successful!")
        print("\nRecreating indexes...")
        create_indexes()
        print("\n✓ Indexes recreated successfully!")
        print("\nDatabase is now clean and ready to use.")
    else:
        print("\n✗ Database reset failed or was blocked.")

if __name__ == "__main__":
    main()
