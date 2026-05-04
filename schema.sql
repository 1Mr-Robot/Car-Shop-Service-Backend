-- ==========================================
-- CAR SHOP SERVICE - SCHEMA V2.1
-- ==========================================

-- ------------------------------------------
-- 1. TABLAS INDEPENDIENTES (Catálogos)
-- ------------------------------------------
CREATE TABLE rol (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE cliente (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100),
    rfc VARCHAR(13) UNIQUE,
    celular VARCHAR(15) UNIQUE NOT NULL,
    correo VARCHAR(255) UNIQUE,
    direccion TEXT
);

CREATE TABLE producto (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    codigo_barras VARCHAR(100) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    vehiculos_compatibles TEXT,
    descripcion TEXT,
    marca VARCHAR(50) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    cantidad_stock INTEGER NOT NULL DEFAULT 0,
    precio_compra NUMERIC(10, 2) NOT NULL,
    precio_venta NUMERIC(10, 2) NOT NULL
);

CREATE TABLE servicio (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_mano_obra NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    activo BOOLEAN DEFAULT TRUE
);

-- ------------------------------------------
-- 2. TABLAS DEPENDIENTES (Nivel 1)
-- ------------------------------------------
CREATE TABLE usuario (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    id_rol INTEGER NOT NULL REFERENCES rol (id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100),
    rfc VARCHAR(13) UNIQUE,
    curp VARCHAR(18) UNIQUE,
    celular VARCHAR(15) UNIQUE NOT NULL,
    correo VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE vehiculo (
    id SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES cliente (id) ON DELETE CASCADE,
    marca VARCHAR(50) NOT NULL,
    modelo VARCHAR(50) NOT NULL,
    anio INTEGER NOT NULL,
    color VARCHAR(30) NOT NULL,
    matricula VARCHAR(20) UNIQUE NOT NULL,
    niv VARCHAR(17) UNIQUE
);

-- ------------------------------------------
-- 3. TABLAS DEPENDIENTES (Nivel 2)
-- ------------------------------------------
CREATE TABLE orden (
    id SERIAL PRIMARY KEY,
    id_vehiculo INTEGER NOT NULL REFERENCES vehiculo (id) ON DELETE RESTRICT,
    id_mecanico INTEGER NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    notas_cliente TEXT,
    kilometraje INTEGER NOT NULL,
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP,
    total_orden NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

CREATE TABLE venta (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    total NUMERIC(10, 2) NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------
-- 4. TABLAS DE DETALLE E INTERMEDIAS (Nivel 3)
-- ------------------------------------------
CREATE TABLE orden_servicio (
    id SERIAL PRIMARY KEY,
    id_orden INTEGER NOT NULL REFERENCES orden (id) ON DELETE CASCADE,
    id_servicio INTEGER NOT NULL REFERENCES servicio (id) ON DELETE RESTRICT,
    estatus VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (
        estatus IN (
            'Pendiente',
            'En Progreso',
            'Finalizado'
        )
    ),
    descripcion_personalizada TEXT,
    precio_personalizado NUMERIC(10, 2)
);

CREATE TABLE orden_producto (
    id SERIAL PRIMARY KEY,
    id_orden INTEGER NOT NULL REFERENCES orden (id) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES producto (id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

CREATE TABLE detalle_venta (
    id_venta INTEGER NOT NULL REFERENCES venta (id) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES producto (id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (id_venta, id_producto)
);