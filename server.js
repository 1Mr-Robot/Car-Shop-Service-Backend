const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes"); 

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); 

// Conexión a la db
app.get("/api/test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({
            message: "Conexion a la base de datos exitosa!",
            time: result.rows[0].now
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Database connection failed" });
    }
});

// Route Middlewares
// Cualquier solicitud que comience con /api/auth será gestionada por authRoutes
app.use("/api/auth", authRoutes);


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});