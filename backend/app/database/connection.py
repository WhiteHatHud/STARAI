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
def docs_collection():
    return get_db().documents

@property 
def chunks_collection():
    return get_db().chunks

@property
def cases_collection():
    return get_db().cases

@property
def reports_collection():
    return get_db().reports

@property
def report_progress_collection():
    return get_db().report_progress

@property
def slides_collection():
    return get_db().slides

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
    def docs_collection(self):
        return get_db().documents

    @property 
    def chunks_collection(self):
        return get_db().chunks

    @property
    def cases_collection(self):
        return get_db().cases

    @property
    def reports_collection(self):
        return get_db().reports

    @property
    def report_progress_collection(self):
        return get_db().report_progress

    @property
    def slides_collection(self):
        return get_db().slides
    
# Create instance for module-level access
_connections = DatabaseConnections()

# Export collections for backward compatibility
client = _connections.client
db = _connections.db
users_collection = _connections.users_collection
docs_collection = _connections.docs_collection
chunks_collection = _connections.chunks_collection
cases_collection = _connections.cases_collection
reports_collection = _connections.reports_collection
report_progress_collection = _connections.report_progress_collection
slides_collection = _connections.slides_collection

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
    docs_coll = _connections.docs_collection  
    chunks_coll = _connections.chunks_collection
    cases_coll = _connections.cases_collection
    reports_coll = _connections.reports_collection
    report_progress_coll = _connections.report_progress_collection
    slides_coll = _connections.slides_collection

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
    
    # Common indexes for both environments
    create_index_if_not_exists(cases_coll, "name", "name_1", unique=True)
    create_index_if_not_exists(docs_coll, [("case_id", 1), ("name", 1)], "case_id_1_name_1", unique=True)
    create_index_if_not_exists(chunks_coll, [("doc_id", 1), ("index", 1)], "doc_id_1_index_1", unique=True)

    # User management indexes
    create_index_if_not_exists(users_coll, "username", "username_1", unique=True)
    create_index_if_not_exists(users_coll, "email", "email_1", unique=True)
    
    # Case index by user_id for quick filtering
    create_index_if_not_exists(cases_coll, "user_id", "user_id_1")
    
    # Case study indexes
    create_index_if_not_exists(reports_coll, "user_id", "user_id_1")
    create_index_if_not_exists(reports_coll, "case_id", "case_id_1")
    create_index_if_not_exists(reports_coll, "created_at", "created_at_1")
    create_index_if_not_exists(reports_coll, "status", "status_1")
    create_index_if_not_exists(reports_coll, "title", "title_1")
    
    # Case study progress indexes
    create_index_if_not_exists(report_progress_coll, "report_id", "report_id_1", unique=True)
    create_index_if_not_exists(report_progress_coll, "user_id", "user_id_1")
    create_index_if_not_exists(report_progress_coll, "status", "status_1")
    create_index_if_not_exists(report_progress_coll, "created_at", "created_at_1")
    
    # Slides collection indexes
    create_index_if_not_exists(slides_coll, "user_id", "user_id_1")
    create_index_if_not_exists(slides_coll, "created_at", "created_at_1")
    
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

    # -- Vector index logic --
    EMBEDDING_MODEL_DIMS = 1024  # DocumentDB max allowed dimension
    
    # Vector index with environment-specific implementation
    time.sleep(5)
    if ENV == "production" or ENV == "test":
        # DocumentDB vector index
        vector_index_name = "my_vss_index"
        if not index_exists(chunks_coll, vector_index_name):
            try:
                chunks_coll.create_index(
                    [("embedding", "vector")],
                    name=vector_index_name,
                    vectorOptions={
                        "type": "hnsw",
                        "dimensions": EMBEDDING_MODEL_DIMS,
                        "similarity": "cosine",
                        "m": 16,
                        'efConstruction': 64
                    }
                )
                print(f"Created vector index '{vector_index_name}' on chunks collection")
            except Exception as e:
                print(f"Error creating vector index: {str(e)}")
        else:
            print(f"Vector index '{vector_index_name}' already exists on chunks collection")
    else:
        # MongoDB Atlas Local vector index
        try:
            vector_index_name = "my_vss_index"
            # Check if the vector search index already exists
            existing_indices = list(chunks_coll.list_search_indexes())
            existing_index_names = [idx.get('name') for idx in existing_indices]
            
            if vector_index_name not in existing_index_names:
                # Create search index model for vector search
                search_index_model = SearchIndexModel(
                    definition={
                        "fields": [
                            {
                                "type": "vector",
                                "path": "embedding",
                                "numDimensions": EMBEDDING_MODEL_DIMS,
                                "similarity": "cosine",
                                "quantization": "scalar"
                            }
                        ]
                    },
                    name=vector_index_name,
                    type="vectorSearch"
                )
                
                result = chunks_coll.create_search_index(model=search_index_model)
                
                print(f"New search index named {result} is building.")
                
                # Wait for initial sync to complete
                print("Polling to check if the index is ready. This may take up to a minute.")
                predicate = lambda index: index.get("queryable") is True
                
                while True:
                    indices = list(chunks_coll.list_search_indexes(result))
                    if len(indices) and predicate(indices[0]):
                        break
                    time.sleep(5)
                    
                print(f"Index {result} is ready for querying.")
            else:
                print(f"Vector search index '{vector_index_name}' already exists on chunks collection")
            
        except Exception as e:
            print(f"Warning: Vector index creation failed in development environment: {e}")
            print("Vector search might not be available in development mode.")