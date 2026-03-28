// Firebase Client Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

let auth;
let app;

export const initFirebase = async () => {
    if (app) return { app, auth };

    try {
        const response = await fetch('/api/config/firebase');
        const firebaseConfig = await response.json();
        
        if (!firebaseConfig.apiKey) {
            throw new Error("Firebase API Key is missing. Please add the Firebase Web Config to your .env file.");
        }

        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        return { app, auth };
    } catch (error) {
        console.error("Failed to load Firebase Config", error);
        throw error;
    }
};

export const getFirebaseAuth = () => auth;
