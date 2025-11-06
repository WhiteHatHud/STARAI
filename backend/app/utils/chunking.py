# utils/chunking.py
import logging
import re
import json
import numpy as np
from app.core.sagemaker_manager import sagemaker_manager

#------------------------------------------------------------------------------------------------------------------------------------------------------------------
logger = logging.getLogger(__name__)

async def embed_sentence_sagemaker(text, content_type="application/json"):
    """Send a request to the SageMaker endpoint and get the embedding using sagemaker_manager."""
    ENDPOINT_NAME = "Qwen3-Embedding-600M-2025-09-15-07-03-56-057"
    payload = {"inputs": text}

    try:
        # Use the sagemaker_manager
        response = await sagemaker_manager.invoke_endpoint(
            endpoint_name=ENDPOINT_NAME,
            payload=payload,
            content_type=content_type
        )
        # The response is already parsed as JSON by sagemaker_manager
        return response
    except Exception as e:
        logging.error(f"Error querying SageMaker: {e}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return None

#------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Combine sequential sentences for more context
def combine_sentences(sentences, buffer_size=1):
    for i in range(len(sentences)):
        combined_sentence = ''

        for j in range(i - buffer_size, i):
            if j >= 0:
                combined_sentence += sentences[j]['sentence'] + ' '

        combined_sentence += sentences[i]['sentence']
        for j in range(i + 1, i + 1 + buffer_size):
            if j < len(sentences):
                combined_sentence += ' ' + sentences[j]['sentence']

        sentences[i]['combined_sentence'] = combined_sentence

    return sentences

def calculate_cosine_distances(sentences):
    distances = []
    for i in range(len(sentences) - 1):
        embedding_current = np.array(sentences[i]['combined_sentence_embedding']).squeeze()
        embedding_next = np.array(sentences[i + 1]['combined_sentence_embedding']).squeeze()

        # Compute cosine similarity manually
        similarity = np.dot(embedding_current, embedding_next) / (
            np.linalg.norm(embedding_current) * np.linalg.norm(embedding_next)
        )

        # Convert to cosine distance
        distance = 1 - similarity

        # Append cosine distance to the list
        distances.append(distance)

        # Store distance in the dictionary
        sentences[i]['distance_to_next'] = distance

    return distances, sentences

#------------------------------------------------------------------------------------------------------------------------------------------------------------------

# main chunking function
async def semantic_chunk(text) -> dict:
    print("splitting sentences")
    # Splitting the essay on '.', '?', and '!'
    single_sentences_list = re.split(r'(?<=[.?!])\s+', text)
    sentences = [{'sentence': x, 'index' : i} for i, x in enumerate(single_sentences_list)]

    print("combining sentences")
    sentences = combine_sentences(sentences)

    for i, sentence in enumerate(sentences):
        sentence['combined_sentence_embedding'] = await embed_sentence_sagemaker(sentence['combined_sentence'])

    print("calculating distances")
    # calculate difference between meanings of the sentences
    distances, sentences = calculate_cosine_distances(sentences)

    print("generating chunks")
    # generate chunks based on semantic differences
    breakpoint_percentile_threshold = 65
    breakpoint_distance_threshold = np.percentile(distances, breakpoint_percentile_threshold) # If you want more chunks, lower the percentile cutoff
    indices_above_thresh = [i for i, x in enumerate(distances) if x > breakpoint_distance_threshold] # The indices of those breakpoints on your list

    start_index = 0
    chunks = []

    # Iterate through the breakpoints to slice the sentences
    for index in indices_above_thresh:
        end_index = index
        group = sentences[start_index:end_index + 1]
        combined_text = ' '.join([d['sentence'] for d in group])
        chunks.append(combined_text)
        start_index = index + 1

    # The last group, if any sentences remain
    if start_index < len(sentences):
        combined_text = ' '.join([d['sentence'] for d in sentences[start_index:]])
        chunks.append(combined_text)

    return chunks

#------------------------------------------------------------------------------------------------------------------------------------------------------------------

# semantic chunk n embed
async def semantic_embed(text) -> list[dict]:
    chunks = await semantic_chunk(text)
    print(f"{len(chunks)} chunks generated")

    embed_list = []
    for i, chunk in enumerate(chunks):
        embedding = await embed_sentence_sagemaker(chunk)
        embedded_chunks = {
            "index": i,
            "content": chunk,
            "embedding": embedding
        }
        embed_list.append(embedded_chunks)
    print(f"{len(embed_list)} chunks embedded")
    return embed_list