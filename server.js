const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes"); 
const ordenRoutes = require("./routes/ordenRoutes");
const authenticateToken = require("./middleware/authMiddleware");
const catalogRoutes = require("./routes/catalogRoutes"); 
const clienteRoutes = require("./routes/clienteRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes.js");

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
// Rutas Públicas (No requieren token)
app.use("/api/auth", authRoutes);
// Rutas Privadas
app.use("/api/v1/ordenes", authenticateToken, ordenRoutes); 
app.use("/api/v1", authenticateToken, catalogRoutes);
app.use("/api/v1/clientes", authenticateToken, clienteRoutes);
app.use("/api/v1/usuarios", authenticateToken, usuarioRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});