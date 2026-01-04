// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAR1MZTKL03dYW65_XjWDwqa4C6vN4YmMc",
  authDomain: "gerenciador-filas-bpa.firebaseapp.com",
  databaseURL: "https://gerenciador-filas-bpa-default-rtdb.firebaseio.com",
  projectId: "gerenciador-filas-bpa",
  storageBucket: "gerenciador-filas-bpa.firebasestorage.app",
  messagingSenderId: "158845933372",
  appId: "1:158845933372:web:491771e52e732bb2277039"
};

// Inicializa Firebase (proteção contra duplicar)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// 🔴 EXPORTA GLOBALMENTE
window.db = firebase.database();
window.UNIDADE = "BPA";
