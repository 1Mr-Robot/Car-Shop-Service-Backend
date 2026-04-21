const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
router.get("/mecanicos", usuarioController.getMecanicos);
module.exports = router;