# # core/sagemaker_manager.py

import os
import json
import boto3
import logging
import asyncio
from dotenv import load_dotenv
from sse_starlette.sse import EventSourceResponse  # If you're returning directly in FastAPI
from app.utils.streaming import LineIterator  # You must define this utility
import traceback
from datetime import datetime
from typing import Dict, Any, AsyncIterator, AsyncGenerator, Union
from fastapi.responses import StreamingResponse
from botocore.config import Config

logger = logging.getLogger(__name__)

class SageMakerManager:
    def __init__(self):
        load_dotenv()
        self.aws_access_key_id = os.environ.get("SAGEMAKER_AWS_ACCESS_KEY_ID")
        self.aws_secret_access_key = os.environ.get("SAGEMAKER_AWS_SECRET_ACCESS_KEY")
        self.region_name = os.environ.get("SAGEMAKER_REGION", "ap-southeast-1")
        self.streaming = True
        self.initialize_client()
        logger.info(f"Initialized SageMakerManager for region {self.region_name}")

    def initialize_client(self):
        self.runtime_client = boto3.Session(
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
            region_name=self.region_name
        ).client('sagemaker-runtime')

    def refresh_credentials(self):

        """Refresh SageMaker credentials from environment variables"""
        try:
            load_dotenv()
            self.aws_access_key_id = os.environ.get("SAGEMAKER_AWS_ACCESS_KEY_ID")
            self.aws_secret_access_key = os.environ.get("SAGEMAKER_AWS_SECRET_ACCESS_KEY")
            self.region_name = os.environ.get("SAGEMAKER_REGION", "ap-southeast-1")
            self.initialize_client()
            logger.info(f"SageMakerManager credentials refreshed for region {self.region_name}")
            return True
        except Exception as e:
            logger.error(f"Error refreshing credentials: {e}")
            return False

    async def stream_invoke(self, messages: Dict[str, Any], endpoint_name: str, content_type='application/json', progress_id=None, progress_tracker=None, is_video=False) -> AsyncIterator[str]:
        
        """
        Streams responses from a SageMaker endpoint to avoid timeout.
        """
        try:

            if is_video:
                payload = messages
            else:
                payload = {
                    "messages": messages['messages'],
                    "max_tokens": messages['parameters']['max_new_tokens'],
                    "temperature": messages['parameters']['temperature'],
                    "top_p": messages['parameters']['top_p'],
                    "return_full_text": messages['parameters']['return_full_text'],
                    "stream": True
                }
            logger.info("Streaming invoke request to SageMaker")

            response = self.runtime_client.invoke_endpoint_with_response_stream(
                EndpointName=endpoint_name,
                Body=json.dumps(payload),
                ContentType=content_type
            )
            event_stream = response['Body']
            buffer = ""
            for event in event_stream:
                chunk_bytes = event['PayloadPart']['Bytes']
                if chunk_bytes:
                    text = chunk_bytes.decode('utf-8')
                    buffer += text
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        if not line.strip():
                            continue
                        try:
                            data = json.loads(line)
                            if 'choices' in data:
                                content = data['choices'][0]['delta'].get('content')
                                if progress_id and progress_tracker and progress_id in progress_tracker:
                                    progress_tracker[progress_id].update({
                                        "partial_response": content,
                                        "last_updated": str(datetime.now())
                                    })
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue

            # Flush any remaining buffer after the loop
            if buffer.strip():
                try:
                    data = json.loads(buffer)
                    if 'choices' in data:
                        content = data['choices'][0]['delta'].get('content')
                        if progress_id and progress_tracker and progress_id in progress_tracker:
                            progress_tracker[progress_id].update({
                                "partial_response": content,
                                "last_updated": str(datetime.now())
                            })
                        if content:
                            yield content
                except json.JSONDecodeError:
                    pass

            if progress_id and progress_tracker and progress_id in progress_tracker:
                progress_tracker[progress_id].update({
                    "status": "completed",
                    "progress": 100,
                    "last_updated": str(datetime.now())
                })
            # for event in event_stream:
            #     chunk_bytes = event['PayloadPart']['Bytes']
            #     if chunk_bytes:
            #         text = chunk_bytes.decode('utf-8')
            #         for line in text.splitlines():
            #             if not line.strip():
            #                 continue
            #             try:
            #                 data = json.loads(line)
            #                 # Extract content
            #                 if 'choices' in data:
            #                     content = data['choices'][0]['delta'].get('content')
            #                     if progress_id and progress_tracker and progress_id in progress_tracker:
            #                         progress_tracker[progress_id].update({
            #                             "partial_response": content,
            #                             "last_updated": str(datetime.now())
            #                         })
            #                     if content:
            #                         yield content
            #             except json.JSONDecodeError:
            #                 # Ignore invalid JSON chunks
            #                 pass
            # if progress_id and progress_tracker and progress_id in progress_tracker:
            #     progress_tracker[progress_id].update({
            #         "status": "completed",
            #         "progress": 100,
            #         "last_updated": str(datetime.now())
            #     })
            # buffer = ""
            # for event in event_stream:
            #     chunk_bytes = event['PayloadPart']['Bytes']
            #     if chunk_bytes:
            #         text = chunk_bytes.decode('utf-8')
            #         buffer += text
            #         lines = buffer.splitlines()
            #         if not text.endswith("\n"):
            #             buffer = lines.pop() if lines else buffer
            #         else:
            #             buffer = ""
            #         # print("Raw chunk text:", lines)
            #         for line in lines:
            #             print("RAW LINE:", repr(line))  # <--- Add this
            #             if not line.strip():
            #                 continue
            #             try:
            #                 data = json.loads(line)
            #                 # Extract content
            #                 if 'choices' in data:
            #                     content = data['choices'][0]['delta'].get('content')
            #                     if progress_id and progress_tracker and progress_id in progress_tracker:
            #                         progress_tracker[progress_id].update({
            #                             "partial_response": content,
            #                             "last_updated": str(datetime.now())
            #                         })
            #                     if content:
            #                         yield content
            #             except json.JSONDecodeError:
            #                 # Ignore invalid JSON chunks
            #                 pass        
        except Exception as e:
            logger.error(f"Streaming error: {str(e)}")
            if progress_id and progress_tracker and progress_id in progress_tracker:
                progress_tracker[progress_id].update({
                    "status": "error",
                    "error": str(e),
                    "last_updated": str(datetime.now())
                })
            raise

    async def invoke_endpoint(self, endpoint_name, payload, content_type='application/json'):
        """Invoke a SageMaker endpoint with the given payload"""
        try:
            # Convert payload to JSON if it's a dict
            if isinstance(payload, dict):
                payload = json.dumps(payload)
                
            # Set up request parameters
            request_params = {
                'EndpointName': endpoint_name,
                'ContentType': content_type,
                'Body': payload
            }
            
       
            # Invoke the SageMaker endpoint in standard mode
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.runtime_client.invoke_endpoint(**request_params)
            )
            
            response_body = response.get('Body').read().decode('utf-8')
            
            try:
                return json.loads(response_body)
            except:
                return response_body
                
        except Exception as e:
            logger.error(f"Error invoking SageMaker endpoint {endpoint_name}: {str(e)}")
            logger.error(traceback.format_exc())
            raise

sagemaker_manager = SageMakerManager()