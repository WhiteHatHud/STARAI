"""
Anomaly Detection for Excel Datasets using Autoencoder
Adapted from the BETH system call autoencoder for tabular data
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
import logging
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
import pickle
import os

logger = logging.getLogger(__name__)

# Check if TensorFlow is available
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, Model
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
    TF_AVAILABLE = True
    logger.info("TensorFlow detected, autoencoder available")
except ImportError:
    TF_AVAILABLE = False
    logger.warning("TensorFlow not available, falling back to statistical methods")


class TabularAnomalyDetector:
    """
    Autoencoder-based anomaly detector for Excel tabular data.
    Learns to reconstruct normal patterns and flags anomalies via reconstruction error.
    """

    def __init__(self, encoding_dim=8, threshold_percentile=95):
        """
        Args:
            encoding_dim: Dimension of latent encoding
            threshold_percentile: Percentile for anomaly threshold (default 95th)
        """
        self.encoding_dim = encoding_dim
        self.threshold_percentile = threshold_percentile
        self.autoencoder = None
        self.threshold = None
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.numeric_cols = []
        self.categorical_cols = []
        self.feature_names = []
        self.is_trained = False

    def _preprocess_dataframe(self, df: pd.DataFrame, fit=True) -> np.ndarray:
        """
        Preprocess DataFrame for autoencoder input.

        Args:
            df: Input DataFrame
            fit: Whether to fit encoders and scalers

        Returns:
            Preprocessed numpy array
        """
        df = df.copy()

        # Identify column types on first fit
        if fit:
            self.numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            self.categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()

            logger.info(f"Detected {len(self.numeric_cols)} numeric and {len(self.categorical_cols)} categorical columns")

        # Encode categorical columns
        for col in self.categorical_cols:
            if fit:
                # Create and fit encoder
                le = LabelEncoder()
                df[col] = df[col].fillna('MISSING')
                le.fit(df[col])
                self.label_encoders[col] = le
                df[col] = le.transform(df[col])
            else:
                # Transform using existing encoder
                df[col] = df[col].fillna('MISSING')
                # Handle unseen categories
                le = self.label_encoders[col]
                df[col] = df[col].map(lambda x: le.transform([x])[0] if x in le.classes_ else -1)

        # Convert to numeric array
        all_cols = self.numeric_cols + self.categorical_cols
        X = df[all_cols].values.astype(float)

        # Handle missing values
        if fit:
            imputer = SimpleImputer(strategy='mean')
            X = imputer.fit_transform(X)
            self.imputer = imputer
        else:
            # If imputer is missing from loaded model, create a new one and fit it
            if self.imputer is None:
                logger.warning("Imputer not found in metadata, creating and fitting new imputer")
                self.imputer = SimpleImputer(strategy='mean')
                X = self.imputer.fit_transform(X)
            else:
                X = self.imputer.transform(X)

        # Scale features
        if fit:
            X = self.scaler.fit_transform(X)
            self.feature_names = all_cols
        else:
            X = self.scaler.transform(X)

        return X

    def _build_autoencoder(self, n_features: int):
        """
        Build autoencoder architecture for tabular data.

        Args:
            n_features: Number of input features
        """
        if not TF_AVAILABLE:
            raise RuntimeError("TensorFlow is required for autoencoder training")

        # Input layer
        input_layer = layers.Input(shape=(n_features,), name='input')

        # Encoder
        x = layers.Dense(64, activation='relu', name='encoder_1')(input_layer)
        x = layers.Dropout(0.2)(x)
        x = layers.Dense(32, activation='relu', name='encoder_2')(x)
        x = layers.Dropout(0.2)(x)
        encoded = layers.Dense(self.encoding_dim, activation='relu', name='encoding')(x)

        # Decoder
        x = layers.Dense(32, activation='relu', name='decoder_1')(encoded)
        x = layers.Dropout(0.2)(x)
        x = layers.Dense(64, activation='relu', name='decoder_2')(x)
        x = layers.Dropout(0.2)(x)
        decoded = layers.Dense(n_features, activation='linear', name='output')(x)

        # Create and compile model
        self.autoencoder = Model(inputs=input_layer, outputs=decoded, name='autoencoder')
        self.autoencoder.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )

        logger.info(f"Built autoencoder: {n_features} features -> {self.encoding_dim} latent dim")

    def train(self, df: pd.DataFrame, epochs=50, batch_size=32, validation_split=0.2):
        """
        Train autoencoder on normal (benign) data.

        Args:
            df: Training DataFrame (should contain mostly normal data)
            epochs: Number of training epochs
            batch_size: Batch size
            validation_split: Validation split ratio
        """
        logger.info(f"Training autoencoder on {len(df)} samples...")

        # Preprocess data
        X = self._preprocess_dataframe(df, fit=True)

        # Build model
        n_features = X.shape[1]
        self._build_autoencoder(n_features)

        # Callbacks
        early_stopping = EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True,
            verbose=0
        )

        reduce_lr = ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=0
        )

        # Train (target is same as input for reconstruction)
        history = self.autoencoder.fit(
            X, X,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            callbacks=[early_stopping, reduce_lr],
            verbose=0
        )

        # Calculate reconstruction errors on training data to set threshold
        train_mse = self._calculate_reconstruction_errors(X)
        self.threshold = np.percentile(train_mse, self.threshold_percentile)

        self.is_trained = True

        logger.info(f"Training complete. Anomaly threshold: {self.threshold:.4f} ({self.threshold_percentile}th percentile)")
        logger.info(f"Final loss: {history.history['loss'][-1]:.4f}, val_loss: {history.history['val_loss'][-1]:.4f}")

        return history

    def _calculate_reconstruction_errors(self, X: np.ndarray) -> np.ndarray:
        """
        Calculate reconstruction error (MSE) for each sample.

        Args:
            X: Input data

        Returns:
            Array of MSE values (one per sample)
        """
        X_pred = self.autoencoder.predict(X, verbose=0)
        mse = np.mean(np.square(X - X_pred), axis=1)
        return mse

    def detect_anomalies(self, df: pd.DataFrame) -> List[Dict]:
        """
        Detect anomalies in new data.

        Args:
            df: DataFrame to check for anomalies

        Returns:
            List of anomaly dictionaries with row_index, anomaly_score, and anomalous_features
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained before detecting anomalies")

        logger.info(f"Detecting anomalies in {len(df)} samples...")

        # Preprocess data
        X = self._preprocess_dataframe(df, fit=False)

        # Calculate reconstruction errors
        reconstruction_errors = self._calculate_reconstruction_errors(X)

        # Identify anomalies
        is_anomaly = reconstruction_errors > self.threshold

        anomalies = []
        for idx in np.where(is_anomaly)[0]:
            # Calculate per-feature reconstruction error
            X_row = X[idx:idx+1]
            X_pred = self.autoencoder.predict(X_row, verbose=0)[0]
            feature_errors = np.abs(X[idx] - X_pred)

            # Identify top anomalous features
            top_feature_indices = np.argsort(feature_errors)[-3:][::-1]  # Top 3 features
            anomalous_features = [
                {
                    "feature_name": self.feature_names[i],
                    "actual_value": float(X[idx][i]),  # Use preprocessed value instead of raw
                    "reconstruction_error": float(feature_errors[i])
                }
                for i in top_feature_indices
            ]

            anomalies.append({
                "row_index": int(idx),
                "anomaly_score": float(reconstruction_errors[idx]),
                "anomalous_features": anomalous_features,
                "raw_data": df.iloc[idx].to_dict()
            })

        logger.info(f"Detected {len(anomalies)} anomalies ({len(anomalies)/len(df)*100:.2f}%)")

        return anomalies

    def save(self, directory: str):
        """Save model and preprocessors to directory."""
        os.makedirs(directory, exist_ok=True)

        # Save Keras model
        if self.autoencoder:
            self.autoencoder.save(os.path.join(directory, 'autoencoder.h5'))

        # Save preprocessors and metadata
        metadata = {
            'threshold': self.threshold,
            'encoding_dim': self.encoding_dim,
            'threshold_percentile': self.threshold_percentile,
            'scaler': self.scaler,
            'label_encoders': self.label_encoders,
            'imputer': self.imputer,
            'numeric_cols': self.numeric_cols,
            'categorical_cols': self.categorical_cols,
            'feature_names': self.feature_names,
            'is_trained': self.is_trained
        }

        with open(os.path.join(directory, 'metadata.pkl'), 'wb') as f:
            pickle.dump(metadata, f)

        logger.info(f"Model saved to {directory}")

    @classmethod
    def load(cls, directory: str, threshold_path: Optional[str] = None):
        """
        Load model and preprocessors from directory.

        Args:
            directory: Directory containing autoencoder.h5 and metadata.pkl
            threshold_path: Optional path to .npy file containing threshold value
        """
        if not TF_AVAILABLE:
            raise RuntimeError("TensorFlow is required to load models")

        # Load metadata
        metadata_path = os.path.join(directory, 'metadata.pkl')
        if not os.path.exists(metadata_path):
            raise FileNotFoundError(f"metadata.pkl not found in {directory}")

        with open(metadata_path, 'rb') as f:
            metadata = pickle.load(f)

        # Create instance with defaults if metadata is incomplete
        detector = cls(
            encoding_dim=metadata.get('encoding_dim', 8),
            threshold_percentile=metadata.get('threshold_percentile', 95)
        )

        # Load Keras model with custom objects to handle legacy formats
        model_path = os.path.join(directory, 'autoencoder.h5')
        if os.path.exists(model_path):
            # Define custom objects for legacy model compatibility
            custom_objects = {
                'mse': 'mean_squared_error',
                'mae': 'mean_absolute_error',
            }
            try:
                # Try loading with compile=False to avoid metric/loss deserialization issues
                detector.autoencoder = keras.models.load_model(model_path, compile=False)

                # Manually recompile the model with correct loss/metrics
                detector.autoencoder.compile(
                    optimizer=keras.optimizers.Adam(learning_rate=0.001),
                    loss='mse',
                    metrics=['mae']
                )
                logger.info(f"Loaded and recompiled autoencoder model from {model_path}")
            except Exception as e:
                logger.error(f"Failed to load model with compile=False: {e}")
                # Fallback: try with custom objects
                detector.autoencoder = keras.models.load_model(model_path, custom_objects=custom_objects)
                logger.info(f"Loaded autoencoder model from {model_path} with custom objects")
        else:
            raise FileNotFoundError(f"autoencoder.h5 not found in {directory}")

        # Restore metadata (with fallbacks for missing fields)
        detector.scaler = metadata.get('scaler', StandardScaler())
        detector.label_encoders = metadata.get('label_encoders', {})
        detector.imputer = metadata.get('imputer', None)
        detector.numeric_cols = metadata.get('numeric_cols', [])
        detector.categorical_cols = metadata.get('categorical_cols', [])
        detector.feature_names = metadata.get('feature_names', [])
        detector.is_trained = metadata.get('is_trained', True)

        # Load threshold from .npy file if provided, otherwise from metadata
        if threshold_path and os.path.exists(threshold_path):
            detector.threshold = float(np.load(threshold_path))
            logger.info(f"Loaded threshold from {threshold_path}: {detector.threshold}")
        elif 'threshold' in metadata:
            detector.threshold = metadata['threshold']
            logger.info(f"Loaded threshold from metadata: {detector.threshold}")
        else:
            # Use a default threshold if none available
            detector.threshold = 0.1
            logger.warning(f"No threshold found, using default: {detector.threshold}")

        logger.info(f"Model loaded from {directory}")
        return detector


