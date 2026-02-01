# Guide des Nouvelles Fonctionnalités RIZE

## 🔍 Recherche d'Utilisateurs et de Contenu

### Configuration

La recherche est automatiquement activée sur la page Discover. Aucune configuration supplémentaire n'est nécessaire.

### Fonctionnalités

- **Recherche en temps réel** : Les résultats s'affichent au fur et à mesure de la saisie
- **Recherche multi-critères** : Nom d'utilisateur, titre, bio, contenu des posts
- **Mise en évidence** : Les termes recherchés sont surlignés dans les résultats
- **Navigation rapide** : Cliquer sur un résultat pour accéder directement au profil

### Utilisation

```javascript
// La recherche est automatiquement initialisée
// Tapez simplement dans la barre de recherche sur la page Discover

// Pour effectuer une recherche programmatique :
await performSearch("terme de recherche");
```

### Personnalisation

Modifiez les paramètres dans `js/search.js` :

```javascript
// Délai de debounce (ms)
const SEARCH_DEBOUNCE = 300;

// Nombre maximum de résultats
const MAX_RESULTS = 10;

// Longueur minimale de recherche
const MIN_SEARCH_LENGTH = 2;
```

## 🔔 Notifications en Temps Réel

### Configuration Requise

1. **Exécutez le schéma SQL** :
   ```sql
   -- Copiez et exécutez le contenu de sql/notifications-schema.sql
   -- dans l'éditeur SQL de Supabase
   ```

2. **Activez Realtime dans Supabase** :
   - Allez dans Database > Replication
   - Activez la réplication pour la table `notifications`

### Types de Notifications

- `follow` : Quelqu'un vous suit
- `like` : Quelqu'un aime votre contenu
- `comment` : Quelqu'un commente votre post
- `mention` : Quelqu'un vous mentionne
- `achievement` : Vous débloquez un succès

### Fonctionnalités

- **Notifications en temps réel** : Reçues instantanément via WebSocket
- **Toast notifications** : Popup élégant pour les nouvelles notifications
- **Badge de compteur** : Affiche le nombre de notifications non lues
- **Panneau de notifications** : Liste complète accessible depuis la navigation
- **Son de notification** : Alerte sonore pour les nouvelles notifications
- **Marquage comme lu** : Cliquer sur une notification la marque comme lue

### Utilisation

```javascript
// Créer une notification manuellement
await createNotification(
    userId,           // ID de l'utilisateur destinataire
    'follow',         // Type de notification
    'Message',        // Message de la notification
    '/profile/123'    // Lien optionnel
);

// Marquer toutes les notifications comme lues
await markAllNotificationsAsRead();

// Se désabonner des notifications (lors de la déconnexion)
unsubscribeFromNotifications();
```

### Notifications Automatiques

Les notifications sont créées automatiquement pour :

- **Nouveau follower** : Trigger SQL automatique
- **Autres événements** : À implémenter selon vos besoins

Exemple d'ajout de notification lors d'une action :

```javascript
// Dans votre fonction de création de contenu
async function createPost(postData) {
    // ... créer le post ...
    
    // Notifier les followers
    const followers = await getFollowers(currentUser.id);
    for (const follower of followers) {
        await createNotification(
            follower.id,
            'post',
            `${currentUser.name} a publié un nouveau post`,
            `/profile/${currentUser.id}`
        );
    }
}
```

## 📤 Upload de Fichiers

### Configuration Requise

1. **Créez le bucket Storage dans Supabase** :
   - Allez dans Storage
   - Créez un bucket nommé `media`
   - Rendez-le public

2. **Configurez les politiques** :
   ```sql
   -- Lecture publique
   CREATE POLICY "Public Access" ON storage.objects 
   FOR SELECT USING (bucket_id = 'media');
   
   -- Upload pour utilisateurs authentifiés
   CREATE POLICY "Authenticated users can upload" ON storage.objects 
   FOR INSERT WITH CHECK (
     bucket_id = 'media' AND 
     auth.role() = 'authenticated'
   );
   
   -- Suppression par le propriétaire
   CREATE POLICY "Users can delete own files" ON storage.objects 
   FOR DELETE USING (
     bucket_id = 'media' AND 
     auth.uid() = owner
   );
   ```

### Formats Supportés

**Images** :
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

**Vidéos** :
- MP4 (.mp4)
- WebM (.webm)
- QuickTime (.mov)

**Limite de taille** : 50 MB par fichier

### Fonctionnalités

- **Upload simple** : Un fichier à la fois
- **Upload multiple** : Plusieurs fichiers simultanément
- **Drag & Drop** : Glisser-déposer des fichiers
- **Compression d'images** : Réduction automatique de la taille
- **Aperçu** : Prévisualisation avant upload
- **Barre de progression** : Suivi de l'upload
- **Validation** : Vérification du type et de la taille

### Utilisation

#### Upload Simple

