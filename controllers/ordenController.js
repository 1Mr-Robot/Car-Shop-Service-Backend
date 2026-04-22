// controllers/ordenController.js
const pool = require("../db");

/**
 * GET /api/v1/ordenes
 * Obtiene órdenes filtradas, ordenadas y paginadas.
 * Implementa RBAC (Role-Based Access Control) con req.user
 */
const getOrdenes = async (req, res) => {
    try {
        // 1. Extraer Query Parameters (Ignoramos mecanico_id por seguridad, usaremos req.user)
        const { estatus_servicio, sort, limit, page, mecanico_id } = req.query;
        const usuarioActual = req.user; // Inyectado por authMiddleware

        // Configuraciones por defecto para Paginación
        const limitNum = parseInt(limit) || 10;
        const pageNum = parseInt(page) || 1;
        const offset = (pageNum - 1) * limitNum;

        // 2. Construcción Dinámica de la Consulta SQL
        // SE AÑADIÓ: Un JOIN a usuario 'm' para obtener mechanicName (Requerido por Frontend para Recepcionista)
        let query = `
            SELECT 
                o.id::TEXT,
                v.anio::TEXT AS "vehicleYear",
                v.marca AS "vehicleBrand",
                v.modelo AS "vehicleModel",
                v.matricula AS "vehiclePlate",
                v.color AS "vehicleColor",
                v.niv AS "vehicleVIN",
                c.nombre || ' ' || c.apellido_paterno AS "ownerName",
                m.nombre || ' ' || m.apellido_paterno AS "mechanicName", 
                o.kilometraje || ' km' AS "vehicleMileage",

                -- Variables Legacy para OrderCard
                TO_CHAR(o.fecha_inicio, 'HH12:MI AM') AS "since",
                TO_CHAR(o.fecha_inicio, 'DD/MM/YYYY, HH12:MI AM') AS "time",

                -- Variables Limpias para Detalles de Orden (Inicio y Fin)
                TO_CHAR(o.fecha_inicio, 'DD/MM/YYYY') AS "startDate",
                TO_CHAR(o.fecha_inicio, 'HH12:MI AM') AS "startTime",
                TO_CHAR(o.fecha_fin, 'DD/MM/YYYY') AS "endDate",
                TO_CHAR(o.fecha_fin, 'HH12:MI AM') AS "endTime",

                o.notas_cliente AS "notes",

                -- JSON Anidado 1: Servicios
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

                -- JSON Anidado 2: Productos Utilizados
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', p.id::TEXT,
                            'name', p.nombre,
                            'brand', p.marca,
                            'quantity', op.cantidad
                        )
                    )
                    FROM orden_producto op
                    JOIN producto p ON op.id_producto = p.id
                    WHERE op.id_orden = o.id
                ), '[]'::json) AS products

            FROM orden o
            JOIN vehiculo v ON o.id_vehiculo = v.id
            JOIN cliente c ON v.id_cliente = c.id
            JOIN usuario m ON o.id_mecanico = m.id
            WHERE 1=1
        `;

        const queryParams = [];
        let paramIndex = 1;

        // ==========================================
        // 3. CAPA DE SEGURIDAD RBAC (Role-Based Access Control)
        // ==========================================
        if (usuarioActual.rol === 'Mecánico') {
            // Regla Estricta: Un mecánico SOLO ve sus propias órdenes. 
            // Usamos el ID interno de Postgres que sacamos del middleware de forma segura.
            query += ` AND o.id_mecanico = $${paramIndex}`;
            queryParams.push(usuarioActual.id);
            paramIndex++;
        } else if (usuarioActual.rol === 'Recepcionista') {
            // Regla Administrador: Ve todo. 
            // Opcional: Si el recepcionista quiere filtrar por un mecánico en particular desde la UI
            if (mecanico_id) {
                query += ` AND m.firebase_uid = $${paramIndex}`;
                queryParams.push(mecanico_id);
                paramIndex++;
            }
        }

        // ==========================================
        // 4. Filtros Generales
        // ==========================================
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
            query += ` ORDER BY o.fecha_fin DESC NULLS LAST`;
        } else {
            query += ` ORDER BY o.fecha_inicio DESC`; 
        }

        // Paginación (Limit & Offset)
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limitNum, offset);

        const result = await pool.query(query, queryParams);

        res.status(200).json({
            data: result.rows,
            meta: { page: pageNum, limit: limitNum, count: result.rows.length }
        });

    } catch (err) {
        console.error("Error en getOrdenes:", err);
        res.status(500).json({ error: "Error interno del servidor al obtener las órdenes" });
    }
};

/**
 * Función auxiliar de seguridad: Verifica si un mecánico tiene permiso para modificar esta orden
 */
