// backend/controllers/ventaController.js
const pool = require("../db");

/**
 * POST /api/v1/ventas
 * Transacción de Venta de Mostrador:
 * 1. Verifica RBAC (Solo Recepcionistas).
 * 2. Verifica Stock suficiente.
 * 3. Crea la venta.
 * 4. Crea el detalle de los productos.
 * 5. Resta el stock del inventario.
 */
const createVenta = async (req, res) => {
    // 1. Verificación RBAC de Seguridad
    if (req.user.rol !== 'Recepcionista') {
        return res.status(403).json({ 
            error: "Acceso denegado. Solo los Recepcionistas pueden realizar ventas de mostrador." 
        });
    }

    const { productos } = req.body; // Esperamos: [{ id_producto: 1, cantidad: 2 }, ...]

    if (!productos || productos.length === 0) {
        return res.status(400).json({ error: "El carrito está vacío." });
    }

    // Solicitamos un cliente exclusivo del pool para la transacción
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Iniciamos la transacción

        let totalVenta = 0;

        // 2. Verificar Stock y Calcular Subtotales (Fuente de la verdad: Backend)
        for (const item of productos) {
            // Buscamos el producto bloqueando la fila momentáneamente para evitar condiciones de carrera (opcional pero buena práctica)
            const prodRes = await client.query(
                'SELECT nombre, precio_venta, cantidad_stock FROM producto WHERE id = $1', 
                [item.id_producto]
            );
            
            if (prodRes.rowCount === 0) {
                throw new Error(`El producto con ID ${item.id_producto} no existe.`);
            }

            const prod = prodRes.rows[0];

            if (prod.cantidad_stock < item.cantidad) {
                throw new Error(`Stock insuficiente para "${prod.nombre}". Solo quedan ${prod.cantidad_stock} en inventario.`);
            }

            // Almacenamos los valores calculados en el objeto para usarlos en el INSERT
            item.precio_unitario = prod.precio_venta;
            item.subtotal = prod.precio_venta * item.cantidad;
            totalVenta += item.subtotal;
        }

        // 3. Registrar la Venta (Tabla Padre)
        const ventaRes = await client.query(
            'INSERT INTO venta (id_usuario, total) VALUES ($1, $2) RETURNING id',
            [req.user.id, totalVenta]
        );
        const nuevaVentaId = ventaRes.rows[0].id;

        // 4. Registrar los Detalles y Descontar Stock (Tablas Hijas)
        for (const item of productos) {
            // Insertar en detalle_venta
            await client.query(
                'INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)',
                [nuevaVentaId, item.id_producto, item.cantidad, item.precio_unitario, item.subtotal]
            );

            // Actualizar stock en producto
            await client.query(
                'UPDATE producto SET cantidad_stock = cantidad_stock - $1 WHERE id = $2',
                [item.cantidad, item.id_producto]
            );
        }

        await client.query('COMMIT'); // Si todo salió bien, guardamos los cambios definitivamente
        
        res.status(201).json({ 
            message: "Venta registrada exitosamente.", 
            data: { id_venta: nuevaVentaId, total: totalVenta } 
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Si ALGO falla, revertimos absolutamente todo
        console.error("[Venta Controller] Error en Transacción:", error.message);
        
        // Si el error fue provocado por nuestras validaciones (ej. falta de stock), enviamos 400
        if (error.message.includes("Stock insuficiente") || error.message.includes("no existe")) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: "Error interno del servidor al procesar la venta." });
    } finally {
        client.release(); // Devolvemos la conexión al pool
    }
};

module.exports = {
    createVenta
};