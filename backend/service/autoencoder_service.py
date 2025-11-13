"""
Autoencoder Anomaly Detection Service
Loads trained model and detects anomalies in new data
"""

import sys
import os
from pathlib import Path

# Add the Model/AutoEncoder directory to Python path
# Try both local and Docker paths
model_dir_local = Path(__file__).resolve().parent.parent.parent / "Model" / "AutoEncoder"
model_dir_docker = Path("/app/Model/AutoEncoder")

if model_dir_docker.exists():
    model_dir = model_dir_docker
elif model_dir_local.exists():
    model_dir = model_dir_local
else:
    # Fallback: try to find it relative to current location
    model_dir = Path(__file__).resolve().parent.parent.parent / "Model" / "AutoEncoder"

sys.path.insert(0, str(model_dir))

from data_preprocessing import SequencePreprocessor
import numpy as np
import pandas as pd
import pickle
from tensorflow import keras
from typing import List, Dict, Tuple

class AutoencoderService:
    def __init__(
        self, 
        model_path: str = "Final.h5",
        preprocessor_path: str = "preprocessor.pkl",
        threshold_path: str = "threshold.npy"
    ):
        """
        Initialize autoencoder service.
        
        Args:
            model_path: Path to trained autoencoder model
            preprocessor_path: Path to saved preprocessor
            threshold_path: Path to anomaly threshold
        """
        print(f"Loading autoencoder model from {model_path}...")
        self.model = keras.models.load_model(model_path, compile=False)
        
        print(f"Loading preprocessor from {preprocessor_path}...")
        self.preprocessor = SequencePreprocessor.load(preprocessor_path)

        print(f"Loading threshold from {threshold_path}...")
        self.threshold = np.load(threshold_path)
        
        print(f"✓ Autoencoder service initialized")
        print(f"  - Model input shape: {self.model.input_shape}")
        print(f"  - Anomaly threshold: {self.threshold:.4f}")
    
    def preprocess_data(self, df: pd.DataFrame) -> np.ndarray:
        """
        Preprocess raw data into sequences for the model.

        Args:
            df: Raw DataFrame with BETH data

        Returns:
            Scaled sequences ready for model
        """
        # Use the SequencePreprocessor to create sequences (fit_encoders=False for inference)
        print(f"Preprocessing {len(df)} rows into sequences...")
        sequences, _, _ = self.preprocessor.create_sequences(df, fit_encoders=False)
        print(f"  Generated {len(sequences)} sequences of shape {sequences.shape}")
        return sequences
    
    def predict_anomalies(
        self, 
        X: np.ndarray, 
        return_scores: bool = True
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Detect anomalies using reconstruction error.
        
        Args:
            X: Input sequences (preprocessed)
            return_scores: Whether to return reconstruction scores
            
        Returns:
            predictions: Binary predictions (1 = anomaly, 0 = normal)
            scores: Reconstruction errors (MSE)
        """
        print(f"Predicting on {len(X)} sequences...")
        
        # Get reconstructions
        X_reconstructed = self.model.predict(X, batch_size=256, verbose=0)
        
        # Calculate reconstruction error (MSE)
        reconstruction_errors = np.mean(
            np.square(X - X_reconstructed), 
            axis=(1, 2)
        )
        
        # Classify as anomaly if error > threshold
        predictions = (reconstruction_errors > self.threshold).astype(int)
        
        print(f"  Detected {predictions.sum()} anomalies ({predictions.mean()*100:.2f}%)")
        print(f"  MSE range: {reconstruction_errors.min():.4f} - {reconstruction_errors.max():.4f}")
        
        if return_scores:
            return predictions, reconstruction_errors
        return predictions
    
    def analyze_dataset(
        self,
        df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Full pipeline: preprocess -> detect -> return results.

        Args:
            df: Raw BETH dataset

        Returns:
            DataFrame with anomaly predictions and scores for each sequence
        """
        # Preprocess
        print(f"Preprocessing {len(df)} rows into sequences...")
        X, sequence_indices, _ = self.preprocessor.create_sequences(df, fit_encoders=False)
        print(f"  Generated {len(X)} sequences of shape {X.shape}")

        # Predict
        print(f"Predicting on {len(X)} sequences...")
        X_reconstructed = self.model.predict(X, batch_size=256, verbose=0)

        # Calculate reconstruction error (MSE)
        scores = np.mean(
            np.square(X - X_reconstructed),
            axis=(1, 2)
        )

        # Classify as anomaly if error > threshold
        predictions = (scores > self.threshold).astype(int)

        print(f"  Detected {predictions.sum()} anomalies ({predictions.mean()*100:.2f}%)")
        print(f"  MSE range: {scores.min():.4f} - {scores.max():.4f}")

        # Create results dataframe with one row per sequence
        # Each sequence corresponds to the last event in that sequence
        results_data = []
        for i, seq_idx in enumerate(sequence_indices):
            # Get the last row index in the original dataframe for this sequence
            row = df.iloc[seq_idx].copy()
            results_data.append({
                'sequence_id': i,
                'original_row_index': seq_idx,
                'anomaly_prediction': predictions[i],
                'reconstruction_error': scores[i],
                'anomaly_score': scores[i] / self.threshold,
                **row.to_dict()
            })

        results = pd.DataFrame(results_data)

        # Sort by anomaly score (highest first)
        results = results.sort_values('anomaly_score', ascending=False)

        return results
    
    def get_top_anomalies(
        self, 
        df: pd.DataFrame, 
        top_n: int = 100
    ) -> pd.DataFrame:
        """
        Get top N most anomalous sequences.
        
        Args:
            df: Raw BETH dataset
            top_n: Number of top anomalies to return
            
        Returns:
            DataFrame with top anomalies
        """
        results = self.analyze_dataset(df)
        anomalies = results[results['anomaly_prediction'] == 1]
        return anomalies.head(top_n)