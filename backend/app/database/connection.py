from pymongo import MongoClient
from pymongo.operations import SearchIndexModel

import time
import os
from dotenv import load_dotenv
from datetime import timezone
load_dotenv()

# Determine environment
ENV = os.getenv("APP_ENV")

if ENV == "production":
    PROJECT_VARIANT = os.getenv("PROJECT_VARIANT")
    MONGO_URI = os.getenv("MONGO_SOF_DB_URI") if PROJECT_VARIANT == "sof" else os.getenv("MONGO_CASE_AND_CUSTOM_DB_URI")
else:
    # Local MongoDB connection (Docker)
    MONGO_URI = "mongodb://mongodb:27017/?directConnection=true"

# Global variables for lazy initialization
_client = None
_db = None

def get_client():
    """Get MongoDB client with lazy initialization"""
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI, uuidRepresentation='standard', tz_aware=True,
            tzinfo=timezone.utc)
    return _client

def get_db():
    """Get database instance with lazy initialization"""
    global _db
    if _db is None:
        _db = get_client().staraidocdb
    return _db

# Create properties that lazily initialize collections
@property
def client():
    return get_client()

@property 
def db():
    return get_db()

@property
def users_collection():
    return get_db().users

@property
def datasets_collection():
    return get_db().datasets

@property
def anomalies_collection():
    return get_db().anomalies

@property
def anomaly_reports_collection():
    return get_db().anomaly_reports

@property
def analysis_sessions_collection():
    return get_db().analysis_sessions

@property
def llm_explanations_collection():
    return get_db().llm_explanations

# Create a module-level class to hold our lazy properties
class DatabaseConnections:
    @property
    def client(self):
        return get_client()

    @property 
    def db(self):
        return get_db()

    @property
    def users_collection(self):
        return get_db().users

    @property
    def datasets_collection(self):
        return get_db().datasets

    @property
    def anomalies_collection(self):
        return get_db().anomalies

    @property
    def anomaly_reports_collection(self):
        return get_db().anomaly_reports

    @property
    def analysis_sessions_collection(self):
        return get_db().analysis_sessions

    @property
    def llm_explanations_collection(self):
        return get_db().llm_explanations

# Create instance for module-level access
_connections = DatabaseConnections()

# Export collections for backward compatibility
client = _connections.client
db = _connections.db
users_collection = _connections.users_collection
datasets_collection = _connections.datasets_collection
anomalies_collection = _connections.anomalies_collection
anomaly_reports_collection = _connections.anomaly_reports_collection
analysis_sessions_collection = _connections.analysis_sessions_collection
llm_explanations_collection = _connections.llm_explanations_collection

def reset_database():
    """Drop all collections and reset the database"""
    if ENV == "production":
        print("WARNING: Refusing to reset collections in production environment.")
        return False
    
    print("Dropping all collections...")
    
    # Get all existing collection names
    db_instance = get_db()
    collection_names = db_instance.list_collection_names()
    
    for collection_name in collection_names:
        try:
            db_instance[collection_name].drop()
            print(f"Dropped collection: {collection_name}")
        except Exception as e:
            print(f"Error dropping collection {collection_name}: {str(e)}")
    
    print("All collections dropped successfully.")
    return True

