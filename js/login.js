/* ========================================
   LOGIQUE DE LA PAGE LOGIN
   ======================================== */

let isSignUpMode = false;

// Éléments DOM
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const confirmPasswordInput = document.getElementById('confirm-password');
const usernameGroup = document.getElementById('username-group');
const confirmPasswordGroup = document.getElementById('confirm-password-group');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');
const toggleLink = document.getElementById('toggle-link');
const toggleText = document.getElementById('toggle-text');
const formTitle = document.getElementById('form-title');
const formSubtitle = document.getElementById('form-subtitle');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

// Vérifier si l'utilisateur est déjà connecté
async function checkExistingSession() {
    // Vérifier si checkAuth existe
    if (typeof checkAuth !== 'function') {
        console.error('checkAuth n\'est pas disponible');
        return null;
    }
    
    const user = await checkAuth();
    if (user) {
        // Rediriger vers la page principale
        window.location.href = 'index.html';
    }
}

// Afficher un message d'erreur
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Afficher un message de succès
function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 5000);
}

// Toggle entre connexion et inscription
function toggleMode() {
    isSignUpMode = !isSignUpMode;
    
    if (isSignUpMode) {
        // Mode inscription
        formTitle.textContent = 'Créer votre compte';
        formSubtitle.textContent = 'Rejoignez la communauté RIZE';
        usernameGroup.style.display = 'block';
        confirmPasswordGroup.style.display = 'block';
        btnText.textContent = 'Créer mon compte';
        toggleText.textContent = 'Déjà un compte ?';
        toggleLink.textContent = 'Se connecter';
        usernameInput.required = true;
        confirmPasswordInput.required = true;
    } else {
        // Mode connexion
        formTitle.textContent = 'Bienvenue sur RIZE';
        formSubtitle.textContent = 'Connectez-vous pour continuer';
        usernameGroup.style.display = 'none';
        confirmPasswordGroup.style.display = 'none';
        btnText.textContent = 'Se connecter';
        toggleText.textContent = 'Pas encore de compte ?';
        toggleLink.textContent = 'Créer un compte';
        usernameInput.required = false;
        confirmPasswordInput.required = false;
    }
    
    // Reset form
    authForm.reset();
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// Gérer la soumission du formulaire
async function handleSubmit(e) {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const username = usernameInput.value.trim();
    const confirmPassword = confirmPasswordInput.value;
    
    // Validation
    if (!email || !password) {
        showError('Veuillez remplir tous les champs obligatoires.');
        return;
    }
    
    if (isSignUpMode) {
        if (!username) {
            showError('Veuillez entrer un nom d\'utilisateur.');
            return;
        }
        
        if (username.length < 3) {
            showError('Le nom d\'utilisateur doit contenir au moins 3 caractères.');
            return;
        }
        
        if (password.length < 6) {
            showError('Le mot de passe doit contenir au moins 6 caractères.');
            return;
        }
        
        if (password !== confirmPassword) {
            showError('Les mots de passe ne correspondent pas.');
            return;
        }
    }
    
    // Désactiver le bouton et afficher le loader
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
    
    try {
        if (isSignUpMode) {
            // Inscription
            const result = await signUp(email, password, username);
            
            if (result.success) {
                showSuccess('Compte créé avec succès ! Vérifiez votre email pour confirmer votre compte.');
                
                // NE PAS créer le profil utilisateur immédiatement
                // L'utilisateur doit d'abord confirmer son email
                // Le profil sera créé lors de la première connexion
                
                // Attendre 2 secondes puis basculer en mode connexion
                setTimeout(() => {
                    toggleMode();
                    emailInput.value = email;
                }, 2000);
            } else {
                showError(result.error || 'Erreur lors de la création du compte.');
            }
        } else {
            // Connexion
            const result = await signIn(email, password);
            
            if (result.success) {
                // Après connexion réussie, créer ou mettre à jour le profil
                if (result.user) {
                    const profileResult = await upsertUserProfile(result.user.id, {
                        name: username || result.user.email.split('@')[0],
                        title: 'Nouveau membre',
                        bio: '',
                        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || result.user.id}`,
                        banner: 'https://placehold.co/1200x300/1a1a2e/00ff88?text=Ma+Trajectoire',
                        socialLinks: {}
                    });
                    
                    if (!profileResult.success) {
                        console.warn('Profil non créé:', profileResult.error);
                    }
                }
                
                showSuccess('Connexion réussie ! Redirection...');
                
                // Rediriger vers la page principale après 1 seconde
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } else {
                showError(result.error || 'Email ou mot de passe incorrect.');
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
        // Réactiver le bouton
        submitBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
    }
}

// Event listeners
toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMode();
});

authForm.addEventListener('submit', handleSubmit);

// Vérifier la session au chargement
checkExistingSession();