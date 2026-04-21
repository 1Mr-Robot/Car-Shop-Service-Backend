// backend/routes/ventaRoutes.js
const express = require("express");
const router = express.Router();
const ventaController = require("../controllers/ventaController");

// POST /api/v1/ventas
router.post("/", ventaController.createVenta);

module.exports = router;