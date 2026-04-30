from flask import Flask, request, jsonify
import joblib
import shap
import pandas as pd
import numpy as np

app = Flask(__name__)

model = joblib.load("objects/lr_model.joblib")
preprocessor = joblib.load("objects/preprocessor.joblib")

ORIGINAL_FEATURES = ["age", "sex", "cp", "trestbps", "chol", "fbs",
                     "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"]

FEATURE_META = {
    "age": {"label": "Age", "unit": "years"},
    "sex": {"label": "Sex", "unit": "", "map": {0: "Female", 1: "Male"}},
    "cp": {"label": "Chest Pain Type", "unit": "", "map": {0: "Typical Angina", 1: "Atypical Angina", 2: "Non-Anginal Pain", 3: "Asymptomatic"}},
    "trestbps": {"label": "Resting Blood Pressure", "unit": "mmHg"},
    "chol": {"label": "Cholesterol", "unit": "mg/dL"},
    "fbs": {"label": "Fasting Blood Sugar", "unit": "", "map": {0: "Normal (≤120 mg/dL)", 1: "High (>120 mg/dL)"}},
    "restecg": {"label": "Resting ECG", "unit": "", "map": {0: "Normal", 1: "ST-T Abnormality", 2: "Left Ventricular Hypertrophy"}},
    "thalach": {"label": "Max Heart Rate", "unit": "bpm"},
    "exang": {"label": "Exercise-Induced Angina", "unit": "", "map": {0: "No", 1: "Yes"}},
    "oldpeak": {"label": "ST Depression", "unit": "mm"},
    "slope": {"label": "ST Slope", "unit": "", "map": {0: "Upsloping", 1: "Flat", 2: "Downsloping"}},
    "ca": {"label": "Major Vessels Colored", "unit": ""},
    "thal": {"label": "Thalassemia", "unit": "", "map": {1: "Normal", 2: "Fixed Defect", 3: "Reversible Defect"}},
}


# ─────────────────────────────────────────────────────────────────────
#  CLINICAL TRUTH TABLE
#  Defines whether a feature value is inherently a risk or protective
#  factor — completely independent of SHAP sign.
#  True  = this value is clinically a RISK factor
#  False = this value is clinically PROTECTIVE / neutral
# ─────────────────────────────────────────────────────────────────────
def is_clinically_risk(feature, value):
    v = float(value)
    rules = {
        "cp": lambda v: int(v) in [0, 3],
        "exang": lambda v: int(v) == 1,
        "ca": lambda v: int(v) >= 1,
        "thal": lambda v: int(v) in [2, 3],
        "oldpeak": lambda v: v > 1.0,
        "slope": lambda v: int(v) == 2,
        "restecg": lambda v: int(v) in [1, 2],
        "fbs": lambda v: int(v) == 1,
        "age": lambda v: v > 55,
        "sex": lambda v: int(v) == 1,
        "thalach": lambda v: v < 140,
        "chol": lambda v: v >= 200,
        "trestbps": lambda v: v >= 140,
    }
    fn = rules.get(feature)
    return fn(v) if fn else False


def get_value_label(feature, value):
    """Always returns a human-readable string."""
    try:
        meta = FEATURE_META.get(feature, {})
        if "map" in meta:
            return meta["map"].get(int(float(value)), str(value))
        unit = meta.get("unit", "")
        fval = float(value)
        display = int(fval) if fval == int(fval) else fval
        return f"{display} {unit}".strip()
    except (TypeError, ValueError):
        return str(value)


