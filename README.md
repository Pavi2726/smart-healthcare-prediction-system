# 🏥 Smart Healthcare Prediction System

A full-stack AI-based web application that predicts the risk of heart disease using Machine Learning.

---

## 🚀 Tech Stack

* **Frontend:** React.js
* **Backend:** Node.js (Express)
* **ML Service:** Python (Flask)
* **Model:** Logistic Regression (scikit-learn)
* **Explainability:** SHAP

---

## 🧠 Project Overview

This system allows users (doctors/patients) to input clinical parameters and receive:

* Heart disease prediction (0 / 1)
* Risk score (probability)
* Explainable AI insights (feature importance)

---

## 🔄 System Architecture

Frontend (React)
⬇
Backend (Node.js API)
⬇
ML Service (Flask API)
⬇
Machine Learning Model

---

## 📊 Input Features

The model takes 13 clinical parameters:

* age
* sex
* cp (chest pain type)
* trestbps (resting blood pressure)
* chol (cholesterol)
* fbs (fasting blood sugar)
* restecg (ECG results)
* thalach (max heart rate)
* exang (exercise-induced angina)
* oldpeak (ST depression)
* slope
* ca (major vessels)
* thal

---

## 📤 Output

```json
{
  "prediction": 0,
  "risk_score": 0.25
}
```

* **Prediction:**

  * 0 → Low Risk
  * 1 → High Risk

* **Risk Score:** Probability of heart disease

---

## ⚙️ Setup Instructions

### 🔹 1. Clone Repository

```bash
git clone https://github.com/Pavi2726/smart-healthcare-prediction-system
cd Healthcare-Prediction-system
```

---

### 🔹 2. Run ML Service

```bash
cd ml-service
pip install -r requirements.txt
python app.py
```

Runs at: http://127.0.0.1:5000

---

### 🔹 3. Run Backend

```bash
cd backend
npm install
node server.js
```

Runs at: http://localhost:3000

---

### 🔹 4. Run Frontend

```bash
cd frontend/my-app
npm install
npm start
```

Runs at: http://localhost:3001

---

## 🧪 API Endpoint

### POST /predict

```json
{
  "age": 63,
  "sex": 1,
  "cp": 3,
  "trestbps": 145,
  "chol": 233,
  "fbs": 1,
  "restecg": 0,
  "thalach": 150,
  "exang": 0,
  "oldpeak": 2.3,
  "slope": 0,
  "ca": 0,
  "thal": 1
}
```

---

## 📈 Features Implemented

* ✔ Heart disease prediction API
* ✔ Risk score calculation
* ✔ React-based dashboard
* ✔ Input validation & mapping
* ✔ Explainable AI (SHAP)
* ✔ Full-stack integration

---

## 🔮 Future Improvements

* Patient history storage (Database)
* Improved UI/UX
* Model optimization
* Deployment to cloud
