// controllers/ordenController.js
const pool = require("../db");

/**
 * GET /api/v1/ordenes
 * Obtiene órdenes filtradas, ordenadas y paginadas.
 * Implementa RBAC (Role-Based Access Control) con req.user
 */
const getOrdenes = async (req, res) => {
    try {
        const { estatus_servicio, sort, limit, page, mecanico_id } = req.query;
        const usuarioActual = req.user; 

        const limitNum = parseInt(limit) || 10;
        const pageNum = parseInt(page) || 1;
        const offset = (pageNum - 1) * limitNum;

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

                TO_CHAR(o.fecha_inicio, 'HH12:MI AM') AS "since",
                TO_CHAR(o.fecha_inicio, 'DD/MM/YYYY, HH12:MI AM') AS "time",

                TO_CHAR(o.fecha_inicio, 'DD/MM/YYYY') AS "startDate",
                TO_CHAR(o.fecha_inicio, 'HH12:MI AM') AS "startTime",
                TO_CHAR(o.fecha_fin, 'DD/MM/YYYY') AS "endDate",
                TO_CHAR(o.fecha_fin, 'HH12:MI AM') AS "endTime",

                o.notas_cliente AS "notes",

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
                ), '[]'::json) AS services,

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

        if (usuarioActual.rol === 'Mecánico') {
            query += ` AND o.id_mecanico = $${paramIndex}`;
            queryParams.push(usuarioActual.id);
            paramIndex++;
        } else if (usuarioActual.rol === 'Recepcionista') {
            if (mecanico_id) {
                query += ` AND m.firebase_uid = $${paramIndex}`;
                queryParams.push(mecanico_id);
                paramIndex++;
            }
        }

        if (estatus_servicio) {
            query += ` AND EXISTS (
                SELECT 1 FROM orden_servicio os2 
                WHERE os2.id_orden = o.id AND os2.estatus = $${paramIndex}
            )`;
            queryParams.push(estatus_servicio);
            paramIndex++;
        }

        if (sort === 'fecha_inicio_asc') {
            query += ` ORDER BY o.fecha_inicio ASC`;
        } else if (sort === 'fecha_fin_desc') {
            query += ` ORDER BY o.fecha_fin DESC NULLS LAST`;
        } else {
            query += ` ORDER BY o.fecha_inicio DESC`; 
        }

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

const verifyOrderOwnership = async (ordenId, usuarioActual) => {
    if (usuarioActual.rol === 'Recepcionista') return true; 
    const query = `SELECT id FROM orden WHERE id = $1 AND id_mecanico = $2`;
    const result = await pool.query(query, [ordenId, usuarioActual.id]);
    return result.rowCount > 0; 
};

