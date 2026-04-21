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

module.exports = { getMecanicos };