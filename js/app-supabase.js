/* ========================================
   APP.JS - VERSION SUPABASE INTÉGRÉE
   Remplace les données mockées par des appels API réels
   ======================================== */

// État global de l'application
window.currentUser = null;
window.currentUserId = null;
window.currentViewerId = null;
window.allUsers = [];
window.userContents = {};
window.userProjects = {};

/* ========================================
   INITIALISATION ET AUTHENTIFICATION
   ======================================== */

// Vérifier l'authentification au chargement
async function initializeApp() {
    // Tenter de restaurer la session locale d'abord
    const savedSession = SessionManager.loadSession();
    
    // Vérifier la session avec Supabase
    const user = await checkAuth();
    
    if (user) {
        window.currentUser = user;
        window.currentUserId = user.id;
        window.currentViewerId = user.id;
        
        // Sauvegarder/étendre la session
        SessionManager.saveSession(user);
        
        // Mettre à jour l'interface
        updateNavigation(true);
        navigateTo('discover');
        
        // Charger les données
        await loadAllData();
    } else if (savedSession) {
        // Session locale existante mais pas de session Supabase
        // Tenter une reconnexion silencieuse ou rediriger vers login
        ToastManager.info('Session expirée', 'Veuillez vous reconnecter');
        SessionManager.clearSession();
        updateNavigation(false);
        await loadPublicData();
    } else {
        // Utilisateur non connecté
        updateNavigation(false);
        await loadPublicData();
    }
    
    // Initialiser le thème
    initTheme();
    
    // Remplir la grille Discover
    renderDiscoverGrid();
    
    // Remplir la section profil si connecté
    if (window.currentUserId) {
        const profileContainer = document.querySelector('.profile-container');
        if (profileContainer) {
            profileContainer.innerHTML = await renderProfileTimeline(window.currentUserId);
            if (window.loadUserArcs) window.loadUserArcs(window.currentUserId);
        }
    }
}

// Mettre à jour la navigation selon l'état de connexion
function updateNavigation(isLoggedIn) {
    const navAuth = document.getElementById('nav-auth');
    const navProfile = document.getElementById('nav-profile');
    
    if (navAuth) {
        if (isLoggedIn) {
            navAuth.style.display = 'none';
        } else {
            navAuth.style.display = 'block';
            navAuth.textContent = 'Connexion';
            navAuth.onclick = () => window.location.href = 'login.html';
        }
    }
    
    if (navProfile) {
        if (!isLoggedIn) {
            navProfile.style.display = 'none';
        } else {
            navProfile.style.display = 'block';
        }
    }
}

// Gérer la déconnexion
async function handleSignOut() {
    const result = await signOut();
    if (result.success) {
        SessionManager.clearSession();
        ToastManager.success('Déconnexion', 'À bientôt !');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    }
}

/* ========================================
   GESTION DU PROFIL UTILISATEUR
   ======================================== */

// S'assurer qu'un utilisateur a un profil valide
async function ensureUserProfile(user) {
    try {
        // Vérifier si le profil existe
        const profileResult = await getUserProfile(user.id);
        
        if (!profileResult.success) {
            // Créer un nouveau profil
            const username = user.user_metadata?.username || user.email.split('@')[0];
            const accountType = user.user_metadata?.account_type || null;
            const accountSubtype = user.user_metadata?.account_subtype || null;
            const badge = user.user_metadata?.badge || null;

            const profileData = {
                name: username,
                title: accountSubtype || 'Nouveau membre',
                bio: '',
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
                banner: 'https://placehold.co/1200x300/1a1a2e/00ff88?text=Ma+Trajectoire',
                account_type: accountType,
                account_subtype: accountSubtype,
                badge: badge,
                socialLinks: {}
            };
            
            const createResult = await upsertUserProfile(user.id, profileData);
            
            if (createResult.success) {
                console.log('Profil utilisateur créé avec succès');
                return createResult.data;
            } else {
                console.error('Erreur création profil:', createResult.error);
                return null;
            }
        } else {
            console.log('Profil utilisateur trouvé');
            return profileResult.data;
        }
    } catch (error) {
        console.error('Erreur ensureUserProfile:', error);
        return null;
    }
}

/* ========================================
   CHARGEMENT DES DONNÉES
   ======================================== */

// Charger toutes les données pour un utilisateur connecté
async function loadAllData() {
    try {
        // S'assurer que l'utilisateur connecté a un profil
        if (window.currentUser) {
            await ensureUserProfile(window.currentUser);
        }
        
        // Charger tous les utilisateurs
        const usersResult = await getAllUsers();
        if (usersResult.success) {
            allUsers = usersResult.data;
            
            // S'assurer que l'utilisateur connecté est dans la liste
            if (window.currentUser && !allUsers.find(u => u.id === window.currentUser.id)) {
                // Recharger le profil de l'utilisateur connecté
                const userProfileResult = await getUserProfile(window.currentUser.id);
                if (userProfileResult.success) {
                    allUsers.push(userProfileResult.data);
                }
            }
        }
        
        // Charger le contenu pour chaque utilisateur
        for (const user of allUsers) {
            const contentResult = await getUserContent(user.id);
            if (contentResult.success) {
                userContents[user.id] = contentResult.data.map(convertSupabaseContent);
            }
            
            const projectsResult = await getUserProjects(user.id);
            if (projectsResult.success) {
                userProjects[user.id] = projectsResult.data;
            }
        }
    } catch (error) {
        console.error('Erreur chargement données:', error);
    }
}

// Charger uniquement les données publiques
async function loadPublicData() {
    try {
        const usersResult = await getAllUsers();
        if (usersResult.success) {
            allUsers = usersResult.data;
        }
        
        // Charger le contenu public
        for (const user of allUsers) {
            const contentResult = await getUserContent(user.id);
            if (contentResult.success) {
                userContents[user.id] = contentResult.data.map(convertSupabaseContent);
            }
        }
    } catch (error) {
        console.error('Erreur chargement données publiques:', error);
    }
}

/* ========================================
   FONCTIONS UTILITAIRES
   ======================================== */

// Récupérer un utilisateur par ID
function getUser(userId) {
    return allUsers.find(u => u.id === userId);
}

// Récupérer le contenu d'un utilisateur
function getUserContentLocal(userId) {
    const contents = userContents[userId] || [];
    return contents.sort((a, b) => b.day_number - a.day_number);
}

// Récupérer le dernier contenu
function getLatestContent(userId) {
    const contents = getUserContentLocal(userId);
    return contents.length > 0 ? contents[0] : null;
}

// Récupérer l'état dominant
function getDominantState(userId) {
    const contents = getUserContentLocal(userId);
    if (contents.length === 0) return 'empty';
    return contents[0].state;
}

// Convertir les données Supabase en format compatible avec le code existant
function convertSupabaseUser(supabaseUser) {
    return {
        userId: supabaseUser.id,
        name: supabaseUser.name,
        title: supabaseUser.title || '',
        avatar: supabaseUser.avatar,
        banner: supabaseUser.banner,
        bio: supabaseUser.bio || '',
        socialLinks: supabaseUser.social_links || {},
        projects: userProjects[supabaseUser.id] || []
    };
}

function convertSupabaseContent(supabaseContent) {
    return {
        contentId: supabaseContent.id,
        userId: supabaseContent.user_id,
        projectId: supabaseContent.project_id,
        arcId: supabaseContent.arc_id,
        dayNumber: supabaseContent.day_number,
        type: supabaseContent.type,
        state: supabaseContent.state,
        title: supabaseContent.title,
        description: supabaseContent.description,
        mediaUrl: supabaseContent.media_url,
        createdAt: new Date(supabaseContent.created_at),
        arc: supabaseContent.arcs ? {
            id: supabaseContent.arcs.id,
            title: supabaseContent.arcs.title,
            status: supabaseContent.arcs.status
        } : null,
        project: supabaseContent.projects ? {
            id: supabaseContent.projects.id,
            name: supabaseContent.projects.name
        } : null
    };
}

/* ========================================
   SYSTÈME DE FOLLOWERS (SUPABASE)
   ======================================== */

async function toggleFollow(viewerId, targetUserId) {
    if (!window.currentUser) {
        ToastManager.info('Connexion requise', 'Vous devez être connecté pour suivre des utilisateurs');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }
    
    const btn = document.getElementById(`follow-btn-${targetUserId}`);
    
    await LoadingManager.withLoading(btn, async () => {
        const isCurrentlyFollowing = await isFollowing(viewerId, targetUserId);
        
        if (isCurrentlyFollowing) {
            await unfollowUser(viewerId, targetUserId);
        } else {
            await followUser(viewerId, targetUserId);
        }
        
        // Refresh du bouton
        if (btn) {
            const isNowFollowing = await isFollowing(viewerId, targetUserId);
            btn.classList.toggle('unfollow', isNowFollowing);
            
            const btnText = btn.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = isNowFollowing ? '✓ Abonné' : '+ Suivre';
            } else {
                btn.textContent = isNowFollowing ? '✓ Abonné' : '+ Suivre';
            }
            
            // Toast de confirmation
            if (isNowFollowing) {
                ToastManager.success('Abonnement confirmé', 'Vous suivez maintenant cet utilisateur');
                AnimationManager.bounceIn(btn);
            } else {
                ToastManager.info('Désabonnement', 'Vous ne suivez plus cet utilisateur');
            }
        }
        
        // Mettre à jour les compteurs
        const followerCount = await getFollowerCount(targetUserId);
        const followerStats = document.querySelectorAll('.follower-stat-count');
        if (followerStats[0]) {
            followerStats[0].textContent = followerCount;
        }
    });
}

