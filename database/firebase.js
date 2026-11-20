
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyARoUmsEFIyhmPVViXcsvNAqSb1ziJbil4",
  authDomain: "kopicu-eb948.firebaseapp.com",
  projectId: "kopicu-eb948",
  storageBucket: "kopicu-eb948.firebasestorage.app",
  messagingSenderId: "656269985841",
  appId: "1:656269985841:web:3e1452d387187283cded10",
  measurementId: "G-QE7MGCMTTK"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const storage = getStorage(app);
