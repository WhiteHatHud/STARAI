import json
from typing import List, Dict, Any
from io import BytesIO
from app.core.s3_manager import s3_manager
from datetime import datetime, timedelta, timezone
import uuid
import random

class ReportTemplateRepository:
    """Repository for handling case study template storage operations"""
    
    def __init__(self):
        self.s3_manager = s3_manager
        self.template_prefix = "s3bucket-starai-sa4jp/dataset/documents/template"
        self.temp_prefix = "s3bucket-starai-sa4jp/dataset/documents/temp"
        self.public_prefix = "s3bucket-starai-sa4jp/dataset/documents/public"
        self.shared_prefix = "s3bucket-starai-sa4jp/dataset/documents/shared"
        self.cleanup_probability = float("0.1")
    
    async def upload_temp_template(self, user_id: str, template_content: bytes, filename: str) -> Dict[str, Any]:
        """Upload template file to temporary location in S3"""
        try:
            template_file_obj = BytesIO(template_content)
            temp_key = f"{self.temp_prefix}/{user_id}/{filename}"
            
            s3_info = self.s3_manager.upload_file(file_obj=template_file_obj, key=temp_key)
            presigned_url = self.s3_manager.generate_presigned_url(key=temp_key)
            
            return {
                "s3_info": s3_info,
                "presigned_url": presigned_url,
                "temp_key": temp_key
            }
        except Exception as e:
            raise Exception(f"Failed to upload temporary template: {str(e)}")
    
    def cleanup_temp_template(self, temp_key: str) -> bool:
        """Clean up temporary template file from S3"""
        try:
            self.s3_manager.delete_file(key=temp_key)
            return True
        except Exception as e:
            print(f"Warning: Failed to cleanup temp file {temp_key}: {str(e)}")
            return False
    
    async def save_template(
        self, 
        user_id: str, 
        template_content: str, 
        username: str
    ) -> Dict[str, Any]:
        """Save template content to S3 with metadata"""
        try:
            template_name = str(uuid.uuid4())
            template_key = f"{self.template_prefix}/{user_id}/{template_name}"
            
            # Convert content to bytes
            template_content_bytes = template_content.encode('utf-8')
            template_file_obj = BytesIO(template_content_bytes)
            
            # Extract metadata from the generated template content
            metadata = self.s3_manager.extract_report_metadata_for_upload(
                template_content=template_content,
                template_name=template_name,
                created_by=username
            )
            
            # Upload the template with metadata
            s3_info = self.s3_manager.upload_file(
                file_obj=template_file_obj, 
                key=template_key,
                content_type="text/plain",
                metadata=metadata
            )
            
            return {
                "s3_info": s3_info,
                "template_name": template_name,
                "template_key": template_key,
                "metadata": metadata
            }
        except Exception as e:
            raise Exception(f"Failed to save template: {str(e)}")
    
    def list_user_templates(self, user_id: str) -> List[Dict[str, Any]]:
        """List all templates for a specific user with metadata"""
        try:
            files = self.s3_manager.list_files(prefix=f"{self.template_prefix}/{user_id}/")
            
            templates = []
            for clean_key, file_info in files.items():
                filename = clean_key.split('/')[-1]  # Get just the filename
                template_data = {
                    "filename": filename,
                    "template_name": filename,
                    "size": file_info['size'],
                    "last_modified": file_info['last_modified'],
                    "storage_class": file_info['storage_class'],
                    "s3_key": file_info['full_key'],
                    "report_metadata": file_info.get('report_metadata', {})
                }
                templates.append(template_data)
            return templates
            
        except Exception as e:
            raise Exception(f"Failed to list templates: {str(e)}")
    
    def get_template_by_name(self, user_id: str, template_name: str) -> Dict[str, Any]:
        """Get a specific template with its content and metadata"""
        try:
            template_key = f"{self.template_prefix}/{user_id}/{template_name}"
            
            # Get the template content
            template_content = self.s3_manager.get_object(template_key).decode('utf-8')
            
            # Get the template metadata from S3
            files = self.s3_manager.list_files(prefix=template_key)
            file_info = files.get(template_name, {})
            
            return {
                "template_name": template_name,
                "content": template_content,
                "s3_key": template_key,
                "size": file_info.get('size'),
                "last_modified": file_info.get('last_modified'),
                "report_metadata": file_info.get('report_metadata', {})
            }
            
        except Exception as e:
            raise Exception(f"Failed to get template {template_name}: {str(e)}")

    def update_template(self, user_id: str, username: str, template_name: str, updated_content: str) -> Dict[str, Any]:
        """Update an existing template with new content"""
        try:
            template_key = f"{self.template_prefix}/{user_id}/{template_name}"
            
            # Convert updated content to bytes
            updated_content_bytes = updated_content.encode('utf-8')
            updated_file_obj = BytesIO(updated_content_bytes)
            
            # Extract metadata from the generated template content
            metadata = self.s3_manager.extract_report_metadata_for_upload(
                template_content=updated_content,
                template_name=template_name,
                created_by=username
            )
             
            # Upload the template with metadata
            s3_info = self.s3_manager.upload_file(
                file_obj=updated_file_obj, 
                key=template_key,
                content_type="text/plain",
                metadata=metadata
            )
            
            return {
                "s3_info": s3_info,
                "template_name": template_name,
                "template_key": template_key,
                "metadata": metadata
            }
        
        except Exception as e:
            raise Exception(f"Failed to update template {template_name}: {str(e)}")

    def delete_template(self, user_id: str, template_name: str) -> bool:
        """Delete a specific template"""
        try:
            template_key = f"{self.template_prefix}/{user_id}/{template_name}"
            
            self.s3_manager.delete_file(template_key)
            template_identifier = f"{user_id}:{template_name}"
            public_templates = self.get_public_templates_dict().get('public_templates', {})
            
            if template_identifier in public_templates:
                del public_templates[template_identifier]
                self._save_public_templates_dict(public_templates)
            
            return True
        except Exception as e:
            raise Exception(f"Failed to delete template {template_name}: {str(e)}")

    def delete_user_templates(self, user_id: str) -> int:
        """Delete all templates for a specific user"""
        try:
            files = self.s3_manager.list_files(prefix=f"{self.template_prefix}/{user_id}/")
            
            for clean_key, file_info in files.items():
                try:
                    self.s3_manager.delete_file(key=file_info['full_key'])
                except Exception as e:
                    print(f"Warning: Failed to delete template {file_info['full_key']}: {str(e)}")
                    continue
            
            public_templates = self.get_public_templates_dict().get('public_templates', {})
            keys_to_delete = [key for key in public_templates if key.startswith(f"{user_id}:")]
            
            for key in keys_to_delete:
                del public_templates[key]
            
            if keys_to_delete:
                self._save_public_templates_dict(public_templates)
            
        except Exception as e:
            raise Exception(f"Failed to delete user templates: {str(e)}")

    def share_template(self, user_id: str, template_name: str) -> str:
        """Generate a shareable code for a template with 7 days TTL"""
        try:
            share_code = str(uuid.uuid4())
            file_obj = {
                "template_path": f"{self.template_prefix}/{user_id}/{template_name}",
                "time_to_live": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            }
            file_obj = json.dumps(file_obj).encode('utf-8')
            file_obj = BytesIO(file_obj)
            self.s3_manager.upload_file(file_obj=file_obj, key=f"{self.shared_prefix}/{share_code}")
            self.clean_up_shares()
            return share_code
        except Exception as e:
            raise Exception(f"Failed to share template {template_name}: {str(e)}")

    def validate_share_code(self, share_code: str) -> Dict[str, Any]:
        """Check if a share code is valid and not expired"""
        try:
            key = f"{self.shared_prefix}/{share_code}"
            file_obj = self.s3_manager.get_object(key=key).decode('utf-8')
            shared_info = json.loads(file_obj)
            if shared_info.get("time_to_live") < datetime.now(timezone.utc).isoformat():
                self.s3_manager.delete_file(key=key)
                return {"result": False, "message": "Share code has expired"}
        except Exception as e:
            return {"result": False, "message": str(e)}
        
        try:           
            template_path = shared_info.get("template_path")
            print(template_path)
            file_obj = self.s3_manager.get_object(key=template_path)
            template_content = file_obj.decode('utf-8')
            return {"result": True, "message": template_content}
        except Exception as e:
            self.s3_manager.delete_file(key=key)
            return {"result": False, "message": "Template has been deleted"}

    def assign_template_to_users(self, share_code: str, users: List[Any]) -> str:
        """Assign a shared template to multiple users"""
        validation_result = self.validate_share_code(share_code)
        if not validation_result.get("result"):
            return f"Failed to assign template: {validation_result.get('message')}"
        
        # Fixed: Get template_content from the message field
        template_content = validation_result.get("message")
        
        success_count = 0
        total_count = len(users)
        
        for user in users:
            try:
                user_id = str(user.id)
                username = user.username
                new_template_name = str(uuid.uuid4())
                new_template_key = f"{self.template_prefix}/{user_id}/{new_template_name}"

                metadata = self.s3_manager.extract_report_metadata_for_upload(
                    template_content=template_content,
                    template_name=new_template_name,
                    created_by=username
                )
                
                # Convert template content to bytes for upload
                template_content_bytes = template_content.encode('utf-8')
                template_file_obj = BytesIO(template_content_bytes)
                
                # Upload the template with metadata
                self.s3_manager.upload_file(
                    file_obj=template_file_obj, 
                    key=new_template_key,
                    content_type="text/plain",
                    metadata=metadata
                )
                success_count += 1
                print(f"Successfully assigned template to user {username}")
                
            except Exception as e:
                print(f"Warning: Failed to assign template to user {username}: {str(e)}")
                continue
        
        self.clean_up_shares()
        return f"Template {share_code} assigned successfully to {success_count}/{total_count} users"

    def get_share_template(self, user_id: str, username: str, share_code: str) -> Dict[str, Any]:
        """Retrieve the shared template information"""
        validation_result = self.validate_share_code(share_code)
        if not validation_result.get("result"):
            return {"result": validation_result.get("message")}

        # Fixed: Get template_content from the message field
        template_content = validation_result.get("message")
        new_template_name = str(uuid.uuid4())
        new_template_key = f"{self.template_prefix}/{user_id}/{new_template_name}"

        metadata = self.s3_manager.extract_report_metadata_for_upload(
            template_content=template_content,
            template_name=new_template_name,
            created_by=username
        )
        
        # Convert template content to bytes for upload
        template_content_bytes = template_content.encode('utf-8')
        template_file_obj = BytesIO(template_content_bytes)
        
        # Upload the template with metadata
        self.s3_manager.upload_file(
            file_obj=template_file_obj, 
            key=new_template_key,
            content_type="text/plain",
            metadata=metadata
        )
        
        self.clean_up_shares()
        return {
            "result": "Template imported successfully",
            "template_name": new_template_name,
            "template_key": new_template_key
        }

    def clean_up_shares(self):
        """Remove expired shared templates"""
        if random.random() > self.cleanup_probability:
            return
        try:
            files = self.s3_manager.list_files(prefix=f"{self.shared_prefix}/")
            for clean_filename, file_info in files.items():  # files is a dict
                try:
                    file_content = self.s3_manager.get_object(key=file_info['full_key'])
                    file_data = json.loads(file_content.decode('utf-8'))
                    
                    if file_data.get("time_to_live") < datetime.now(timezone.utc).isoformat():
                        self.s3_manager.delete_file(key=file_info['full_key'])
                except Exception as e:
                    print(f"Error processing shared file {clean_filename}: {str(e)}")
                    continue
        except Exception as e:
            raise Exception(f"Failed to clean up shared templates: {str(e)}")

    def toggle_public(self, user_id: str, template_name: str) -> bool:
        """Toggle the public visibility of a template"""
        try:
            public_templates = self.get_public_templates_dict().get('public_templates', {})
            template_identifier = f"{user_id}:{template_name}"
            
            if template_identifier in public_templates:
                del public_templates[template_identifier]
                is_now_public = False
            else:
                user_templates = self.list_user_templates(user_id)
                template_data = next((template for template in user_templates if template.get("template_name") == template_name), None)

                if template_data:
                    template_data["template_identifier"] = template_identifier
                    public_templates[template_identifier] = template_data
                    is_now_public = True
                else:
                    raise Exception(f"Template {template_name} not found in user templates")

            self._save_public_templates_dict(public_templates)
            return is_now_public            
        except Exception as e:
            raise Exception(f"Failed to toggle public status for template {template_name}: {str(e)}")
    
    def get_public_templates_dict(self) -> Dict[str, Dict[str, Any]]:
        """Get the dictionary of public templates with metadata from S3"""
        try:
            public_list_key = f"{self.public_prefix}/public_templates_list.json"
            file_content = self.s3_manager.get_object(key=public_list_key).decode('utf-8')
            data = json.loads(file_content)
            return data
        except Exception as e:
            self.s3_manager.upload_file(
                file_obj=BytesIO(json.dumps({"public_templates": {}, "last_updated": datetime.now().isoformat(), "total_count": 0}).encode('utf-8')),
                key=f"{self.public_prefix}/public_templates_list.json", 
                content_type="application/json"
            )
            return {"public_templates": {}, "last_updated": datetime.now().isoformat(), "total_count": 0}

    def _save_public_templates_dict(self, public_templates: Dict[str, Dict[str, Any]]) -> None:
        """Save the dictionary of public templates with metadata to S3"""
        try:
            public_list_key = f"{self.public_prefix}/public_templates_list.json"
            data = {
                "public_templates": public_templates,
                "last_updated": datetime.now().isoformat(),
                "total_count": len(public_templates)
            }
            file_content = json.dumps(data, indent=2, default=str).encode('utf-8')
            file_obj = BytesIO(file_content)
            self.s3_manager.upload_file(
                file_obj=file_obj, 
                key=public_list_key,
                content_type="application/json"
            )
        except Exception as e:
            raise Exception(f"Failed to save public templates dict: {str(e)}")
    
    def get_public_template_content(self, template_identifier: str) -> Dict[str, Any]:
        """Get the full content of a public template and increment download count"""
        try:
            user_id, template_name = template_identifier.split(":", 1)
            template_data = self.get_template_by_name(user_id, template_name)
            return template_data
        except Exception as e:
            raise Exception(f"Failed to get public template content: {str(e)}")
    
    def list_templates_for_existing_users(self) -> List[Dict[str, Any]]:
        """List all private templates, but only for users that exist in the database"""
        try:
            # Import here to avoid circular imports
            from app.repositories.user_repo import get_all_users
            
            # Get all user IDs from the database
            existing_users = get_all_users()
            existing_user_ids = {str(user.id) for user in existing_users}
            # Create a mapping of user_id to username for easy lookup
            user_id_to_username = {str(user.id): user.username for user in existing_users}
            
            print(f"Found {len(existing_user_ids)} users in database: {existing_user_ids}")
            
            # Fetch templates for each existing user
            templates = []
            for user_id in existing_user_ids:
                try:
                    # Fetch templates only for this specific user using targeted prefix
                    user_prefix = f"{self.template_prefix}/{user_id}/"
                    user_files = self.s3_manager.list_files(prefix=user_prefix)
                    
                    # Process templates for this user
                    for clean_key, file_info in user_files.items():
                        # For user-specific prefix, clean_key should just be the filename
                        filename = clean_key.split('/')[-1] if '/' in clean_key else clean_key
                        
                        template_data = {
                            "template_name": filename,
                            "username": user_id_to_username.get(user_id, "Unknown"),
                            "report_metadata": file_info.get('report_metadata', {}),
                            "isPublic": False  # Mark as private by default
                        }
                        templates.append(template_data)
                        
                except Exception as e:
                    print(f"Warning: Failed to fetch templates for user {user_id}: {str(e)}")
                    continue
            
            print(f"Found {len(templates)} templates for existing users")
            return templates
            
        except Exception as e:
            raise Exception(f"Failed to list templates for existing users: {str(e)}")

# Create a singleton instance
template_repository = ReportTemplateRepository()