/* ========================================
   SYSTÈME DE BADGES (CONSERVÉ)
   ======================================== */

const badgeSVGs = {
    success: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>',
    failure: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 8l8 8M16 8l-8 8"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="3" height="16"/><rect x="15" y="4" width="3" height="16"/></svg>',
    empty: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
    consistency7: '<svg viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" font-size="18" font-weight="bold">7</text></svg>',
    consistency30: '<svg viewBox="0 0 24 24"><path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8z"/></svg>',
    consistency100: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    consistency365: '<svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>',
    solo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-6 2-6 2v4h12v-4s-2-2-6-2z"/></svg>',
    team: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M8 11c-2 0-3 1-3 1v3h10v-3s-1-1-3-1z"/><path d="M16 11c-2 0-3 1-3 1v3h6v-3s-1-1-3-1z"/></svg>',
    enterprise: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
    creative: '<svg viewBox="0 0 24 24"><circle cx="15.5" cy="9.5" r="1.5"/><path d="M3 17.25V21h4v-3.75L3 17.25z"/><path d="M15 8.75h.01M21 19V9c0-1.1-.9-2-2-2h-4l-4-5-4 5H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z"/></svg>',
    tech: '<svg viewBox="0 0 24 24"><path d="M9 5H7.12A2.12 2.12 0 0 0 5 7.12v9.76A2.12 2.12 0 0 0 7.12 19h9.76A2.12 2.12 0 0 0 19 16.88V15m-6-9h6V5h-6v1z"/><path d="M9 9h6v6H9z"/></svg>',
    transparent: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>'
};

function calculateConsistency(userId) {
    const contents = getUserContentLocal(userId);
    if (contents.length < 7) return null;
    
    const sortedByDay = [...contents].sort((a, b) => a.day_number - b.day_number);
    
    let consecutiveDays = 1;
    let maxConsecutive = 1;
    
    for (let i = 1; i < sortedByDay.length; i++) {
        if (sortedByDay[i].day_number - sortedByDay[i-1].day_number === 1) {
            consecutiveDays++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveDays);
        } else {
            consecutiveDays = 1;
        }
    }
    
    if (maxConsecutive >= 365) return 'consistency365';
    if (maxConsecutive >= 100) return 'consistency100';
    if (maxConsecutive >= 30) return 'consistency30';
    if (maxConsecutive >= 7) return 'consistency7';
    return null;
}

function determineTrajectoryType(userId) {
    const user = getUser(userId);
    const contents = getUserContentLocal(userId);
    
    if (!user || contents.length === 0) return null;
    
    const userTitle = user.title.toLowerCase();
    const textContent = contents.map(c => (c.title + ' ' + c.description).toLowerCase()).join(' ') + ' ' + userTitle;
    
    if (textContent.includes('unreal') || userTitle.includes('designer') || textContent.includes('motion')) return 'creative';
    if (textContent.includes('boss') || textContent.includes('game') || textContent.includes('indie')) return 'creative';
    if (textContent.includes('ceo') || textContent.includes('entreprise')) return 'enterprise';
    if (textContent.includes('refonte') || textContent.includes('ui') || textContent.includes('mobile')) return 'tech';
    if (textContent.includes('architecture') || textContent.includes('api') || textContent.includes('database')) return 'tech';
    
    return 'solo';
}

function evaluateTransparency(userId) {
    const contents = getUserContentLocal(userId);
    if (contents.length === 0) return false;
    
    const failureCount = contents.filter(c => c.state === 'failure').length;
    const ratio = failureCount / contents.length;
    
    return ratio >= 0.3;
}

function generateBadge(badgeType, label) {
    const iconTypes = new Set(['team','enterprise','creative','tech','solo']);
    if (iconTypes.has(badgeType)) {
        const iconPath = `./icons/${badgeType}.svg`;
        return `
            <div class="badge" title="${label}">
                <img src="${iconPath}" alt="${label}" class="badge-icon" />
            </div>
        `;
    }
    
    const svg = badgeSVGs[badgeType];
    if (!svg) return '';
    
    let cssClass = 'badge';
    if (badgeType.startsWith('consistency')) cssClass += '';
    else if (badgeType === 'success') cssClass += ' badge-success badge-filled';
    else if (badgeType === 'failure') cssClass += ' badge-failure badge-filled';
    else if (badgeType === 'pause') cssClass += ' badge-pause badge-filled';
    else if (badgeType === 'empty') cssClass += '';
    else if (badgeType === 'transparent') cssClass += ' badge-success';
    else cssClass += '';
    
    return `
        <div class="${cssClass}" title="${label}">
            <div class="badge-icon">${svg}</div>
            <span>${label}</span>
        </div>
    `;
}

function getUserBadges(userId) {
    const badges = [];
    
    const trajectoryType = determineTrajectoryType(userId);
    if (trajectoryType && trajectoryType !== 'solo') {
        const labels = {
            team: 'Collectif',
            enterprise: 'Entreprise',
            creative: 'Créatif',
            tech: 'Tech'
        };
        badges.push({ type: trajectoryType, label: labels[trajectoryType] });
    }
    
    const consistency = calculateConsistency(userId);
    if (consistency) {
        const labels = {
            consistency7: '7j consécutifs',
            consistency30: '30j consécutifs',
            consistency100: '100j consécutifs',
            consistency365: '365j consécutifs'
        };
        badges.push({ type: consistency, label: labels[consistency] });
    }
    
    if (evaluateTransparency(userId)) {
        badges.push({ type: 'transparent', label: 'Transparent' });
    }
    
    return badges;
}

function getContentBadges(content) {
    const badges = [];
    
    const stateLabels = {
        success: 'Victoire',
        failure: 'Bloqué',
        pause: 'Pause',
        empty: 'Vide'
    };
    
    badges.push({ type: content.state, label: stateLabels[content.state] });
    
    return badges;
}

function renderBadges(badgesList) {
    if (badgesList.length === 0) return '';
    
    return `
        <div class="badge-container">
            ${badgesList.map(b => generateBadge(b.type, b.label)).join('')}
        </div>
    `;
}

function renderProfileSocialLinks(userId) {
    const user = getUser(userId);
    // Support both snake_case (DB) and camelCase (local update)
    const socialLinks = user ? (user.social_links || user.socialLinks) : null;
    
    if (!user || !socialLinks || Object.keys(socialLinks).length === 0) {
        return '';
    }
    
    const platformLabels = {
        github: 'GitHub',
        youtube: 'YouTube',
        twitter: 'X',
        tiktok: 'TikTok',
        linkedin: 'LinkedIn',
        twitch: 'Twitch',
        spotify: 'Spotify',
        discord: 'Discord',
        reddit: 'Reddit',
        pinterest: 'Pinterest',
        facebook: 'Facebook',
        site: 'Site'
    };
    
    const platformIcons = {
        github: 'icons/github.svg',
        youtube: 'icons/youtube.svg',
        twitter: 'icons/twitter.svg',
        tiktok: 'icons/tiktok.svg',
        linkedin: 'icons/linkedin.svg',
        twitch: 'icons/twitch.svg',
        spotify: 'icons/spotify.svg',
        discord: 'icons/discord.svg',
        reddit: 'icons/reddit.svg',
        pinterest: 'icons/pinterest.svg',
        facebook: 'icons/facebook.svg',
        site: 'icons/link.svg'
    };
    
    const socialHtml = Object.entries(socialLinks)
        .filter(([_, url]) => url)
        .map(([platform, url]) => {
            const label = platformLabels[platform] || platform;
            const iconPath = platformIcons[platform] || 'icons/link.svg';
            return `
                <a href="${url}" target="_blank" rel="noopener noreferrer" 
                   class="social-badge" 
                   title="Visiter ${label}">
                    <img src="${iconPath}" alt="${platform}" class="social-badge-icon" />
                </a>
            `;
        })
        .join('');
    
    return socialHtml ? `<div class="profile-social-badges">${socialHtml}</div>` : '';
}

/* ========================================
   RENDERING - DISCOVER GRID
   ======================================== */

function renderUserCard(userId) {
    const user = getUser(userId);
    if (!user) return '';
    
    const latestContent = getLatestContent(userId);
    const dominantState = getDominantState(userId);
    
    if (!latestContent) return '';
    
    const stateColor = dominantState === 'success' ? '#10b981' 
                     : dominantState === 'failure' ? '#ef4444'
                     : '#6366f1';
    
    const userBadges = getUserBadges(userId);
    const badgesHtml = renderBadges(userBadges);
    
    let mediaHtml = '';
    if (latestContent && latestContent.mediaUrl) {
        if (latestContent.type === 'video') {
            mediaHtml = `
                <div class="card-media-wrap">
                    <video class="card-media" src="${latestContent.mediaUrl}" muted playsinline loop preload="metadata" tabindex="-1"></video>
                </div>
            `;
        } else if (latestContent.type === 'image') {
            mediaHtml = `
                <div class="card-media-wrap">
                    <img class="card-media" src="${latestContent.mediaUrl}" alt="${latestContent.title || 'Preview'}">
                </div>
            `;
        }
    }
    
    // Déterminer la classe CSS selon le type de média pour l'adaptation
    const cardClass = latestContent && latestContent.mediaUrl 
        ? `user-card has-media ${latestContent.type}` 
        : 'user-card';

    return `
        <div class="${cardClass}" data-user="${userId}" onclick="openImmersive('${userId}')">
            ${mediaHtml}
            <div class="card-content">
                <div class="card-top">
                    <img src="${user.avatar || 'https://placehold.co/40'}" class="card-avatar" onclick="event.stopPropagation(); navigateToUserProfile('${userId}')">
                    <div class="card-meta">
                        <h3 onclick="event.stopPropagation(); navigateToUserProfile('${userId}')">${user.name}</h3>
                        <span>${user.title || ''}</span>
                    </div>
                </div>
                <div class="card-status" style="border-color: ${stateColor}20; color: ${stateColor};">
                    <span class="status-day">J-${latestContent ? latestContent.dayNumber : 0}</span>
                    ${latestContent ? latestContent.title : 'Aucune activité'}
                </div>
                ${badgesHtml}
            </div>
        </div>
    `;
}

