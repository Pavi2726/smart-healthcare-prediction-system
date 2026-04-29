const mysql   = require("mysql2");
const express = require("express");
const axios   = require("axios");
const cors    = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ── DB connection ──────────────────────────────────────────────
const db = mysql.createConnection({
  host:     "localhost",
  user:     "root",
  password: "Janu@gayi27",
  database: "healthcare"
});

db.connect(err => {
  if (err) { console.error("❌ MySQL connection failed:", err); return; }
  console.log("✅ MySQL Connected");
});

// ── POST /predict ──────────────────────────────────────────────
app.post("/predict", async (req, res) => {
  try {
    // Step 1: Call Flask — get the FULL response
    const flaskRes = await axios.post("http://127.0.0.1:5000/predict", req.body);
    const result   = flaskRes.data;
    // result has: prediction, risk_score, explanation,
    //             shap_scores, verdict, risk_factors, protective_factors

    // Step 2: Build duplicate-check values from input
    const inputValues = [
      req.body.age,      req.body.sex,    req.body.cp,
      req.body.trestbps, req.body.chol,   req.body.fbs,
      req.body.restecg,  req.body.thalach, req.body.exang,
      req.body.oldpeak,  req.body.slope,  req.body.ca,
      req.body.thal
    ];

    const checkQuery = `
      SELECT id FROM predictions
      WHERE age=? AND sex=? AND cp=? AND trestbps=? AND chol=?
        AND fbs=? AND restecg=? AND thalach=? AND exang=?
        AND oldpeak=? AND slope=? AND ca=? AND thal=?
      LIMIT 1
    `;

    db.query(checkQuery, inputValues, (checkErr, rows) => {
      if (checkErr) {
        console.error("❌ Duplicate check failed:", checkErr);
        // DB error — still return the full prediction to frontend
        return res.json({ ...result, stored: false, message: "DB check failed" });
      }

      if (rows.length > 0) {
        // ── Duplicate found — skip insert, still return FULL result ──
        console.log("⚠️  Duplicate entry — skipping insert");
        return res.json({ ...result, stored: false, message: "Duplicate — not stored" });
      }

      // ── Not a duplicate — insert into DB ──
      const insertQuery = `
        INSERT INTO predictions
          (age, sex, cp, trestbps, chol, fbs, restecg, thalach,
           exang, oldpeak, slope, ca, thal, prediction, risk_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const insertValues = [...inputValues, result.prediction, result.risk_score];

      db.query(insertQuery, insertValues, (insertErr) => {
        if (insertErr) {
          console.error("❌ Insert error:", insertErr);
          // Insert failed — still return full prediction
          return res.json({ ...result, stored: false, message: "Insert failed" });
        }

        console.log("✅ Saved to DB");
        return res.json({ ...result, stored: true, message: "Stored successfully" });
      });
    });

  } catch (error) {
    console.error("❌ Flask error:", error.message);
    res.status(500).json({ error: "Error connecting to ML service" });
  }
});

// ── GET /history ───────────────────────────────────────────────
app.get("/history", (req, res) => {
  db.query(
    "SELECT * FROM predictions ORDER BY created_at DESC",
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error fetching history" });
      res.json(rows);
    }
  );
});

app.listen(3000, () => console.log("🚀 Backend running on http://localhost:3000"));