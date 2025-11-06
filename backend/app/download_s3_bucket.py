#!/usr/bin/env python3
import os
import sys
from dotenv import load_dotenv
from core.s3_manager import s3_manager

def download_all_files(local_dir: str, prefix: str = ""):
    """
    Download all files from the S3 bucket (optionally under a prefix)
    and save them locally, preserving folder structure.
    """
    os.makedirs(local_dir, exist_ok=True)

    print(f"Listing files in bucket '{s3_manager.bucket_name}' with prefix '{prefix}'...")
    all_files = s3_manager.list_files(prefix=prefix)

    if not all_files:
        print("No files found in the bucket.")
        return

    for file_name, file_info in all_files.items():
        s3_key = file_info['full_key']
        local_path = os.path.join(local_dir, file_name)

        # Ensure local folder exists
        os.makedirs(os.path.dirname(local_path), exist_ok=True)

        # Download the file directly
        file_content = s3_manager.get_object(s3_key)
        with open(local_path, "wb") as f:
            f.write(file_content)

        print(f"Downloaded: {s3_key} → {local_path}")

    print(f"\nSuccessfully downloaded {len(all_files)} files to '{local_dir}'.")


if __name__ == "__main__":
    # Accept optional command line arguments for local folder and S3 prefix
    local_folder = sys.argv[1] if len(sys.argv) > 1 else "./downloaded_files"
    s3_prefix = sys.argv[2] if len(sys.argv) > 2 else ""

    download_all_files(local_folder, s3_prefix)