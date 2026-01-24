# Guide Live Streaming & Analytics Dashboard

## 🎥 Live Streaming

### Configuration Requise

1. **Exécutez le schéma SQL** :
   ```bash
   # Dans Supabase Dashboard > SQL Editor
   # Exécutez le contenu de sql/streaming-schema.sql
   ```

2. **Activez Realtime** :
   - Database > Replication
   - Activez pour les tables : `streaming_sessions`, `stream_messages`, `stream_viewers`

### Fonctionnalités

- ✅ **Sessions de streaming en direct**
- ✅ **Chat en temps réel** avec Supabase Realtime
- ✅ **Compteur de viewers** mis à jour automatiquement
- ✅ **Notifications automatiques** aux followers
- ✅ **Historique des messages**
- ✅ **Présence des viewers** avec heartbeat

### Utilisation

#### Démarrer un Stream

```javascript
const result = await startStream({
    title: 'Mon premier stream',
    description: 'Je code en direct !',
    thumbnailUrl: 'https://...'
});

if (result.success) {
    const streamId = result.stream.id;
    window.location.href = `stream.html?id=${streamId}`;
}
```

#### Rejoindre un Stream

```javascript
// L'utilisateur clique sur un stream en direct
const result = await joinStream(streamId);

if (result.success) {
    console.log('Stream rejoint:', result.stream);
}
```

#### Envoyer un Message

```javascript
const result = await sendChatMessage('Salut tout le monde !');

if (result.success) {
    console.log('Message envoyé');
}
```

#### Terminer un Stream

```javascript
const result = await endStream();

if (result.success) {
    console.log('Stream terminé');
}
```

### Architecture Technique

#### Tables

**streaming_sessions**
- `id` : UUID du stream
- `user_id` : ID de l'hôte
- `title` : Titre du stream
- `description` : Description
- `status` : 'live', 'ended', 'scheduled'
- `viewer_count` : Nombre de viewers
- `started_at` : Date de début
- `ended_at` : Date de fin

**stream_messages**
- `id` : UUID du message
- `stream_id` : ID du stream
- `user_id` : ID de l'auteur
- `message` : Contenu du message
- `created_at` : Date d'envoi

**stream_viewers**
- `id` : UUID
- `stream_id` : ID du stream
- `user_id` : ID du viewer
- `joined_at` : Date d'arrivée
- `last_seen` : Dernière activité

#### Realtime Channels

1. **Chat Channel** : `stream-chat-{streamId}`
   - Écoute les nouveaux messages
   - Affichage en temps réel

2. **Stream Channel** : `stream-{streamId}`
   - Écoute les mises à jour du stream
   - Status, viewer count, etc.

#### Heartbeat System

- Envoi toutes les 20 secondes
- Met à jour `last_seen` dans `stream_viewers`
- Trigger automatique met à jour `viewer_count`

### Notifications Automatiques

Quand un stream démarre :
- Tous les followers reçoivent une notification
- Trigger SQL automatique
- Type : 'stream'
- Lien direct vers le stream

### Exemple Complet

```javascript
// Page pour démarrer un stream
async function handleStartStream() {
    const title = document.getElementById('stream-title').value;
    const description = document.getElementById('stream-description').value;
    
    const result = await startStream({
        title: title,
        description: description,
        thumbnailUrl: null
    });
    
    if (result.success) {
        window.location.href = `stream.html?id=${result.stream.id}`;
    } else {
        alert('Erreur: ' + result.error);
    }
}

// Dans stream.html
async function initStream() {
    const streamId = new URLSearchParams(window.location.search).get('id');
    
    // Rejoindre le stream
    await joinStream(streamId);
    
    // Charger l'historique du chat
    const chatResult = await loadChatHistory(streamId);
    
    // Afficher les messages
    chatResult.messages.forEach(msg => {
        displayChatMessage(msg);
    });
    
    // Écouter les nouveaux messages
    // (déjà géré par subscribeToStream)
}
```

## 📊 Analytics Dashboard

### Configuration Requise

1. **Exécutez le schéma SQL** :
   ```bash
   # Dans Supabase Dashboard > SQL Editor
   # Exécutez le contenu de sql/analytics-schema.sql
   ```

2. **Incluez Chart.js** :
   ```html
   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
   ```

### Fonctionnalités

- ✅ **Statistiques globales** : posts totaux, succès, échecs, taux de succès
- ✅ **Système de streaks** : streak actuel, meilleur streak
- ✅ **Métriques quotidiennes** : évolution sur 30 jours
- ✅ **Graphiques interactifs** : Chart.js
- ✅ **Export CSV** : téléchargement des données
- ✅ **Calcul automatique** : triggers SQL

### Métriques Disponibles

#### Statistiques Globales
- Total de posts
- Nombre de succès
- Nombre d'échecs
- Nombre de pauses
- Taux de succès (%)
- Streak actuel
- Meilleur streak
- Nombre d'abonnés
- Nombre d'abonnements

#### Métriques Quotidiennes
- Posts par jour
- Succès par jour
- Échecs par jour
- Pauses par jour
- Followers gagnés/perdus
- Vues

### Utilisation

#### Afficher le Dashboard

```javascript
// Charger le dashboard pour l'utilisateur courant
await renderAnalyticsDashboard(currentUser.id);

// Charger le dashboard pour un autre utilisateur
await renderAnalyticsDashboard('user-id-here');
```

#### Récupérer les Statistiques

```javascript
const result = await getUserStatistics(userId);

if (result.success) {
    const stats = result.stats;
    console.log('Total posts:', stats.total_posts);
    console.log('Taux de succès:', stats.success_rate + '%');
    console.log('Streak actuel:', stats.current_streak);
}
```

#### Récupérer les Métriques Quotidiennes

