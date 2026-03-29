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
const authModal       = document.getElementById('authModal');
const mainAppContent  = document.getElementById('mainAppContent');
const authNav         = document.getElementById('auth-nav');
const userNav         = document.getElementById('user-nav');
const userEmailDisplay= document.getElementById('userEmailDisplay');

const navLoginBtn     = document.getElementById('navLoginBtn');
const navSignupBtn    = document.getElementById('navSignupBtn');
const navLogoutBtn    = document.getElementById('navLogoutBtn');

const authModalTitle  = document.getElementById('authModalTitle');
const authCardSub     = document.querySelector('.auth-card-sub');
const authEmail       = document.getElementById('authEmail');
const authPassword    = document.getElementById('authPassword');
const authSubmitBtn   = document.getElementById('authSubmitBtn');
const authSwitchText  = document.getElementById('authSwitchText');
const authSwitchLink  = document.getElementById('authSwitchLink');

const landingPage     = document.getElementById('landing-page');
const getStartedBtn   = document.getElementById('getStartedBtn');
const getStartedBtn2  = document.getElementById('getStartedBtn2');
const appContainer    = document.getElementById('app-container');

let isLoginMode = true;

// ----------------------------------------------------------------
const setupAuthUI = () => {
    const showModal = (login = true) => {
        isLoginMode = login;
        authModalTitle.textContent    = isLoginMode ? 'Welcome Back'   : 'Create Account';
        if (authCardSub) authCardSub.textContent = isLoginMode
            ? 'Sign in to continue planning your next adventure.'
            : 'Join thousands of smart travelers today.';
        authSubmitBtn.textContent     = isLoginMode ? 'Sign In'        : 'Sign Up';
        authSwitchText.textContent    = isLoginMode ? "Don't have an account?" : "Already have an account?";
        authSwitchLink.textContent    = isLoginMode ? 'Sign Up'        : 'Log In';
        authModal.style.display       = 'flex';
    };

    // Landing page buttons
    if (getStartedBtn)  getStartedBtn.addEventListener('click',  () => showModal(true));
    if (getStartedBtn2) getStartedBtn2.addEventListener('click', () => showModal(true));

    // Navbar buttons (landing)
    if (navLoginBtn)  navLoginBtn.addEventListener('click',  () => showModal(true));
    if (navSignupBtn) navSignupBtn.addEventListener('click', () => showModal(false));

    // Switch Sign in ↔ Sign up
    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        showModal(!isLoginMode);
    });

    // Submit
    authSubmitBtn.addEventListener('click', async () => {
        const email    = authEmail.value.trim();
        const password = authPassword.value;

        if (!email || !password) {
            alert('Please enter your email and password.');
            return;
        }
        if (!auth) {
            alert('Firebase is not configured. Please add your Web Client Keys to the .env file and restart the server.');
            return;
        }

        try {
            authSubmitBtn.disabled     = true;
            authSubmitBtn.textContent  = 'Please wait…';
            if (isLoginMode) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            authModal.style.display = 'none';
            authEmail.value         = '';
            authPassword.value      = '';
        } catch (error) {
            console.error('Auth Error', error);
            alert(error.message);
        } finally {
            authSubmitBtn.disabled    = false;
            authSubmitBtn.textContent = isLoginMode ? 'Sign In' : 'Sign Up';
        }
    });

    // Logout
    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', async () => {
            try { await signOut(auth); }
            catch (error) { console.error('Logout Error', error); }
        });
    }

    // Close modal on backdrop click
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) authModal.style.display = 'none';
    });
};

// ----------------------------------------------------------------
const updateUIVisibility = (user) => {
    if (user) {
        currentUser = user;
        window.__userCreatedAt = user.metadata?.creationTime || null;
        window.dispatchEvent(new CustomEvent('user-ready', { detail: { uid: user.uid } }));

        // Hide landing, show app
        landingPage.style.display    = 'none';
        if (appContainer) appContainer.style.display = 'flex';
        mainAppContent.style.display = 'block';
        authModal.style.display      = 'none';

        // Update header user info
        if (authNav)         authNav.style.display  = 'none';
        if (userNav)         userNav.style.display  = 'flex';
        if (userEmailDisplay) userEmailDisplay.textContent = user.email;

    } else {
        currentUser = null;
        window.dispatchEvent(new CustomEvent('user-ready', { detail: null }));

        // Show landing, hide app
        landingPage.style.display    = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        mainAppContent.style.display = 'none';
        authModal.style.display      = 'none';

        if (authNav) authNav.style.display = 'block';
        if (userNav) userNav.style.display = 'none';
    }
};

// ----------------------------------------------------------------
const initialize = async () => {
    setupAuthUI();

    try {
        const firebaseInstance = await initFirebase();
        auth = firebaseInstance.auth;

        onAuthStateChanged(auth, (user) => {
            updateUIVisibility(user);
        });
    } catch (error) {
        console.error('Failed to initialize auth', error);
        updateUIVisibility(null);
        authModalTitle.textContent = 'Configuration Error';
        if (authCardSub) authCardSub.textContent = 'Firebase keys are missing in .env';
        authSwitchLink.style.display = 'none';
    }
};

initialize();

export const getCurrentUserId = () => currentUser ? currentUser.uid : null;
