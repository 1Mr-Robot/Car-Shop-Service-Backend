// routes/ordenRoutes.js
const express = require("express");
const router = express.Router();
const ordenController = require("../controllers/ordenController");

// ==========================================
// RUTAS RESTful PARA ÓRDENES (/api/v1/ordenes)
// ==========================================

// GET /api/v1/ordenes -> Obtener lista de órdenes (soporta filtros, sort y paginación)
router.get("/", ordenController.getOrdenes);

// Rutas Interactivas (PATCH y POST)
router.patch("/:id/servicios/:servicioId", ordenController.updateServiceStatus);
router.post("/:id/servicios", ordenController.addServices);
router.post("/:id/productos", ordenController.addProducts);
router.post("/", ordenController.createMasterOrder);
router.patch("/:id/finalizar", ordenController.finalizeOrder);
module.exports = router;