import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:3000";
const TOKEN_KEY = "heart_app_token";
const USER_KEY = "heart_app_user";

const FIELDS = [
  { name: "age", label: "Age", type: "number", placeholder: "e.g. 52", min: 1, max: 120 },
  { name: "sex", label: "Sex", type: "select", options: [{ label: "Select", value: "" }, { label: "Male", value: 1 }, { label: "Female", value: 0 }] },
  { name: "cp", label: "Chest Pain Type", type: "select", options: [{ label: "Select", value: "" }, { label: "Typical Angina", value: 0 }, { label: "Atypical Angina", value: 1 }, { label: "Non-Anginal Pain", value: 2 }, { label: "Asymptomatic", value: 3 }] },
  { name: "trestbps", label: "Resting BP", type: "number", placeholder: "e.g. 130", min: 50, max: 300 },
  { name: "chol", label: "Cholesterol", type: "number", placeholder: "e.g. 210", min: 100, max: 600 },
  { name: "fbs", label: "FBS > 120", type: "select", options: [{ label: "Select", value: "" }, { label: "Yes", value: 1 }, { label: "No", value: 0 }] },
  { name: "restecg", label: "Resting ECG", type: "select", options: [{ label: "Select", value: "" }, { label: "Normal", value: 0 }, { label: "ST-T Abnormal", value: 1 }, { label: "LVH", value: 2 }] },
  { name: "thalach", label: "Max Heart Rate", type: "number", placeholder: "e.g. 150", min: 50, max: 250 },
  { name: "exang", label: "Exercise Angina", type: "select", options: [{ label: "Select", value: "" }, { label: "Yes", value: 1 }, { label: "No", value: 0 }] },
  { name: "oldpeak", label: "Oldpeak", type: "number", placeholder: "e.g. 1.2", min: 0, max: 10, step: 0.1 },
  { name: "slope", label: "ST Slope", type: "select", options: [{ label: "Select", value: "" }, { label: "Upsloping", value: 0 }, { label: "Flat", value: 1 }, { label: "Downsloping", value: 2 }] },
  { name: "ca", label: "Major Vessels", type: "select", options: [{ label: "Select", value: "" }, { label: "0", value: 0 }, { label: "1", value: 1 }, { label: "2", value: 2 }, { label: "3", value: 3 }] },
  { name: "thal", label: "Thalassemia", type: "select", options: [{ label: "Select", value: "" }, { label: "Normal", value: 1 }, { label: "Fixed Defect", value: 2 }, { label: "Reversible Defect", value: 3 }] }
];

const emptyForm = Object.fromEntries(FIELDS.map((f) => [f.name, ""]));

function getRoute() {
  const p = window.location.pathname.toLowerCase();
  if (p === "/login") return "login";
  if (p === "/signup") return "signup";
  if (p === "/dashboard") return "dashboard";
  return "predict";
}

function go(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function AuthPage({ mode, authForm, setAuthForm, authLoading, authError, onSubmit }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-title"><span className="heart-logo">❤</span> CardioSense AI</h1>
        <p>{mode === "login" ? "Sign in to continue" : "Create a secure account"}</p>
        <form onSubmit={onSubmit} className="auth-form">
          {mode === "signup" && (
            <input type="text" placeholder="Full Name" value={authForm.name} onChange={(e) => setAuthForm((p) => ({ ...p, name: e.target.value }))} required />
          )}
          <input type="email" placeholder="Email" value={authForm.email} onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))} required />
          <input type="password" placeholder="Password" value={authForm.password} onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))} required />
          <button disabled={authLoading}>{authLoading ? "Please wait..." : mode === "login" ? "Login" : "Sign Up"}</button>
          {authError && <p className="error">{authError}</p>}
        </form>
        <p className="switch-link">
          {mode === "login" ? (
            <>New user? <button type="button" onClick={() => go("/signup")}>Create account</button></>
          ) : (
            <>Already have account? <button type="button" onClick={() => go("/login")}>Go to login</button></>
          )}
        </p>
      </div>
    </div>
  );
}