const verifyOrderOwnership = async (ordenId, usuarioActual) => {
    if (usuarioActual.rol === 'Recepcionista') return true; // El admin puede tocar todo
    
    const query = `SELECT id FROM orden WHERE id = $1 AND id_mecanico = $2`;
    const result = await pool.query(query, [ordenId, usuarioActual.id]);
    return result.rowCount > 0; // true si es suya, false si intenta hackear/tocar otra
};

/**
 * PATCH /api/v1/ordenes/:id/servicios/:servicioId
 */
const updateServiceStatus = async (req, res) => {
    try {
        const { id, servicioId } = req.params;
        const { estatus } = req.body;

        // Validar propiedad de la orden
        const isOwner = await verifyOrderOwnership(id, req.user);
        if (!isOwner) {
            return res.status(403).json({ error: "No tienes permiso para modificar esta orden." });
        }

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

        res.status(200).json({ message: "Estatus actualizado correctamente", data: result.rows[0] });

    } catch (err) {
        console.error("Error en updateServiceStatus:", err);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

/**
 * POST /api/v1/ordenes/:id/servicios
 */
const addServices = async (req, res) => {
    try {
        const { id } = req.params;
        const { servicios } = req.body;

        const isOwner = await verifyOrderOwnership(id, req.user);
        if (!isOwner) return res.status(403).json({ error: "No tienes permiso." });

        if (!servicios || servicios.length === 0) {
            return res.status(400).json({ error: "No se proporcionaron servicios para agregar" });
        }

        const query = `
            INSERT INTO orden_servicio (id_orden, id_servicio)
            SELECT $1, unnest($2::int[])
            RETURNING *;
        `;
        const result = await pool.query(query, [id, servicios]);

        res.status(201).json({ message: "Servicios agregados a la orden", data: result.rows });

    } catch (err) {
        console.error("Error en addServices:", err);
        res.status(500).json({ error: "Error al agregar servicios" });
    }
};

/**
 * POST /api/v1/ordenes/:id/productos
 */
const addProducts = async (req, res) => {
    try {
        const { id } = req.params;
        const { productos } = req.body;

        const isOwner = await verifyOrderOwnership(id, req.user);
        if (!isOwner) return res.status(403).json({ error: "No tienes permiso." });

        if (!productos || productos.length === 0) {
            return res.status(400).json({ error: "No se proporcionaron productos para agregar" });
        }

        const query = `
            INSERT INTO orden_producto (id_orden, id_producto, cantidad, precio_unitario, subtotal)
            SELECT $1, p.id, 1, p.precio_venta, p.precio_venta * 1 
            FROM producto p
            WHERE p.id = ANY($2::int[])
            RETURNING *;
        `;
        const result = await pool.query(query, [id, productos]);

        res.status(201).json({ message: "Productos agregados a la orden", data: result.rows });

    } catch (err) {
        console.error("Error en addProducts:", err);
        res.status(500).json({ error: "Error al agregar productos" });
    }
};

/**
 * POST /api/v1/ordenes
 * Transacción Maestra: Crea la orden y le asigna sus servicios iniciales.
 */
const createMasterOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { id_vehiculo, id_mecanico, kilometraje, fecha_inicio, notas_cliente, servicios } = req.body;
        
        // Limpiamos el kilometraje (ej. "45,000" -> 45000)
        const kmLimpio = parseInt(kilometraje.toString().replace(/,/g, ''), 10) || 0;

        // 1. Insertar la Orden
        const insertOrdenQuery = `
            INSERT INTO orden (id_vehiculo, id_mecanico, kilometraje, fecha_inicio, notas_cliente, total_orden)
            VALUES ($1, $2, $3, $4, $5, 0.00)
            RETURNING id;
        `;
        const ordenResult = await client.query(insertOrdenQuery, [
            id_vehiculo, id_mecanico, kmLimpio, fecha_inicio, notas_cliente || null
        ]);
        const nuevaOrdenId = ordenResult.rows[0].id;

        // 2. Insertar los Servicios asociados
        if (servicios && servicios.length > 0) {
            const insertServiciosQuery = `
                INSERT INTO orden_servicio (id_orden, id_servicio, estatus)
                SELECT $1, unnest($2::int[]), 'Pendiente'
            `;
            await client.query(insertServiciosQuery, [nuevaOrdenId, servicios]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Orden maestra creada", data: { id: nuevaOrdenId } });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error en createMasterOrder:", error);
        res.status(500).json({ error: "Error al crear la orden maestra" });
    } finally {
        client.release();
    }
};

module.exports = {
    getOrdenes,
    updateServiceStatus,
    addServices,
    addProducts, 
    createMasterOrder
};