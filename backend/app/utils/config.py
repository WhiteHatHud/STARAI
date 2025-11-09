from functools import lru_cache
from dotenv import load_dotenv
import os


@lru_cache(maxsize=1)
def load_config():
    load_dotenv('.env.local')
    return os.environ

def get_env(key: str, default=None):
    """Get a specific environment variable."""
    config = load_config()
    return config.get(key, default)