function Dashboard({ history, filter, setFilter }) {
  const filtered = history.filter((h) => (filter === "ALL" ? true : filter === "HIGH" ? h.prediction === 1 : h.prediction === 0));
  const totalHigh = history.filter((h) => h.prediction === 1).length;
  const totalLow = history.filter((h) => h.prediction === 0).length;

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Doctor Dashboard</h3>
        <select className="control" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">All</option>
          <option value="HIGH">High Risk</option>
          <option value="LOW">Low Risk</option>
        </select>
      </div>
      <div className="stats">
        <div className="stat"><span>Total</span><strong>{history.length}</strong></div>
        <div className="stat high"><span>High</span><strong>{totalHigh}</strong></div>
        <div className="stat low"><span>Low</span><strong>{totalLow}</strong></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Age</th><th>Chol</th><th>Prediction</th><th>Risk</th><th>Date</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="5" className="empty">No records found.</td></tr>
            ) : filtered.map((item, i) => (
              <tr key={i}>
                <td>{item.age}</td>
                <td>{item.chol}</td>
                <td><span className={`badge ${item.prediction === 1 ? "high" : "low"}`}>{item.prediction === 1 ? "High" : "Low"}</span></td>
                <td>{(item.risk_score * 100).toFixed(2)}%</td>
                <td>{new Date(item.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExplanationBlock({ result }) {
  const riskFactors = result?.risk_factors || [];
  const protectiveFactors = result?.protective_factors || [];

  return (
    <div className="explain-wrap">
      {result?.verdict && <p className="explain-verdict">{result.verdict}</p>}

      {riskFactors.length > 0 && (
        <div className="explain-section">
          <h4 className="explain-title risk">Risk Drivers</h4>
          <div className="explain-list">
            {riskFactors.slice(0, 6).map((item, idx) => (
              <div className="explain-item risk" key={`risk-${idx}`}>
                <div className="explain-item-head">
                  <strong>{item.feature}</strong>
                  <span className="impact plus">+{Number(item.shap_impact).toFixed(3)}</span>
                </div>
                <p>{item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {protectiveFactors.length > 0 && (
        <div className="explain-section">
          <h4 className="explain-title protect">Protective Drivers</h4>
          <div className="explain-list">
            {protectiveFactors.slice(0, 6).map((item, idx) => (
              <div className="explain-item protect" key={`protect-${idx}`}>
                <div className="explain-item-head">
                  <strong>{item.feature}</strong>
                  <span className="impact minus">{Number(item.shap_impact).toFixed(3)}</span>
                </div>
                <p>{item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(getRoute());
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [currentUser, setCurrentUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    const onPop = () => setRoute(getRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!token && (route === "predict" || route === "dashboard")) go("/login");
    if (token && (route === "login" || route === "signup")) go("/");
  }, [token, route]);

  const fetchHistory = async (jwtToken = token) => {
    if (!jwtToken) {
      setHistory([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/history`, { headers: { Authorization: `Bearer ${jwtToken}` } });
      if (res.status === 401 || res.status === 403) {
        setHistory([]);
        return;
      }
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("History fetch error:", err);
    }
  };

  useEffect(() => { fetchHistory(); }, [token]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const signup = route === "signup";
      const payload = signup
        ? { name: authForm.name, email: authForm.email, password: authForm.password }
        : { email: authForm.email, password: authForm.password };
      const endpoint = signup ? "/auth/register" : "/auth/login";
      const { data } = await axios.post(`${API_BASE}${endpoint}`, payload);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setToken(data.token);
      setCurrentUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
      go("/");
    } catch (err) {
      setAuthError(err?.response?.data?.error || "Authentication failed");
    }
    setAuthLoading(false);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken("");
    setCurrentUser(null);
    setHistory([]);
    go("/login");
  };

  const validate = () => {
    const errs = {};
    FIELDS.forEach((f) => {
      const v = formData[f.name];
      if (v === "" || v === undefined) errs[f.name] = "Required";
      else if (f.type === "number") {
        const n = parseFloat(v);
        if (Number.isNaN(n)) errs[f.name] = "Enter a number";
        else if (f.min != null && n < f.min) errs[f.name] = `Min ${f.min}`;
        else if (f.max != null && n > f.max) errs[f.name] = `Max ${f.max}`;
      }
    });
    return errs;
  };

  const submitPredict = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    setApiErr("");
    setResult(null);
    const payload = Object.fromEntries(Object.entries(formData).map(([k, v]) => [k, Number(v)]));
    try {
      const { data } = await axios.post(`${API_BASE}/predict`, payload);
      setResult(data);
      fetchHistory();
    } catch (err) {
      setApiErr(err?.response?.data?.message || "Cannot reach server. Ensure backend and ML service are running.");
    }
    setLoading(false);
  };

  const filled = useMemo(() => FIELDS.filter((f) => formData[f.name] !== "").length, [formData]);

  if (route === "login" || route === "signup") {
    return (
      <AuthPage
        mode={route}
        authForm={authForm}
        setAuthForm={setAuthForm}
        authLoading={authLoading}
        authError={authError}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">❤</div>
          <div>
            <h2>CardioSense EHR</h2>
            <p>Clean and secure clinical prediction workflow</p>
          </div>
        </div>
        <div className="top-actions">
          <nav className="top-nav">
            <button
              className={`nav-btn ${route === "predict" ? "active" : ""}`}
              onClick={() => go("/")}
              type="button"
            >
              Prediction
            </button>
            <button
              className={`nav-btn ${route === "dashboard" ? "active" : ""}`}
              onClick={() => go("/dashboard")}
              type="button"
            >
              Dashboard
            </button>
          </nav>
          {currentUser && <span className="chip">{currentUser.name}</span>}
          <button className="btn ghost" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="layout">
        {route === "predict" && (
          <>
            <section className="panel">
              <div className="panel-head"><h3>Prediction Interface</h3><span className="chip">{filled}/{FIELDS.length}</span></div>
              <form onSubmit={submitPredict}>
                <div className="grid">
                  {FIELDS.map((f) => (
                    <div key={f.name} className="field">
                      <label>{f.label} {errors[f.name] && <span className="err">{errors[f.name]}</span>}</label>
                      {f.type === "select" ? (
                        <select className="control" name={f.name} value={formData[f.name]} onChange={(e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }))}>
                          {f.options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input className="control" type="number" name={f.name} value={formData[f.name]} placeholder={f.placeholder} min={f.min} max={f.max} step={f.step || 1} onChange={(e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="actions">
                  <button type="button" className="btn ghost" onClick={() => { setFormData(emptyForm); setErrors({}); setResult(null); setApiErr(""); }}>Reset</button>
                  <button type="submit" className="btn primary" disabled={loading}>{loading ? "Analyzing..." : "Predict"}</button>
                </div>
              </form>
              {apiErr && <p className="error">{apiErr}</p>}
            </section>

            <section className="panel">
              <h3>Result</h3>
              {!result ? <p className="muted">Submit patient details to view prediction.</p> : (
                <>
                  <div className={`result ${result.prediction === 1 ? "high" : "low"}`}>
                    <p>{result.prediction === 1 ? "High Risk" : "Low Risk"}</p>
                    <strong>{(result.risk_score * 100).toFixed(2)}%</strong>
                  </div>
                  <ExplanationBlock result={result} />
                </>
              )}
            </section>
          </>
        )}

        {route === "dashboard" && (
          <Dashboard history={history} filter={filter} setFilter={setFilter} />
        )}
      </main>
    </div>
  );
}
