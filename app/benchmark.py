import json
import random
import os
import sys
import numpy as np
try:
    from tabulate import tabulate
except ImportError:
    def tabulate(data, headers, tablefmt="grid"):
        """Fallback table generator when tabulate is not installed"""
        col_widths = [len(h) for h in headers]
        for row in data:
            for i, val in enumerate(row):
                col_widths[i] = max(col_widths[i], len(str(val)))
        divider = "+" + "+".join(["-" * (w + 2) for w in col_widths]) + "+"
        lines = [divider]
        header_str = "|" + "|".join([f" {headers[i]:<{col_widths[i]}} " for i in range(len(headers))]) + "|"
        lines.append(header_str)
        lines.append(divider)
        for row in data:
            row_str = "|" + "|".join([f" {str(row[i]):<{col_widths[i]}} " for i in range(len(row))]) + "|"
            lines.append(row_str)
        lines.append(divider)
        return "\n".join(lines)

# WARNING & HORIZON THRESHOLDS FOR LEAD-TIME PREDICTORS
GAS_WARNING_THRESHOLD = 8.0
TEMP_WARNING_THRESHOLD = 55.0
HORIZON_LIMIT = 5.0

from app.engine import evaluate_compound_risk
from app.anomaly import detector
from app.predictor import LeadTimePredictor

