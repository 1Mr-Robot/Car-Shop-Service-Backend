const pool = require("../db");

const createVehiculo = async (req, res) => {
    try {
        const { id_cliente, marca, modelo, anio, color, matricula, niv } = req.body;

        if (!id_cliente || !marca || !modelo || !anio || !color || !matricula) {
            return res.status(400).json({ error: "Todos los campos excepto NIV son obligatorios." });
        }

        const query = `
            INSERT INTO vehiculo (id_cliente, marca, modelo, anio, color, matricula, niv)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, marca, modelo, anio, matricula;
        `;
        const values = [id_cliente, marca, modelo, anio, color, matricula, niv || null];
        const result = await pool.query(query, values);

        res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        console.error("Error en createVehiculo:", error);
        if (error.code === "23505") {
            return res.status(400).json({ error: "Ya existe un vehículo con esa matrícula o NIV." });
        }
        res.status(500).json({ error: "Error al crear vehículo." });
    }
};

module.exports = { createVehiculo };