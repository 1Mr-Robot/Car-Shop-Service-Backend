const pool = require("../db");

const createCliente = async (req, res) => {
    try {
        const { nombre, apellido_paterno, apellido_materno, rfc, celular, correo, direccion } = req.body;

        if (!nombre || !apellido_paterno || !celular) {
            return res.status(400).json({ error: "Nombre, apellido paterno y celular son obligatorios." });
        }

        const query = `
            INSERT INTO cliente (nombre, apellido_paterno, apellido_materno, rfc, celular, correo, direccion)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, nombre, apellido_paterno, celular;
        `;
        const values = [nombre, apellido_paterno, apellido_materno || null, rfc || null, celular, correo || null, direccion || null];
        const result = await pool.query(query, values);

        res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        console.error("Error en createCliente:", error);
        if (error.code === "23505") {
            return res.status(400).json({ error: "El cliente ya existe con ese RFC o celular." });
        }
        res.status(500).json({ error: "Error al crear cliente." });
    }
};

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

module.exports = { getClientesConVehiculos, createCliente };