def create_indexes():
    """Create database indexes if they don't already exist"""

    # Get collections with lazy initialization
    db_instance = get_db()
    users_coll = _connections.users_collection
    datasets_coll = _connections.datasets_collection
    anomalies_coll = _connections.anomalies_collection
    anomaly_reports_coll = _connections.anomaly_reports_collection
    sessions_coll = _connections.analysis_sessions_collection
    llm_explanations_coll = _connections.llm_explanations_collection

    def index_exists(collection, index_name):
        """Check if an index already exists on a collection"""
        try:
            existing_indexes = list(collection.list_indexes())
            return any(idx.get('name') == index_name for idx in existing_indexes)
        except Exception as e:
            print(f"Error checking if index exists: {str(e)}")
            return False

    def create_index_if_not_exists(collection, keys, index_name=None, **kwargs):
        """Create an index if it doesn't already exist"""
        if index_name and index_exists(collection, index_name):
            print(f"Index '{index_name}' already exists on collection {collection.name}")
            return

        # For compound indexes without explicit name
        if not index_name and isinstance(keys, list):
            # Generate a name for compound indexes to check
            field_parts = [f"{k[0]}_{k[1]}" for k in keys]
            generated_name = "_".join(field_parts)
            if index_exists(collection, generated_name):
                print(f"Compound index '{generated_name}' already exists on collection {collection.name}")
                return

        try:
            collection.create_index(keys, name=index_name, **kwargs)
            print(f"Created index {index_name or keys} on collection {collection.name}")
        except Exception as e:
            print(f"Error creating index {index_name or keys} on collection {collection.name}: {str(e)}")

    # ============= USER MANAGEMENT INDEXES =============
    create_index_if_not_exists(users_coll, "username", "username_1", unique=True)
    create_index_if_not_exists(users_coll, "email", "email_1", unique=True)

    # ============= ANOMALY DETECTION INDEXES =============

    # Dataset indexes
    create_index_if_not_exists(datasets_coll, "user_id", "user_id_1")
    create_index_if_not_exists(datasets_coll, "status", "status_1")
    create_index_if_not_exists(datasets_coll, "uploaded_at", "uploaded_at_1")
    create_index_if_not_exists(datasets_coll, [("user_id", 1), ("filename", 1)], "user_id_1_filename_1")

    # Anomalies indexes
    create_index_if_not_exists(anomalies_coll, "dataset_id", "dataset_id_1")
    create_index_if_not_exists(anomalies_coll, "user_id", "user_id_1")
    create_index_if_not_exists(anomalies_coll, "status", "status_1")
    create_index_if_not_exists(anomalies_coll, "anomaly_score", "anomaly_score_1")
    create_index_if_not_exists(anomalies_coll, "detected_at", "detected_at_1")
    create_index_if_not_exists(anomalies_coll, [("dataset_id", 1), ("row_index", 1)], "dataset_id_1_row_index_1")

    # Anomaly reports indexes
    create_index_if_not_exists(anomaly_reports_coll, "user_id", "user_id_1")
    create_index_if_not_exists(anomaly_reports_coll, "dataset_id", "dataset_id_1")
    create_index_if_not_exists(anomaly_reports_coll, "anomaly_id", "anomaly_id_1", unique=True)
    create_index_if_not_exists(anomaly_reports_coll, "status", "status_1")
    create_index_if_not_exists(anomaly_reports_coll, "created_at", "created_at_1")
    create_index_if_not_exists(anomaly_reports_coll, [("user_id", 1), ("status", 1)], "user_id_1_status_1")

    # Analysis sessions indexes
    create_index_if_not_exists(sessions_coll, "user_id", "user_id_1")
    create_index_if_not_exists(sessions_coll, "dataset_id", "dataset_id_1", unique=True)
    create_index_if_not_exists(sessions_coll, "status", "status_1")
    create_index_if_not_exists(sessions_coll, "started_at", "started_at_1")

    # LLM explanations indexes
    create_index_if_not_exists(llm_explanations_coll, "dataset_id", "dataset_id_1")
    create_index_if_not_exists(llm_explanations_coll, "anomaly_id", "anomaly_id_1", unique=True)
    create_index_if_not_exists(llm_explanations_coll, "session_id", "session_id_1")
    create_index_if_not_exists(llm_explanations_coll, "verdict", "verdict_1")
    create_index_if_not_exists(llm_explanations_coll, "severity", "severity_1")
    create_index_if_not_exists(llm_explanations_coll, "status", "status_1")
    create_index_if_not_exists(llm_explanations_coll, "created_at", "created_at_1")

    # Create admin user in development environment
    if ENV == "development" or ENV is None:
        from app.core.auth import get_password_hash

        # Check if admin user already exists
        existing_admin = users_coll.find_one({"username": "admin"})

        if not existing_admin:
            # Create admin user
            admin_user = {
                "email": "admin@example.com",
                "username": "admin",
                "disabled": False,
                "hashed_password": get_password_hash("password123"),
                "is_admin": True
            }

            try:
                users_coll.insert_one(admin_user)
                print("Development admin user created successfully")
            except Exception as e:
                print(f"Warning: Failed to create admin user: {e}")

    print("All anomaly detection indexes created successfully.")