def generate_clinical_reason(feature, patient_value):
    """
    Returns a fully written clinical sentence.icit.
    patient_value is always the raw numeric value from patient_data.
    """
    try:
        v = float(patient_value)
    except (TypeError, ValueError):
        v = 0

    if feature == "cp":
        return {
            0: "Typical angina strongly suggests reduced coronary blood flow — a primary cardiac symptom.",
            1: "Atypical angina has a weaker association with coronary artery disease and is considered a neutral or borderline finding.",
            2: "Non-anginal chest pain is less directly linked to coronary artery disease.",
            3: "Asymptomatic presentation can mask silent coronary artery disease — a known high-risk pattern.",
        }.get(int(v), f"Chest pain type {int(v)} has clinical significance.")

    if feature == "thalach":
        if v < 120:
            return f"Max heart rate of {int(v)} bpm is very low — poor cardiac reserve is a significant risk marker."
        elif v < 140:
            return f"Max heart rate of {int(v)} bpm is below optimal, suggesting reduced cardiac capacity."
        elif v >= 150:
            return f"Max heart rate of {int(v)} bpm reflects strong cardiac fitness, which lowers disease risk."
        else:
            return f"Max heart rate of {int(v)} bpm is in an acceptable range with moderate cardiac reserve."

    if feature == "oldpeak":
        if v == 0:
            return "No ST depression detected — a reassuring sign of healthy cardiac stress response."
        elif v <= 1.0:
            return f"Mild ST depression of {v} mm is a borderline finding and may require monitoring."
        elif v > 2.0:
            return f"ST depression of {v} mm is significantly elevated — a strong indicator of myocardial ischemia."
        else:
            return f"ST depression of {v} mm is moderately elevated — an early warning sign of possible ischemia."

    if feature == "ca":
        n = int(v)
        if n == 0:
            return "No major coronary vessels are blocked — a strong protective indicator."
        elif n == 1:
            return "1 major vessel shows reduced perfusion — this directly elevates heart disease risk."
        else:
            return f"{n} major vessels show reduced perfusion on fluoroscopy — a significant cardiac risk finding."

    if feature == "thal":
        return {
            1: "Normal thalassemia result — no hereditary blood flow defect detected, which is protective.",
            2: "Fixed thalassemia defect indicates permanent myocardial damage — a significant risk factor.",
            3: "Reversible thalassemia defect is triggered by stress and signals stress-induced ischemia.",
        }.get(int(v), f"Thalassemia result {int(v)} has clinical significance.")

    if feature == "exang":
        if int(v) == 1:
            return "Chest pain during exercise (exercise-induced angina) is a clinically significant cardiac risk indicator."
        else:
            return "No chest pain during exercise — a reassuring finding that supports lower cardiovascular risk."

    if feature == "age":
        if v > 65:
            return f"Age {int(v)} is above 65 — advancing age is an independent cardiovascular risk factor."
        elif v > 55:
            return f"Age {int(v)} is above 55 — places the patient in an elevated cardiovascular risk bracket."
        elif v < 45:
            return f"Age {int(v)} is relatively young — this lowers baseline cardiovascular risk."
        else:
            return f"Age {int(v)} is in a moderate cardiovascular risk range."

    if feature == "chol":
        if v >= 240:
            return f"Cholesterol of {int(v)} mg/dL is clinically high (≥240) — raises atherosclerosis risk."
        elif v >= 200:
            return f"Borderline cholesterol of {int(v)} mg/dL (200–239 range) warrants ongoing monitoring."
        else:
            return f"Cholesterol of {int(v)} mg/dL is in the healthy range — a protective finding."

    if feature == "trestbps":
        if v >= 140:
            return f"Resting BP of {int(v)} mmHg meets the hypertension threshold — increases cardiac workload."
        elif v >= 130:
            return f"Resting BP of {int(v)} mmHg is elevated (Stage 1 hypertension range) — a risk factor."
        else:
            return f"Resting BP of {int(v)} mmHg is in the healthy normal range — a protective finding."

    if feature == "sex":
        if int(v) == 1:
            return "Male sex is associated with higher cardiovascular disease incidence across population studies."
        else:
            return "Female sex is associated with relatively lower cardiovascular risk before menopause."

    if feature == "fbs":
        if int(v) == 1:
            return "Elevated fasting blood sugar (>120 mg/dL) suggests insulin resistance or diabetes — a major cardiovascular risk factor."
        else:
            return "Normal fasting blood sugar indicates healthy glucose metabolism, which lowers metabolic cardiovascular risk."

    if feature == "restecg":
        return {
            0: "Normal resting ECG — no electrical abnormality detected, which is reassuring.",
            1: "ST-T wave abnormality on resting ECG suggests possible ischemia or electrolyte imbalance.",
            2: "Left ventricular hypertrophy on ECG indicates chronic pressure overload of the heart.",
        }.get(int(v), f"Resting ECG finding {int(v)} has clinical relevance.")

    if feature == "slope":
        return {
            0: "Upsloping ST segment is a favorable finding during exercise — a protective indicator.",
            1: "Flat ST segment is a borderline finding — not a strong independent risk factor.",
            2: "Downsloping ST segment is the most concerning pattern, strongly associated with ischemia.",
        }.get(int(v), f"ST slope pattern {int(v)} has diagnostic significance.")

    # Generic fallback
    label = FEATURE_META.get(feature, {}).get("label", feature)
    val_label = get_value_label(feature, patient_value)
    return f"{label} value of {val_label} has been factored into the prediction."


