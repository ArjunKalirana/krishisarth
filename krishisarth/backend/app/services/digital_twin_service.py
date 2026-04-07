from datetime import datetime
import math
from typing import Dict, List, Any

class DigitalTwinService:
    def __init__(self):
        self.current_mae = 0.08  # Default initial MAE
        self.last_calibrated_at = datetime.utcnow()
        self.total_simulations_run = 0
        self.flow_rate_lpm = 10.0  # liters per minute

    def _get_absorption_factor(self, crop_type: str) -> float:
        crop_type = (crop_type or "").lower()
        if "tomato" in crop_type:
            return 0.82
        elif "wheat" in crop_type:
            return 0.74
        elif "sugar" in crop_type:
            return 0.91
        return 0.80

    def simulate_irrigation(self, zone_id: str, duration_minutes: int, current_state: Dict[str, Any]) -> Dict[str, Any]:
        self.total_simulations_run += 1
        
        current_moisture = current_state.get("moisture_pct", 50.0)
        current_ec = current_state.get("ec_ds_m", 1.2)
        crop_type = current_state.get("crop_type", "default")
        
        absorption_factor = self._get_absorption_factor(crop_type)
        
        # Simulate moisture increase
        moisture_added = (self.flow_rate_lpm * duration_minutes * absorption_factor * 0.1)  # Scaling factor for %
        predicted_moisture = min(100.0, current_moisture + moisture_added)
        
        # Simulate EC dilution
        predicted_ec = current_ec * (1 - 0.05 * (duration_minutes / 60))
        predicted_ec = max(0.1, predicted_ec)  # Prevent dropping to 0
        
        water_volume_l = self.flow_rate_lpm * duration_minutes
        
        # Efficiency Score
        if 45 <= predicted_moisture <= 75:
            efficiency_score = 1.0
            recommendation = "Optimal irrigation duration."
            should_irrigate = True
        else:
            diff = min(abs(predicted_moisture - 45), abs(predicted_moisture - 75))
            efficiency_score = max(0.0, 1.0 - (diff * 0.02))
            if predicted_moisture > 75:
                recommendation = "Simulated duration leads to overwatering. Reduce time."
                should_irrigate = False
            else:
                recommendation = "Simulated duration leads to underwatering. Increase time."
                should_irrigate = True

        return {
            "predicted_moisture": round(predicted_moisture, 2),
            "predicted_ec": round(predicted_ec, 2),
            "water_volume_l": round(water_volume_l, 2),
            "efficiency_score": round(efficiency_score, 2),
            "recommendation": recommendation,
            "mae_confidence": round(self.current_mae, 3),
            "should_irrigate": should_irrigate
        }

    def simulate_fertigation(self, zone_id: str, nutrient_type: str, dose_ml: float, current_state: Dict[str, Any]) -> Dict[str, Any]:
        self.total_simulations_run += 1
        
        current_ec = current_state.get("ec_ds_m", 1.2)
        current_ph = current_state.get("ph", 6.5)
        
        nutrient_concentration = 5.0
        soil_volume = 1000.0
        
        # NPK increase (abstract delta)
        predicted_npk_delta = (dose_ml * nutrient_concentration) / soil_volume
        
        # EC spike
        predicted_ec = current_ec + (dose_ml * 0.003)
        
        # pH shifts slightly downwards
        predicted_ph_shift = -0.05 * (dose_ml / 10.0)
        
        dose_efficiency = min(1.0, 1.2 - (dose_ml / 100.0))
        
        warning_if_ec_too_high = None
        if predicted_ec > 3.5:
            warning_if_ec_too_high = "Risk of salt stress: Predicted EC > 3.5 dS/m"
            recommendation = "Reduce nutrient dose or run fresh water flush cycle."
        else:
            recommendation = "Dose is within safe limits."

        return {
            "predicted_npk_delta": round(predicted_npk_delta, 4),
            "predicted_ec": round(predicted_ec, 2),
            "predicted_ph_shift": round(predicted_ph_shift, 2),
            "predicted_final_ph": round(current_ph + predicted_ph_shift, 2),
            "dose_efficiency": round(dose_efficiency, 2),
            "recommendation": recommendation,
            "warning_if_ec_too_high": warning_if_ec_too_high
        }

    def calibrate_mae(self, actual_outcomes: List[Dict[str, float]], simulated_outcomes: List[Dict[str, float]]) -> float:
        if not actual_outcomes or not simulated_outcomes or len(actual_outcomes) != len(simulated_outcomes):
            return self.current_mae
            
        n = len(actual_outcomes)
        total_error = 0.0
        
        for i in range(n):
            actual_moisture = actual_outcomes[i].get("moisture_pct", 0)
            sim_moisture = simulated_outcomes[i].get("moisture_pct", 0)
            total_error += abs(actual_moisture - sim_moisture)
            
        self.current_mae = total_error / n
        self.last_calibrated_at = datetime.utcnow()
        return self.current_mae

    def get_twin_status(self) -> Dict[str, Any]:
        if self.current_mae < 0.1:
            trust_level = "HIGH"
        elif self.current_mae < 0.25:
            trust_level = "MEDIUM"
        else:
            trust_level = "LOW"
            
        return {
            "mae_score": round(self.current_mae, 3),
            "trust_level": trust_level,
            "last_calibrated_at": self.last_calibrated_at.isoformat() + "Z",
            "total_simulations_run": self.total_simulations_run
        }

    def recalibrate_twin(self) -> Dict[str, Any]:
        import random
        # Mocking an improvement/shuffle in MAE for demo purposes
        improvement = random.uniform(0.005, 0.02)
        self.current_mae = max(0.01, self.current_mae - improvement)
        self.last_calibrated_at = datetime.utcnow()
        return self.get_twin_status()

digital_twin_engine = DigitalTwinService()
