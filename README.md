# Car Shop Service

## Informacion del Proyecto

| Matricula | Nombre | Carrera |
|-----------|--------|---------|
| 2177709 | Uziel Omar Flores Torres | ITS |
| 2102029 | Melissa Mayte Del Ángel Álvarez | ITS |
| 2099307 | Regino Alexander Martínez Alvarado | ITS |
| 2099485 | Maximiliano Juárez Gómez | ITS |
| 2132054 | Luis Enrique Ramírez Arellano | ITS |

**Materia:** Ingeniería de Dispositivos Móviles

**Profesor:** MA Sergio Plata Gutiérrez

**Grupo:** 001

**Equipo:** 7

**Brigada:** 2

---

## Descripcion del Proyecto

**Car Shop Service** es una aplicacion movil diseñada para gestionar las operaciones de un taller automotriz. La aplicacion permite a los mecanicos llevar un control exhaustivo de las ordenes de servicio, administrando vehiculos, servicios realizados, productos utilizados y el seguimiento del estado de cada reparacion.

El sistema cuenta con autenticacion via Firebase y se comunica con un servidor backend desarrollado en Node.js/Express que interactua con una base de datos PostgreSQL para persistir toda la informacion.

<p align="center">
    <img src="https://uziel.app/media/projects/car-shop-service/og.webp" alt="hero"  />
</p>

---

## Arquitectura

El proyecto esta dividido en dos partes principales:

### Frontend — Aplicacion Movil (Expo / React Native)

```
/
├── App.js                  # Punto de entrada principal, navegacion
├── app.json                # Configuracion de Expo
├── firebaseConfig.js       # Inicializacion de Firebase
├── screens/                # Pantallas de la aplicacion
│   ├── LoginScreen.js
│   ├── HomeScreen.js
│   ├── OrdersScreen.js
│   ├── AgendaScreen.js
│   ├── OrderDetailsScreen.js
│   ├── PastRepairsScreen.js
│   ├── NextServiceScreen.js
│   ├── LastServiceScreen.js
│   ├── AddServiceScreen.js
│   └── AddProductScreen.js
├── components/             # Componentes reutilizables
│   ├── BottomNav.js
│   ├── OrderCard.js
│   ├── VehicleCard.js
│   └── Service.js
├── services/               # Capa de comunicacion con la API
│   ├── apiClient.js        # Cliente HTTP centralizado
│   ├── OrderService.js    # Operacionessobre ordenes
│   └── CatalogService.js  # Catalogo de productos y servicios
└── assets/                 # Recursos estaticos (logos, iconos)
```

- **Pantallas** (`screens/`): Cada pantalla representa una vista completa de la aplicacion y se registran en el `Stack.Navigator` de `App.js`.
- **Componentes** (`components/`): Bloques reutilizables de interfaz que se consumen dentro de las pantallas.
- **Servicios** (`services/`): Abstraccion sobre las llamadas HTTP al backend. `ApiClient` es el motor central que inyecta automaticamente el token de Firebase en cada peticion.

### Backend — API REST (Node.js / Express)

```
backend/
├── server.js               #Entrada, configura Express, CORS y rutas
├── db.js                   # Pool de conexion a PostgreSQL
├── .env                    # Variables de entorno (NO commitear)
├── routes/                 # Definicion de rutas RESTful
│   ├── authRoutes.js
│   └── ordenRoutes.js
└── controllers/            # Logica de negocio por recurso
    ├── authController.js
    └── ordenController.js
```

### Base de Datos — PostgreSQL

El schema se encuentra en `database/schema.sql`. El modelo de datos esta estructurado en cuatro niveles de dependencias:

1. **Tablas independientes (catalogos):** `rol`, `cliente`, `producto`, `servicio`
2. **Tablas dependientes nivel 1:** `usuario` (vinculada a Firebase via `firebase_uid`), `vehiculo` (vinculada a `cliente`)
3. **Tablas dependientes nivel 2:** `orden` (vinculada a `vehiculo` y `usuario/mecanico`), `venta`
4. **Tablas de detalle/intermedias:** `orden_servicio`, `orden_producto`, `detalle_venta`

---

## Tecnologias Utilizadas

### Frontend
| Tecnologia | Version | Proposito |
|-----------|---------|-----------|
| Expo | ~54.0.33 | Framework para React Native |
| React Native | 0.81.5 | UI nativa |
| React Navigation | 7.x | Navegacion por stacks |
| Firebase JS SDK | 12.9.0 | Autenticacion (Email/Password) |
| expo-router | 6.0.23 | Enrutamiento basado en archivos |
| expo-navigation-bar | 5.0.10 | Personalizacion de barra de navegacion |
| expo-checkbox | 5.0.8 | Checkboxes en formularios |
| expo-linking | 8.0.11 | Vinculacion profunda |
| expo-status-bar | 3.0.9 | Barra de estado |

### Backend
| Tecnologia | Version | Proposito |
|-----------|---------|-----------|
| Node.js | — | Entorno de ejecucion |
| Express | 5.2.1 | Framework web REST API |
| pg | 8.18.0 | Cliente PostgreSQL |
| cors | 2.8.6 | Politica de mismo origen |
| dotenv | 17.3.1 | Variables de entorno |
| nodemon | 3.1.14 | Recarga automatica en desarrollo |

### Base de Datos
| Tecnologia | Proposito |
|-----------|-----------|
| PostgreSQL | Motor de base de datos relacional |

---

## Flujo de Autenticacion

1. El usuario ingresa correo y contrasena en `LoginScreen`.
2. `signInWithEmailAndPassword` (Firebase Auth) valida las credenciales.
3. Se obtiene el `idToken` de Firebase y se envia al backend en `/api/auth/verify`.
4. El backend busca el `firebase_uid` en la tabla `usuario` de PostgreSQL.
5. Si existe, retorna los datos del mecanico; si no, retorna 404.
6. La app navega a `HomeScreen` con los datos del usuario.

---

## API Endpoints

### Autenticacion
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/auth/verify` | Verifica el usuario contra PostgreSQL usando el `firebase_uid` |

### Ordenes
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/v1/ordenes` | Lista ordenes (soporta filtros: `mecanico_id`, `estatus_servicio`, `sort`, `limit`, `page`) |
| PATCH | `/api/v1/ordenes/:id/servicios/:servicioId` | Actualiza el estatus de un servicio dentro de una orden |
| POST | `/api/v1/ordenes/:id/servicios` | Agrega servicios a una orden |
| POST | `/api/v1/ordenes/:id/productos` | Agrega productos a una orden |
| GET | `/api/test` | Prueba de conexion a la base de datos |
