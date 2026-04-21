const pool = require("../db");

const getClientesConVehiculos = async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id::TEXT, 
                c.nombre || ' ' || c.apellido_paterno AS name, 
                c.celular AS phone,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', v.id::TEXT,
                            'brand', v.marca,
                            'model', v.modelo,
                            'year', v.anio::TEXT,
                            'plate', v.matricula
                        )
                    ) FILTER (WHERE v.id IS NOT NULL), '[]'::json
                ) AS vehicles
            FROM cliente c
            LEFT JOIN vehiculo v ON c.id = v.id_cliente
            GROUP BY c.id
            ORDER BY c.nombre ASC;
        `;
        const result = await pool.query(query);
        res.status(200).json({ data: result.rows });
    } catch (error) {
        console.error("Error en getClientesConVehiculos:", error);
        res.status(500).json({ error: "Error al obtener clientes." });
    }
};

module.exports = { getClientesConVehiculos };