const updateServiceStatus = async (req, res) => {
    try {
        const { id, servicioId } = req.params;
        const { estatus } = req.body;

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
 * [REFACTOR] POST /api/v1/ordenes/:id/servicios-personalizados
 * Implementa Transacción: Inserta el servicio y suma el costo al total_orden.
 */
const addCustomService = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        const { descripcion_personalizada, precio_personalizado } = req.body;

        const isOwner = await verifyOrderOwnership(id, req.user); 
        if (!isOwner) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "No tienes permisos."});
        }

        if (!descripcion_personalizada || precio_personalizado == null) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "La descripción y el precio son obligatorios para un servicio personalizado." });
        }

        // 1. Insertamos el servicio
        const insertQuery = `
            INSERT INTO orden_servicio (id_orden, descripcion_personalizada, precio_personalizado, estatus)
            VALUES ($1, $2, $3, 'Pendiente')
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [id, descripcion_personalizada, precio_personalizado]);

        // 2. Sumamos el costo al total_orden de manera segura
        const updateOrderQuery = `
            UPDATE orden 
            SET total_orden = total_orden + $1 
            WHERE id = $2;
        `;
        await client.query(updateOrderQuery, [precio_personalizado, id]);

        await client.query('COMMIT');
        res.status(201).json({ message: "Servicio personalizado añadido y total actualizado.", data: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error en addCustomService:", err);
        res.status(500).json({ error: "Error al crear el servicio personalizado." });
    } finally {
        client.release();
    }
};

/**
 * [REFACTOR] POST /api/v1/ordenes/:id/productos
 * Añade productos, resta stock, calcula subtotales, y consolida la suma en el total_orden.
 */
const addProducts = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { productos } = req.body;

        const isOwner = await verifyOrderOwnership(id, req.user);
        if (!isOwner) {
            return res.status(403).json({ error: "No tienes permiso." });
        }

        if (!productos || !Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ error: "La lista de productos no es válida." });
        }

        await client.query('BEGIN');
        const insertedProducts = [];
        let totalAmountToAdd = 0; // Acumulador de costos

        for (const item of productos) {
            const { id_producto, cantidad } = item;

            if (!id_producto || !cantidad || cantidad <= 0) {
                throw new Error("Datos de producto inválidos en la petición.");
            }

            const stockResult = await client.query(
                `SELECT nombre, cantidad_stock, precio_venta FROM producto WHERE id = $1 FOR UPDATE`,
                [id_producto]
            );

            if (stockResult.rowCount === 0) {
                throw new Error(`El producto con ID ${id_producto} no existe en el catálogo.`);
            }

            const productoDb = stockResult.rows[0];

            if (productoDb.cantidad_stock < cantidad) {
                throw new Error(`Stock insuficiente para "${productoDb.nombre}". Solo quedan ${productoDb.cantidad_stock} unidades.`);
            }

            await client.query(
                `UPDATE producto SET cantidad_stock = cantidad_stock - $1 WHERE id = $2`,
                [cantidad, id_producto]
            );

            // Calcular el subtotal y sumar al acumulador global
            const subtotal = productoDb.precio_venta * cantidad;
            totalAmountToAdd += subtotal;

            const insertResult = await client.query(
                `INSERT INTO orden_producto (id_orden, id_producto, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [id, id_producto, cantidad, productoDb.precio_venta, subtotal]
            );

            insertedProducts.push(insertResult.rows[0]);
        }

        // Si se agregaron productos, sumamos el valor completo a la orden maestra en un solo movimiento
        if (totalAmountToAdd > 0) {
            await client.query(
                `UPDATE orden SET total_orden = total_orden + $1 WHERE id = $2`,
                [totalAmountToAdd, id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Productos añadidos, stock descontado y total actualizado.", data: insertedProducts });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error transaccional en addProducts:", err);
        res.status(400).json({ error: err.message || "Error al procesar el inventario." });
    } finally {
        client.release();
    }
};

const createMasterOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { id_vehiculo, id_mecanico, kilometraje, fecha_inicio, notas_cliente, servicios } = req.body;
        const kmLimpio = parseInt(kilometraje.toString().replace(/,/g, ''), 10) || 0;

        const insertOrdenQuery = `
            INSERT INTO orden (id_vehiculo, id_mecanico, kilometraje, fecha_inicio, notas_cliente, total_orden)
            VALUES ($1, $2, $3, $4, $5, 0.00)
            RETURNING id;
        `;
        const ordenResult = await client.query(insertOrdenQuery, [
            id_vehiculo, id_mecanico, kmLimpio, fecha_inicio, notas_cliente || null
        ]);
        const nuevaOrdenId = ordenResult.rows[0].id;

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

const finalizeOrder = async (req, res) => {
    try {
        const { id } = req.params;
        
        const isOwner = await verifyOrderOwnership(id, req.user);
        if (!isOwner) return res.status(403).json({ error: "No tienes permiso." });

        const query = `
            UPDATE orden 
            SET fecha_fin = (NOW() AT TIME ZONE 'America/Mexico_City')
            WHERE id = $1 
            RETURNING *;
        `;
        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Orden no encontrada." });
        }

        res.status(200).json({ message: "Orden finalizada exitosamente.", data: result.rows[0] });
    } catch (err) {
        console.error("Error en finalizeOrder:", err);
        res.status(500).json({ error: "Error interno al finalizar la orden." });
    }
};

const startAllServices = async (req, res) => {
    try {
        const { id } = req.params;

        const isOwner = await verifyOrderOwnership(id, req.user);
        if (!isOwner) return res.status(403).json({ error: "No tienes permiso para modificar esta orden." });

        const query = `
            UPDATE orden_servicio 
            SET estatus = 'En Progreso' 
            WHERE id_orden = $1 AND estatus = 'Pendiente' 
            RETURNING *;
        `;
        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(400).json({ error: "No hay servicios pendientes para iniciar en esta orden." });
        }

        res.status(200).json({ message: "Todos los servicios iniciados correctamente.", data: result.rows });
    } catch (err) {
        console.error("Error en startAllServices:", err);
        res.status(500).json({ error: "Error interno del servidor al iniciar servicios." });
    }
};

module.exports = {
    getOrdenes,
    updateServiceStatus,
    addServices,
    addCustomService,
    addProducts, 
    createMasterOrder,
    finalizeOrder, 
    startAllServices
};