import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.models.models import TokenData, User, UserInDB, PyObjectId
from app.database.connection import db
from bson import ObjectId  # Import ObjectId from bson

# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "f70331007dbc658b5ec33d99e19f8d2a9d12ba716413456b05f01669f11fba9d")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 3

# OAuth2 setup
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# User collection
users_collection = db.users

# Password hashing utility functions
def verify_password(plain_password, hashed_password):
    # Convert plain password to bytes
    password_bytes = plain_password.encode('utf-8')
    # Convert hashed password from string to bytes if it's a string
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    # Check password
    return bcrypt.checkpw(password_bytes, hashed_password)

def get_password_hash(password):
    # Convert password to bytes
    password_bytes = password.encode('utf-8')
    # Generate salt
    salt = bcrypt.gensalt()
    # Hash password
    hashed = bcrypt.hashpw(password_bytes, salt)
    # Return as string for storage
    return hashed.decode('utf-8')

# User authentication functions
def get_user(username: str):
    user_dict = users_collection.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if user_dict:
        return UserInDB(**user_dict)
    return None

def get_user_by_id(user_id: str):
    try:
        # Convert string ID to ObjectId
        object_id = ObjectId(user_id)
        user_dict = users_collection.find_one({"_id": object_id})
        if user_dict:
            return UserInDB(**user_dict)
    except Exception as e:
        print(f"Error retrieving user by ID: {e}")
    return None

def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

# Token functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now() + expires_delta
    else:
        expire = datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("user_id")
        if user_id_str is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id_str)
    except JWTError:
        raise credentials_exception
    
    user = get_user_by_id(user_id=str(token_data.user_id))
    if user is None:
        raise credentials_exception
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_current_admin_user(current_user: User = Depends(get_current_active_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The user doesn't have enough privileges")
    return current_user