def generate_benchmark_data():
    """
    Generates a synthetic dataset of ~200 scenarios as time-series sequences.
    Seeded with random.seed(42) for deterministic, reproducible runs.
    """
    random.seed(42)
    np.random.seed(42)
    scenarios = []

    # 1. Hot Work Standard Incidents (30 scenarios)
    # Gas trends up steadily, Hot Work permit active, worker present.
    for i in range(30):
        readings = []
        gas = 4.0
        temp = 32.0
        pressure = 1.8
        for step in range(30):
            gas += random.uniform(0.3, 0.7)
            temp += random.uniform(-0.5, 0.5)
            pressure += random.uniform(-0.05, 0.05)
            readings.append({
                "timestamp": step * 2.0,
                "gas_level": round(max(0.0, gas), 2),
                "temperature": round(max(0.0, temp), 1),
                "pressure": round(max(0.0, pressure), 2),
                "worker_count": 2,
                "permit_type": "Hot Work",
                "permit_active": True
            })
        scenarios.append({"id": f"HW_STD_{i+1}", "type": "Hot Work Incident", "readings": readings})

    # 2. Confined Space Incidents (30 scenarios)
    # Gas trends up past 8%, Confined Space permit active, workers > 2.
    for i in range(30):
        readings = []
        gas = 4.0
        temp = 32.0
        pressure = 1.8
        for step in range(30):
            gas += random.uniform(0.2, 0.4)
            temp += random.uniform(-0.5, 0.5)
            pressure += random.uniform(-0.05, 0.05)
            readings.append({
                "timestamp": step * 2.0,
                "gas_level": round(max(0.0, gas), 2),
                "temperature": round(max(0.0, temp), 1),
                "pressure": round(max(0.0, pressure), 2),
                "worker_count": 3,
                "permit_type": "Confined Space",
                "permit_active": True
            })
        scenarios.append({"id": f"CS_STD_{i+1}", "type": "Confined Space Incident", "readings": readings})

    # 3. Thermal Stress Incidents (30 scenarios)
    # Temp trends up past 65C, Cold Work active.
    for i in range(30):
        readings = []
        gas = 4.0
        temp = 40.0
        pressure = 1.8
        for step in range(30):
            gas += random.uniform(-0.2, 0.2)
            temp += random.uniform(1.0, 1.8)
            pressure += random.uniform(-0.05, 0.05)
            readings.append({
                "timestamp": step * 2.0,
                "gas_level": round(max(0.0, gas), 2),
                "temperature": round(max(0.0, temp), 1),
                "pressure": round(max(0.0, pressure), 2),
                "worker_count": 2,
                "permit_type": "Cold Work",
                "permit_active": True
            })
        scenarios.append({"id": f"TS_STD_{i+1}", "type": "Thermal Stress Incident", "readings": readings})

    # 4. Slow-onset Incidents (30 scenarios)
    # Gradual drift of gas over many steps, permit active. Tests lead-time predictor.
    for i in range(30):
        readings = []
        gas = 4.0
        temp = 32.0
        pressure = 1.8
        for step in range(30):
            gas += random.uniform(0.25, 0.35)
            temp += random.uniform(-0.3, 0.3)
            pressure += random.uniform(-0.05, 0.05)
            readings.append({
                "timestamp": step * 2.0,
                "gas_level": round(max(0.0, gas), 2),
                "temperature": round(max(0.0, temp), 1),
                "pressure": round(max(0.0, pressure), 2),
                "worker_count": 2,
                "permit_type": "Hot Work",
                "permit_active": True
            })
        scenarios.append({"id": f"SLOW_INC_{i+1}", "type": "Slow-onset Incident", "readings": readings})

    # 5. Fast-onset Incidents (30 scenarios)
    # Gas spikes suddenly in 1-2 steps, permit active. Tests reaction speed / ML anomaly.
    for i in range(30):
        readings = []
        gas = 4.0
        temp = 32.0
        pressure = 1.8
        for step in range(30):
            if step == 16:
                gas = 13.5
            elif step > 16:
                gas += random.uniform(-0.5, 0.5)
            else:
                gas += random.uniform(-0.1, 0.1)
            temp += random.uniform(-0.5, 0.5)
            pressure += random.uniform(-0.05, 0.05)
            readings.append({
                "timestamp": step * 2.0,
                "gas_level": round(max(0.0, gas), 2),
                "temperature": round(max(0.0, temp), 1),
                "pressure": round(max(0.0, pressure), 2),
                "worker_count": 2,
                "permit_type": "Hot Work",
                "permit_active": True
            })
        scenarios.append({"id": f"FAST_INC_{i+1}", "type": "Fast-onset Incident", "readings": readings})

    # 6. Near-miss Non-incidents: High gas, NO permit (25 scenarios)
    # Gas goes high, but permit not active (should NOT trigger compound rules).
    for i in range(25):
        readings = []
        gas = 4.0
        temp = 32.0
        pressure = 1.8
        for step in range(30):
            gas += random.uniform(0.3, 0.7)
            temp += random.uniform(-0.5, 0.5)
            pressure += random.uniform(-0.05, 0.05)
            readings.append({
                "timestamp": step * 2.0,
                "gas_level": round(max(0.0, gas), 2),
                "temperature": round(max(0.0, temp), 1),
                "pressure": round(max(0.0, pressure), 2),
                "worker_count": 2,
                "permit_type": "Hot Work",
                "permit_active": False
            })
        scenarios.append({"id": f"NM_NO_PERM_{i+1}", "type": "Near-miss No Permit", "readings": readings})

    # 7. Near-miss Under Threshold (25 scenarios)
    # Gas rises but levels off under critical threshold (11.5%), permit active.
    for i in range(25):
        readings = []
        gas = 4.0
        temp = 32.0
        pressure = 1.8
        for step in range(30):
            if gas < 10.5:
                gas += random.uniform(0.3, 0.6)
            else:
                gas += random.uniform(-0.2, 0.2)
            temp += random.uniform(-0.5, 0.5)
            pressure += random.uniform(-0.05, 0.05)
            readings.append({
                "timestamp": step * 2.0,
                "gas_level": round(max(0.0, gas), 2),
                "temperature": round(max(0.0, temp), 1),
                "pressure": round(max(0.0, pressure), 2),
                "worker_count": 2,
                "permit_type": "Hot Work",
                "permit_active": True
            })
        scenarios.append({"id": f"NM_UNDER_{i+1}", "type": "Near-miss Under Threshold", "readings": readings})

    # 8. Noisy Normal Operation (30 scenarios)
    # Random normal fluctuations inside safe bounds, permit active.
    for i in range(30):
        readings = []
        gas = 4.0
        temp = 32.0
        pressure = 1.8
        for step in range(30):
            gas = 4.0 + random.uniform(-1.0, 1.0)
            temp = 32.0 + random.uniform(-2.0, 2.0)
            pressure = 1.8 + random.uniform(-0.1, 0.1)
            readings.append({
                "timestamp": step * 2.0,
                "gas_level": round(max(0.0, gas), 2),
                "temperature": round(max(0.0, temp), 1),
                "pressure": round(max(0.0, pressure), 2),
                "worker_count": 2,
                "permit_type": "Hot Work",
                "permit_active": True
            })
        scenarios.append({"id": f"NOISY_NORM_{i+1}", "type": "Noisy Normal", "readings": readings})

    return scenarios

