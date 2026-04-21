const express = require("express");
const router = express.Router();
const catalogController = require("../controllers/catalogController");

// Estas rutas estarán protegidas por el authMiddleware en server.js
router.get("/servicios", catalogController.getServicios);
router.get("/productos", catalogController.getProductos);

module.exports = router;