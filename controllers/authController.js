const pool = require("../db");

const verifyUser = async (req, res) => {
    try {
        // 1. Grab the UID sent from the frontend Expo app
        const { firebase_uid } = req.body;

        if (!firebase_uid) {
            return res.status(400).json({ error: "El firebase_uid es requerido." });
        }

        // 2. Query the database. 
        // We use a JOIN to get the actual name of the role (e.g., 'Mecánico') instead of just the id_rol number.
        const query = `
            SELECT 
                u.id, 
                u.firebase_uid, 
                u.nombre, 
                u.apellido_paterno, 
                u.correo, 
                r.nombre AS rol
            FROM usuario u
            JOIN rol r ON u.id_rol = r.id
            WHERE u.firebase_uid = $1
        `;
        
        const result = await pool.query(query, [firebase_uid]);

        // 3. If the array is empty, the user exists in Firebase but NOT in our PostgreSQL database
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: "Usuario no encontrado en la base de datos del taller. Contacta a tu jefe." 
            });
        }

        // 4. Success! Send the user data and role back to the frontend
        const user = result.rows[0];
        res.json({
            message: "Usuario verificado exitosamente",
            user: user
        });

    } catch (err) {
        console.error("Error en verifyUser:", err.message);
        res.status(500).json({ error: "Error del servidor al verificar el usuario" });
    }
};

module.exports = {
    verifyUser
};