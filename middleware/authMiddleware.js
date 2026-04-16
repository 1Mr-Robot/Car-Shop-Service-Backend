const admin = require("../config/firebase");
const pool = require("../db");

/**
 * Middleware de Autenticación y Autorización (RBAC)
 * Intercepta todas las peticiones a rutas protegidas.
 */
const authenticateToken = async (req, res, next) => {
    // 1. INTERCEPCIÓN: Buscamos el token en los headers
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // El formato es "Bearer eyJhbGci..."

    if (!token) {
        return res.status(401).json({ 
            error: "Acceso denegado. No se proporcionó un token de autenticación." 
        });
    }

    try {
        // 2. VALIDACIÓN CRIPTOGRÁFICA: Firebase verifica que el token sea real y no haya expirado
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        // 3. AUTORIZACIÓN (RBAC): Buscamos el UID en nuestra base de datos PostgreSQL
        // Hacemos un JOIN con la tabla 'rol' para saber si es Mecánico o Recepcionista
        const userQuery = `
            SELECT 
                u.id, 
                u.firebase_uid, 
                u.nombre, 
                u.apellido_paterno, 
                r.nombre AS rol 
            FROM usuario u 
            JOIN rol r ON u.id_rol = r.id 
            WHERE u.firebase_uid = $1
        `;
        
        const result = await pool.query(userQuery, [uid]);

        // Si el usuario existe en Firebase pero no en nuestra BD (ej. alguien ajeno al taller)
        if (result.rows.length === 0) {
            return res.status(403).json({ 
                error: "Usuario autenticado, pero no tiene perfil registrado en el sistema del taller." 
            });
        }

        // 4. INYECCIÓN: Adjuntamos el perfil del usuario al objeto 'req'
        // Esto es magia pura: ahora TODOS los controladores sabrán quién hizo la petición y qué rol tiene.
        req.user = result.rows[0];

        // 5. PASE DE LISTA: Todo está en orden, permitimos que la petición continúe hacia el controlador
        next();

    } catch (error) {
        console.error("[Auth Middleware] Error al verificar token:", error.message);
        
        // Diferenciamos entre un token expirado y un token falso para mejor debugging
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: "El token de sesión ha expirado. Por favor, inicia sesión nuevamente." });
        }
        return res.status(401).json({ error: "Token inválido o corrupto." });
    }
};

module.exports = authenticateToken;