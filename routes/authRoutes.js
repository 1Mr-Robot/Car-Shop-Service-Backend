const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Cuando el frontend alcance POST /api/auth/verify, se ejecuta la funcion verifyUser
router.post("/verify", authController.verifyUser);

module.exports = router;