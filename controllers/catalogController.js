const pool = require("../db");

/**
 * GET /api/v1/servicios
 * Obtiene el catálogo maestro de servicios con paginación.
 */
const getServicios = async (req, res) => {
    try {
        const { page = 1, limit = 15, activo = 'true' } = req.query;
        
        const limitNum = parseInt(limit);
        const offset = (parseInt(page) - 1) * limitNum;
        const isActivo = activo === 'true';

        const query = `
            SELECT id, nombre AS name, descripcion, precio_mano_obra::TEXT, activo 
            FROM servicio 
            WHERE activo = $1 
            ORDER BY id ASC 
            LIMIT $2 OFFSET $3
        `;
        
        const result = await pool.query(query, [isActivo, limitNum, offset]);

        res.status(200).json({
            data: result.rows,
            meta: { page: parseInt(page), limit: limitNum, count: result.rowCount }
        });
    } catch (err) {
        console.error("[Catalog Controller] Error en getServicios:", err);
        res.status(500).json({ error: "Error al obtener el catálogo de servicios." });
    }
};

/**
 * GET /api/v1/productos
 * Obtiene el inventario de productos. 
 * Soporta filtro 'inStock' para ventas vs reabastecimiento.
 */
const getProductos = async (req, res) => {
    try {
        const { page = 1, limit = 15, activo = 'true', inStock = 'false' } = req.query;
        
        const limitNum = parseInt(limit);
        const offset = (parseInt(page) - 1) * limitNum;
        const isActivo = activo === 'true';
        const requiresStock = inStock === 'true';

        // Construcción dinámica de la consulta
        let query = `SELECT * FROM producto WHERE activo = $1`;
        const queryParams = [isActivo];
        let paramIndex = 2;

        if (requiresStock) {
            query += ` AND cantidad_stock > 0`;
        }

        query += ` ORDER BY nombre ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limitNum, offset);

        const result = await pool.query(query, queryParams);

        res.status(200).json({
            data: result.rows,
            meta: { page: parseInt(page), limit: limitNum, count: result.rowCount }
        });
    } catch (err) {
        console.error("[Catalog Controller] Error en getProductos:", err);
        res.status(500).json({ error: "Error al obtener el catálogo de productos." });
    }
};

module.exports = {
    getServicios,
    getProductos
};