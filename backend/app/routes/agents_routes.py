from fastapi import APIRouter, HTTPException, status
from typing import Optional, List, Dict, Any
from app.repositories.agent_repo import AgentRepository
import logging
from app.models.agent_schema import ModelCreate, ModelInfo, ModelUpdate, AgentRunRequest, AgentRunResponse
from app.agent.base_agent import BaseAgent

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/run", response_model=AgentRunResponse)
async def run_agent(request: AgentRunRequest):
    """
    Run an AI agent with the given prompt.
    
    Args:
        request: Agent run request with model_id and prompt
        
    Returns:
        Agent response with generated text
    """
    try:
        # Initialize agent
        agent = BaseAgent(request.model_id)
        
        # Build kwargs for generation
        gen_kwargs = {}
        if request.system:
            gen_kwargs["system"] = request.system
        if request.temperature is not None:
            gen_kwargs["temperature"] = request.temperature
        if request.max_tokens is not None:
            gen_kwargs["max_tokens"] = request.max_tokens
        if request.max_new_tokens is not None:
            gen_kwargs["max_new_tokens"] = request.max_new_tokens
        if request.top_p is not None:
            gen_kwargs["top_p"] = request.top_p
        if request.repetition_penalty is not None:
            gen_kwargs["repetition_penalty"] = request.repetition_penalty
        
        # Run agent
        logger.info(f"Running agent with model: {request.model_id}")
        response = agent.run(request.prompt, **gen_kwargs)
        
        # Get provider info
        agent_repo = AgentRepository()
        config = agent_repo.load_agent(request.model_id)
        provider = config.get("provider", "unknown")

        return {
            "model_id": request.model_id,
            "prompt": request.prompt,
            "response": response,
        }
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error running agent: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run agent: {str(e)}"
        )


@router.get("/", response_model=List[str])
async def list_models():
    """Get list of all available models."""
    try:
        repo = AgentRepository()
        models = repo.list_models()
        return models
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/{model_id}", response_model=ModelInfo)
async def get_model(model_id: str):
    """Get information about a specific model."""
    try:
        repo = AgentRepository()
        model_info = repo.get_model_info(model_id)
        return model_info
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting model: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/provider/{provider}", response_model=List[str])
async def get_models_by_provider(provider: str):
    """Get all models for a specific provider."""
    try:
        repo = AgentRepository()
        models = repo.get_models_by_provider(provider)
        return models
    except Exception as e:
        logger.error(f"Error getting models by provider: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.put("/{model_id}")
async def update_model(model_id: str, model: ModelUpdate):
    """Update an existing model configuration."""
    try:
        repo = AgentRepository()
        
        # Build update dict
        update_data = model.model_dump(exclude_none=True)
        
        repo.update_model(model_id=model_id, **update_data)
        
        return {
            "message": f"Model '{model_id}' updated successfully",
            "model_id": model_id
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating model: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(model_id: str):
    """Delete a model configuration."""
    try:
        repo = AgentRepository()
        repo.delete_model(model_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error deleting model: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/add", status_code=status.HTTP_201_CREATED)
async def create_model(model: ModelCreate):
    """Add a new model configuration."""
    try:
        repo = AgentRepository()
        repo.add_model(
            model_id=model.model_id,
            provider=model.provider,
            system_prompt=model.system_prompt,
            temperature=model.temperature,
            max_tokens=model.max_tokens
        )
        return {
            "message": f"Model '{model.model_id}' created successfully",
            "model_id": model.model_id
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating model: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )