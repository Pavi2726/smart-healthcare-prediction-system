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

# ------------------------------------------------------------------ #
#  Clinical context: labels, normal ranges, and plain-English meaning #
# ------------------------------------------------------------------ #
FEATURE_META = {
    "age":      {"label": "Age",                    "unit": "years",  "high_risk": ">55",  "low_risk": "<45"},
    "sex":      {"label": "Sex",                    "unit": "",       "map": {0: "Female", 1: "Male"}},
    "cp":       {"label": "Chest Pain Type",        "unit": "",       "map": {0: "Typical Angina", 1: "Atypical Angina", 2: "Non-Anginal Pain", 3: "Asymptomatic"}},
    "trestbps": {"label": "Resting Blood Pressure", "unit": "mmHg",  "normal": "<120",    "high": "≥140"},
    "chol":     {"label": "Cholesterol",            "unit": "mg/dL", "normal": "<200",    "high": "≥240"},
    "fbs":      {"label": "Fasting Blood Sugar",    "unit": "",       "map": {0: "Normal (≤120 mg/dL)", 1: "High (>120 mg/dL)"}},
    "restecg":  {"label": "Resting ECG",            "unit": "",       "map": {0: "Normal", 1: "ST-T Abnormality", 2: "Left Ventricular Hypertrophy"}},
    "thalach":  {"label": "Max Heart Rate",         "unit": "bpm",   "normal": ">150",    "low_risk_above": 150},
    "exang":    {"label": "Exercise-Induced Angina","unit": "",       "map": {0: "No", 1: "Yes"}},
    "oldpeak":  {"label": "ST Depression",          "unit": "",       "normal": "0",       "high": ">2.0"},
    "slope":    {"label": "ST Slope",               "unit": "",       "map": {0: "Upsloping", 1: "Flat", 2: "Downsloping"}},
    "ca":       {"label": "Major Vessels Colored",  "unit": "",       "normal": "0",       "high": "≥1"},
    "thal":     {"label": "Thalassemia",            "unit": "",       "map": {0: "Normal", 1: "Fixed Defect", 2: "Reversible Defect"}},
}

def get_feature_value_label(feature, value):
    """Return human-readable value string."""
    meta = FEATURE_META.get(feature, {})
    if "map" in meta:
        return meta["map"].get(int(value), str(value))
    unit = meta.get("unit", "")
    return f"{value} {unit}".strip()

def generate_clinical_reason(feature, shap_val, patient_value, prediction):
    """Turn a SHAP value into a plain-English clinical sentence."""
    meta = FEATURE_META.get(feature, {})
    label = meta.get("label", feature)
    val_str = get_feature_value_label(feature, patient_value)
    direction = "increased" if shap_val > 0 else "reduced"
    impact = "risk" if prediction == 1 else "likelihood of no disease"

    # Feature-specific clinical explanations
    reasons = {
        "cp": {
            3: "Asymptomatic chest pain is a strong indicator of silent heart disease.",
            0: "Typical angina pattern suggests reduced blood flow to the heart.",
            1: "Atypical angina is a moderate warning sign.",
            2: "Non-anginal pain is less directly linked to heart disease.",
        },
        "thalach": None,  # handled below
        "oldpeak": None,
        "ca": None,
        "thal": None,
        "exang": None,
    }

    if feature == "thalach":
        if patient_value < 120:
            return f"Max heart rate of {patient_value} bpm is very low — poor cardiac response to exercise significantly {direction} risk."
        elif patient_value > 160:
            return f"Max heart rate of {patient_value} bpm is excellent — strong cardiac fitness {direction} {impact}."
        else:
            return f"Max heart rate of {patient_value} bpm is moderate, slightly {direction} {impact}."

    if feature == "oldpeak":
        if patient_value == 0:
            return "No ST depression detected — a reassuring sign that {direction}s risk."
        elif patient_value > 2:
            return f"ST depression of {patient_value} is significantly elevated, indicating possible ischemia and {direction}ing risk."
        else:
            return f"Mild ST depression of {patient_value} is a moderate warning sign and {direction}s risk."

    if feature == "ca":
        if patient_value == 0:
            return f"No major vessels blocked — a positive sign that {direction}s risk."
        else:
            return f"{int(patient_value)} blocked major vessel(s) detected — directly {direction}s heart disease risk."

    if feature == "thal":
        thal_map = {0: "normal blood flow", 1: "a fixed defect (permanent damage)", 2: "a reversible defect (stress-induced)"}
        thal_desc = thal_map.get(int(patient_value), "abnormal result")
        return f"Thalassemia shows {thal_desc}, which {direction}s {impact}."

    if feature == "exang":
        if patient_value == 1:
            return f"Chest pain during exercise (exercise-induced angina) is a significant warning sign and {direction}s risk."
        else:
            return f"No chest pain during exercise — a reassuring sign that {direction}s risk."

    if feature == "cp" and int(patient_value) in reasons.get("cp", {}):
        return reasons["cp"][int(patient_value)]

    if feature == "age":
        if patient_value > 60:
            return f"Age {patient_value} is above 60 — older age {direction}s cardiovascular risk."
        elif patient_value < 45:
            return f"Age {patient_value} is relatively young — {direction}s baseline risk."
        else:
            return f"Age {patient_value} is in a moderate risk range and {direction}s {impact}."

    if feature == "chol":
        if patient_value >= 240:
            return f"Cholesterol of {patient_value} mg/dL is high (≥240) — {direction}s heart disease risk."
        elif patient_value < 200:
            return f"Cholesterol of {patient_value} mg/dL is in a healthy range — {direction}s risk."
        else:
            return f"Borderline cholesterol of {patient_value} mg/dL {direction}s {impact} moderately."

    if feature == "trestbps":
        if patient_value >= 140:
            return f"Resting blood pressure of {patient_value} mmHg is high — {direction}s cardiovascular risk."
        elif patient_value < 120:
            return f"Healthy blood pressure of {patient_value} mmHg — {direction}s risk."
        else:
            return f"Borderline blood pressure of {patient_value} mmHg {direction}s {impact} slightly."

    if feature == "sex":
        sex_str = "Male" if patient_value == 1 else "Female"
        return f"Being {sex_str} {direction}s the statistical {impact} based on population data."

    if feature == "fbs":
        if patient_value == 1:
            return f"Elevated fasting blood sugar (>120 mg/dL) suggests possible diabetes, which {direction}s heart risk."
        else:
            return f"Normal fasting blood sugar — {direction}s risk."

    if feature == "restecg":
        ecg_map = {0: "normal ECG", 1: "ST-T wave abnormality", 2: "left ventricular hypertrophy"}
        ecg_desc = ecg_map.get(int(patient_value), "abnormal ECG")
        return f"Resting ECG shows {ecg_desc}, which {direction}s {impact}."

    if feature == "slope":
        slope_map = {0: "upsloping (favorable)", 1: "flat (moderate concern)", 2: "downsloping (concerning)"}
        slope_desc = slope_map.get(int(patient_value), "abnormal slope")
        return f"ST slope is {slope_desc} — {direction}s {impact}."

    # Generic fallback
    return f"{label} value of {val_str} {direction}s {impact}."


