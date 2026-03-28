import { initFirebase } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

let auth;
let currentUser = null;

// UI Elements
const authModal = document.getElementById('authModal');
const mainAppContent = document.getElementById('mainAppContent');
const authNav = document.getElementById('auth-nav');
const userNav = document.getElementById('user-nav');
const userEmailDisplay = document.getElementById('userEmailDisplay');

const navLoginBtn = document.getElementById('navLoginBtn');
const navSignupBtn = document.getElementById('navSignupBtn');
const navLogoutBtn = document.getElementById('navLogoutBtn');

const authModalTitle = document.getElementById('authModalTitle');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authSwitchText = document.getElementById('authSwitchText');
const authSwitchLink = document.getElementById('authSwitchLink');

let isLoginMode = true;

const setupAuthUI = () => {
    // Show Modal
    const showModal = (login = true) => {
        isLoginMode = login;
        authModalTitle.textContent = isLoginMode ? 'Sign In' : 'Sign Up';
        authSubmitBtn.textContent = isLoginMode ? 'Sign In' : 'Sign Up';
        authSwitchText.textContent = isLoginMode ? "Don't have an account?" : "Already have an account?";
        authSwitchLink.textContent = isLoginMode ? "Sign Up" : "Log In";
        authModal.style.display = 'flex';
    };

    navLoginBtn.addEventListener('click', () => showModal(true));
    navSignupBtn.addEventListener('click', () => showModal(false));
    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        showModal(!isLoginMode);
    });

    // Handle Submit
    authSubmitBtn.addEventListener('click', async () => {
        const email = authEmail.value;
        const password = authPassword.value;
        
        if (!email || !password) {
            alert("Please enter email and password");
            return;
        }

        if (!auth) {
            alert("Firebase is not configured! Please add your Web Client Keys to the .env file and restart the server.");
            return;
        }

        try {
            authSubmitBtn.disabled = true;
            authSubmitBtn.textContent = 'Please wait...';
            
            if (isLoginMode) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            
            authModal.style.display = 'none';
            authEmail.value = '';
            authPassword.value = '';
        } catch (error) {
            console.error("Auth Error", error);
            alert(error.message);
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isLoginMode ? 'Sign In' : 'Sign Up';
        }
    });

    // Handle Logout
    navLogoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout Error", error);
        }
    });

    // Hide modal if click outside
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.style.display = 'none';
        }
    });
};

const updateUIVisibility = (user) => {
    if (user) {
        currentUser = user;
        // Broadcast custom event so app.js knows user is ready
        window.dispatchEvent(new CustomEvent('user-ready', { detail: { uid: user.uid } }));
        
        authNav.style.display = 'none';
        userNav.style.display = 'flex';
        userEmailDisplay.textContent = user.email;
        mainAppContent.style.display = 'block';
        authModal.style.display = 'none';
    } else {
        currentUser = null;
        window.dispatchEvent(new CustomEvent('user-ready', { detail: null }));
        
        authNav.style.display = 'block';
        userNav.style.display = 'none';
        mainAppContent.style.display = 'none';
        
        // Force login view
        authModalTitle.textContent = 'Sign In';
        authModal.style.display = 'flex';
        authSubmitBtn.textContent = 'Sign In';
    }
};

const initialize = async () => {
    // Setup UI listeners immediately so buttons work even if Firebase fails
    setupAuthUI();
    
    try {
        const firebaseInstance = await initFirebase();
        auth = firebaseInstance.auth;

        onAuthStateChanged(auth, (user) => {
            updateUIVisibility(user);
        });
    } catch (error) {
        console.error("Failed to initialize auth", error);
        // If Firebase fails to initialize, show the logged-out state but buttons will just alert
        updateUIVisibility(null);
        authModalTitle.textContent = "Configuration Error";
        authSwitchText.textContent = "Firebase keys are missing in .env";
        authSwitchLink.style.display = "none";
    }
};

// Start initialization
initialize();

// Export current user getter for app.js
export const getCurrentUserId = () => currentUser ? currentUser.uid : null;