```javascript
const result = await getDailyMetrics(userId, 30); // 30 derniers jours

if (result.success) {
    result.metrics.forEach(day => {
        console.log(`${day.date}: ${day.posts_count} posts`);
    });
}
```

#### Exporter en CSV

```javascript
exportAnalyticsCSV(userId);
// Télécharge automatiquement un fichier CSV
```

### Graphiques

#### Graphique de Progression (Line Chart)

Affiche l'évolution sur 30 jours :
- Ligne verte : Succès
- Ligne rouge : Échecs
- Ligne bleue : Pauses

```javascript
createProgressChart(metrics);
```

#### Graphique en Camembert (Doughnut Chart)

Affiche la répartition :
- Vert : Succès
- Rouge : Échecs
- Bleu : Pauses

```javascript
createPieChart(stats);
```

### Calculs Automatiques

#### Métriques Quotidiennes

Trigger automatique sur `INSERT` dans `content` :
- Incrémente le compteur de posts du jour
- Incrémente le compteur selon l'état (succès/échec/pause)
- Crée une entrée si elle n'existe pas

#### Streaks

Trigger automatique sur `INSERT` dans `content` :
- Vérifie si le post est consécutif au précédent
- Incrémente le streak si oui
- Réinitialise à 1 si non
- Met à jour le meilleur streak

### Vue SQL : user_statistics

Vue précalculée pour les statistiques globales :

```sql
SELECT * FROM user_statistics WHERE user_id = 'user-id';
```

Retourne :
- Toutes les statistiques globales
- Calculées en temps réel
- Jointures avec users, content, followers

### Personnalisation des Graphiques

```javascript
// Modifier les couleurs
const customColors = {
    success: '#00ff00',
    failure: '#ff0000',
    pause: '#0000ff'
};

// Modifier les options Chart.js
analyticsChart = new Chart(ctx, {
    type: 'line',
    data: { /* ... */ },
    options: {
        responsive: true,
        plugins: {
            legend: {
                labels: {
                    color: '#ffffff' // Couleur des labels
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    color: '#888888'
                }
            }
        }
    }
});
```

### Exemple Complet

```html
<!-- analytics.html -->
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <link rel="stylesheet" href="css/streaming-analytics.css">
</head>
<body>
    <div id="analytics-dashboard"></div>
    
    <script src="js/supabase-config.js"></script>
    <script src="js/analytics.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', async () => {
            const user = await checkAuth();
            if (!user) {
                window.location.href = 'login.html';
                return;
            }
            
            await renderAnalyticsDashboard(user.id);
        });
    </script>
</body>
</html>
```

## 🔗 Intégration dans l'Application

### Ajouter des Liens de Navigation

```html
<!-- Dans la navigation -->
<a href="analytics.html">📊 Analytics</a>
<a href="#" onclick="showLiveStreams()">🔴 Lives</a>
```

### Afficher les Streams en Direct

```javascript
async function showLiveStreams() {
    const result = await getLiveStreams();
    
    if (result.success) {
        const container = document.getElementById('live-streams');
        container.innerHTML = result.streams.map(stream => `
            <div class="live-stream-card" onclick="window.location.href='stream.html?id=${stream.id}'">
                <div class="live-stream-thumbnail">
                    <img src="${stream.thumbnail_url || 'default.jpg'}" alt="${stream.title}">
                    <div class="live-badge">🔴 LIVE</div>
                </div>
                <div class="live-stream-info">
                    <h3 class="live-stream-title">${stream.title}</h3>
                    <div class="live-stream-host">
                        <img src="${stream.users.avatar}" alt="${stream.users.name}">
                        <span>${stream.users.name}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}
```

### Bouton "Démarrer un Stream"

```html
<button class="btn-start-stream" onclick="showStartStreamModal()">
    🔴 Démarrer un Live
</button>
```

## 🎨 Personnalisation des Styles

Tous les styles sont dans `css/streaming-analytics.css`.

### Couleurs du Stream

```css
.stream-status.live {
    color: #ef4444; /* Rouge pour LIVE */
}

.live-badge {
    background: #ef4444;
}
```

### Couleurs des Stats

```css
.analytics-stat-card.success {
    border-color: rgba(16, 185, 129, 0.3);
}

.analytics-stat-card.failure {
    border-color: rgba(239, 68, 68, 0.3);
}

.analytics-stat-card.streak {
    border-color: rgba(255, 165, 0, 0.3);
}
```

## 🐛 Dépannage

### Le chat ne fonctionne pas
- Vérifiez que Realtime est activé pour `stream_messages`
- Vérifiez les politiques RLS
- Vérifiez que l'utilisateur est authentifié

### Les viewers ne sont pas comptés
- Vérifiez que le trigger `update_viewer_count` existe
- Vérifiez que le heartbeat fonctionne (console logs)
- Vérifiez les politiques RLS sur `stream_viewers`

### Les graphiques ne s'affichent pas
- Vérifiez que Chart.js est chargé
- Vérifiez que les données existent
- Ouvrez la console pour voir les erreurs

### Les métriques ne se mettent pas à jour
- Vérifiez que les triggers SQL sont créés
- Vérifiez que les posts sont bien insérés
- Vérifiez les politiques RLS

## 📚 Ressources

- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [WebRTC pour le streaming vidéo](https://webrtc.org/)

## 🚀 Améliorations Futures

- [ ] Streaming vidéo WebRTC
- [ ] Modération du chat
- [ ] Émojis et réactions
- [ ] Replays des streams
- [ ] Analytics avancés (heatmaps, etc.)
- [ ] Comparaison avec d'autres utilisateurs
- [ ] Objectifs et challenges
- [ ] Badges de progression

Bon développement ! 🎉