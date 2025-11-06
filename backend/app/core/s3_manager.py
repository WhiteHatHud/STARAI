import os
import boto3
import botocore.config
from botocore.exceptions import ClientError
from typing import Optional, BinaryIO, Dict, Any
import traceback
import logging
import io
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

class S3Manager:
    def __init__(self):
        # Load from environment variables
        self.aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID")
        self.aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
        self.region_name = os.environ.get("AWS_REGION", "ap-southeast-1")
        self.bucket_name = os.environ.get("S3_BUCKET_NAME", "starai-dev-documents")

        # The base path within the bucket where all files will be stored
        self.base_path = os.environ.get("S3_BASE_PATH", "dataset/")
        
        # Configure S3 client with Signature Version 4
        self.s3_config = botocore.config.Config(
            signature_version='s3v4',
            s3={'addressing_style': 'virtual'},
            retries={
                'max_attempts': 3,
                'mode': 'standard'
            }
        )
        
        # Initialize S3 client with Signature Version 4
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=self.aws_access_key,
            aws_secret_access_key=self.aws_secret_key,
            region_name=self.region_name,
            config=self.s3_config
        )
        
        logger.info(f"Initialized S3Manager with Signature Version 4 for region {self.region_name}")
    
    # Add this to s3_utils.py
    
    def refresh_credentials(self):
        """
        Refresh S3 credentials from environment variables
        """
        try:
            # Reload environment variables
            from dotenv import load_dotenv
            load_dotenv()
            
            # Get fresh credentials from environment
            self.aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID")
            self.aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
            self.region_name = os.environ.get("AWS_REGION", "ap-southeast-1")
            
            # Reinitialize the client with the new credentials
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=self.aws_access_key,
                aws_secret_access_key=self.aws_secret_key,
                region_name=self.region_name,
                config=self.s3_config
            )
            
            logger.info(f"S3Manager credentials refreshed for region {self.region_name}")
            return True
        except Exception as e:
            logger.error(f"Error refreshing S3Manager credentials: {e}")
            return False
    
    def upload_file(self, file_obj: BinaryIO, key: str, content_type: Optional[str] = None, metadata: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Upload a file to S3 bucket using Signature Version 4
        
        Args:
            file_obj: File-like object to upload
            key: S3 object key (path)
            content_type: MIME type of the file
            metadata: Optional dictionary of metadata to store with the object
            
        Returns:
            Dict with uploaded file info including s3:// URL
        """
        try:
            # Check if credentials are available
            if not self.aws_access_key or not self.aws_secret_key:
                logger.warning("S3 credentials missing, attempting to refresh...")
                self.refresh_credentials()
                if not self.aws_access_key or not self.aws_secret_key:
                    raise ValueError("Unable to obtain AWS credentials for S3 upload")
            
            if not key.startswith(self.base_path):
                full_key = f"{self.base_path}{key}"
            else:
                full_key = key

            # Use the full key for upload
            extra_args = {'ServerSideEncryption': 'AES256'}  # Default encryption
            if content_type:
                extra_args['ContentType'] = content_type
            if metadata:
                extra_args['Metadata'] = metadata
                
            logger.info(f"Uploading file to S3: bucket={self.bucket_name}, key={key}")
            
            # Perform the upload
            try:
                self.s3_client.upload_fileobj(
                    file_obj,
                    self.bucket_name,
                    key,
                    ExtraArgs=extra_args
                )
            except ClientError as upload_error:
                error_message = upload_error.response.get('Error', {}).get('Message', str(upload_error))
                logger.error(f"S3 upload failed with error: {error_message}")
                raise
            
            # Generate canonical S3 URL
            s3_url = f"s3://{self.bucket_name}/{key}"
            
            logger.info(f"Successfully uploaded file to {s3_url}")
            return {
                "key": key,
                "url": s3_url,
                "bucket": self.bucket_name
            }
        except ClientError as e:
            logger.error(f"Error uploading file to S3: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during S3 upload: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    def get_object(self, key: str) -> bytes:
        """
        Get an object directly from S3 as bytes using Signature Version 4
        
        Args:
            key: S3 object key
            
        Returns:
            Object content as bytes
        """
        try:
            # Check if credentials are available
            if not self.aws_access_key or not self.aws_secret_key:
                logger.warning("S3 credentials missing, attempting to refresh...")
                self.refresh_credentials()
                if not self.aws_access_key or not self.aws_secret_key:
                    raise ValueError("Unable to obtain AWS credentials for S3 upload")
                
            logger.info(f"Getting object from S3: bucket={self.bucket_name}, key={key}")
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=key
            )
            return response['Body'].read()
        except ClientError as e:
            logger.error(f"Error getting object from S3: {e}")
            raise
    
    def get_object_stream(self, key: str) -> io.BytesIO:
        """
        Get an object from S3 as a file-like stream using Signature Version 4
        
        Args:
            key: S3 object key
            
        Returns:
            BytesIO object containing the file content
        """
        try:
            # Check if credentials are available
            if not self.aws_access_key or not self.aws_secret_key:
                logger.warning("S3 credentials missing, attempting to refresh...")
                self.refresh_credentials()
                if not self.aws_access_key or not self.aws_secret_key:
                    raise ValueError("Unable to obtain AWS credentials for S3 upload")
                
            logger.info(f"Getting object stream from S3: bucket={self.bucket_name}, key={key}")
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=key
            )
            stream = io.BytesIO(response['Body'].read())
            stream.seek(0)  # Reset the stream position to the beginning
            return stream
        except ClientError as e:
            logger.error(f"Error getting object stream from S3: {e}")
            raise
    
    def generate_presigned_url(self, key: str, expiration: int = 3600) -> str:
        """
        Generate a presigned URL for an S3 object using Signature Version 4
        
        Args:
            key: S3 object key
            expiration: URL expiration time in seconds (default: 1 hour)
            
        Returns:
            Presigned URL as string with S3v4 signature
        """
        try:
            # Check if credentials are available
            if not self.aws_access_key or not self.aws_secret_key:
                logger.warning("S3 credentials missing, attempting to refresh...")
                self.refresh_credentials()
                if not self.aws_access_key or not self.aws_secret_key:
                    raise ValueError("Unable to obtain AWS credentials for S3 upload")
                
            logger.info(f"Generating presigned URL (S3v4) for: bucket={self.bucket_name}, key={key}")
            
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': key
                },
                ExpiresIn=expiration
            )
            
            logger.info(f"Generated presigned URL with S3v4 signature (expires in {expiration} seconds)")
            return url
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {e}")
            raise
    
    def delete_file(self, key: str) -> None:
        """Delete a file from S3 bucket using Signature Version 4"""
        try:
            # Check if credentials are available
            if not self.aws_access_key or not self.aws_secret_key:
                logger.warning("S3 credentials missing, attempting to refresh...")
                self.refresh_credentials()
                if not self.aws_access_key or not self.aws_secret_key:
                    raise ValueError("Unable to obtain AWS credentials for S3 upload")
                
            logger.info(f"Deleting file from S3: bucket={self.bucket_name}, key={key}")
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=key
            )
            logger.info(f"Successfully deleted file from S3")
        except ClientError as e:
            logger.error(f"Error deleting file from S3: {e}")
            raise

    def list_files(self, prefix: str = '') -> Dict[str, Any]:
        """
        List files in S3 bucket with optional prefix
        
        Args:
            prefix: Optional prefix to filter files
            
        Returns:
            Dict with file keys and their metadata
        """
        try:
            # Check if credentials are available
            if not self.aws_access_key or not self.aws_secret_key:
                logger.warning("S3 credentials missing, attempting to refresh...")
                self.refresh_credentials()
                if not self.aws_access_key or not self.aws_secret_key:
                    raise ValueError("Unable to obtain AWS credentials for S3 upload")
                
            logger.info(f"Listing files in S3: bucket={self.bucket_name}, prefix={prefix}")
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            files = {}
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Remove the base path prefix from the key for cleaner display
                    clean_key = obj['Key'].replace(prefix, '', 1) if obj['Key'].startswith(prefix) else obj['Key']
                    
                    # Get object metadata to retrieve report metadata
                    try:
                        head_response = self.s3_client.head_object(
                            Bucket=self.bucket_name,
                            Key=obj['Key']
                        )
                        object_metadata = head_response.get('Metadata', {})
                    except ClientError as e:
                        logger.warning(f"Could not retrieve metadata for {obj['Key']}: {e}")
                        object_metadata = {}
                    
                    files[clean_key] = {
                        'full_key': obj['Key'],  # Keep the full key for S3 operations
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat(),
                        'storage_class': obj.get('StorageClass', 'STANDARD'),
                        'report_metadata': {
                            'report_type': object_metadata.get('report-type'),
                            'primary_focus': object_metadata.get('primary-focus'),
                            'template_name': object_metadata.get('template-name'),
                            'created_by': object_metadata.get('created-by'),
                            'sections_count': object_metadata.get('sections-count')
                        }
                    }
                    
            logger.info(f"Found {len(files)} files in S3")
            return files
        except ClientError as e:
            logger.error(f"Error listing files in S3: {e}")
            raise
    
    def parse_s3_url(self, s3_url: str) -> Dict[str, str]:
        """
        Parse an S3 URL and extract bucket and key
        
        Args:
            s3_url: S3 URL (s3://)
            
        Returns:
            Dict with 'bucket' and 'key'
        """
        if not s3_url.startswith('s3://'):
            raise ValueError(f"Invalid S3 URL format: {s3_url}. Expected s3:// format.")
            
        parts = s3_url.replace('s3://', '').split('/', 1)
        bucket = parts[0]
        key = parts[1] if len(parts) > 1 else ''
        
        return {
            'bucket': bucket,
            'key': key
        }
    
    def is_kms_encrypted(self, key: str) -> bool:
        """
        Check if an object is encrypted with AWS KMS
        
        Args:
            key: S3 object key
            
        Returns:
            bool: True if the object is KMS encrypted
        """
        try:
            # Check if credentials are available
            if not self.aws_access_key or not self.aws_secret_key:
                logger.warning("S3 credentials missing, attempting to refresh...")
                self.refresh_credentials()
                if not self.aws_access_key or not self.aws_secret_key:
                    raise ValueError("Unable to obtain AWS credentials for S3 upload")
                
            response = self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=key
            )
            # Check if ServerSideEncryption is aws:kms
            return response.get('ServerSideEncryption') == 'aws:kms'
        except ClientError as e:
            logger.error(f"Error checking KMS encryption for object: {e}")
            return False

    def extract_report_metadata_for_upload(self, template_content: str, template_name: str, created_by: str = None) -> Dict[str, str]:
        """
        Extract report metadata from template content for S3 upload
        
        Args:
            template_content: JSON string of the template
            template_name: Name of the template
            created_by: User who created the template
            
        Returns:
            Dict of metadata for S3 upload (keys must be lowercase and hyphens only)
        """
        try:
            import json
            template_data = json.loads(template_content)
            
            report_metadata = template_data.get('report_metadata', {})
            sections = template_data.get('sections', [])
            
            # S3 metadata keys must be lowercase and contain only letters, numbers, and hyphens
            metadata = {
                'template-name': template_name,
                'report-type': report_metadata.get('report_type', ''),
                'primary-focus': report_metadata.get('primary_focus', ''),
                'sections-count': str(len(sections)),
                'content-type': 'template'
            }
            
            if created_by:
                metadata['created-by'] = created_by
                
            # Remove empty values
            return {k: v for k, v in metadata.items() if v}
            
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Could not extract metadata from template: {e}")
            return {
                'template-name': template_name,
                'content-type': 'template'
            }

# Create a singleton instance
s3_manager = S3Manager()