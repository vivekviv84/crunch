# -*- coding: utf-8 -*-
"""
CRUNCH — proprietary RESCUE SCORE™ calculator.
Instantly assesses the severity, likelihood of completion, and danger status
of high-stress, short-window assignment deadlines.
"""

import math
from typing import Dict, List, Any


class RescueScoreCalculator:
    def __init__(self):
        pass

    def calculate_score(self, 
                        hours_remaining: float, 
                        total_subtasks: int, 
                        completed_subtasks: int, 
                        complexity_level: str,  # "Low", "Medium", "High", "Critical"
                        user_pace_state: str,   # "Critical", "At Risk", "On Track"
                        historical_procrastination_index: float = 0.7) -> Dict[str, Any]:
        """
        Computes the proprietary Rescue Score (0-100).
        0-30 = Safe
        31-60 = At Risk
        61-80 = Danger
        81-100 = Critical Rescue Needed
        """
        # 1. Urgency Component (30% weight)
        # Higher score as hours remaining shrinks below 24
        urgency_score = 0.0
        if hours_remaining <= 0:
            urgency_score = 100.0
        elif hours_remaining <= 4:
            urgency_score = 95.0 + (4 - hours_remaining) * 1.25
        elif hours_remaining <= 12:
            urgency_score = 75.0 + (12 - hours_remaining) * 2.5
        elif hours_remaining <= 24:
            urgency_score = 40.0 + (24 - hours_remaining) * 2.9
        else:
            urgency_score = max(0.0, 40.0 - (hours_remaining - 24) * 0.5)
        urgency_score = min(100.0, max(0.0, urgency_score))

        # 2. Complexity Component (20% weight)
        complexity_weights = {
            "low": 20.0,
            "medium": 50.0,
            "high": 80.0,
            "critical": 100.0
        }
        complexity_val = complexity_weights.get(complexity_level.lower(), 50.0)

        # 3. Remaining Work Component (20% weight)
        incomplete_tasks = max(0, total_subtasks - completed_subtasks)
        if total_subtasks == 0:
            remaining_work_score = 0.0
        else:
            remaining_work_score = (incomplete_tasks / total_subtasks) * 100.0

        # 4. Progress Component (10% weight - inverted)
        # High progress reduces danger, so progress score is subtracted/mitigated
        if total_subtasks == 0:
            progress_score = 0.0
        else:
            progress_score = (completed_subtasks / total_subtasks) * 100.0
        
        # 5. Pace Danger Component (10% weight)
        pace_danger_weights = {
            "on track": 10.0,
            "at risk": 60.0,
            "critical": 100.0
        }
        pace_danger_score = pace_danger_weights.get(user_pace_state.lower(), 50.0)

        # 6. Risk Factors (10% weight)
        # Combined multiplier of procrastination and extreme time pressure
        risk_factor_base = historical_procrastination_index * 70.0
        if hours_remaining < 6:
            risk_factor_base += 30.0
        risk_factor_score = min(100.0, risk_factor_base)

        # Weighted calculation
        raw_score = (
            (urgency_score * 0.30) +
            (complexity_val * 0.20) +
            (remaining_work_score * 0.20) +
            ((100.0 - progress_score) * 0.10) +
            (pace_danger_score * 0.10) +
            (risk_factor_score * 0.10)
        )

        final_score = int(min(100.0, max(0.0, raw_score)))

        # Interpretation
        if final_score <= 30:
            risk_level = "Safe"
            explanation = "Your progression pacing safely leads to submission before the deadline. Keep the passive focus."
        elif final_score <= 60:
            risk_level = "At Risk"
            explanation = "Pacing leaks indicate a growing risk. A minor delay will throw the timeline off. Restrict secondary tabs."
        elif final_score <= 80:
            risk_level = "Danger"
            explanation = "Urgent attention required. The time necessary to complete all subtasks matches your time available. Cut all fluff."
        else:
            risk_level = "Critical Rescue Needed"
            explanation = "Severe risk of failing submission guidelines. Immediate microtask triage and scope trimming via the co-pilot is mandatory to pass."

        # Risk breakdown lists
        risk_factors = []
        if hours_remaining < 12:
            risk_factors.append("Time frame collapsed below 12 hours.")
        if user_pace_state.lower() in ["critical", "at risk"]:
            risk_factors.append("Current hourly compilation rate is below timeline estimates.")
        if remaining_work_score > 60:
            risk_factors.append("Incomplete deliverable density remains critically high.")
        if complexity_level.lower() in ["high", "critical"]:
            risk_factors.append("High syllabus complexity creates substantial cognitive friction.")

        return {
            "score": final_score,
            "risk_level": risk_level,
            "explanation": explanation,
            "risk_factors": risk_factors,
            "components": {
                "urgency": int(urgency_score),
                "complexity": int(complexity_val),
                "remaining_work": int(remaining_work_score),
                "progress": int(progress_score),
                "pace_danger": int(pace_danger_score),
                "risk_profile": int(risk_factor_score)
            }
        }
