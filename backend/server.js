
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Janu@gayi27",
  database: "healthcare"
});

db.connect(err => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("MySQL Connected");
});


const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

app.post("/predict", async (req, res) => {
  try {
    const response = await axios.post("http://127.0.0.1:5000/predict", req.body);

    const result = response.data;

    const values = [
      req.body.age,
      req.body.sex,
      req.body.cp,
      req.body.trestbps,
      req.body.chol,
      req.body.fbs,
      req.body.restecg,
      req.body.thalach,
      req.body.exang,
      req.body.oldpeak,
      req.body.slope,
      req.body.ca,
      req.body.thal,
      result.prediction,
      result.risk_score
    ];

    db.query(
      `INSERT INTO predictions 
      (age, sex, cp, trestbps, chol, fbs, restecg, thalach, exang, oldpeak, slope, ca, thal, prediction, risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values,
      (err) => {
        if (err) {
          console.error("DB Error:", err);
          return res.status(500).json({ error: "Database error" });
        }

        // send response after saving
        res.json(result);
      }
    );

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error connecting to ML service" });
  }
});

app.get("/history", (req, res) => {
  db.query("SELECT * FROM predictions ORDER BY created_at DESC", (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error fetching history" });
    }
    res.json(results);
  });
});

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
});