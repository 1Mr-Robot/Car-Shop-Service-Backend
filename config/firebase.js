const admin = require("firebase-admin");
require("dotenv").config();

const privateKey = process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : undefined;

const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
};

// Verificación preventiva de seguridad
if (!firebaseConfig.projectId || !firebaseConfig.clientEmail || !firebaseConfig.privateKey) {
    throw new Error(
        "Faltan credenciales de Firebase Admin en backend/.env. " +
        "Asegúrate de configurar FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY."
    );
}

try {
    // Inicialización del Singleton de Firebase Admin
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(firebaseConfig),
        });
        console.log(">> Firebase Admin SDK inicializado con éxito.");
    }
} catch (error) {
    console.error(">> Error al inicializar Firebase Admin SDK:", error.message);
}

module.exports = admin;