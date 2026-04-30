require("dotenv").config();
const mysql = require("mysql2");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const JWT_SECRET = process.env.JWT_SECRET || "change_me_in_env";
const ML_SERVICE_URL = process.env.ML_SERVICE_URL;

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

function ensureUsersTable() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(createUsersTable, (err) => {
    if (err) {
      console.error("Users table setup error:", err);
    }
  });
}

db.connect((err) => {
  if (err) {
    console.error("MySQL connection failed:", err);
    return;
  }
  console.log("MySQL Connected");
  ensureUsersTable();
});

app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    db.query(
      "SELECT id FROM users WHERE email = ?",
      [normalizedEmail],
      async (findErr, rows) => {
        if (findErr) {
          console.error(findErr);
          return res.status(500).json({ error: "Database error" });
        }

        if (rows.length > 0) {
          return res.status(409).json({ error: "Email already registered" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        db.query(
          "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
          [name, normalizedEmail, passwordHash],
          (insertErr, result) => {
            if (insertErr) {
              console.error(insertErr);
              return res.status(500).json({ error: "Database error" });
            }

            const token = jwt.sign(
              { id: result.insertId, name, email: normalizedEmail },
              JWT_SECRET,
              { expiresIn: "1d" }
            );

            res.status(201).json({
              message: "User registered successfully",
              token,
              user: { id: result.insertId, name, email: normalizedEmail },
            });
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  db.query(
    "SELECT id, name, email, password_hash FROM users WHERE email = ?",
    [normalizedEmail],
    async (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      if (rows.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = rows[0];
      const passwordOk = await bcrypt.compare(password, user.password_hash);

      if (!passwordOk) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.json({
        message: "Login successful",
        token,
        user: { id: user.id, name: user.name, email: user.email },
      });
    }
  );
});

app.post("/predict", async (req, res) => {
  try {
    if (!ML_SERVICE_URL) {
      return res.status(500).json({ error: "ML_SERVICE_URL is not configured" });
    }

    const flaskRes = await axios.post(`${ML_SERVICE_URL}/predict`, req.body);
    const result = flaskRes.data;

    const inputValues = [
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
        console.error("Duplicate check failed:", checkErr);
        return res.json({ ...result, stored: false, message: "DB check failed" });
      }

      if (rows.length > 0) {
        return res.json({ ...result, stored: false, message: "Duplicate - not stored" });
      }

      const insertQuery = `
        INSERT INTO predictions
          (age, sex, cp, trestbps, chol, fbs, restecg, thalach,
           exang, oldpeak, slope, ca, thal, prediction, risk_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const insertValues = [...inputValues, result.prediction, result.risk_score];

      db.query(insertQuery, insertValues, (insertErr) => {
        if (insertErr) {
          console.error("Insert error:", insertErr);
          return res.json({ ...result, stored: false, message: "Insert failed" });
        }

        return res.json({ ...result, stored: true, message: "Stored successfully" });
      });
    });
  } catch (error) {
    console.error("Flask error:", error.message);
    res.status(500).json({ error: "Error connecting to ML service" });
  }
});

app.get("/history", authenticateToken, (req, res) => {
  db.query("SELECT * FROM predictions ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Error fetching history" });
    }
    res.json(rows);
  });
});

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
});