function renderDiscoverGrid() {
    const grid = document.querySelector('.discover-grid');
    if (!grid) return;
    
    // Afficher un état de chargement si les données ne sont pas encore là
    if (allUsers.length === 0) {
        LoadingStateManager.showSkeleton(grid, 'card', 6);
        return;
    }
    
    const cardsHTML = allUsers
        .map(user => renderUserCard(user.id))
        .filter(html => html !== '')
        .join('');
    
    if (cardsHTML === '') {
        LoadingStateManager.showEmptyState(
            grid,
            '👥',
            'Aucune trajectoire à explorer',
            'Revenez plus tard pour découvrir de nouvelles trajectoires.',
            { text: 'Actualiser', action: 'location.reload()' }
        );
    } else {
        grid.innerHTML = cardsHTML;
        
        // Animations d'apparition progressives
        if (window.AnimationManager) {
            setTimeout(() => {
                AnimationManager.fadeInElements('.discover-card', 150);
            }, 100);
        }
    }
    
    setupDiscoverVideoInteractions();
}

/* ========================================
   RENDERING - IMMERSIVE VIEW
   ======================================== */
function renderImmersiveContent(userId) {
    const contents = getUserContentLocal(userId);
    
    return contents.map(content => {
        const stateLabel = content.state === 'success' ? '#Victoire'
                         : content.state === 'failure' ? '#Bloqué'
: '#Pause';
        
        const contentBadges = getContentBadges(content);
        const badgesHtml = renderBadges(contentBadges);
        
        const mediaHtml = content.mediaUrl 
            ? `<img src="${content.mediaUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<div style="height: 100%; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); display: flex; align-items: center; justify-content: center; color: #333; font-size: 0.9rem;">Jour ${content.dayNumber}</div>`;
        
        return `
            <div class="immersive-post">
                <div class="post-content-wrap">
                    ${mediaHtml}
                    <div class="post-info">
                        <span class="step-indicator">Jour ${content.dayNumber}</span>
                        <span class="state-tag">${stateLabel}</span>
                        <h2>${content.title}</h2>
                        <p>${content.description}</p>
                        <div class="badges-immersive">
                            ${badgesHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openImmersive(userId) {
    const overlay = document.getElementById('immersive-overlay');
    overlay.innerHTML = `
        <div class="close-immersive" onclick="closeImmersive()">✕</div>
        ${renderImmersiveContent(userId)}
    `;
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeImmersive() {
    document.getElementById('immersive-overlay').style.display = 'none';
    document.body.style.overflow = 'auto';
}

/* ========================================
   RENDERING - PROFILE TIMELINE
   ======================================== */

async function renderProfileTimeline(userId) {
    console.log('renderProfileTimeline appelé pour userId:', userId);
    console.log('allUsers contient:', allUsers.length, 'utilisateurs');
    
    const user = getUser(userId);
    if (!user) {
        console.error('Utilisateur non trouvé dans allUsers:', userId);
        console.log('Liste des IDs dans allUsers:', allUsers.map(u => u.id));
        return '<p>Utilisateur introuvable</p>';
    }
    
    console.log('Utilisateur trouvé:', user.name);
    const contents = getUserContentLocal(userId);
    const userBadges = getUserBadges(userId);
    const userBadgesHtml = renderBadges(userBadges);
    
    const currentUserId = window.currentUserId;
    const isOwnProfile = userId === currentUserId;
    const isFollowingThisUser = currentUserId && !isOwnProfile ? await isFollowing(currentUserId, userId) : false;
    
    const settingsButtonHtml = isOwnProfile ? `
        <button class="badge live-badge btn" onclick="window.launchLive('${userId}')" title="Lancer un live" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none;">
            <div class="badge-icon"><img src="icons/live.svg" alt="Live" style="width:100%;height:100%;filter:invert(1);"></div>
            <span>Live</span>
        </button>
        <button class="badge settings-badge" onclick="openSettings('${userId}')" title="Réglages">
            <div class="badge-icon"><img src="icons/reglages.svg" alt="Réglages" style="width:100%;height:100%;"></div>
            <span>Réglages</span>
        </button>
    ` : '';
    
    const followButtonHtml = !isOwnProfile && currentUserId ? `
        <button 
            class="btn btn-follow ${isFollowingThisUser ? 'unfollow' : ''}"
            onclick="toggleFollow('${currentUserId}', '${userId}')"
            id="follow-btn-${userId}"
        >
            <span class="btn-text">${isFollowingThisUser ? '✓ Abonné' : '+ Suivre'}</span>
        </button>
    ` : '';
    
    const followerCount = await getFollowerCount(userId);
    const followingCount = await getFollowingCount(userId);
    
    // Générer la timeline
    const maxDay = contents.length > 0 ? contents[0].day_number : 0;
    const timeline = [];
    for (let day = maxDay; day >= 1; day--) {
        const dayContent = contents.find(c => c.day_number === day);
        timeline.push({
            dayNumber: day,
            content: dayContent || null,
            state: dayContent ? dayContent.state : 'empty'
        });
    }
    
    const timelineItems = timeline.map(item => {
        if (item.state === 'empty') {
            const emptyBadgeSvg = `
                <div class="timeline-dot-badge">
                    ${badgeSVGs.empty}
                </div>
            `;
            
            return `
                <div class="timeline-item item-empty">
                    ${emptyBadgeSvg}
                    <div class="timeline-date">Jour ${item.dayNumber}</div>
                    <div class="timeline-card" style="opacity: 0.5;">
                        <span class="empty-indicator">Aucune trace aujourd'hui.</span>
                    </div>
                </div>
            `;
        }
        
        const content = item.content;
        const itemClass = `item-${content.state}`;
        const dateFormatted = new Intl.DateTimeFormat('fr-FR', { 
            month: 'long', 
            day: 'numeric' 
        }).format(content.createdAt);
        
        let stateBadgeSvg = '';
        if (content.state === 'success') {
            stateBadgeSvg = badgeSVGs.success;
        } else if (content.state === 'failure') {
            stateBadgeSvg = badgeSVGs.failure;
        } else if (content.state === 'pause') {
            stateBadgeSvg = badgeSVGs.pause;
        }
        
        // Ajouter le média s'il existe
        let mediaHtml = '';
        if (content.mediaUrl) {
            if (content.type === 'video') {
                mediaHtml = `<div class="timeline-media"><video src="${content.mediaUrl}" controls style="max-width: 100%; border-radius: 8px; margin-top: 1rem;"></video></div>`;
            } else if (content.type === 'image') {
                mediaHtml = `<div class="timeline-media"><img src="${content.mediaUrl}" alt="${content.title}" style="max-width: 100%; border-radius: 8px; margin-top: 1rem;"></div>`;
            } else if (content.type === 'live' || content.type === 'gif') {
                mediaHtml = `<div class="timeline-media"><a href="${content.mediaUrl}" target="_blank" style="color: var(--accent-color); text-decoration: underline; margin-top: 1rem; display: block;">Voir le média</a></div>`;
            }
        }

        // Ajouter les références ARC/Projet
        let contextHtml = '';
        const contextItems = [];
        
        if (content.arc) {
            const arcStatusColor = content.arc.status === 'completed' ? '#10b981' : content.arc.status === 'abandoned' ? '#ef4444' : '#f59e0b';
            contextItems.push(`<span class="context-tag arc-tag" style="background: ${arcStatusColor}20; color: ${arcStatusColor}; border: 1px solid ${arcStatusColor}30;" onclick="openArcDetails('${content.arc.id}')">🎯 ${content.arc.title}</span>`);
        }
        
        if (content.project) {
            contextItems.push(`<span class="context-tag project-tag" style="background: var(--accent-color)20; color: var(--accent-color); border: 1px solid var(--accent-color)30;">📁 ${content.project.name}</span>`);
        }
        
        if (contextItems.length > 0) {
            contextHtml = `<div class="timeline-context" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">${contextItems.join('')}</div>`;
        }

        // Ajouter boutons de modification/suppression si c'est le profil de l'utilisateur connecté
        let actionsHtml = '';
        if (currentUser && currentUser.id === userId) {
            // Log de débogage pour vérifier l'ID
            console.log('Content ID pour les boutons:', content.contentId, 'Content complet:', content);
            
            actionsHtml = `
                <div class="timeline-actions" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; opacity: 0.7;">
                    <button class="btn-action" onclick="editContent('${content.contentId || content.id}')" style="background: none; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
                        ✏️ Modifier
                    </button>
                    <button class="btn-action" onclick="deleteContent('${content.contentId || content.id}')" style="background: none; border: 1px solid #ef4444; color: #ef4444; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
                        🗑️ Supprimer
                    </button>
                </div>
            `;
        }

        return `
            <div class="timeline-item ${itemClass}">
                <div class="timeline-dot-badge filled">
                    ${stateBadgeSvg}
                </div>
                <div class="timeline-date">${dateFormatted} - Jour ${content.dayNumber}</div>
                <div class="timeline-card">
                    <h4>${content.title}</h4>
                    <p>${content.description}</p>
                    ${contextHtml}
                    ${mediaHtml}
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');
    
    const timelineCollapsedHtml = timeline.length > 0 ? `
        <div class="timeline-latest">
            <div class="timeline-item-latest">
                ${(() => {
                    const lastItem = timeline[0];
                    if (lastItem.state === 'empty') {
                        return `
                            <div class="timeline-dot-badge">
                                ${badgeSVGs.empty}
                            </div>
                            <div class="timeline-date">Jour ${lastItem.dayNumber}</div>
                            <div class="timeline-card" style="opacity: 0.5;">
                                <span class="empty-indicator">Aucune trace aujourd'hui.</span>
                            </div>
                        `;
                    } else {
                        const content = lastItem.content;
                        let stateBadgeSvg = '';
                        if (content.state === 'success') {
                            stateBadgeSvg = badgeSVGs.success;
                        } else if (content.state === 'failure') {
                            stateBadgeSvg = badgeSVGs.failure;
                        } else if (content.state === 'pause') {
                            stateBadgeSvg = badgeSVGs.pause;
                        }
                        const dateFormatted = new Intl.DateTimeFormat('fr-FR', { 
                            month: 'long', 
                            day: 'numeric' 
                        }).format(content.createdAt);
                        
                        // Ajouter le média s'il existe pour la vue condensée
                        let mediaHtmlLatest = '';
                        if (content.mediaUrl) {
                            if (content.type === 'video') {
                                mediaHtmlLatest = `<div class="timeline-media"><video src="${content.mediaUrl}" controls style="max-width: 100%; border-radius: 8px; margin-top: 1rem;"></video></div>`;
                            } else if (content.type === 'image') {
                                mediaHtmlLatest = `<div class="timeline-media"><img src="${content.mediaUrl}" alt="${content.title}" style="max-width: 100%; border-radius: 8px; margin-top: 1rem;"></div>`;
                            } else if (content.type === 'live' || content.type === 'gif') {
                                mediaHtmlLatest = `<div class="timeline-media"><a href="${content.mediaUrl}" target="_blank" style="color: var(--accent-color); text-decoration: underline; margin-top: 1rem; display: block;">Voir le média</a></div>`;
                            }
                        }

                        // Ajouter les références ARC/Projet pour la vue condensée
                        let contextHtmlLatest = '';
                        const contextItemsLatest = [];
                        
                        if (content.arc) {
                            const arcStatusColor = content.arc.status === 'completed' ? '#10b981' : content.arc.status === 'abandoned' ? '#ef4444' : '#f59e0b';
                            contextItemsLatest.push(`<span class="context-tag arc-tag" style="background: ${arcStatusColor}20; color: ${arcStatusColor}; border: 1px solid ${arcStatusColor}30;" onclick="openArcDetails('${content.arc.id}')">🎯 ${content.arc.title}</span>`);
                        }
                        
                        if (content.project) {
                            contextItemsLatest.push(`<span class="context-tag project-tag" style="background: var(--accent-color)20; color: var(--accent-color); border: 1px solid var(--accent-color)30;">📁 ${content.project.name}</span>`);
                        }
                        
                        if (contextItemsLatest.length > 0) {
                            contextHtmlLatest = `<div class="timeline-context" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">${contextItemsLatest.join('')}</div>`;
                        }

                        return `
                            <div class="timeline-dot-badge filled">
                                ${stateBadgeSvg}
                            </div>
                            <div class="timeline-date">${dateFormatted} - Jour ${content.dayNumber}</div>
                            <div class="timeline-card">
                                <h4>${content.title}</h4>
                                <p>${content.description}</p>
                                ${contextHtmlLatest}
                                ${mediaHtmlLatest}
                            </div>
                        `;
                    }
                })()}
            </div>
            <button class="btn-toggle-timeline" onclick="toggleTimelineExpand(this)">
                <span class="toggle-text">Afficher l'historique complet</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            <div class="timeline-full hidden" id="timeline-full-${userId}">
                ${timelineItems}
            </div>
        </div>
    ` : '';
    
    const timelinesHtml = timelineCollapsedHtml;
    
    const safeBanner = user.banner && user.banner.startsWith('http') ? user.banner : null;
    const bannerHtml = safeBanner ? `<img src="${safeBanner}" class="profile-banner" alt="Bannière de ${user.name}" onerror="this.style.display='none'">` : '';
    
    const projects = userProjects[userId] || [];
    const projectsHtml = projects.length ? `
        <div class="projects-grid">
            ${projects.map(p => `
                <div class="project-card">
                    <img src="${p.cover || user.banner || user.avatar}" class="project-cover" alt="Cover">
                    <div class="project-meta">
                        <h4>${p.name}</h4>
                        <p>${p.description || ''}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : '';
    
    const profileHtml = `
        ${bannerHtml}
        <div class="profile-hero">
            <div class="profile-avatar-wrapper">
                <img src="${(user.avatar && user.avatar.startsWith('http')) ? user.avatar : 'https://placehold.co/150'}" class="profile-avatar-img" alt="Avatar de ${user.name}">
            </div>
            <h2>${user.name}</h2>
            <p style="color: var(--text-secondary);"><strong>${user.title}</strong></p>
            <p class="profile-bio" style="max-width: 600px; margin: 0.5rem auto; line-height: 1.5;">${user.bio || ''}</p>
            ${userBadgesHtml}
            ${renderProfileSocialLinks(userId)}
            
            ${!isOwnProfile ? `
                <div class="follow-section">
                    <div class="follower-stat">
                        <div class="follower-stat-count">${followerCount}</div>
                        <div class="follower-stat-label">Abonnés</div>
                    </div>
                    <div class="follower-stat">
                        <div class="follower-stat-count">${followingCount}</div>
                        <div class="follower-stat-label">Abonnements</div>
                    </div>
                </div>
                ${followButtonHtml}
            ` : `
                <div class="follow-section">
                    <div class="follower-stat">
                        <div class="follower-stat-count">${followerCount}</div>
                        <div class="follower-stat-label">Abonnés</div>
                    </div>
                    <div class="follower-stat">
                        <div class="follower-stat-count">${followingCount}</div>
                        <div class="follower-stat-label">Abonnements</div>
                    </div>
                </div>
                <div style="margin-top:6px; display:flex; gap:8px; align-items:center;"> 
                    <button class="btn-add" onclick="openCreateMenu('${userId}')" title="Ajouter une trace">
                        <img src="icons/plus.svg" alt="Ajouter" style="width:18px;height:18px">
                    </button>
                    <button class="btn-secondary" onclick="window.openCreateModal ? window.openCreateModal() : console.error('openCreateModal function not found')" title="Démarrer un ARC" style="padding: 0.5rem 1rem; border-radius: 12px; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        Nouvel ARC
                    </button>
                    ${settingsButtonHtml}
                </div>
            `}
        </div>
        ${projectsHtml}
        <div class="timeline">
            ${timelinesHtml}
        </div>
    `;
    
    const settingsButtonContainer = document.getElementById('settings-button-container');
    if (settingsButtonContainer) {
        settingsButtonContainer.innerHTML = '';
    }
    
    return profileHtml;
}

/* ========================================
   NAVIGATION
   ======================================== */

function navigateTo(pageId) {
    // Vérifier si l'utilisateur essaie d'accéder à son profil sans être connecté
    if (pageId === 'profile' && !currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    window.scrollTo(0, 0);
    document.body.classList.toggle('profile-open', pageId === 'profile');
}

// Make sure handleProfileNavigation is defined as an async function
async function handleProfileNavigation() {
    if (!window.currentUser) {
        // Rediriger vers la page de connexion
        window.location.href = 'login.html';
        return;
    }
    
    // Si connecté, naviguer vers le profil
    navigateTo('profile');
    
    // S'assurer que le profil est rendu avec l'utilisateur courant
    if (window.currentUserId) {
        const profileContainer = document.querySelector('.profile-container');
        if (profileContainer) {
            profileContainer.innerHTML = await renderProfileTimeline(window.currentUserId);
            if (window.loadUserArcs) window.loadUserArcs(window.currentUserId);
        }
    }
}

// Expose the function globally to ensure accessibility
window.handleProfileNavigation = handleProfileNavigation;
async function navigateToUserProfile(userId) {
    currentUserId = userId;
    const profileContainer = document.querySelector('.profile-container');
    if (profileContainer) {
        profileContainer.innerHTML = await renderProfileTimeline(userId);
        if (window.loadUserArcs) window.loadUserArcs(userId);
    }
    navigateTo('profile');
}

/* ========================================
   UTILITAIRES UI
   ======================================== */

function toggleTimelineExpand(button) {
    const timelineLatest = button.closest('.timeline-latest');
    const timelineFull = timelineLatest.querySelector('.timeline-full');
    const toggleText = button.querySelector('.toggle-text');
    const isExpanded = !timelineFull.classList.contains('hidden');
    
    if (isExpanded) {
        timelineFull.classList.add('hidden');
        toggleText.textContent = 'Afficher l\'historique complet';
        button.classList.remove('expanded');
    } else {
        timelineFull.classList.remove('hidden');
        toggleText.textContent = 'Masquer l\'historique';
        button.classList.add('expanded');
    }
}

function setupDiscoverVideoInteractions() {
    const isMobile = window.matchMedia('(max-width: 700px)').matches;
    const cards = document.querySelectorAll('.user-card');
    
    cards.forEach(card => {
        const video = card.querySelector('video.card-media');
        if (!video) return;
        
        video.muted = true;
        video.playsInline = true;
        
        if (isMobile) {
            video.play().catch(() => {});
        } else {
            card.addEventListener('mouseenter', () => {
                video.play().catch(() => {});
            });
            card.addEventListener('mouseleave', () => {
                try { video.pause(); video.currentTime = 0; } catch(e) {}
            });
            video.addEventListener('mouseover', () => video.play().catch(() => {}));
            video.addEventListener('mouseout', () => { try { video.pause(); video.currentTime = 0; } catch(e) {} });
        }
    });
}

/* ========================================
   SYSTÈME DE THÈME
   ======================================== */

function initTheme() {
    const savedTheme = localStorage.getItem('rize-theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
    }
}

function toggleTheme() {
    const htmlElement = document.documentElement;
    htmlElement.classList.toggle('light-mode');
    
    if (htmlElement.classList.contains('light-mode')) {
        localStorage.setItem('rize-theme', 'light');
    } else {
        localStorage.setItem('rize-theme', 'dark');
    }
}

function isLightMode() {
    return document.documentElement.classList.contains('light-mode');
}

/* ========================================
   RÉGLAGES
   ======================================== */

function closeSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

function openSettings(userId) {
    if (!currentUser || currentUser.id !== userId) return;

    const user = getUser(userId);
    const modal = document.getElementById('settings-modal');
    const container = modal.querySelector('.settings-container');
    
    // Social links preparation
    const socialLinks = user.social_links || user.socialLinks || {};
    
    container.innerHTML = `
        <div class="settings-section">
            <div class="settings-header" style="border:none; margin-bottom:1rem; padding-bottom:0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h2>Réglages</h2>
                    <button type="button" class="btn-theme-toggle" onclick="toggleTheme()" style="width:auto;">
                        ${isLightMode() ? '🌙 Mode Sombre' : '☀️ Mode Clair'}
                    </button>
                </div>
                <p>Personnalisez votre profil public</p>
            </div>
            
            <form id="settings-form">
                <h3>Identité</h3>
                
            <div class="upload-section" style="display: flex; flex-direction: column; gap: 2rem; margin-bottom: 2rem;">
                <!-- Avatar Section -->
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <label class="form-hint" style="margin-bottom:0.5rem; display:block;">Avatar</label>
                    <div style="position: relative; cursor: pointer;" onclick="document.getElementById('setting-avatar-file').click()">
                        <img src="${(user.avatar && user.avatar.startsWith('http')) ? user.avatar : 'https://placehold.co/150'}" class="preview-avatar-circle" id="preview-avatar" alt="Avatar" style="object-fit: cover;">
                        <div style="position: absolute; bottom: 0; right: 0; background: #fff; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.5);">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#000" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        </div>
                    </div>
                    <input type="file" id="setting-avatar-file" accept="image/*" style="display: none;">
                    <input type="hidden" id="setting-avatar" value="${user.avatar || ''}">
                    <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">Cliquez pour changer</p>
                </div>

                <!-- Banner Section -->
                <div>
                    <label class="form-hint" style="margin-bottom:0.5rem; display:block;">Bannière</label>
                    <div style="position: relative; cursor: pointer;" onclick="document.getElementById('setting-banner-file').click()">
                        <img src="${(user.banner && user.banner.startsWith('http')) ? user.banner : 'https://placehold.co/1200x300/1a1a2e/00ff88?text=Ma+Trajectoire'}" class="preview-banner-rect" id="preview-banner" alt="Bannière" style="object-fit: cover;">
                        <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; border-radius: 14px;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
                            <span style="background: rgba(0,0,0,0.6); color: white; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem;">Changer la bannière</span>
                        </div>
                    </div>
                    <input type="file" id="setting-banner-file" accept="image/*" style="display: none;">
                    <input type="hidden" id="setting-banner" value="${user.banner || ''}">
                </div>
            </div>

                <div class="form-group">
                    <label>Nom d'affichage</label>
                    <input type="text" id="setting-name" class="form-input" value="${user.name}" required>
                </div>

                <div class="form-group">
                    <label>Titre / Rôle</label>
                    <input type="text" id="setting-title" class="form-input" value="${user.title}" required>
                </div>

                <div class="form-group">
                    <label>Bio</label>
                    <textarea id="setting-bio" class="form-input" rows="4">${user.bio || ''}</textarea>
                </div>

                <h3>Réseaux Sociaux</h3>
                <div class="form-group">
                    <div class="social-link-item">
                        <img src="icons/twitter.svg" alt="X">
                        <input type="text" class="form-input" data-social="twitter" placeholder="x (twitter).com/username" value="${socialLinks.twitter || ''}">
                    </div>
                    <div class="social-link-item">
                        <img src="icons/youtube.svg" alt="YouTube">
                        <input type="text" class="form-input" data-social="youtube" placeholder="https://youtube.com" value="${socialLinks.youtube || ''}">
                    </div>
                    <div class="social-link-item">
                        <img src="icons/twitch.svg" alt="Twitch">
                        <input type="text" class="form-input" data-social="twitch" placeholder="twitch.com/username" value="${socialLinks.twitch || ''}">
                    </div>
                    <div class="social-link-item">
                        <img src="icons/spotify.svg" alt="Spotify">
                        <input type="text" class="form-input" data-social="spotify" placeholder="spotify.com/username" value="${socialLinks.spotify || ''}">
                    </div>
                    <div class="social-link-item">
                        <img src="icons/tiktok.svg" alt="TikTok">
                        <input type="text" class="form-input" data-social="tiktok" placeholder="tiktok.com/username" value="${socialLinks.tiktok || ''}">
                    </div>
                    <div class="social-link-item">
                        <img src="icons/discord.svg" alt="Discord">
                        <input type="text" class="form-input" data-social="discord" placeholder="discord.com/username" value="${socialLinks.discord || ''}">
                    </div>
                    <div class="social-link-item">
                        <img src="icons/reddit.svg" alt="Reddit">
                        <input type="text" class="form-input" data-social="reddit" placeholder="reddit.com/username" value="${socialLinks.reddit || ''}">
                    </div>
                    <div class="social-link-item">
                        <img src="icons/pinterest.svg" alt="Pinterest">
                        <input type="text" class="form-input" data-social="pinterest" placeholder="pinterest.com/username" value="${socialLinks.pinterest || ''}">
                    </div>
                    <div class="social-link-item">
                        <img src="icons/linkedin.svg" alt="LinkedIn">
                        <input type="text" class="form-input" data-social="linkedin" placeholder="linkedin.com/username" value="${socialLinks.linkedin || ''}">
                    </div>
                    <div class="social-link-item">
                        <img src="icons/facebook.svg" alt="Facebook">
                        <input type="text" class="form-input" data-social="facebook" placeholder="facebook.com/username" value="${socialLinks.facebook || ''}">
                    </div>
                    <div class="social-link-item">
                        <img src="icons/link.svg" alt="Site">
                        <input type="text" class="form-input" data-social="site" placeholder="https://example.com" value="${socialLinks.site || ''}">
                    </div>
                </div>

                <div class="actions-bar" style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;">
                    <button type="button" class="btn-cancel" onclick="closeSettings()">Annuler</button>
                    <button type="submit" class="btn-save">Enregistrer</button>
                </div>

                <div style="margin-top: 3rem; border-top: 1px solid #1a1a1a; padding-top: 2rem;">
                     <button type="button" onclick="handleSignOut()" style="width: 100%; padding: 0.8rem; background: #221a1a; color: #ef4444; border: 1px solid #3d1a1a; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s;">
                        Se déconnecter
                    </button>
                </div>
            </form>
        </div>
    `;

    modal.style.display = 'block';
    // Force reflow
    modal.offsetHeight;
    modal.classList.add('active');

    // Handle form submission
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSave = e.target.querySelector('.btn-save');
        const originalText = btnSave.textContent;
        btnSave.disabled = true;
        btnSave.textContent = 'Enregistrement...';

        const socialInputs = e.target.querySelectorAll('[data-social]');
        const newSocialLinks = {};
        socialInputs.forEach(input => {
            if (input.value.trim()) {
                newSocialLinks[input.dataset.social] = input.value.trim();
            }
        });

        const profileData = {
            name: document.getElementById('setting-name').value,
            title: document.getElementById('setting-title').value,
            bio: document.getElementById('setting-bio').value,
            avatar: document.getElementById('setting-avatar').value,
            banner: document.getElementById('setting-banner').value,
            socialLinks: newSocialLinks
        };

        const result = await upsertUserProfile(userId, profileData);
        
        if (result.success) {
            // Update local state
            const userIndex = allUsers.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                // Merge new data
                allUsers[userIndex] = { ...allUsers[userIndex], ...result.data };
            }
            
            // Reload profile view
            if (document.querySelector('#profile.active')) {
                const profileContainer = document.querySelector('.profile-container');
                if (profileContainer) {
                    profileContainer.innerHTML = await renderProfileTimeline(userId);
                }
            }
            
            closeSettings();
        } else {
            alert('Erreur: ' + result.error);
        }
        
        btnSave.disabled = false;
        btnSave.textContent = originalText;
    });

    // Initialize file uploads
    if (typeof initializeFileInput === 'function') {
        // Avatar upload
        initializeFileInput('setting-avatar-file', {
            preview: 'preview-avatar',
            compress: true,
            onUpload: (result) => {
                if (result.success) {
                    document.getElementById('setting-avatar').value = result.url;
                } else {
                    alert('Erreur upload: ' + result.error);
                }
            }
        });

        // Banner upload
        initializeFileInput('setting-banner-file', {
            preview: 'preview-banner',
            compress: true,
            onUpload: (result) => {
                if (result.success) {
                    document.getElementById('setting-banner').value = result.url;
                } else {
                    alert('Erreur upload: ' + result.error);
                }
            }
        });
    }
}

/* ========================================
   LIVE STREAMING
   ======================================== */

let currentStream = null;
let screenStream = null;
let cameraStream = null;
let isLive = false;

// Polyfill pour roundRect si non supporté
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        this.beginPath();
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        this.closePath();
        return this;
    };
}

function launchLive(userId) {
    if (!window.currentUser) {
        if (window.ToastManager) {
            ToastManager.error('Connexion requise', 'Vous devez être connecté pour lancer un live');
        }
        return;
    }
    
    if (window.currentUser.id !== userId) {
        if (window.ToastManager) {
            ToastManager.error('Erreur', 'Vous ne pouvez lancer un live que pour votre propre profil');
        }
        return;
    }
    
    // Redirection vers la page de création de stream
    if (window.ToastManager) {
        ToastManager.success('Lancement Live', 'Redirection vers la configuration du live...');
    }
    
    setTimeout(() => {
        window.location.href = 'create-stream.html';
    }, 500);
}

// Exposer les fonctions globalement pour les onclick
window.launchLive = launchLive;
window.createLiveModal = createLiveModal;
window.closeLiveModal = closeLiveModal;
window.toggleCamera = toggleCamera;
window.toggleScreenShare = toggleScreenShare;
window.setLayout = setLayout;
window.updateCameraSize = updateCameraSize;
window.updateCameraPosition = updateCameraPosition;
window.startLiveStream = startLiveStream;
window.stopLiveStream = stopLiveStream;

function createLiveModal() {
    const modal = document.createElement('div');
    modal.id = 'live-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content live-modal-content">
            <div class="modal-header">
                <h2><img src="icons/live.svg" alt="Live" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;filter:invert(0.2);"> Configuration Live Stream</h2>
                <button class="close-btn" onclick="closeLiveModal()">&times;</button>
            </div>
            <div class="live-controls">
                <div class="stream-preview">
                    <video id="live-preview" autoplay muted playsinline></video>
                    <div class="stream-status" id="stream-status">
                        <span class="status-indicator offline">● Hors ligne</span>
                    </div>
                </div>
                
                <div class="control-panel">
                    <div class="source-controls">
                        <h3>Sources de streaming</h3>
                        <div class="source-buttons">
                            <button class="source-btn" id="camera-btn" onclick="toggleCamera()">
                                📹 Caméra
                            </button>
                            <button class="source-btn" id="screen-btn" onclick="toggleScreenShare()">
                                🖥️ Écran
                            </button>
                        </div>
                    </div>
                    
                    <div class="layout-controls" id="layout-controls" style="display: none;">
                        <h3>Mise en page</h3>
                        <div class="layout-options">
                            <button class="layout-btn active" onclick="setLayout('single')">Simple</button>
                            <button class="layout-btn" onclick="setLayout('pip')">Incrustation</button>
                            <button class="layout-btn" onclick="setLayout('side')">Côte à côte</button>
                        </div>
                        
                        <div class="size-controls" id="size-controls">
                            <div class="size-control">
                                <label>Taille caméra (%)</label>
                                <input type="range" id="camera-size" min="20" max="80" value="30" onchange="updateCameraSize(this.value)">
                                <span id="camera-size-value">30%</span>
                            </div>
                            <div class="size-control">
                                <label>Position caméra</label>
                                <select id="camera-position" onchange="updateCameraPosition(this.value)">
                                    <option value="bottom-right">Bas droite</option>
                                    <option value="bottom-left">Bas gauche</option>
                                    <option value="top-right">Haut droite</option>
                                    <option value="top-left">Haut gauche</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stream-actions">
                        <button class="btn-start-stream" id="start-stream-btn" onclick="startLiveStream()" disabled>
                            ▶️ Démarrer le live
                        </button>
                        <button class="btn-stop-stream" id="stop-stream-btn" onclick="stopLiveStream()" style="display: none;">
                            ⏹️ Arrêter le live
                        </button>
                    </div>
                    
                    <div class="stream-info">
                        <div class="info-item">
                            <label>Titre du live</label>
                            <input type="text" id="stream-title" placeholder="Mon super live stream!" maxlength="100">
                        </div>
                        <div class="info-item">
                            <label>Description</label>
                            <textarea id="stream-description" placeholder="Décrivez votre live..." maxlength="500"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function closeLiveModal() {
    const modal = document.getElementById('live-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
        modal.style.display = 'none';
        // Nettoyer les streams si en cours
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            screenStream = null;
        }
    }, 300);
}

async function toggleCamera() {
    const btn = document.getElementById('camera-btn');
    const preview = document.getElementById('live-preview');
    
    if (cameraStream) {
        // Arrêter la caméra
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        btn.classList.remove('active');
        btn.textContent = '📹 Caméra';
        updatePreview();
    } else {
        // Démarrer la caméra
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: true
            });
            btn.classList.add('active');
            btn.textContent = '📹 Caméra (ON)';
            updatePreview();
            checkStreamReady();
        } catch (error) {
            console.error('Erreur caméra:', error);
            alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
        }
    }
}

async function toggleScreenShare() {
    const btn = document.getElementById('screen-btn');
    const preview = document.getElementById('live-preview');
    
    if (screenStream) {
        // Arrêter le partage d'écran
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
        btn.classList.remove('active');
        btn.textContent = '🖥️ Écran';
        updatePreview();
    } else {
        // Démarrer le partage d'écran
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: true
            });
            
            // Écouter l'arrêt du partage d'écran par l'utilisateur
            screenStream.getVideoTracks()[0].onended = () => {
                screenStream = null;
                btn.classList.remove('active');
                btn.textContent = '🖥️ Écran';
                updatePreview();
                checkStreamReady();
            };
            
            btn.classList.add('active');
            btn.textContent = '🖥️ Écran (ON)';
            updatePreview();
            checkStreamReady();
        } catch (error) {
            console.error('Erreur partage d\'écran:', error);
            alert('Impossible de partager l\'écran. Opération annulée par l\'utilisateur.');
        }
    }
}

function updatePreview() {
    const preview = document.getElementById('live-preview');
    const layoutControls = document.getElementById('layout-controls');
    
    if (screenStream && cameraStream) {
        // Mode mixte - afficher les contrôles de layout
        layoutControls.style.display = 'block';
        setLayout(document.querySelector('.layout-btn.active')?.onclick?.toString().match(/setLayout\('(.+)'\)/)?.[1] || 'pip');
    } else if (screenStream) {
        // Écran seulement
        preview.srcObject = screenStream;
        layoutControls.style.display = 'none';
    } else if (cameraStream) {
        // Caméra seulement
        preview.srcObject = cameraStream;
        layoutControls.style.display = 'none';
    } else {
        // Aucun stream
        preview.srcObject = null;
        layoutControls.style.display = 'none';
    }
}

function setLayout(layout) {
    // Retirer la classe active de tous les boutons
    document.querySelectorAll('.layout-btn').forEach(btn => btn.classList.remove('active'));
    // Ajouter la classe active au bouton sélectionné
    event.target.classList.add('active');
    
    const preview = document.getElementById('live-preview');
    const sizeControls = document.getElementById('size-controls');
    
    if (!screenStream || !cameraStream) return;
    
    // Créer un canvas pour mixer les streams
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    
    const screenVideo = document.createElement('video');
    const cameraVideo = document.createElement('video');
    
    screenVideo.srcObject = screenStream;
    cameraVideo.srcObject = cameraStream;
    
    screenVideo.muted = true;
    cameraVideo.muted = true;
    
    Promise.all([
        new Promise(resolve => screenVideo.onloadedmetadata = resolve),
        new Promise(resolve => cameraVideo.onloadedmetadata = resolve)
    ]).then(() => {
        screenVideo.play();
        cameraVideo.play();
        
        function drawFrame() {
            if (layout === 'single') {
                // Écran seulement
                ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
                sizeControls.style.display = 'none';
            } else if (layout === 'pip') {
                // Picture-in-picture
                const cameraSize = parseInt(document.getElementById('camera-size').value);
                const cameraWidth = (canvas.width * cameraSize) / 100;
                const cameraHeight = (cameraWidth * 9) / 16; // Ratio 16:9
                
                const position = document.getElementById('camera-position').value;
                let x, y;
                
                switch (position) {
                    case 'bottom-right':
                        x = canvas.width - cameraWidth - 20;
                        y = canvas.height - cameraHeight - 20;
                        break;
                    case 'bottom-left':
                        x = 20;
                        y = canvas.height - cameraHeight - 20;
                        break;
                    case 'top-right':
                        x = canvas.width - cameraWidth - 20;
                        y = 20;
                        break;
                    case 'top-left':
                        x = 20;
                        y = 20;
                        break;
                }
                
                // Dessiner l'écran en arrière-plan
                ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
                
                // Dessiner la caméra par-dessus
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(x, y, cameraWidth, cameraHeight, 10);
                ctx.clip();
                ctx.drawImage(cameraVideo, x, y, cameraWidth, cameraHeight);
                ctx.restore();
                
                sizeControls.style.display = 'block';
            } else if (layout === 'side') {
                // Côte à côte
                const screenWidth = canvas.width * 0.7;
                const cameraWidth = canvas.width * 0.3;
                
                ctx.drawImage(screenVideo, 0, 0, screenWidth, canvas.height);
                ctx.drawImage(cameraVideo, screenWidth, 0, cameraWidth, canvas.height);
                
                sizeControls.style.display = 'none';
            }
            
            if (currentStream) {
                requestAnimationFrame(drawFrame);
            }
        }
        
        // Créer un stream à partir du canvas
        currentStream = canvas.captureStream(30);
        
        // Ajouter l'audio du stream principal (écran ou caméra)
        if (screenStream.getAudioTracks().length > 0) {
            currentStream.addTrack(screenStream.getAudioTracks()[0]);
        } else if (cameraStream.getAudioTracks().length > 0) {
            currentStream.addTrack(cameraStream.getAudioTracks()[0]);
        }
        
        preview.srcObject = currentStream;
        drawFrame();
    });
}

function updateCameraSize(value) {
    document.getElementById('camera-size-value').textContent = value + '%';
    if (currentStream && document.querySelector('.layout-btn.active')?.textContent === 'Incrustation') {
        setLayout('pip');
    }
}

function updateCameraPosition(position) {
    if (currentStream && document.querySelector('.layout-btn.active')?.textContent === 'Incrustation') {
        setLayout('pip');
    }
}

function checkStreamReady() {
    const startBtn = document.getElementById('start-stream-btn');
    startBtn.disabled = !(screenStream || cameraStream);
}

async function startLiveStream() {
    const title = document.getElementById('stream-title').value || 'Live Stream';
    const description = document.getElementById('stream-description').value || '';
    
    if (!currentStream && !screenStream && !cameraStream) {
        alert('Veuillez sélectionner au moins une source (caméra ou écran)');
        return;
    }
    
    try {
        // Si pas de stream mixte, utiliser le stream principal
        if (!currentStream) {
            currentStream = screenStream || cameraStream;
        }
        
        // Mettre à jour l'interface
        isLive = true;
        document.getElementById('start-stream-btn').style.display = 'none';
        document.getElementById('stop-stream-btn').style.display = 'inline-block';
        document.getElementById('stream-status').innerHTML = '<span class="status-indicator live">● En direct</span>';
        
        // Créer une entrée de contenu live dans la base de données
        await createLiveContent(title, description);
        
        alert('✅ Live démarré ! Votre stream est maintenant en direct.');
        
    } catch (error) {
        console.error('Erreur démarrage live:', error);
        alert('Erreur lors du démarrage du live: ' + error.message);
    }
}

async function stopLiveStream() {
    try {
        // Arrêter tous les streams
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        
        isLive = false;
        document.getElementById('start-stream-btn').style.display = 'inline-block';
        document.getElementById('stop-stream-btn').style.display = 'none';
        document.getElementById('stream-status').innerHTML = '<span class="status-indicator offline">● Hors ligne</span>';
        
        alert('⏹️ Live arrêté.');
        
    } catch (error) {
        console.error('Erreur arrêt live:', error);
        alert('Erreur lors de l\'arrêt du live: ' + error.message);
    }
}

async function getNextDayNumber(userId) {
    const contents = getUserContentLocal(userId);
    const maxDay = contents.length > 0 ? contents[0].day_number : 0;
    return maxDay + 1;
}

async function createLiveContent(title, description) {
    // Créer une entrée de contenu live
    const contentData = {
        userId: currentUser.id,
        type: 'live',
        state: 'success',
        title: title,
        description: description,
        mediaUrl: null, // Pour un live, pas d'URL statique
        dayNumber: await getNextDayNumber(currentUser.id)
    };
    
    try {
        const result = await createContent(contentData);
        console.log('Contenu live créé:', result);
    } catch (error) {
        console.error('Erreur création contenu live:', error);
    }
}

/* ========================================
   CRÉATION DE CONTENU
   ======================================== */

function closeCreateMenu() {
    const modal = document.getElementById('create-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

async function openCreateMenu(userId, preSelectedArcId = null, existingContent = null) {
    if (!currentUser || currentUser.id !== userId) return;

    const modal = document.getElementById('create-modal');
    const container = modal.querySelector('.create-container');
    
    // Calculate next day ou utiliser jour existant si édition
    const contents = getUserContentLocal(userId);
    const maxDay = contents.length > 0 ? contents[0].day_number : 0;
    const nextDay = existingContent ? existingContent.day_number : maxDay + 1;

    // Get user projects for selection
    const projects = userProjects[userId] || [];
    const projectOptions = projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    // Get user ARCs for selection
    let arcOptions = '';
    try {
        const { data: arcs } = await supabase
            .from('arcs')
            .select('id, title')
            .eq('user_id', userId)
            .eq('status', 'in_progress');
        
        if (arcs && arcs.length > 0) {
            arcOptions = arcs.map(a => {
                const selected = preSelectedArcId && a.id === preSelectedArcId ? 'selected' : '';
                return `<option value="${a.id}" ${selected}>${a.title}</option>`;
            }).join('');
        }
    } catch (e) {
        console.error("Error fetching arcs for create menu", e);
    }

    const isEdit = !!existingContent;
    const title = isEdit ? 'Modifier la Trace' : 'Nouvelle Trace';
    const subtitle = isEdit ? `Modifier la trace du jour ${nextDay}` : `Documentez votre progression du jour ${nextDay}`;

    container.innerHTML = `
        <div class="settings-section">
            <div class="settings-header" style="border:none; margin-bottom:1rem; padding-bottom:0;">
                <h2>${title}</h2>
                <p>${subtitle}</p>
            </div>
            
            <form id="create-form">
                ${isEdit ? `<input type="hidden" id="content-id" value="${existingContent.id}">` : ''}
                
                <div class="form-group">
                    <label>Jour #</label>
                    <input type="number" id="create-day" class="form-input" value="${nextDay}" required>
                </div>

                <div class="form-group">
                    <label>Titre de l'accomplissement</label>
                    <input type="text" id="create-title" class="form-input" placeholder="Ex: Intégration de l'API terminée" value="${isEdit ? existingContent.title : ''}" required>
                </div>

                <div class="form-group">
                    <label>Description</label>
                    <textarea id="create-desc" class="form-input" rows="4" placeholder="Détaillez ce que vous avez fait, appris ou surmonté..." required>${isEdit ? existingContent.description : ''}</textarea>
                </div>

                <div class="form-group">
                    <label>État</label>
                    <select id="create-state" class="form-input">
                        <option value="success" ${isEdit && existingContent.state === 'success' ? 'selected' : ''}>Victoire (Vert)</option>
                        <option value="failure" ${isEdit && existingContent.state === 'failure' ? 'selected' : ''}>Bloqué / Échec (Rouge)</option>
                        <option value="pause" ${isEdit && existingContent.state === 'pause' ? 'selected' : ''}>Pause / Réflexion (Violet)</option>
                    </select>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Projet (Optionnel)</label>
                        <select id="create-project" class="form-input">
                            <option value="">Aucun projet spécifique</option>
                            ${projects.map(p => `<option value="${p.id}" ${isEdit && existingContent.project_id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>ARC (Optionnel)</label>
                        <select id="create-arc" class="form-input">
                            <option value="">Hors ARC</option>
                            ${arcOptions}
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label>Type de média</label>
                    <select id="create-type" class="form-input">
                        <option value="image" ${isEdit && existingContent.type === 'image' ? 'selected' : ''}>Image</option>
                        <option value="video" ${isEdit && existingContent.type === 'video' ? 'selected' : ''}>Vidéo</option>
                        <option value="live" ${isEdit && existingContent.type === 'live' ? 'selected' : ''}>Live / Stream</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Média</label>
                    
                    <!-- Upload Zone for Image/Video -->
                    <div id="media-upload-container">
                        <div class="upload-zone" id="create-media-dropzone" style="border: 2px dashed var(--border-color); padding: 2rem; border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.3s ease; background: rgba(255,255,255,0.02);">
                            <div id="create-media-preview-container" style="display: none; margin-bottom: 1rem;">
                                <!-- Preview will be inserted here -->
                            </div>
                            <div id="create-media-loader" style="display: none; margin-bottom: 1rem;">
                                <div style="display: inline-block; width: 24px; height: 24px; border: 2px solid var(--accent-color); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                                <p style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary);">Upload en cours...</p>
                            </div>
                            <div id="create-media-placeholder">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                <p style="color: var(--text-secondary); font-size: 0.9rem;">Cliquez ou glissez un fichier ici</p>
                                <p style="color: var(--text-secondary); font-size: 0.75rem; opacity: 0.7;">JPG, PNG, GIF, MP4 (Max 50MB)</p>
                            </div>
                        </div>
                        <input type="file" id="create-media-file" accept="image/*,video/*" style="display: none;">
                    </div>

                    <!-- URL Input for Live -->
                    <div id="media-url-container" style="display: none;">
                        <input type="text" id="create-live-url" class="form-input" placeholder="Lien du Live (ex: Twitch, YouTube...)" style="margin-bottom: 0.5rem;">
                        <p class="form-hint">Le lien sera affiché comme une trace active.</p>
                    </div>

                    <input type="hidden" id="create-media-url" value="${isEdit && existingContent.media_url ? existingContent.media_url : ''}">
                    <input type="hidden" id="create-media-type" value="${isEdit && existingContent.type ? existingContent.type : 'image'}">
                </div>

                <div class="actions-bar">
                    <button type="button" class="btn-cancel" onclick="closeCreateMenu()">Annuler</button>
                    <button type="submit" class="btn-save">${isEdit ? 'Mettre à jour' : 'Publier la trace'}</button>
                </div>
            </form>
        </div>
    `;

    modal.style.display = 'block';
    // Force reflow
    modal.offsetHeight;
    modal.classList.add('active');

    // Initialize file upload
    if (typeof initializeFileInput === 'function') {
        const typeSelect = document.getElementById('create-type');
        const uploadContainer = document.getElementById('media-upload-container');
        const urlContainer = document.getElementById('media-url-container');
        const liveInput = document.getElementById('create-live-url');
        const mediaUrlInput = document.getElementById('create-media-url');
        const mediaTypeInput = document.getElementById('create-media-type');
        
        const dropZone = document.getElementById('create-media-dropzone');
        const fileInput = document.getElementById('create-media-file');
        const previewContainer = document.getElementById('create-media-preview-container');
        const placeholder = document.getElementById('create-media-placeholder');
        const loader = document.getElementById('create-media-loader');

        // Toggle logic
        typeSelect.addEventListener('change', () => {
            const type = typeSelect.value;
            mediaTypeInput.value = type;
            
            if (type === 'live') {
                uploadContainer.style.display = 'none';
                urlContainer.style.display = 'block';
                // Use the live URL if set
                mediaUrlInput.value = liveInput.value;
            } else {
                uploadContainer.style.display = 'block';
                urlContainer.style.display = 'none';
                
                // Update accept attribute
                if (type === 'image') {
                    fileInput.accept = 'image/*';
                } else if (type === 'video') {
                    fileInput.accept = 'video/*';
                }
            }
        });

        // Live URL handler
        liveInput.addEventListener('input', () => {
            if (typeSelect.value === 'live') {
                mediaUrlInput.value = liveInput.value;
            }
        });
        
        // Handle click on dropzone (prevent double click if clicking preview)
        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'IMG' && e.target.tagName !== 'VIDEO') {
                fileInput.click();
            }
        });

        // Add spinning animation style if not exists
        if (!document.getElementById('spin-style')) {
            const style = document.createElement('style');
            style.id = 'spin-style';
            style.innerHTML = '@keyframes spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }

        // Custom handler to show loader
        fileInput.addEventListener('change', () => {
             if (fileInput.files.length > 0) {
                 placeholder.style.display = 'none';
                 previewContainer.style.display = 'none';
                 loader.style.display = 'block';
             }
        });

        initializeFileInput('create-media-file', {
            dropZone: dropZone,
            compress: true,
            onUpload: (result) => {
                loader.style.display = 'none';
                
                if (result.success) {
                    document.getElementById('create-media-url').value = result.url;
                    document.getElementById('create-media-type').value = result.type;
                    
                    // Update Preview
                    previewContainer.style.display = 'block';
                    
                    if (result.type === 'image') {
                        previewContainer.innerHTML = `<img src="${result.url}" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">`;
                    } else {
                        previewContainer.innerHTML = `<video src="${result.url}" controls style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);"></video>`;
                    }
                } else {
                    placeholder.style.display = 'block';
                    alert('Erreur upload: ' + result.error);
                }
            }
        });
    }

    // Préremplir les champs existants si édition
    if (isEdit && existingContent) {
        if (existingContent.media_url) {
            previewContainer.style.display = 'block';
            placeholder.style.display = 'none';
            
            if (existingContent.type === 'image') {
                previewContainer.innerHTML = `<img src="${existingContent.media_url}" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">`;
            } else if (existingContent.type === 'video') {
                previewContainer.innerHTML = `<video src="${existingContent.media_url}" controls style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);"></video>`;
            } else if (existingContent.type === 'live') {
                uploadContainer.style.display = 'none';
                urlContainer.style.display = 'block';
                liveInput.value = existingContent.media_url;
            }
        }
    }

    // Handle form submission
    document.getElementById('create-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const mediaUrl = document.getElementById('create-media-url').value;
        if (!mediaUrl) {
            alert("Veuillez uploader une image ou une vidéo.");
            return;
        }

        const btnSave = e.target.querySelector('.btn-save');
        const originalText = btnSave.textContent;
        btnSave.disabled = true;
        btnSave.textContent = isEdit ? 'Mise à jour...' : 'Publication...';

        const contentData = {
            userId: userId,
            dayNumber: parseInt(document.getElementById('create-day').value),
            title: document.getElementById('create-title').value,
            description: document.getElementById('create-desc').value,
            state: document.getElementById('create-state').value,
            type: document.getElementById('create-media-type').value,
            mediaUrl: mediaUrl,
            projectId: document.getElementById('create-project').value || null,
            arcId: document.getElementById('create-arc').value || null
        };

        let result;
        if (isEdit) {
            // Mise à jour
            const contentId = document.getElementById('content-id').value;
            result = await updateContent(contentId, contentData);
        } else {
            // Création
            result = await createContent(contentData);
        }
        
        if (result.success) {
            // Recharger les données locales et rafraîchir l'interface
            await loadAllData();
            
            // Reload profile view
            if (document.querySelector('#profile.active')) {
                const profileContainer = document.querySelector('.profile-container');
                if (profileContainer) {
                    profileContainer.innerHTML = await renderProfileTimeline(userId);
                    if (window.loadUserArcs) window.loadUserArcs(userId);
                }
            }
            
            closeCreateMenu();
        } else {
            alert('Erreur: ' + result.error);
        }
        
        btnSave.disabled = false;
        btnSave.textContent = originalText;
    });
}

/* ========================================
   GESTION DU CONTENU - MODIFICATION/SUPPRESSION
   ======================================== */

async function editContent(contentId) {
    try {
        // Récupérer les détails du contenu
        const { data: content, error } = await supabase
            .from('content')
            .select(`
                *,
                arcs (id, title),
                projects (id, name)
            `)
            .eq('id', contentId)
            .single();

        if (error) throw error;

        // Vérifier que c'est bien le contenu de l'utilisateur connecté
        if (!currentUser || content.user_id !== currentUser.id) {
            alert('Vous ne pouvez modifier que votre propre contenu.');
            return;
        }

        // Pré-remplir le formulaire d'édition
        await openCreateMenu(currentUser.id, content.arc_id, content);

    } catch (error) {
        console.error('Erreur lors de la récupération du contenu:', error);
        alert('Erreur lors du chargement du contenu.');
    }
}

async function deleteContent(contentId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette trace ? Cette action est irréversible.')) {
        return;
    }

    console.log('Tentative de suppression du contenu ID:', contentId);
    console.log('Utilisateur actuel:', currentUser);

    if (!window.currentUser) {
        alert('Vous devez être connecté pour supprimer une trace.');
        return;
    }

    try {
        // Vérifier d'abord que le contenu existe et appartient à l'utilisateur
        const { data: contentToDelete, error: fetchError } = await supabase
            .from('content')
            .select('id, user_id, title')
            .eq('id', contentId)
            .single();

        if (fetchError) {
            console.error('Erreur lors de la récupération du contenu:', fetchError);
            throw new Error('Contenu introuvable: ' + fetchError.message);
        }

        if (contentToDelete.user_id !== currentUser.id) {
            alert('Vous ne pouvez supprimer que votre propre contenu.');
            return;
        }

        console.log('Contenu à supprimer:', contentToDelete);

        // Procéder à la suppression
        const { error } = await supabase
            .from('content')
            .delete()
            .eq('id', contentId);

        if (error) {
            console.error('Erreur Supabase lors de la suppression:', error);
            throw error;
        }

        console.log('Suppression réussie, rechargement du profil...');

        // Recharger le profil
        if (document.querySelector('#profile.active')) {
            await loadAllData();
            const profileContainer = document.querySelector('.profile-container');
            if (profileContainer) {
                profileContainer.innerHTML = await renderProfileTimeline(currentUser.id);
                if (window.loadUserArcs) window.loadUserArcs(currentUser.id);
            }
        }

        alert('Trace supprimée avec succès.');

    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de la trace: ' + error.message);
    }
}

// Rendre les fonctions disponibles globalement
window.editContent = editContent;
window.deleteContent = deleteContent;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.openCreateMenu = openCreateMenu;
window.closeCreateMenu = closeCreateMenu;
window.toggleTimelineExpand = toggleTimelineExpand;
window.openImmersive = openImmersive;
window.closeImmersive = closeImmersive;
window.navigateToUserProfile = navigateToUserProfile;
window.toggleFollow = toggleFollow;
window.openArcDetails = openArcDetails;
window.toggleTheme = toggleTheme;
window.handleSignOut = handleSignOut;

/* ========================================
   INITIALISATION AU CHARGEMENT
   ======================================== */

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});
window.openCreateMenu = openCreateMenu;
