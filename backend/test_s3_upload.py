#!/usr/bin/env python3
"""
Test script to verify S3 bucket upload configuration
"""
import os
import sys
import time
import boto3
from io import BytesIO
from dotenv import load_dotenv
from botocore.exceptions import ClientError

# Load environment variables from .env.local
load_dotenv('.env.local')

def test_s3_upload():
    """Test uploading a file to S3 bucket"""

    # Get credentials from environment
    aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID")
    aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
    aws_region = os.environ.get("AWS_REGION")
    bucket_name = os.environ.get("S3_BUCKET_NAME")
    base_path = os.environ.get("S3_BASE_PATH", "dataset/")

    print("=" * 60)
    print("S3 Upload Test Configuration")
    print("=" * 60)
    print(f"AWS Access Key ID: {aws_access_key[:10]}..." if aws_access_key else "NOT SET")
    print(f"AWS Secret Key: {'*' * 20}" if aws_secret_key else "NOT SET")
    print(f"AWS Region: {aws_region}")
    print(f"S3 Bucket Name: {bucket_name}")
    print(f"S3 Base Path: {base_path}")
    print("=" * 60)
    print()

    # Check if credentials exist
    if not aws_access_key or not aws_secret_key:
        print("❌ ERROR: AWS credentials not found in environment variables!")
        return False

    if not bucket_name:
        print("❌ ERROR: S3_BUCKET_NAME not found in environment variables!")
        return False

    try:
        # Create S3 client
        print("📡 Connecting to AWS S3...")
        s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=aws_region
        )
        print("✅ Successfully connected to AWS S3\n")

        # Create test file content
        test_content = b"This is a test file to verify S3 upload configuration.\nTimestamp: " + str(time.time()).encode()
        test_file = BytesIO(test_content)
        test_key = f"{base_path}test/test-upload.txt"

        # Try to upload the test file
        print(f"📤 Uploading test file to: s3://{bucket_name}/{test_key}")
        s3_client.upload_fileobj(
            test_file,
            bucket_name,
            test_key,
            ExtraArgs={
                'ContentType': 'text/plain',
                'ServerSideEncryption': 'AES256'
            }
        )
        print("✅ Test file uploaded successfully!\n")

        # Verify the file exists
        print("🔍 Verifying file exists in S3...")
        response = s3_client.head_object(Bucket=bucket_name, Key=test_key)
        print(f"✅ File verified! Size: {response['ContentLength']} bytes\n")

        # Generate presigned URL
        print("🔗 Generating presigned URL...")
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': test_key},
            ExpiresIn=3600
        )
        print(f"✅ Presigned URL generated (valid for 1 hour)")
        print(f"   URL: {presigned_url[:80]}...\n")

        # Ask if user wants to delete the test file
        print("🗑️  Cleaning up test file...")
        s3_client.delete_object(Bucket=bucket_name, Key=test_key)
        print("✅ Test file deleted successfully\n")

        print("=" * 60)
        print("✅ ALL TESTS PASSED! Your S3 configuration is working!")
        print("=" * 60)
        return True

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        print(f"\n❌ AWS Error [{error_code}]: {error_message}")

        if error_code == 'NoSuchBucket':
            print(f"\n💡 The bucket '{bucket_name}' does not exist.")
            print("   Please create it in the AWS Console first.")
        elif error_code == 'InvalidAccessKeyId':
            print("\n💡 The AWS Access Key ID is invalid.")
            print("   Please check your credentials in .env.local")
        elif error_code == 'SignatureDoesNotMatch':
            print("\n💡 The AWS Secret Access Key is invalid.")
            print("   Please check your credentials in .env.local")
        elif error_code == 'AccessDenied':
            print("\n💡 Access denied. Please check:")
            print("   1. IAM user has S3 permissions")
            print("   2. Bucket policy allows this user")
            print("   3. Region is correct")

        return False

    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("\n🧪 Starting S3 Upload Test...\n")
    success = test_s3_upload()
    sys.exit(0 if success else 1)
