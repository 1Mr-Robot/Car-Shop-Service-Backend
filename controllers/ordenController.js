// controllers/ordenController.js
const pool = require("../db");

/**
 * GET /api/v1/ordenes
 * Obtiene órdenes filtradas, ordenadas y paginadas.
 * Da formato exacto al JSON esperado por el Frontend.
 */
const getOrdenes = async (req, res) => {
    try {
        // 1. Extraer Query Parameters (Filtros, Ordenamiento y Paginación)
        const { mecanico_id, estatus_servicio, sort, limit, page } = req.query;

        // Configuraciones por defecto para Paginación
        const limitNum = parseInt(limit) || 10;
        const pageNum = parseInt(page) || 1;
        const offset = (pageNum - 1) * limitNum;

        // 2. Construcción Dinámica de la Consulta SQL
        let query = `
            SELECT 
                o.id::TEXT,
                v.anio::TEXT AS "vehicleYear",
                v.marca AS "vehicleBrand",
                v.modelo AS "vehicleModel",
                v.matricula AS "vehiclePlate",
                v.color AS "vehicleColor",
                c.nombre || ' ' || c.apellido_paterno AS "ownerName",
                o.kilometraje || ' km' AS "vehicleMileage",
                TO_CHAR(o.fecha_inicio, 'HH12:MI AM') AS "since",
                TO_CHAR(o.fecha_inicio, 'DD/MM/YYYY, HH12:MI AM') AS "time",
                o.notas_cliente AS "notes",
                -- Magia de Postgres: Anidamos los servicios como un arreglo de objetos JSON
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', os.id::TEXT,
                            'title', COALESCE(s.nombre, os.descripcion_personalizada),
                            'status', os.estatus
                        )
                    )
                    FROM orden_servicio os
                    LEFT JOIN servicio s ON os.id_servicio = s.id
                    WHERE os.id_orden = o.id
                ), '[]'::json) AS services
            FROM orden o
            JOIN vehiculo v ON o.id_vehiculo = v.id
            JOIN cliente c ON v.id_cliente = c.id
            WHERE 1=1
        `;

        const queryParams = [];
        let paramIndex = 1;

        // Filtro: Mecánico (Soporta si envían el Firebase UID)
        if (mecanico_id) {
            query += ` AND o.id_mecanico = (SELECT id FROM usuario WHERE firebase_uid = $${paramIndex})`;
            queryParams.push(mecanico_id);
            paramIndex++;
        }

        // Filtro: Estatus de los servicios de la orden (Usa EXISTS para evaluar sub-tablas)
        if (estatus_servicio) {
            query += ` AND EXISTS (
                SELECT 1 FROM orden_servicio os2 
                WHERE os2.id_orden = o.id AND os2.estatus = $${paramIndex}
            )`;
            queryParams.push(estatus_servicio);
            paramIndex++;
        }

        // Ordenamiento (Sorting)
        if (sort === 'fecha_inicio_asc') {
            query += ` ORDER BY o.fecha_inicio ASC`;
        } else if (sort === 'fecha_fin_desc') {
            query += ` ORDER BY o.fecha_fin DESC`;
        } else {
            query += ` ORDER BY o.fecha_inicio DESC`; // Por defecto, lo más reciente primero
        }

        // Paginación (Limit & Offset)
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limitNum, offset);

        // 3. Ejecutar la consulta
        const result = await pool.query(query, queryParams);

        // 4. Enviar respuesta exitosa (200 OK)
        res.status(200).json({
            data: result.rows,
            meta: {
                page: pageNum,
                limit: limitNum,
                count: result.rows.length
            }
        });

    } catch (err) {
        console.error("Error en getOrdenes:", err);
        res.status(500).json({ error: "Error interno del servidor al obtener las órdenes" });
    }
};

/**
 * PATCH /api/v1/ordenes/:id/servicios/:servicioId
 * Actualiza parcialmente el estatus de un servicio (Idempotente).
 */
const updateServiceStatus = async (req, res) => {
    try {
        const { id, servicioId } = req.params;
        const { estatus } = req.body;

        // Validamos que el estatus sea válido según el CHECK constraint de la BD
        const estatusValidos = ['Pendiente', 'En Progreso', 'Finalizado'];
        if (!estatusValidos.includes(estatus)) {
            return res.status(400).json({ error: "Estatus no válido" });
        }

        const query = `
            UPDATE orden_servicio 
            SET estatus = $1 
            WHERE id_orden = $2 AND id = $3 
            RETURNING *;
        `;
        const result = await pool.query(query, [estatus, id, servicioId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Servicio no encontrado en esta orden" });
        }

        res.status(200).json({ 
            message: "Estatus actualizado correctamente", 
            data: result.rows[0] 
        });

    } catch (err) {
        console.error("Error en updateServiceStatus:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

/**
 * POST /api/v1/ordenes/:id/servicios
 * Crea nuevos recursos subordinados (Agrega servicios a la orden).
 */
const addServices = async (req, res) => {
    try {
        const { id } = req.params;
        const { servicios } = req.body; // Esperamos un arreglo de IDs: [1, 2, 5]

        if (!servicios || servicios.length === 0) {
            return res.status(400).json({ error: "No se proporcionaron servicios para agregar" });
        }

        // Magia SQL: Insertamos múltiples filas usando unnest para iterar el arreglo
        const query = `
            INSERT INTO orden_servicio (id_orden, id_servicio)
            SELECT $1, unnest($2::int[])
            RETURNING *;
        `;
        const result = await pool.query(query, [id, servicios]);

        res.status(201).json({ 
            message: "Servicios agregados a la orden", 
            data: result.rows 
        });

    } catch (err) {
        console.error("Error en addServices:", err);
        res.status(500).json({ error: "Error interno del servidor al agregar servicios" });
    }
};

/**
 * POST /api/v1/ordenes/:id/productos
 * Crea nuevos recursos subordinados (Agrega productos a la orden calculando su precio actual).
 */
const addProducts = async (req, res) => {
    try {
        const { id } = req.params;
        const { productos } = req.body; // Esperamos un arreglo de IDs: [3, 7]

        if (!productos || productos.length === 0) {
            return res.status(400).json({ error: "No se proporcionaron productos para agregar" });
        }

        // Magia SQL: Insertamos leyendo el precio_venta directamente de la tabla producto
        const query = `
            INSERT INTO orden_producto (id_orden, id_producto, cantidad, precio_unitario, subtotal)
            SELECT 
                $1, 
                p.id, 
                1, -- Por defecto agregamos 1 unidad
                p.precio_venta, 
                p.precio_venta * 1 
            FROM producto p
            WHERE p.id = ANY($2::int[])
            RETURNING *;
        `;
        const result = await pool.query(query, [id, productos]);

        res.status(201).json({ 
            message: "Productos agregados a la orden", 
            data: result.rows 
        });

    } catch (err) {
        console.error("Error en addProducts:", err);
        res.status(500).json({ error: "Error interno del servidor al agregar productos" });
    }
};

// No olvides exportar las nuevas funciones actualizando el module.exports al final del archivo
module.exports = {
    getOrdenes,
    updateServiceStatus,
    addServices,
    addProducts
};