def build_explanation(shap_dict, patient_data):
    risk_factors = []
    protective = []

    for feature, shap_val in shap_dict.items():
        if abs(shap_val) < 0.001:
            continue

        raw_value = patient_data.get(feature, 0)
        val_label = get_value_label(feature, raw_value)
        reason = generate_clinical_reason(feature, raw_value)
        clinically_risky = is_clinically_risk(feature, raw_value)

        entry = {
            "feature": FEATURE_META.get(feature, {}).get("label", feature),
            "patient_value": val_label,
            # ✅ FIX: make SHAP sign always match clinical bucket
            # Risk factors always show positive SHAP, protective always negative
            "shap_impact": abs(round(shap_val, 4)) if clinically_risky else -abs(round(shap_val, 4)),
            "reason": reason,
        }

        if clinically_risky:
            risk_factors.append(entry)
        else:
            protective.append(entry)

    risk_factors.sort(key=lambda x: abs(x["shap_impact"]), reverse=True)
    protective.sort(key=lambda x: abs(x["shap_impact"]), reverse=True)

    return risk_factors, protective


def build_verdict(prediction, probability, risk_factors, protective):
    pct = round(probability * 100, 1)

    if prediction == 1:
        level = "HIGH" if pct >= 70 else "MODERATE"
        top_risks = ", ".join([f["feature"] for f in risk_factors[:3]])
        return (
            f"The model predicts {level} risk of heart disease with {pct}% probability. "
            f"The most influential risk factors are: {top_risks}. "
            f"Clinical follow-up and cardiac workup are recommended."
        )
    else:
        top_protect = ", ".join([f["feature"] for f in protective[:3]]) if protective else "none identified"

        # ✅ NEW: warn when model says low risk but many clinical flags exist
        if len(risk_factors) >= 5:
            risk_note = (
                f" ⚠️ However, {len(risk_factors)} significant clinical risk markers are present "
                f"despite the low model score — independent clinical evaluation is strongly advised."
            )
        elif risk_factors:
            risk_note = (
                f" However, {len(risk_factors)} clinical risk marker(s) are present — routine monitoring is advised."
            )
        else:
            risk_note = " No significant risk markers were detected."

        return (
            f"The model predicts LOW risk of heart disease with a disease probability of {pct}%. "
            f"Key protective factors: {top_protect}.{risk_note}"
        )


# ── Startup ────────────────────────────────────────────────────────── #
try:
    X_train = joblib.load("objects/X_train_sample.joblib")
    background = preprocessor.transform(X_train)
except Exception:
    dummy = pd.DataFrame([{"age": 50, "sex": 1, "cp": 0, "trestbps": 120, "chol": 200,
                           "fbs": 0, "restecg": 0, "thalach": 150, "exang": 0,
                           "oldpeak": 0.0, "slope": 1, "ca": 0, "thal": 2}])
    background = np.zeros((1, preprocessor.transform(dummy).shape[1]))


def get_feature_names(prep):
    names = []
    for _, transformer, cols in prep.transformers_:
        if transformer == "drop":
            continue
        if hasattr(transformer, "get_feature_names_out"):
            names.extend(transformer.get_feature_names_out(cols))
        else:
            names.extend(cols if isinstance(cols, list) else [cols])
    return names


try:
    transformed_names = get_feature_names(preprocessor)
except Exception:
    transformed_names = [f"feature_{i}" for i in range(background.shape[1])]

explainer = shap.LinearExplainer(model, background, feature_perturbation="interventional")


@app.route("/")
def home():
    return "Flask ML service is running."


@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    features = pd.DataFrame([{k: data[k] for k in ORIGINAL_FEATURES}])
    processed = preprocessor.transform(features)

    prediction = int(model.predict(processed)[0])
    probability = float(model.predict_proba(processed)[0][1])

    shap_values = explainer.shap_values(processed)[0]
    transformed_shap = dict(zip(transformed_names, shap_values.tolist()))

    original_shap = {}
    for feat in ORIGINAL_FEATURES:
        total = sum(
            v for k, v in transformed_shap.items()
            if k == feat or k.endswith(f"__{feat}") or k.startswith(f"{feat}_")
        )
        original_shap[feat] = round(total, 6)

    original_shap = dict(
        sorted(original_shap.items(), key=lambda x: abs(x[1]), reverse=True)
    )

    risk_factors, protective = build_explanation(original_shap, data)
    verdict = build_verdict(prediction, probability, risk_factors, protective)
    risk_level = ("HIGH" if probability >= 0.70 else "MODERATE") if prediction == 1 else \
                 ("BORDERLINE LOW" if probability > 0.30 else "LOW")

    return jsonify({
        "prediction": prediction,
        "risk_score": round(probability, 4),
        "risk_level": risk_level,
        "verdict": verdict,
        "risk_factors": risk_factors,
        "protective_factors": protective,
        "patient_data": data,
        "base_value": round(float(explainer.expected_value), 4),
        "shap_scores": original_shap,
        "explanation": original_shap,
    })


if __name__ == "__main__":
    app.run(debug=True)
