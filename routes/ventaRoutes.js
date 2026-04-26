// backend/routes/ventaRoutes.js
const express = require("express");
const router = express.Router();
const ventaController = require("../controllers/ventaController");

// POST /api/v1/ventas
router.post("/", ventaController.createVenta);

// GET /api/v1/ventas - Obtener todas las ventas con detalles
router.get("/", ventaController.getAllVentas);

module.exports = router;