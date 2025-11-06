#!/usr/bin/env python3
"""
Script to create an admin user in MongoDB Atlas
"""
from dotenv import load_dotenv
load_dotenv('.env')

from app.database.connection import users_collection
from app.core.auth import get_password_hash

def create_admin_user():
    """Create an admin user if it doesn't exist"""

    # Check if admin already exists
    existing_admin = users_collection.find_one({"username": "admin"})

    if existing_admin:
        print("✅ Admin user already exists!")
        print(f"   Username: {existing_admin['username']}")
        print(f"   Email: {existing_admin['email']}")
        return

    # Create admin user
    admin_user = {
        "email": "admin@example.com",
        "username": "admin",
        "disabled": False,
        "hashed_password": get_password_hash("password123"),
        "is_admin": True
    }

    try:
        result = users_collection.insert_one(admin_user)
        print("✅ Admin user created successfully!")
        print(f"   Username: admin")
        print(f"   Password: password123")
        print(f"   Email: admin@example.com")
        print(f"   User ID: {result.inserted_id}")
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        return

if __name__ == "__main__":
    print("=" * 60)
    print("Creating Admin User in MongoDB Atlas")
    print("=" * 60)
    print()

    create_admin_user()

    print()
    print("=" * 60)
    print("You can now login with:")
    print("  Username: admin")
    print("  Password: password123")
    print("=" * 60)
