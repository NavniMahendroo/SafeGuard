import numpy as np
from sklearn.ensemble import IsolationForest

# ==============================================================================
# ML ANOMALY DETECTION - ISOLATION FOREST
# ==============================================================================

class AnomalyDetector:
    def __init__(self):
        self.model = None
        self._train_on_normal_data()
    
    def _train_on_normal_data(self):
        """
        Train Isolation Forest on synthetic normal operating data.
        Features: [gas_level, temperature, pressure, worker_count]
        Normal ranges: gas 0-8%, temp 20-50°C, pressure 1-3 bar
        """
        # Generate synthetic normal training data
        n_samples = 1000
        np.random.seed(42)
        
        gas_levels = np.random.uniform(0, 8, n_samples)
        temperatures = np.random.uniform(20, 50, n_samples)
        pressures = np.random.uniform(1, 3, n_samples)
        worker_counts = np.random.randint(0, 5, n_samples)
        
        X_train = np.column_stack([gas_levels, temperatures, pressures, worker_counts])
        
        # Train Isolation Forest
        self.model = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100
        )
        self.model.fit(X_train)
        print("[Anomaly Detector] Isolation Forest trained on normal operating data")
    
    def score(self, gas_level: float, temperature: float, pressure: float, worker_count: int) -> float:
        """
        Score a telemetry reading.
        Returns anomaly score (negative = anomalous, positive = normal).
        """
        if self.model is None:
            return 0.0
        
        X = np.array([[gas_level, temperature, pressure, worker_count]])
        score = self.model.decision_function(X)[0]
        return float(score)

# Global instance
detector = AnomalyDetector()