def run_benchmark():
    scenarios = generate_benchmark_data()
    results = []

    for scenario in scenarios:
        readings = scenario["readings"]
        
        # 1. Determine Ground Truth Breach Index
        gt_breach_idx = None
        for idx, r in enumerate(readings):
            active_permits = [{"zone": "Gas Storage Zone", "type": r["permit_type"]}] if r["permit_active"] else []
            workers = {f"W{i}": {"node": "Gas Storage Zone"} for i in range(r["worker_count"])}
            triggered = evaluate_compound_risk(
                gas_level=r["gas_level"],
                temperature=r["temperature"],
                active_permits=active_permits,
                workers=workers
            )
            if triggered:
                gt_breach_idx = idx
                break
                
        is_true_incident = (gt_breach_idx is not None)

        # 2. Run Naive Baseline Detector
        # Flags ONLY if gas level crosses 12.0% at any point, ignoring permits
        naive_flagged = False
        naive_flag_idx = None
        for idx, r in enumerate(readings):
            if r["gas_level"] > 12.0:
                naive_flagged = True
                naive_flag_idx = idx
                break

        # 3. Run SafeGuard Full Pipeline
        # Evaluates compound risk + lead time predictor + anomaly detector
        pipeline_flagged = False
        pipeline_flag_idx = None
        pipeline_flag_reasons = []
        pipeline_early_warned = False
        predictor = LeadTimePredictor()

        for idx, r in enumerate(readings):
            # Update rolling predictor
            lead_time = predictor.predict_lead_time(r["gas_level"], r["timestamp"])
            
            # Score ML Isolation Forest anomaly
            anomaly_score = detector.score(
                gas_level=r["gas_level"],
                temperature=r["temperature"],
                pressure=r["pressure"],
                worker_count=r["worker_count"]
            )

            # Evaluate compound rules
            active_permits = [{"zone": "Gas Storage Zone", "type": r["permit_type"]}] if r["permit_active"] else []
            workers = {f"W{i}": {"node": "Gas Storage Zone"} for i in range(r["worker_count"])}
            triggered = evaluate_compound_risk(
                gas_level=r["gas_level"],
                temperature=r["temperature"],
                active_permits=active_permits,
                workers=workers
            )

            # Pipeline detection logic:
            triggered_by_rule = False
            triggered_by_lead_time = False
            triggered_by_anomaly = False

            if triggered:
                triggered_by_rule = True
                
            if r["permit_active"]:
                # Check Proximity Gate
                in_warning_zone = False
                if r["permit_type"] in ["Hot Work", "Confined Space"]:
                    if r["gas_level"] >= GAS_WARNING_THRESHOLD:
                        in_warning_zone = True
                elif r["permit_type"] == "Cold Work":
                    if r["temperature"] >= TEMP_WARNING_THRESHOLD:
                        in_warning_zone = True

                # Check Horizon Gate
                has_horizon_breach = False
                if lead_time is not None and 0.0 < lead_time < HORIZON_LIMIT:
                    has_horizon_breach = True

                # Escalate or issue early warning
                if in_warning_zone and has_horizon_breach:
                    triggered_by_lead_time = True
                elif in_warning_zone or has_horizon_breach:
                    pipeline_early_warned = True

                # Anomaly Forest
                if anomaly_score < -0.05:
                    triggered_by_anomaly = True

            if triggered_by_rule or triggered_by_lead_time or triggered_by_anomaly:
                pipeline_flagged = True
                pipeline_flag_idx = idx
                if triggered_by_rule:
                    pipeline_flag_reasons.append("rule")
                if triggered_by_lead_time:
                    pipeline_flag_reasons.append("lead_time")
                if triggered_by_anomaly:
                    pipeline_flag_reasons.append("anomaly")
                break

        results.append({
            "scenario_id": scenario["id"],
            "scenario_type": scenario["type"],
            "is_true_incident": is_true_incident,
            "gt_breach_idx": gt_breach_idx,
            "naive_flagged": naive_flagged,
            "naive_flag_idx": naive_flag_idx,
            "pipeline_flagged": pipeline_flagged,
            "pipeline_flag_idx": pipeline_flag_idx,
            "pipeline_flag_reasons": pipeline_flag_reasons,
            "pipeline_early_warned": pipeline_early_warned
        })

    # 4. Compute Metrics
    # Initial counters
    n_incidents = sum(1 for r in results if r["is_true_incident"])
    n_normals = len(results) - n_incidents

    naive_tp = 0
    naive_fp = 0
    naive_tn = 0
    naive_fn = 0

    pipeline_tp = 0
    pipeline_fp = 0
    pipeline_tn = 0
    pipeline_fn = 0

    lead_times_gained = []

    for r in results:
        # Ground Truth Incident
        if r["is_true_incident"]:
            # Naive
            if r["naive_flagged"]:
                naive_tp += 1
            else:
                naive_fn += 1
            
            # Pipeline
            if r["pipeline_flagged"]:
                pipeline_tp += 1
                # Calculate lead time gained
                gained_steps = r["gt_breach_idx"] - r["pipeline_flag_idx"]
                gained_minutes = max(0.0, gained_steps * 2.0 / 60.0)
                if gained_minutes > 0.0:
                    lead_times_gained.append(gained_minutes)
            else:
                pipeline_fn += 1
        # Ground Truth Normal/Near-miss
        else:
            # Naive
            if r["naive_flagged"]:
                naive_fp += 1
            else:
                naive_tn += 1
            
            # Pipeline
            if r["pipeline_flagged"]:
                pipeline_fp += 1
            else:
                pipeline_tn += 1

    # Calculate Rates
    naive_tpr = (naive_tp / n_incidents * 100.0) if n_incidents > 0 else 0.0
    naive_fnr = (naive_fn / n_incidents * 100.0) if n_incidents > 0 else 0.0
    naive_fpr = (naive_fp / n_normals * 100.0) if n_normals > 0 else 0.0

    pipeline_tpr = (pipeline_tp / n_incidents * 100.0) if n_incidents > 0 else 0.0
    pipeline_fnr = (pipeline_fn / n_incidents * 100.0) if n_incidents > 0 else 0.0
    pipeline_fpr = (pipeline_fp / n_normals * 100.0) if n_normals > 0 else 0.0

    # Calculate Early Warning totals
    n_early_warnings = sum(1 for r in results if r["pipeline_early_warned"])

    # Reduction in False Negatives
    fn_reduction = 0.0
    if naive_fn > 0:
        fn_reduction = ((naive_fn - pipeline_fn) / naive_fn) * 100.0

    # Average Lead Time Gained
    avg_lead_time_gained = np.mean(lead_times_gained) if lead_times_gained else 0.0

    # 5. Format & Print Summary Table
    headers = ["Metric", "Naive Baseline", "SafeGuard Pipeline"]
    metrics_data = [
        ["True Positive Rate (Recall)", f"{naive_tpr:.1f}%", f"{pipeline_tpr:.1f}%"],
        ["False Negative Rate", f"{naive_fnr:.1f}%", f"{pipeline_fnr:.1f}%"],
        ["False Positive Rate (False Alarms)", f"{naive_fpr:.1f}%", f"{pipeline_fpr:.1f}%"],
        ["Total Scenarios Evaluated", str(len(results)), str(len(results))],
        ["True Incidents Caught", f"{naive_tp}/{n_incidents}", f"{pipeline_tp}/{n_incidents}"],
        ["False Alarms Triggered", f"{naive_fp}/{n_normals}", f"{pipeline_fp}/{n_normals}"],
        ["Early Warnings Issued", "N/A", str(n_early_warnings)]
    ]

    # Compute Diagnostic Breakdown of False Positives
    fp_rule_only = 0
    fp_anomaly_only = 0
    fp_lead_time_only = 0
    fp_combination = 0
    
    for r in results:
        if not r["is_true_incident"] and r["pipeline_flagged"]:
            reasons = r.get("pipeline_flag_reasons", [])
            if len(reasons) > 1:
                fp_combination += 1
            elif "rule" in reasons:
                fp_rule_only += 1
            elif "anomaly" in reasons:
                fp_anomaly_only += 1
            elif "lead_time" in reasons:
                fp_lead_time_only += 1

    print("\n" + "="*80)
    print("🛡️ SAFEGUARD SYSTEM PERFORMANCE BENCHMARK")
    print("="*80)
    print(tabulate(metrics_data, headers=headers, tablefmt="grid"))
    
    print("\n" + "="*80)
    print("🔍 FALSE POSITIVE DIAGNOSTIC BREAKDOWN (SafeGuard Pipeline)")
    print("="*80)
    print(f"Total False Positives: {pipeline_fp}")
    print(f"  - Rule-only triggers:       {fp_rule_only}")
    print(f"  - Anomaly-only triggers:    {fp_anomaly_only}")
    print(f"  - Lead-time-only triggers:  {fp_lead_time_only}")
    print(f"  - Combination triggers:     {fp_combination}")
    print("="*80)
    print("\n" + "-"*80)
    
    summary_sentence = (
        f"SafeGuard reduced false negatives by {fn_reduction:.1f}% and provided "
        f"an average of {avg_lead_time_gained:.2f} minutes additional warning "
        f"versus single-sensor detection."
    )
    print(summary_sentence)
    print("-"*80 + "\n")

    # 6. Save raw per-scenario results to benchmark_results.json
    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "benchmark_results.json")
    benchmark_payload = {
        "summary": {
            "total_scenarios": len(results),
            "total_incidents": n_incidents,
            "total_normals": n_normals,
            "fn_reduction_pct": round(fn_reduction, 2),
            "avg_lead_time_gained_minutes": round(avg_lead_time_gained, 2),
            "early_warnings_issued": n_early_warnings,
            "naive": {
                "tpr": round(naive_tpr, 2),
                "fnr": round(naive_fnr, 2),
                "fpr": round(naive_fpr, 2),
                "tp": naive_tp,
                "fp": naive_fp,
                "tn": naive_tn,
                "fn": naive_fn
            },
            "safeguard": {
                "tpr": round(pipeline_tpr, 2),
                "fnr": round(pipeline_fnr, 2),
                "fpr": round(pipeline_fpr, 2),
                "tp": pipeline_tp,
                "fp": pipeline_fp,
                "tn": pipeline_tn,
                "fn": pipeline_fn,
                "early_warnings_issued": n_early_warnings
            }
        },
        "scenarios": [
            {
                "id": r["scenario_id"],
                "type": r["scenario_type"],
                "is_true_incident": r["is_true_incident"],
                "ground_truth_breach_index": r["gt_breach_idx"],
                "naive_flagged": r["naive_flagged"],
                "naive_flag_index": r["naive_flag_idx"],
                "pipeline_flagged": r["pipeline_flagged"],
                "pipeline_flag_index": r["pipeline_flag_idx"],
                "pipeline_early_warned": r["pipeline_early_warned"],
                "lead_time_gained_minutes": round(max(0.0, (r["gt_breach_idx"] - r["pipeline_flag_idx"]) * 2.0 / 60.0), 2) if (r["is_true_incident"] and r["pipeline_flagged"] and r["gt_breach_idx"] is not None and r["pipeline_flag_idx"] is not None) else 0.0
            }
            for r in results
        ]
    }
    
    with open(output_path, "w") as f:
        json.dump(benchmark_payload, f, indent=2)
    print(f"[Benchmark] Raw results successfully saved to: {output_path}")

if __name__ == "__main__":
    run_benchmark()
