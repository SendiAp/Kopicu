import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyARoUmsEFIyhmPVViXcsvNAqSb1ziJbil4",
  authDomain: "kopicu-eb948.firebaseapp.com",
  databaseURL: "https://kopicu-eb948-default-rtdb.firebaseio.com",
  projectId: "kopicu-eb948",
  storageBucket: "kopicu-eb948.firebasestorage.app",
  messagingSenderId: "656269985841",
  appId: "1:656269985841:web:53fdbc28192a2399cded10",
  measurementId: "G-PCBEXWCQBF"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

isSupported()
  .then(supported => {
    if (supported) {
      getAnalytics(app);
    }
  })
  .catch(error => {
    console.warn("Firebase Analytics tidak tersedia:", error);
  });
