const pool = require("../db");

const getProductos = async (req, res) => {
    try {
        const query = `
            SELECT 
                id::TEXT,
                sku,
                codigo_barras,
                nombre,
                vehiculos_compatibles,
                descripcion,
                marca,
                activo,
                cantidad_stock,
                precio_compra,
                precio_venta
            FROM producto
            ORDER BY nombre ASC;
        `;
        const result = await pool.query(query);
        res.status(200).json({ data: result.rows });
    } catch (error) {
        console.error("Error en getProductos:", error);
        res.status(500).json({ error: "Error al obtener productos." });
    }
};

const createProducto = async (req, res) => {
    try {
        const { sku, codigo_barras, nombre, vehiculos_compatibles, descripcion, marca, cantidad_stock, precio_compra, precio_venta } = req.body;

        if (!sku || !nombre || !marca || cantidad_stock === undefined || !precio_compra || !precio_venta) {
            return res.status(400).json({ error: "SKU, nombre, marca, cantidad, precio de compra y precio de venta son obligatorios." });
        }

        const query = `
            INSERT INTO producto (sku, codigo_barras, nombre, vehiculos_compatibles, descripcion, marca, cantidad_stock, precio_compra, precio_venta)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, sku, nombre;
        `;
        const values = [sku, codigo_barras || null, nombre, vehiculos_compatibles || null, descripcion || null, marca, cantidad_stock, precio_compra, precio_venta];
        const result = await pool.query(query, values);

        res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        console.error("Error en createProducto:", error);
        if (error.code === "23505") {
            return res.status(400).json({ error: "Ya existe un producto con ese SKU o código de barras." });
        }
        res.status(500).json({ error: "Error al crear producto." });
    }
};

const updateProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const { cantidad_stock, precio_compra, precio_venta, activo } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (cantidad_stock !== undefined) {
            updates.push(`cantidad_stock = $${paramIndex++}`);
            values.push(cantidad_stock);
        }
        if (precio_compra !== undefined) {
            updates.push(`precio_compra = $${paramIndex++}`);
            values.push(precio_compra);
        }
        if (precio_venta !== undefined) {
            updates.push(`precio_venta = $${paramIndex++}`);
            values.push(precio_venta);
        }
        if (activo !== undefined) {
            updates.push(`activo = $${paramIndex++}`);
            values.push(activo);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No hay campos para actualizar." });
        }

        values.push(id);
        const query = `
            UPDATE producto 
            SET ${updates.join(", ")}
            WHERE id = $${paramIndex}
            RETURNING id, sku, nombre, cantidad_stock;
        `;
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Producto no encontrado." });
        }

        res.status(200).json({ data: result.rows[0] });
    } catch (error) {
        console.error("Error en updateProducto:", error);
        res.status(500).json({ error: "Error al actualizar producto." });
    }
};

const updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { cantidad_stock } = req.body;

        if (cantidad_stock === undefined || cantidad_stock < 0) {
            return res.status(400).json({ error: "Cantidad de stock inválida." });
        }

        const query = `
            UPDATE producto 
            SET cantidad_stock = $1
            WHERE id = $2
            RETURNING id, sku, nombre, cantidad_stock;
        `;
        const result = await pool.query(query, [cantidad_stock, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Producto no encontrado." });
        }

        res.status(200).json({ data: result.rows[0] });
    } catch (error) {
        console.error("Error en updateStock:", error);
        res.status(500).json({ error: "Error al actualizar stock." });
    }
};

module.exports = { getProductos, createProducto, updateProducto, updateStock };