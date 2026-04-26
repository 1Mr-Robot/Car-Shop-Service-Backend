const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
router.get("/mecanicos", usuarioController.getMecanicos);
router.get("/yo", usuarioController.getCurrentUser);
module.exports = router;