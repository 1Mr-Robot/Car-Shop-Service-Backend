const express = require("express");
const router = express.Router();
const productoController = require("../controllers/productoController");

router.get("/", productoController.getProductos);
router.post("/", productoController.createProducto);
router.put("/:id", productoController.updateProducto);
router.put("/:id/stock", productoController.updateStock);

module.exports = router;