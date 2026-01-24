/* ========================================
   CONFIGURATION SUPABASE
   ======================================== */

const SUPABASE_URL = 'https://nzdjdfmeisfnbdnbgaln.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rzTof6ZpJJkVhQDVvW417Q_S-9uN9c3';

// Initialiser le client Supabase seulement s'il n'existe pas déjà
if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Utiliser var au lieu de const pour permettre la redéclaration
var supabase = window.supabaseClient;

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
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) throw error;
        
        // Don't set currentUser = null here
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

// Récupérer le contenu d'un utilisateur
async function getUserContent(userId) {
    const { data, error } = await supabase
        .from('content')
        .select('*')
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