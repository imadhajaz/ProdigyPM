"""
Storage Service - Abstraction layer for file storage
Supports both local filesystem and S3 storage
"""
import os
import uuid
from pathlib import Path
from typing import Optional
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class StorageInterface(ABC):
    """Abstract base class for storage backends"""
    
    @abstractmethod
    def upload_file(self, file_content: bytes, filename: str, file_id: Optional[str] = None) -> dict:
        """Upload a file and return metadata"""
        pass
    
    @abstractmethod
    def get_file(self, file_id: str) -> Optional[bytes]:
        """Retrieve a file by ID"""
        pass
    
    @abstractmethod
    def delete_file(self, file_id: str) -> bool:
        """Delete a file by ID"""
        pass
    
    @abstractmethod
    def get_file_url(self, file_id: str) -> Optional[str]:
        """Get a URL to access the file"""
        pass


class LocalStorage(StorageInterface):
    """Local filesystem storage implementation"""
    
    def __init__(self, upload_dir: Path):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"LocalStorage initialized with directory: {self.upload_dir}")
    
    def upload_file(self, file_content: bytes, filename: str, file_id: Optional[str] = None) -> dict:
        """Save file to local filesystem"""
        if file_id is None:
            file_id = str(uuid.uuid4())
        
        file_extension = Path(filename).suffix
        stored_filename = f"{file_id}{file_extension}"
        file_path = self.upload_dir / stored_filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        file_size = len(file_content)
        logger.info(f"File saved locally: {stored_filename} ({file_size} bytes)")
        
        return {
            "file_id": file_id,
            "filename": filename,
            "stored_filename": stored_filename,
            "file_size": file_size,
            "file_path": str(file_path),
            "storage_type": "local"
        }
    
    def get_file(self, file_id: str) -> Optional[bytes]:
        """Read file from local filesystem"""
        # Find file by ID (scan directory for files starting with file_id)
        matching_files = list(self.upload_dir.glob(f"{file_id}.*"))
        if matching_files:
            file_path = matching_files[0]  # Take the first match
            with open(file_path, "rb") as f:
                return f.read()
        logger.warning(f"File with ID {file_id} not found in {self.upload_dir}")
        return None
    
    def delete_file(self, file_id: str) -> bool:
        """Delete file from local filesystem"""
        for file_path in self.upload_dir.glob(f"{file_id}.*"):
            try:
                file_path.unlink()
                logger.info(f"File deleted: {file_path}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete file {file_path}: {e}")
                return False
        return False
    
    def get_file_url(self, file_id: str) -> Optional[str]:
        """Get local file path (for local storage, returns path)"""
        for file_path in self.upload_dir.glob(f"{file_id}.*"):
            return str(file_path)
        return None


class S3Storage(StorageInterface):
    """AWS S3 storage implementation"""
    
    def __init__(self, bucket_name: str, aws_access_key_id: Optional[str] = None, 
                 aws_secret_access_key: Optional[str] = None, region: str = "us-east-1"):
        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError:
            raise ImportError("boto3 is required for S3 storage. Install it with: pip install boto3")
        
        self.bucket_name = bucket_name
        self.region = region
        
        # Initialize S3 client
        if aws_access_key_id and aws_secret_access_key:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
                region_name=region
            )
        else:
            # Use default credentials (from environment, IAM role, etc.)
            self.s3_client = boto3.client('s3', region_name=region)
        
        logger.info(f"S3Storage initialized with bucket: {bucket_name}")
    
    def upload_file(self, file_content: bytes, filename: str, file_id: Optional[str] = None) -> dict:
        """Upload file to S3"""
        if file_id is None:
            file_id = str(uuid.uuid4())
        
        file_extension = Path(filename).suffix
        s3_key = f"uploads/{file_id}{file_extension}"
        
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType="application/pdf"
            )
            
            file_size = len(file_content)
            file_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_key}"
            
            logger.info(f"File uploaded to S3: {s3_key} ({file_size} bytes)")
            
            return {
                "file_id": file_id,
                "filename": filename,
                "stored_filename": s3_key,
                "file_size": file_size,
                "file_path": s3_key,
                "file_url": file_url,
                "storage_type": "s3"
            }
        except Exception as e:
            logger.error(f"Failed to upload file to S3: {e}")
            raise
    
    def get_file(self, file_id: str) -> Optional[bytes]:
        """Download file from S3"""
        # List objects with prefix to find the file
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"uploads/{file_id}"
            )
            
            if 'Contents' in response:
                s3_key = response['Contents'][0]['Key']
                obj = self.s3_client.get_object(Bucket=self.bucket_name, Key=s3_key)
                return obj['Body'].read()
        except Exception as e:
            logger.error(f"Failed to get file from S3: {e}")
        return None
    
    def delete_file(self, file_id: str) -> bool:
        """Delete file from S3"""
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"uploads/{file_id}"
            )
            
            if 'Contents' in response:
                s3_key = response['Contents'][0]['Key']
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
                logger.info(f"File deleted from S3: {s3_key}")
                return True
        except Exception as e:
            logger.error(f"Failed to delete file from S3: {e}")
        return False
    
    def get_file_url(self, file_id: str) -> Optional[str]:
        """Get S3 URL for the file"""
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=f"uploads/{file_id}"
            )
            
            if 'Contents' in response:
                s3_key = response['Contents'][0]['Key']
                return f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_key}"
        except Exception as e:
            logger.error(f"Failed to get file URL from S3: {e}")
        return None


def get_storage_service() -> StorageInterface:
    """
    Factory function to get the appropriate storage service
    Based on environment variables:
    - STORAGE_TYPE: 'local' or 's3' (default: 'local')
    - For S3: AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
    """
    storage_type = os.getenv("STORAGE_TYPE", "local").lower()
    
    if storage_type == "s3":
        bucket_name = os.getenv("AWS_S3_BUCKET")
        if not bucket_name:
            raise ValueError("AWS_S3_BUCKET environment variable is required for S3 storage")
        
        aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
        aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        aws_region = os.getenv("AWS_REGION", "us-east-1")
        
        return S3Storage(
            bucket_name=bucket_name,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region=aws_region
        )
    else:
        # Default to local storage
        upload_dir = Path(__file__).parent.parent / "uploads"
        return LocalStorage(upload_dir=upload_dir)

