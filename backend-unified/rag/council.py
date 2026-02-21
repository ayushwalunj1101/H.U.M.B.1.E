"""
Unified Backend — Council (Mental State Analysis)
Keyword-based mental state classification.
Lifted from backend/council.py
"""
from pydantic import BaseModel


class CouncilOutput(BaseModel):
    primary_state: str
    severity: str       # mild | moderate | severe
    crisis_risk: str    # low | high
    recommended_modality: str
    reasoning: str


def analyze_user_input(user_text: str) -> CouncilOutput:
    """Keyword-based mental state analysis."""
    text = user_text.lower()

    # 1. CRISIS CHECK
    if any(w in text for w in ["suicide", "kill myself", "end it", "hurt myself", "die"]):
        return CouncilOutput(
            primary_state="Crisis",
            severity="severe",
            crisis_risk="high",
            recommended_modality="Immediate Intervention",
            reasoning="Active self-harm ideation detected.",
        )

    # 2. DEPRESSION
    elif any(w in text for w in ["sad", "hopeless", "tired", "bed", "cry", "worthless"]):
        return CouncilOutput(
            primary_state="Depression",
            severity="moderate",
            crisis_risk="low",
            recommended_modality="CBT (Behavioral Activation)",
            reasoning="Symptoms align with depressive rumination.",
        )

    # 3. ANXIETY
    elif any(w in text for w in ["anxious", "worry", "panic", "heart", "scared", "what if"]):
        return CouncilOutput(
            primary_state="Anxiety",
            severity="moderate",
            crisis_risk="low",
            recommended_modality="CBT (Cognitive Restructuring)",
            reasoning="Worry chain and physical anxiety symptoms.",
        )

    # 4. DEFAULT
    else:
        return CouncilOutput(
            primary_state="General Distress",
            severity="mild",
            crisis_risk="low",
            recommended_modality="Supportive Counseling",
            reasoning="General inquiry.",
        )
