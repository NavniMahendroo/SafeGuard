import numpy as np
from collections import deque
from typing import Optional

# ==============================================================================
# LEAD TIME PREDICTOR - LINEAR REGRESSION ON TREND
# ==============================================================================

class LeadTimePredictor:
    def __init__(self, window_size: int = 10, critical_threshold: float = 12.0):
        self.window_size = window_size
        self.critical_threshold = critical_threshold
        self.gas_readings = deque(maxlen=window_size)
        self.timestamps = deque(maxlen=window_size)
    
    def add_reading(self, gas_level: float, timestamp: float):
        """Add a new gas reading to the rolling window."""
        self.gas_readings.append(gas_level)
        self.timestamps.append(timestamp)
    
    def predict_lead_time(self, current_gas: float, current_timestamp: float) -> Optional[float]:
        """
        Predict minutes until critical threshold is reached.
        Uses linear regression (polyfit degree 1) on the rolling window.
        Returns None if gas is not trending upward or insufficient data.
        """
        # Add current reading
        self.add_reading(current_gas, current_timestamp)
        
        # Need at least 3 readings to compute trend
        if len(self.gas_readings) < 3:
            return None
        
        # Convert to arrays
        times = np.array(list(self.timestamps))
        gases = np.array(list(self.gas_readings))
        
        # Fit linear regression (degree 1)
        try:
            coefficients = np.polyfit(times, gases, 1)
            slope = coefficients[0]
            intercept = coefficients[1]
        except np.linalg.LinAlgError:
            return None
        
        # If slope is not positive (not trending up), return None
        if slope <= 0:
            return None
        
        # Calculate time to reach critical threshold
        # critical = slope * t + intercept
        # t = (critical - intercept) / slope
        if current_gas >= self.critical_threshold:
            return 0.0
        
        time_to_critical = (self.critical_threshold - intercept) / slope
        time_remaining = time_to_critical - current_timestamp
        
        # Convert to minutes (assuming 2-second update interval)
        # time_remaining is in the same units as timestamps (seconds)
        minutes_remaining = time_remaining / 60.0
        
        # Only return positive values
        if minutes_remaining <= 0:
            return 0.0
        
        return float(minutes_remaining)
    
    def reset(self):
        """Reset the rolling window."""
        self.gas_readings.clear()
        self.timestamps.clear()

# Global instance
predictor = LeadTimePredictor()
