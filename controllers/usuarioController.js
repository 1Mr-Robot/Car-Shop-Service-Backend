const pool = require("../db");

const getMecanicos = async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id::TEXT, 
                u.nombre || ' ' || u.apellido_paterno AS name, 
                'General' AS specialty 
            FROM usuario u
            JOIN rol r ON u.id_rol = r.id
            WHERE r.nombre = 'Mecánico'
            ORDER BY u.nombre ASC;
        `;
        const result = await pool.query(query);
        res.status(200).json({ data: result.rows });
    } catch (error) {
        console.error("Error en getMecanicos:", error);
        res.status(500).json({ error: "Error al obtener mecánicos." });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const query = `
            SELECT 
                nombre, 
                apellido_paterno
            FROM usuario
            WHERE id = $1
        `;
        const result = await pool.query(query, [req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.status(200).json({ data: result.rows[0] });
    } catch (error) {
        console.error("Error en getCurrentUser:", error);
        res.status(500).json({ error: "Error al obtener usuario." });
    }
};

module.exports = { getMecanicos, getCurrentUser };