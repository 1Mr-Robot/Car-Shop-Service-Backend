const express = require("express");
const router = express.Router();
const vehiculoController = require("../controllers/vehiculoController");

router.post("/", vehiculoController.createVehiculo);

module.exports = router;