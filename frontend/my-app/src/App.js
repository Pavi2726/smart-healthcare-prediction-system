import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// ─────────────────────────────────────────────────────────────
//  ALL field names match backend API exactly.
//  Dropdowns always send NUMERIC values.
//  No field name is renamed anywhere in this file.
// ─────────────────────────────────────────────────────────────

const FIELDS = [
  {
    name: "age",        // ✅ exact API key
    label: "Age",
    type: "number",
    placeholder: "e.g. 52",
    min: 1, max: 120, unit: "yrs",
  },
  {
    name: "sex",        // ✅ exact API key
    label: "Sex",
    type: "select",
    options: [
      { label: "Select", value: "" },
      { label: "Male",   value: 1  },
      { label: "Female", value: 0  },
    ],
  },
  {
    name: "cp",         // ✅ exact API key
    label: "Chest Pain Type",
    type: "select",
    options: [
      { label: "Select",           value: "" },
      { label: "Typical Angina",   value: 0  },
      { label: "Atypical Angina",  value: 1  },
      { label: "Non-Anginal Pain", value: 2  },
      { label: "Asymptomatic",     value: 3  },
    ],
  },
  {
    name: "trestbps",   // ✅ exact API key
    label: "Resting Blood Pressure",
    type: "number",
    placeholder: "e.g. 130",
    min: 50, max: 300, unit: "mmHg",
  },
  {
    name: "chol",       // ✅ exact API key
    label: "Serum Cholesterol",
    type: "number",
    placeholder: "e.g. 210",
    min: 100, max: 600, unit: "mg/dl",
  },
  {
    name: "fbs",        // ✅ exact API key
    label: "Fasting Blood Sugar > 120",
    type: "select",
    options: [
      { label: "Select",            value: "" },
      { label: "Yes (> 120 mg/dl)", value: 1  },
      { label: "No  (≤ 120 mg/dl)", value: 0  },
    ],
  },
  {
    name: "restecg",    // ✅ exact API key
    label: "Resting ECG",
    type: "select",
    options: [
      { label: "Select",                       value: "" },
      { label: "Normal",                       value: 0  },
      { label: "ST-T Wave Abnormality",        value: 1  },
      { label: "Left Ventricular Hypertrophy", value: 2  },
    ],
  },
  {
    name: "thalach",    // ✅ exact API key
    label: "Max Heart Rate",
    type: "number",
    placeholder: "e.g. 150",
    min: 50, max: 250, unit: "bpm",
  },
  {
    name: "exang",      // ✅ exact API key
    label: "Exercise-Induced Angina",
    type: "select",
    options: [
      { label: "Select", value: "" },
      { label: "Yes",    value: 1  },
      { label: "No",     value: 0  },
    ],
  },
  {
    name: "oldpeak",    // ✅ exact API key
    label: "ST Depression (Oldpeak)",
    type: "number",
    placeholder: "e.g. 1.2",
    min: 0, max: 10, step: 0.1, unit: "mm",
  },
  {
    name: "slope",      // ✅ exact API key
    label: "ST Slope",
    type: "select",
    options: [
      { label: "Select",      value: "" },
      { label: "Upsloping",   value: 0  },
      { label: "Flat",        value: 1  },
      { label: "Downsloping", value: 2  },
    ],
  },
  {
    name: "ca",         // ✅ exact API key
    label: "Major Vessels (Fluoroscopy)",
    type: "select",
    options: [
      { label: "Select",    value: "" },
      { label: "0 vessels", value: 0  },
      { label: "1 vessel",  value: 1  },
      { label: "2 vessels", value: 2  },
      { label: "3 vessels", value: 3  },
    ],
  },
  {
    name: "thal",       // ✅ exact API key
    label: "Thalassemia",
    type: "select",
    options: [
      { label: "Select",            value: "" },
      { label: "Normal",            value: 1  },
      { label: "Fixed Defect",      value: 2  },
      { label: "Reversible Defect", value: 3  },
    ],
  },
];

const emptyForm = Object.fromEntries(FIELDS.map((f) => [f.name, ""]));

