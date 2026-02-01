/* ========================================
   CONFIGURATION SUPABASE
   ======================================== */

const SUPABASE_URL = 'https://dfvhxhenqikekpkgqftv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XolndeMEy4CBdquTDgNbmQ_nFZl6R7w';

// Initialiser le client Supabase seulement s'il n'existe pas déjà
if (!window.supabaseClient) {
    // Détecter si l'utilisateur veut être rappelé
    const rememberMe = localStorage.getItem('rize-remember-me') === 'true';
    
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            // Utiliser localStorage si "Se souvenir de moi" est activé, sinon sessionStorage
            storage: rememberMe ? window.localStorage : window.sessionStorage,
            persistSession: true,
            autoRefreshToken: true
        }
    });
}

// Utiliser var au lieu de const pour permettre la redéclaration
var supabase = window.supabaseClient;

// Fonction pour reconfigurer le stockage de session selon les préférences
function updateSessionStorage(rememberMe) {
    // Sauvegarder la session actuelle si elle existe
    const currentSession = supabase.auth.getSession();
    
    // Créer un nouveau client avec le bon stockage
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            storage: rememberMe ? window.localStorage : window.sessionStorage,
            persistSession: true,
            autoRefreshToken: true
        }
    });
    
    supabase = window.supabaseClient;
    
    return currentSession;
}

// État d'authentification global
// Remove this line (line 17):
// let currentUser = null;

// Update the checkAuth function to not reassign to global currentUser
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
        console.error('Erreur vérification session:', error);
        return null;
    }
    
    if (session) {
        // Return the user without assigning to global currentUser
        return session.user;
    }
    
    return null;
}

// Update signIn function to not assign to global currentUser
async function signIn(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        // Return the user data instead of assigning to global
        return {
            success: true,
            data: data.user
        };
    } catch (error) {
        console.error('Erreur connexion:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Update signUp function similarly
async function signUp(email, password, username) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username: username }
            }
        });
        
        if (error) throw error;
        
        // Return the user data instead of assigning to global
        return {
            success: true,
            data: data.user
        };
    } catch (error) {
        console.error('Erreur inscription:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Update signOut function
async function signOut(clearRememberMe = false) {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) throw error;
        
        // Si demandé, nettoyer les préférences "Se souvenir de moi"
        if (clearRememberMe) {
            localStorage.removeItem('rize-remember-email');
            localStorage.removeItem('rize-remember-me');
        }
        
        return {
            success: true
        };
    } catch (error) {
        console.error('Erreur déconnexion:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/* ========================================
   FONCTIONS BASE DE DONNÉES - USERS
   ======================================== */

// Créer ou mettre à jour un profil utilisateur
async function upsertUserProfile(userId, profileData) {
    try {
        // Vérifier que l'utilisateur est authentifié
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || user.id !== userId) {
            return { 
                success: false, 
                error: 'Utilisateur non authentifié ou ID non correspondant' 
            };
        }
        
        const { data, error } = await supabase
            .from('users')
            .upsert({
                id: userId,
                name: profileData.name,
                title: profileData.title,
                bio: profileData.bio,
                avatar: profileData.avatar,
                banner: profileData.banner,
                account_type: profileData.account_type,
                account_subtype: profileData.account_subtype,
                badge: profileData.badge,
                social_links: profileData.socialLinks,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) {
            console.error('Erreur upsert profil:', error);
            
            // Gestion spécifique des erreurs RLS
            if (error.code === '42501') {
                return { 
                    success: false, 
                    error: 'Permission refusée. Vérifiez que vous êtes connecté.' 
                };
            }
            
            return { success: false, error: error.message };
        }
        
        return { success: true, data: data };
    } catch (error) {
        console.error('Exception upsert profil:', error);
        return { success: false, error: error.message };
    }
}

// Récupérer un profil utilisateur
async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Erreur récupération profil:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, data: data };
}

// Récupérer tous les utilisateurs (pour la page Discover)
async function getAllUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Erreur récupération utilisateurs:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, data: data };
}

/* ========================================
   FONCTIONS BASE DE DONNÉES - CONTENT
   ======================================== */

