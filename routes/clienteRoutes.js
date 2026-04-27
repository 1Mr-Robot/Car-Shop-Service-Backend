const express = require("express");
const router = express.Router();
const clienteController = require("../controllers/clienteController");

router.get("/", clienteController.getClientesConVehiculos);
router.post("/", clienteController.createCliente);

module.exports = router;