// Maps display label → API key (used by ExplanationPanel)
const FEATURE_LABELS = {
  age:      "Age",
  sex:      "Sex",
  cp:       "Chest pain type",
  trestbps: "Resting BP",
  chol:     "Cholesterol",
  fbs:      "Fasting blood sugar",
  restecg:  "Resting ECG",
  thalach:  "Max heart rate",
  exang:    "Exercise angina",
  oldpeak:  "ST depression",
  slope:    "ST slope",
  ca:       "Blocked vessels",
  thal:     "Thalassemia",
};

// ─── Generates a human-readable reason for each SHAP factor ───
function generateReason(feature, shapVal, v) {
  const up = shapVal > 0 ? "increases" : "reduces";
  if (feature === "chol")
    return `Cholesterol ${v} mg/dL ${up} heart disease risk.`;
  if (feature === "age") {
    if (v < 40) return `Age ${v} is relatively young — lowers overall risk.`;
    if (v > 60) return `Age ${v} is elevated — increases cardiovascular risk.`;
    return `Age ${v} contributes moderately to risk.`;
  }
  if (feature === "thalach")
    return `Max heart rate ${v} bpm ${up} risk.`;
  if (feature === "exang")
    return v === 1
      ? "Exercise-induced angina present — noted as a risk factor."
      : "No exercise angina — lowers risk.";
  if (feature === "oldpeak")
    return `ST depression of ${v} mm ${up} risk.`;
  return `${FEATURE_LABELS[feature] || feature} value (${v}) ${up} risk.`;
}

// ─── Single factor card ────────────────────────────────────────
function FactorCard({ item, type, patientData }) {
  const featureKey =
    Object.keys(FEATURE_LABELS).find(
      (k) => FEATURE_LABELS[k] === item.feature
    ) ?? item.feature;

  const val    = patientData?.[featureKey] ?? item.patient_value ?? "—";
  const reason = generateReason(featureKey, item.shap_impact, val);
  const isRisk = type === "risk";

  return (
    <div className={`factor-card ${isRisk ? "risk" : "protect"}`}>
      <div className="factor-icon">{isRisk ? "⚠️" : "🛡️"}</div>
      <div className="factor-body">
        <div className="factor-name">{item.feature}</div>
        <span className="factor-value">Value: {val}</span>
        <p className="factor-reason">{reason}</p>
      </div>
      <div className="factor-shap">
        <span className={`factor-shap-val ${item.shap_impact > 0 ? "positive" : "negative"}`}>
          {item.shap_impact > 0 ? "+" : ""}{item.shap_impact.toFixed(3)}
        </span>
        <span className="factor-shap-label">SHAP</span>
      </div>
    </div>
  );
}