def detect_anomalies_in_excel(
    df: pd.DataFrame,
    model_path: Optional[str] = None,
    train_if_needed: bool = True,
    threshold_path: Optional[str] = None
) -> Tuple[List[Dict], TabularAnomalyDetector]:
    """
    High-level function to detect anomalies in Excel data.

    Args:
        df: Input DataFrame from Excel
        model_path: Path to pre-trained model directory (optional)
        train_if_needed: Whether to train a new model if none exists
        threshold_path: Path to .npy file containing threshold value (optional)

    Returns:
        Tuple of (anomalies_list, detector_model)
    """
    if not TF_AVAILABLE and train_if_needed:
        logger.error("TensorFlow not available. Cannot train model.")
        raise RuntimeError(
            "TensorFlow is required for anomaly detection. "
            "Please install: pip install tensorflow>=2.13.0"
        )

    # Load or create detector
    if model_path and os.path.exists(model_path):
        logger.info(f"Loading pre-trained model from {model_path}")
        detector = TabularAnomalyDetector.load(model_path, threshold_path=threshold_path)
    elif train_if_needed:
        logger.info("Training new anomaly detection model...")
        detector = TabularAnomalyDetector(encoding_dim=8, threshold_percentile=95)

        # Train on the dataset (assumes mostly normal data)
        # For better results, should train only on verified normal data
        detector.train(df, epochs=30, batch_size=32)
    else:
        raise ValueError("No model provided and train_if_needed=False")

    # Detect anomalies
    anomalies = detector.detect_anomalies(df)

    return anomalies, detector