// Créer un nouveau contenu
async function createContent(contentData) {
    const { data, error } = await supabase
        .from('content')
        .insert({
            user_id: contentData.userId,
            project_id: contentData.projectId,
            arc_id: contentData.arcId,
            day_number: contentData.dayNumber,
            type: contentData.type,
            state: contentData.state,
            title: contentData.title,
            description: contentData.description,
            media_url: contentData.mediaUrl
        })
        .select()
        .single();
    
    if (error) {
        console.error('Erreur création contenu:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, data: data };
}

// Mettre à jour un contenu existant
async function updateContent(contentId, contentData) {
    const { data, error } = await supabase
        .from('content')
        .update({
            project_id: contentData.projectId,
            arc_id: contentData.arcId,
            day_number: contentData.dayNumber,
            type: contentData.type,
            state: contentData.state,
            title: contentData.title,
            description: contentData.description,
            media_url: contentData.mediaUrl
        })
        .eq('id', contentId)
        .eq('user_id', contentData.userId) // Sécurité supplémentaire
        .select()
        .single();
    
    if (error) {
        console.error('Erreur mise à jour contenu:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, data: data };
}

// Récupérer le contenu d'un utilisateur
async function getUserContent(userId) {
    const { data, error } = await supabase
        .from('content')
        .select(`
            *,
            arcs (
                id,
                title,
                status
            ),
            projects (
                id,
                name
            )
        `)
        .eq('user_id', userId)
        .order('day_number', { ascending: false });
    
    if (error) {
        console.error('Erreur récupération contenu:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, data: data };
}

/* ========================================
   FONCTIONS BASE DE DONNÉES - FOLLOWERS
   ======================================== */

// Suivre un utilisateur
async function followUser(followerId, followingId) {
    const { data, error } = await supabase
        .from('followers')
        .insert({
            follower_id: followerId,
            following_id: followingId
        })
        .select()
        .single();
    
    if (error) {
        console.error('Erreur follow:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, data: data };
}

// Ne plus suivre un utilisateur
async function unfollowUser(followerId, followingId) {
    const { error } = await supabase
        .from('followers')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);
    
    if (error) {
        console.error('Erreur unfollow:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true };
}

// Vérifier si un utilisateur suit un autre
async function isFollowing(followerId, followingId) {
    const { data, error } = await supabase
        .from('followers')
        .select('*')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Erreur vérification follow:', error);
        return false;
    }
    
    return data !== null;
}

// Compter les followers
async function getFollowerCount(userId) {
    const { count, error } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);
    
    if (error) {
        console.error('Erreur comptage followers:', error);
        return 0;
    }
    
    return count || 0;
}

// Compter les following
async function getFollowingCount(userId) {
    const { count, error } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);
    
    if (error) {
        console.error('Erreur comptage following:', error);
        return 0;
    }
    
    return count || 0;
}

/* ========================================
   FONCTIONS D'AUTHENTIFICATION AVANCÉES
   ======================================== */

// Connexion avec Google OAuth
async function signInWithGoogle() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin === 'null' || window.location.protocol === 'file:' 
                    ? 'http://localhost:3000/index.html' 
                    : window.location.origin + '/index.html'
            }
        });
        
        if (error) throw error;
        
        return {
            success: true,
            data: data
        };
    } catch (error) {
        console.error('Erreur connexion Google:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Réinitialisation du mot de passe
async function resetPassword(email) {
    try {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/login.html?reset=true'
        });
        
        if (error) throw error;
        
        return {
            success: true,
            data: data
        };
    } catch (error) {
        console.error('Erreur reset password:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Mettre à jour le mot de passe (après reset)
async function updatePassword(newPassword) {
    try {
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        return {
            success: true,
            data: data.user
        };
    } catch (error) {
        console.error('Erreur update password:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/* ========================================
   FONCTIONS BASE DE DONNÉES - PROJECTS
   ======================================== */

// Créer un projet
async function createProject(projectData) {
    const { data, error } = await supabase
        .from('projects')
        .insert({
            user_id: projectData.userId,
            name: projectData.name,
            description: projectData.description,
            cover: projectData.cover
        })
        .select()
        .single();
    
    if (error) {
        console.error('Erreur création projet:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, data: data };
}

// Récupérer les projets d'un utilisateur
async function getUserProjects(userId) {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Erreur récupération projets:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, data: data };
}