// ─── Explanation panel ─────────────────────────────────────────
function ExplanationPanel({ result }) {
  const risk    = result.risk_factors        || [];
  const protect = result.protective_factors  || [];

  return (
    <div className="explanation-section">
      <h3 className="explanation-title">🧠 Why this prediction?</h3>

      {risk.length > 0 && (
        <div className="explanation-group">
          <div className="explanation-group-title risk">🔺 Risk Factors</div>
          {risk.map((f, i) => (
            <FactorCard key={i} item={f} type="risk" patientData={result.patient_data} />
          ))}
        </div>
      )}

      {protect.length > 0 && (
        <div className="explanation-group">
          <div className="explanation-group-title protect">🟢 Protective Factors</div>
          {protect.map((f, i) => (
            <FactorCard key={i} item={f} type="protect" patientData={result.patient_data} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Doctor Dashboard ──────────────────────────────────────────
function DoctorDashboard({ history, filter, setFilter }) {
  const filtered = history.filter((h) => {
    if (filter === "HIGH") return h.prediction === 1;
    if (filter === "LOW")  return h.prediction === 0;
    return true;
  });

  const totalHigh = history.filter((h) => h.prediction === 1).length;
  const totalLow  = history.filter((h) => h.prediction === 0).length;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h3 className="dashboard-title">🩺 Doctor Dashboard</h3>
      </div>

      {/* Summary pills */}
      <div className="dashboard-summary">
        <div className="summary-pill">
          <div className="summary-pill-num total">{history.length}</div>
          <div className="summary-pill-label">Total Patients</div>
        </div>
        <div className="summary-pill">
          <div className="summary-pill-num high">{totalHigh}</div>
          <div className="summary-pill-label">High Risk</div>
        </div>
        <div className="summary-pill">
          <div className="summary-pill-num low">{totalLow}</div>
          <div className="summary-pill-label">Low Risk</div>
        </div>
      </div>

      {/* Filter */}
      <div className="dashboard-filter">
        <label htmlFor="dash-filter">Filter by:</label>
        <select
          id="dash-filter"
          className="filter-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All Patients</option>
          <option value="HIGH">High Risk Only</option>
          <option value="LOW">Low Risk Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="dashboard-table-wrap">
        {filtered.length === 0 ? (
          <div className="dashboard-empty">No records found.</div>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Age</th>
                <th>Cholesterol</th>
                <th>Prediction</th>
                <th>Risk Score</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={i}>
                  <td>{item.age}</td>
                  <td>{item.chol} mg/dl</td>
                  <td>
                    <span className={`risk-badge ${item.prediction === 1 ? "high" : "low"}`}>
                      {item.prediction === 1 ? "🔴 High" : "🟢 Low"}
                    </span>
                  </td>
                  <td>{(item.risk_score * 100).toFixed(2)}%</td>
                  <td className="td-date">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────
export default function App() {
  const [formData, setFormData] = useState(emptyForm);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [apiErr,   setApiErr]   = useState("");
  const [show,     setShow]     = useState(false);
  const [history,  setHistory]  = useState([]);
  const [filter,   setFilter]   = useState("ALL");

  const fetchHistory = async () => {
    try {
      const res  = await fetch("http://localhost:3000/history");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("History fetch error:", err);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  // ── Change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  // ── Validation
  const validate = () => {
    const errs = {};
    FIELDS.forEach((f) => {
      const v = formData[f.name];
      if (v === "" || v === undefined) {
        errs[f.name] = "Required";
      } else if (f.type === "number") {
        const n = parseFloat(v);
        if (isNaN(n))                        errs[f.name] = "Enter a number";
        else if (f.min != null && n < f.min) errs[f.name] = `Min ${f.min}`;
        else if (f.max != null && n > f.max) errs[f.name] = `Max ${f.max}`;
      }
    });
    return errs;
  };

  // ── Submit — API call unchanged ✅
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setResult(null);
    setApiErr("");
    setShow(false);

    // Payload: field names unchanged, values cast to Number ✅
    const payload = Object.fromEntries(
      Object.entries(formData).map(([k, v]) => [k, Number(v)])
    );

    try {
      // ✅ Exact API call preserved
      const { data } = await axios.post("http://localhost:3000/predict", payload);
      setResult(data);  // { prediction: 0|1, risk_score: float, risk_factors?, protective_factors? }
      fetchHistory();
      setTimeout(() => setShow(true), 60);
    } catch (err) {
      setApiErr(
        err?.response?.data?.message ||
        "Cannot reach server. Make sure Express (port 3000) and Flask (port 5000) are running."
      );
    }
    setLoading(false);
  };

  // ── Reset
  const handleReset = () => {
    setFormData(emptyForm);
    setErrors({});
    setResult(null);
    setApiErr("");
    setShow(false);
  };

  const filled     = FIELDS.filter((f) => formData[f.name] !== "").length;
  const isHighRisk = result?.prediction === 1;

  return (
    <div className="page">

      {/* ── Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">✚</span>
            <span className="logo-text">CardioSense</span>
            <span className="logo-tag">AI</span>
          </div>
          <div className="header-right">
            <span className="live-dot" />
            <span className="live-label">Live Model</span>
          </div>
        </div>
      </header>

      <main className="main">

        {/* ── Title */}
        <div className="title-block">
          <h1 className="title">Heart Disease Risk Predictor</h1>
          <p className="subtitle">
            Enter all 13 clinical parameters and click <strong>Predict</strong> to get the result.
          </p>
          <div className="prog-row">
            <div className="prog-track">
              <div
                className="prog-bar"
                style={{ width: `${Math.round((filled / FIELDS.length) * 100)}%` }}
              />
            </div>
            <span className="prog-label">{filled} / {FIELDS.length}</span>
          </div>
        </div>

        {/* ── Form */}
        <form className="form-card" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {FIELDS.map((f) => (
              <div
                key={f.name}
                className={[
                  "field-row",
                  errors[f.name]          ? "field-row--err" : "",
                  formData[f.name] !== "" ? "field-row--ok"  : "",
                ].join(" ")}
              >
                <label className="flabel" htmlFor={f.name}>
                  {f.label}
                  {errors[f.name] && <span className="ferr">{errors[f.name]}</span>}
                </label>

                {f.type === "select" ? (
                  <div className="sel-box">
                    <select
                      id={f.name}
                      name={f.name}        /* ✅ exact API key */
                      value={formData[f.name]}
                      onChange={handleChange}
                      className="fsel"
                    >
                      {f.options.map((o) => (
                        <option key={String(o.value)} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span className="caret">▾</span>
                  </div>
                ) : (
                  <div className="inp-box">
                    <input
                      id={f.name}
                      name={f.name}        /* ✅ exact API key */
                      type="number"
                      value={formData[f.name]}
                      placeholder={f.placeholder}
                      min={f.min}
                      max={f.max}
                      step={f.step || 1}
                      onChange={handleChange}
                      className="finp"
                    />
                    {f.unit && <span className="funit">{f.unit}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="btn-row">
            <button type="button" className="btn-reset" onClick={handleReset}>↺ Reset</button>
            <button
              type="submit"
              className={`btn-predict${loading ? " btn-predict--busy" : ""}`}
              disabled={loading}
            >
              {loading ? <><span className="spin" /> Analyzing…</> : "🔍 Predict"}
            </button>
          </div>
        </form>

        {/* ── API error */}
        {apiErr && <div className="api-err">⚠️ {apiErr}</div>}

        {/* ── Result card */}
        {result && (
          <div className={[
            "result",
            show       ? "result--in"  : "",
            isHighRisk ? "result--high" : "result--low",
          ].join(" ")}>

            <div className="res-icon">{isHighRisk ? "🔴" : "🟢"}</div>

            <div className="res-body">
              <p className="res-risk-label">{isHighRisk ? "HIGH RISK" : "LOW RISK"}</p>
              <p className="res-verdict">
                {isHighRisk
                  ? "Heart disease likely — clinical follow-up recommended"
                  : "No heart disease detected — continue routine monitoring"}
              </p>

              <div className="res-scores">
                <div className="res-score-item">
                  <span className="res-score-key">Prediction</span>
                  <span className="res-score-val">{result.prediction}</span>
                </div>
                <div className="res-divider" />
                <div className="res-score-item">
                  <span className="res-score-key">Risk Score</span>
                  {/* ✅ formatted to 2 decimal places */}
                  <span className="res-score-val">{(result.risk_score * 100).toFixed(2)}%</span>
                </div>
              </div>

              <div className="res-bar-wrap">
                <div className="res-bar-track">
                  <div
                    className="res-bar-fill"
                    style={{ width: `${(result.risk_score * 100).toFixed(2)}%` }}
                  />
                </div>
                <span className="res-bar-pct">{(result.risk_score * 100).toFixed(2)}%</span>
              </div>

              {/* Explainable AI panel — only shown if backend returns factors */}
              {(result?.risk_factors || result?.protective_factors) && (
                <ExplanationPanel result={result} />
              )}
            </div>
          </div>
        )}

        {/* ── Doctor Dashboard — only shown if history exists */}
        {history.length > 0 && (
          <DoctorDashboard
            history={history}
            filter={filter}
            setFilter={setFilter}
          />
        )}

        <p className="disclaimer">
          ⚕ For clinical decision support only · POST → localhost:3000/predict
        </p>

      </main>
    </div>
  );
}