```javascript
// Uploader un fichier
const result = await uploadFile(file, 'content');

if (result.success) {
    console.log('URL:', result.url);
    console.log('Type:', result.type); // 'image' ou 'video'
} else {
    console.error('Erreur:', result.error);
}
```

#### Upload Multiple

```javascript
const files = [file1, file2, file3];

const results = await uploadMultipleFiles(
    files,
    'content',
    (current, total) => {
        console.log(`${current}/${total} fichiers uploadés`);
    }
);
```

#### Avec Compression

```javascript
// Compresser une image avant upload
const compressedFile = await compressImage(
    originalFile,
    1920,  // Largeur max
    0.8    // Qualité (0-1)
);

const result = await uploadFile(compressedFile, 'content');
```

#### Initialiser un Input avec Drag & Drop

```javascript
initializeFileInput('file-input', {
    dropZone: document.getElementById('drop-zone'),
    preview: 'preview-image',  // ID de l'élément d'aperçu
    multiple: false,
    compress: true,
    onUpload: (result) => {
        console.log('Fichier uploadé:', result.url);
    }
});
```

#### HTML pour Upload

```html
<!-- Zone de drag & drop -->
<div class="upload-zone" id="drop-zone">
    <svg class="upload-zone-icon" viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
    <p class="upload-zone-text">
        Glissez vos fichiers ici ou cliquez pour sélectionner
    </p>
    <p class="upload-zone-hint">
        Images (JPG, PNG, GIF, WebP) ou Vidéos (MP4, WebM) - Max 50MB
    </p>
    <input type="file" id="file-input" accept="image/*,video/*" style="display: none;">
</div>

<!-- Aperçu -->
<img id="preview-image" style="display: none; max-width: 300px;">

<!-- Barre de progression -->
<div class="upload-progress">
    <div id="upload-progress" class="upload-progress-bar" style="width: 0%;"></div>
</div>
```

### Exemple Complet : Créer un Post avec Image

```javascript
async function createPostWithImage() {
    const fileInput = document.getElementById('post-image');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Veuillez sélectionner une image');
        return;
    }
    
    // Valider le fichier
    const validation = validateFile(file);
    if (!validation.valid) {
        alert(validation.errors.join('\n'));
        return;
    }
    
    // Compresser l'image
    const compressedFile = await compressImage(file);
    
    // Uploader
    const uploadResult = await uploadFile(compressedFile, 'posts');
    
    if (!uploadResult.success) {
        alert('Erreur upload: ' + uploadResult.error);
        return;
    }
    
    // Créer le post avec l'URL de l'image
    const postResult = await createContent({
        userId: currentUser.id,
        dayNumber: getCurrentDayNumber(),
        type: 'image',
        state: 'success',
        title: document.getElementById('post-title').value,
        description: document.getElementById('post-description').value,
        mediaUrl: uploadResult.url
    });
    
    if (postResult.success) {
        alert('Post créé avec succès !');
        // Recharger les données
        await loadAllData();
        renderDiscoverGrid();
    }
}
```

### Suppression de Fichiers

```javascript
// Supprimer un fichier du Storage
const result = await deleteFile('path/to/file.jpg');

if (result.success) {
    console.log('Fichier supprimé');
}
```

## 🎨 Personnalisation des Styles

Tous les styles sont dans `css/search-notifications.css`. Vous pouvez personnaliser :

### Couleurs

```css
/* Modifier les couleurs des notifications */
.notification-badge {
    background: #ef4444; /* Rouge par défaut */
}

.notification-item.unread {
    border-left-color: #10b981; /* Vert par défaut */
}
```

### Animations

```css
/* Modifier l'animation du toast */
@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
```

### Tailles

```css
/* Modifier la taille du panneau de notifications */
.notification-panel {
    width: 400px; /* Largeur par défaut */
    max-height: 600px; /* Hauteur maximale */
}
```

## 🐛 Dépannage

### La recherche ne fonctionne pas
- Vérifiez que les tables existent dans Supabase
- Vérifiez les politiques RLS
- Ouvrez la console pour voir les erreurs

### Les notifications ne s'affichent pas
- Vérifiez que la table `notifications` existe
- Vérifiez que Realtime est activé pour cette table
- Vérifiez que l'utilisateur est connecté

### L'upload échoue
- Vérifiez que le bucket `media` existe
- Vérifiez les politiques Storage
- Vérifiez la taille du fichier (max 50MB)
- Vérifiez le type de fichier

### Erreur "RLS policy violation"
- Vérifiez que les politiques RLS sont correctement configurées
- Vérifiez que l'utilisateur est authentifié

## 📚 Ressources

- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Supabase Full-Text Search](https://supabase.com/docs/guides/database/full-text-search)

## 🚀 Prochaines Améliorations

- [ ] Recherche avancée avec filtres
- [ ] Notifications push (PWA)
- [ ] Upload par URL
- [ ] Édition d'images avant upload
- [ ] Galerie de médias
- [ ] Recherche vocale
- [ ] Notifications groupées
- [ ] Préférences de notifications

Bon développement ! 🎉
