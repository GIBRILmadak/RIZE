/* ========================================
   SYSTÈME DE LIVE STREAMING
   ======================================== */

let currentStream = null;
let streamChannel = null;
let chatChannel = null;
let viewerHeartbeat = null;

// Créer une session de streaming
async function createStreamingSession(streamData) {
    try {
        const { data, error } = await supabase
            .from('streaming_sessions')
            .insert({
                user_id: currentUser.id,
                title: streamData.title,
                description: streamData.description,
                thumbnail_url: streamData.thumbnailUrl,
                status: 'live'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        return { success: true, data: data };
        
    } catch (error) {
        console.error('Erreur création stream:', error);
        return { success: false, error: error.message };
    }
}

// Démarrer un stream
async function startStream(streamData) {
    try {
        // Créer la session
        const result = await createStreamingSession(streamData);
        if (!result.success) throw new Error(result.error);
        
        currentStream = result.data;
        
        // S'abonner aux événements du stream
        subscribeToStream(currentStream.id);
        
        // Démarrer le heartbeat pour maintenir la présence
        startViewerHeartbeat(currentStream.id);
        
        return { success: true, stream: currentStream };
        
    } catch (error) {
        console.error('Erreur démarrage stream:', error);
        return { success: false, error: error.message };
    }
}

// Rejoindre un stream
async function joinStream(streamId) {
    try {
        // Enregistrer comme viewer
        const { error } = await supabase
            .from('stream_viewers')
            .upsert({
                stream_id: streamId,
                user_id: currentUser.id,
                last_seen: new Date().toISOString()
            });
        
        if (error) throw error;
        
        // Récupérer les infos du stream
        const { data: stream, error: streamError } = await supabase
            .from('streaming_sessions')
            .select('*, users(name, avatar)')
            .eq('id', streamId)
            .single();
        
        if (streamError) throw streamError;
        
        currentStream = stream;
        
        // S'abonner aux événements
        subscribeToStream(streamId);
        
        // Démarrer le heartbeat
        startViewerHeartbeat(streamId);
        
        return { success: true, stream: stream };
        
    } catch (error) {
        console.error('Erreur rejoindre stream:', error);
        return { success: false, error: error.message };
    }
}

// S'abonner aux événements du stream
function subscribeToStream(streamId) {
    // Canal pour les messages de chat
    chatChannel = supabase
        .channel(`stream-chat-${streamId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'stream_messages',
                filter: `stream_id=eq.${streamId}`
            },
            (payload) => {
                handleNewChatMessage(payload.new);
            }
        )
        .subscribe();
    
    // Canal pour les mises à jour du stream
    streamChannel = supabase
        .channel(`stream-${streamId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'streaming_sessions',
                filter: `id=eq.${streamId}`
            },
            (payload) => {
                handleStreamUpdate(payload.new);
            }
        )
        .subscribe();
}

// Envoyer un message dans le chat
async function sendChatMessage(message) {
    if (!currentStream) return { success: false, error: 'Pas de stream actif' };
    
    try {
        const { data, error } = await supabase
            .from('stream_messages')
            .insert({
                stream_id: currentStream.id,
                user_id: currentUser.id,
                message: message
            })
            .select('*, users(name, avatar)')
            .single();
        
        if (error) throw error;
        
        return { success: true, data: data };
        
    } catch (error) {
        console.error('Erreur envoi message:', error);
        return { success: false, error: error.message };
    }
}

// Charger l'historique du chat
async function loadChatHistory(streamId, limit = 50) {
    try {
        const { data, error } = await supabase
            .from('stream_messages')
            .select('*, users(name, avatar)')
            .eq('stream_id', streamId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        
        return { success: true, messages: data.reverse() };
        
    } catch (error) {
        console.error('Erreur chargement chat:', error);
        return { success: false, error: error.message };
    }
}

// Gérer un nouveau message de chat
function handleNewChatMessage(message) {
    const chatContainer = document.getElementById('stream-chat-messages');
    if (!chatContainer) return;
    
    const messageElement = createChatMessageElement(message);
    chatContainer.appendChild(messageElement);
    
    // Scroll vers le bas
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Créer un élément de message de chat
function createChatMessageElement(message) {
    const div = document.createElement('div');
    div.className = 'chat-message';
    
    const isOwnMessage = message.user_id === currentUser?.id;
    if (isOwnMessage) div.classList.add('own-message');
    
    div.innerHTML = `
        <img src="${message.users?.avatar || 'https://placehold.co/32'}" class="chat-avatar" alt="${message.users?.name}">
        <div class="chat-message-content">
            <div class="chat-message-header">
                <span class="chat-username">${message.users?.name || 'Utilisateur'}</span>
                <span class="chat-timestamp">${formatChatTime(message.created_at)}</span>
            </div>
            <div class="chat-message-text">${escapeHtml(message.message)}</div>
        </div>
    `;
    
    return div;
}

// Gérer une mise à jour du stream
function handleStreamUpdate(stream) {
    currentStream = stream;
    
    // Mettre à jour l'UI
    updateStreamUI(stream);
    
    // Si le stream est terminé
    if (stream.status === 'ended') {
        handleStreamEnded();
    }
}

// Mettre à jour l'UI du stream
function updateStreamUI(stream) {
    const viewerCount = document.getElementById('stream-viewer-count');
    if (viewerCount) {
        viewerCount.textContent = stream.viewer_count || 0;
    }
    
    const status = document.getElementById('stream-status');
    if (status) {
        status.textContent = stream.status === 'live' ? '🔴 EN DIRECT' : 'Terminé';
        status.className = `stream-status ${stream.status}`;
    }
}

// Terminer un stream
async function endStream() {
    if (!currentStream) return { success: false, error: 'Pas de stream actif' };
    
    try {
        const { error } = await supabase
            .from('streaming_sessions')
            .update({
                status: 'ended',
                ended_at: new Date().toISOString()
            })
            .eq('id', currentStream.id);
        
        if (error) throw error;
        
        // Nettoyer
        cleanupStream();
        
        return { success: true };
        
    } catch (error) {
        console.error('Erreur fin stream:', error);
        return { success: false, error: error.message };
    }
}

// Quitter un stream
function leaveStream() {
    cleanupStream();
    
    // Rediriger vers la page discover
    navigateTo('discover');
}

// Nettoyer les ressources du stream
function cleanupStream() {
    // Arrêter le heartbeat
    if (viewerHeartbeat) {
        clearInterval(viewerHeartbeat);
        viewerHeartbeat = null;
    }
    
    // Se désabonner des canaux
    if (chatChannel) {
        supabase.removeChannel(chatChannel);
        chatChannel = null;
    }
    
    if (streamChannel) {
        supabase.removeChannel(streamChannel);
        streamChannel = null;
    }
    
    currentStream = null;
}

// Démarrer le heartbeat pour maintenir la présence
function startViewerHeartbeat(streamId) {
    // Mettre à jour toutes les 20 secondes
    viewerHeartbeat = setInterval(async () => {
        if (!currentUser) return;
        
        try {
            await supabase
                .from('stream_viewers')
                .upsert({
                    stream_id: streamId,
                    user_id: currentUser.id,
                    last_seen: new Date().toISOString()
                });
        } catch (error) {
            console.error('Erreur heartbeat:', error);
        }
    }, 20000);
}

// Gérer la fin du stream
function handleStreamEnded() {
    alert('Le stream est terminé');
    leaveStream();
}

// Récupérer les streams en direct
async function getLiveStreams() {
    try {
        const { data, error } = await supabase
            .from('streaming_sessions')
            .select('*, users(name, avatar)')
            .eq('status', 'live')
            .order('started_at', { ascending: false });
        
        if (error) throw error;
        
        return { success: true, streams: data };
        
    } catch (error) {
        console.error('Erreur récupération streams:', error);
        return { success: false, error: error.message };
    }
}

// Formater le temps pour le chat
function formatChatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Échapper le HTML pour éviter les XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialiser la page de stream
async function initializeStreamPage(streamId) {
    // Rejoindre le stream
    const result = await joinStream(streamId);
    
    if (!result.success) {
        alert('Erreur: ' + result.error);
        navigateTo('discover');
        return;
    }
    
    // Charger l'historique du chat
    const chatResult = await loadChatHistory(streamId);
    if (chatResult.success) {
        const chatContainer = document.getElementById('stream-chat-messages');
        if (chatContainer) {
            chatContainer.innerHTML = '';
            chatResult.messages.forEach(msg => {
                const element = createChatMessageElement(msg);
                chatContainer.appendChild(element);
            });
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
    
    // Configurer le formulaire de chat
    const chatForm = document.getElementById('stream-chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('stream-chat-input');
            const message = input.value.trim();
            
            if (!message) return;
            
            const result = await sendChatMessage(message);
            if (result.success) {
                input.value = '';
            }
        });
    }
}
