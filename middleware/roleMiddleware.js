/**
 * Middleware de Autorización RBAC
 * Se ejecuta DESPUÉS de authenticateToken.
 * Verifica si el rol del usuario inyectado tiene permiso para acceder a la ruta.
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        // Guarda de seguridad: Asegurarnos de que el authMiddleware ya pasó
        if (!req.user || !req.user.rol) {
            return res.status(401).json({ 
                error: "No se pudo verificar la identidad del usuario para la autorización." 
            });
        }

        // Si el rol del usuario no está en la lista de roles permitidos, lo bloqueamos
        if (!allowedRoles.includes(req.user.rol)) {
            console.warn(`[RBAC] Acceso denegado: Usuario ${req.user.nombre} (${req.user.rol}) intentó acceder a una ruta protegida.`);
            return res.status(403).json({ 
                error: "Acceso denegado. No tienes los permisos necesarios para realizar esta acción." 
            });
        }

        // Si el rol es correcto, permitimos el paso al Controlador
        next();
    };
};

module.exports = authorizeRoles;