def build_explanation(shap_dict, patient_data, prediction):
    """Build structured explanation with factors FOR and AGAINST diagnosis."""
    
    risk_factors    = []  # SHAP > 0 when prediction=1 → pushing toward disease
    protective      = []  # SHAP < 0 when prediction=1 → pushing away from disease

    for feature, shap_val in shap_dict.items():
        if abs(shap_val) < 0.001:   # skip negligible contributors
            continue

        patient_val = patient_data.get(feature, "N/A")
        reason = generate_clinical_reason(feature, shap_val, patient_val, prediction)

        entry = {
            "feature":       FEATURE_META.get(feature, {}).get("label", feature),
            "patient_value": get_feature_value_label(feature, patient_val),
            "shap_impact":   round(shap_val, 4),
            "reason":        reason,
        }

        if shap_val > 0:
            risk_factors.append(entry)
        else:
            protective.append(entry)

    # Sort by absolute impact
    risk_factors.sort(key=lambda x: abs(x["shap_impact"]), reverse=True)
    protective.sort(key=lambda x:  abs(x["shap_impact"]), reverse=True)

    return risk_factors, protective


# ── Startup: build background + explainer once ────────────────────── #
try:
    X_train = joblib.load("objects/X_train_sample.joblib")
    background = preprocessor.transform(X_train)
except Exception:
    dummy = pd.DataFrame([{"age":50,"sex":1,"cp":0,"trestbps":120,"chol":200,
                           "fbs":0,"restecg":0,"thalach":150,"exang":0,
                           "oldpeak":0.0,"slope":1,"ca":0,"thal":2}])
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
    return "✅ Flask server is running successfully!"

# ── Route ─────────────────────────────────────────────────────────── #
@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    features = pd.DataFrame([{k: data[k] for k in ORIGINAL_FEATURES}])
    processed = preprocessor.transform(features)

    prediction  = int(model.predict(processed)[0])
    probability = float(model.predict_proba(processed)[0][1])

    # SHAP
    shap_values = explainer.shap_values(processed)[0]
    transformed_shap = dict(zip(transformed_names, shap_values.tolist()))

    # Aggregate one-hot columns → original feature names
    original_shap = {}
    for feat in ORIGINAL_FEATURES:
        total = sum(v for k, v in transformed_shap.items()
                    if k == feat or k.endswith(f"__{feat}") or k.startswith(f"{feat}_"))
        original_shap[feat] = round(total, 6)

    # Sort by absolute SHAP
    original_shap = dict(sorted(original_shap.items(),
                                key=lambda x: abs(x[1]), reverse=True))

    risk_factors, protective = build_explanation(original_shap, data, prediction)

    # Plain-English verdict
    verdict = (
        f"The model predicts {'HIGH' if prediction == 1 else 'LOW'} risk of heart disease "
        f"with {probability*100:.1f}% confidence. "
        f"{'The following risk factors were identified:' if prediction == 1 else 'The patient appears largely healthy, though some minor risk factors remain.'}"
    )

    return jsonify({
        "prediction":    prediction,
        "risk_score":    round(probability, 4),
        "verdict":       verdict,
        "risk_factors":  risk_factors,
        "protective_factors": protective,
        "patient_data": data,
        "base_value":    round(float(explainer.expected_value), 4),
        "shap_scores":   original_shap, # raw numbers still available
        "explanation": original_shap 
    })


if __name__ == "__main__":
    app.run(debug=True)