# Guide de Migration Supabase - RIZE

## 🎯 Objectif

Ce guide vous accompagne dans la migration complète de votre application RIZE vers Supabase, transformant les données mockées en une vraie base de données fonctionnelle.

## 📋 Étapes de Configuration

### Étape 1: Configuration de la Base de Données

1. **Connectez-vous à Supabase Dashboard**
   - Allez sur https://supabase.com/dashboard
   - Sélectionnez votre projet

2. **Exécutez le schéma SQL**
   - Ouvrez l'éditeur SQL (SQL Editor)
   - Copiez le contenu complet du fichier `sql/schema.sql`
   - Exécutez le script
   - Vérifiez que toutes les tables sont créées sans erreur

3. **Vérifiez les tables créées**
   - `users` - Profils utilisateurs
   - `content` - Posts journaliers
   - `projects` - Projets des utilisateurs
   - `followers` - Relations de suivi

### Étape 2: Configuration de l'Authentification

1. **Activez l'authentification par Email**
   - Dans le Dashboard, allez dans **Authentication** > **Providers**
   - Activez **Email**
   - Configuration recommandée pour le développement:
     - ✅ Enable email provider
     - ❌ Confirm email (désactivé pour dev, activez en prod)
     - ✅ Secure email change
     - ❌ Enable phone confirmations

2. **Configurez les URLs de redirection (optionnel)**
   - Authentication > URL Configuration
   - Site URL: `http://localhost:8080` (ou votre URL de dev)
   - Redirect URLs: Ajoutez vos URLs autorisées

### Étape 3: Configuration du Storage (Optionnel mais recommandé)

Pour permettre l'upload d'images/vidéos:

1. **Créez un bucket**
   - Allez dans **Storage**
   - Cliquez sur "New bucket"
   - Nom: `media`
   - Public: ✅ (pour que les images soient accessibles)

2. **Configurez les politiques**
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

### Étape 4: Test de l'Application

1. **Ouvrez l'application**
   - Servez les fichiers avec un serveur local (ex: `python -m http.server 8080`)
   - Ouvrez `http://localhost:8080/login.html`

2. **Créez votre premier compte**
   - Cliquez sur "Créer un compte"
   - Remplissez le formulaire:
     - Nom d'utilisateur: Votre pseudo
     - Email: Votre email
     - Mot de passe: Min 6 caractères
   - Cliquez sur "Créer mon compte"

3. **Vérifiez la création**
   - Dans Supabase Dashboard > Authentication > Users
   - Vous devriez voir votre utilisateur
   - Dans Table Editor > users
   - Votre profil devrait être créé automatiquement

4. **Testez la connexion**
   - Déconnectez-vous
   - Reconnectez-vous avec vos identifiants
   - Vous devriez être redirigé vers la page principale

### Étape 5: Peuplement Initial (Optionnel)

Pour avoir des données de test, vous pouvez:

1. **Créer plusieurs comptes utilisateurs**
   - Utilisez des emails différents
   - Créez 3-4 comptes de test

2. **Ajouter du contenu via l'interface** (à implémenter)
   - Ou insérer directement dans Supabase:
   
   ```sql
   -- Exemple: Ajouter un post
   INSERT INTO content (user_id, day_number, type, state, title, description)
   VALUES (
     'votre-user-id',
     1,
     'text',
     'success',
     'Premier jour',
     'J''ai commencé mon projet aujourd''hui !'
   );
   ```

## 🔧 Fonctionnalités Implémentées

### ✅ Authentification
- [x] Inscription avec email/mot de passe
- [x] Connexion
- [x] Déconnexion
- [x] Session persistante
- [x] Redirection automatique si connecté

### ✅ Profils Utilisateurs
- [x] Création automatique du profil à l'inscription
- [x] Avatar généré automatiquement
- [x] Lecture des profils publics
- [x] Affichage de la page profil

### ✅ Page Discover
- [x] Affichage de tous les utilisateurs
- [x] Cartes utilisateurs avec dernier contenu
- [x] Badges de trajectoire
- [x] Navigation vers les profils

### ✅ Système de Followers
- [x] Suivre/Ne plus suivre
- [x] Compteurs d'abonnés
- [x] Vérification du statut de suivi

### ✅ Contenu
- [x] Lecture du contenu des utilisateurs
- [x] Timeline chronologique
- [x] Mode immersif
- [x] Badges d'état (succès, échec, pause)

## 🚧 Fonctionnalités à Implémenter

### Création de Contenu
Pour permettre aux utilisateurs d'ajouter du contenu:

```javascript
// Exemple de fonction à ajouter
async function handleCreatePost(userId, postData) {
    const result = await createContent({
        userId: userId,
        projectId: postData.projectId || null,
        dayNumber: postData.dayNumber,
        type: postData.type, // 'text', 'image', 'video'
        state: postData.state, // 'success', 'failure', 'pause'
        title: postData.title,
        description: postData.description,
        mediaUrl: postData.mediaUrl || null
    });
    
    if (result.success) {
        // Recharger les données et rafraîchir l'UI
        await loadAllData();
        renderDiscoverGrid();
    }
}
```

### Upload de Fichiers
Pour permettre l'upload d'images/vidéos vers Supabase Storage:

```javascript
async function uploadMedia(file, userId) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
        .from('media')
        .upload(fileName, file);
    
    if (error) {
        console.error('Erreur upload:', error);
        return null;
    }
    
    // Récupérer l'URL publique
    const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);
    
    return publicUrl;
}
```

### Édition de Profil
Pour permettre aux utilisateurs de modifier leur profil:

```javascript
async function handleUpdateProfile(userId, profileData) {
    const result = await upsertUserProfile(userId, {
        name: profileData.name,
        title: profileData.title,
        bio: profileData.bio,
        avatar: profileData.avatar,
        banner: profileData.banner,
        socialLinks: profileData.socialLinks
    });
    
    if (result.success) {
        // Recharger et rafraîchir
        await loadAllData();
        await navigateToUserProfile(userId);
    }
}
```

## 🐛 Dépannage

### Erreur "relation does not exist"
**Cause**: Le schéma SQL n'a pas été exécuté correctement.
**Solution**: Retournez dans l'éditeur SQL et réexécutez `sql/schema.sql`.

### Erreur "Invalid API key"
**Cause**: Les clés Supabase dans `js/supabase-config.js` sont incorrectes.
**Solution**: Vérifiez vos clés dans Supabase Dashboard > Settings > API.

### Erreur d'authentification
**Cause**: L'authentification par email n'est pas activée.
**Solution**: Authentication > Providers > Activez Email.

### Les données ne s'affichent pas
**Cause**: Problème de politiques RLS ou de données manquantes.
**Solution**: 
1. Vérifiez la console du navigateur pour les erreurs
2. Testez les requêtes dans l'éditeur SQL de Supabase
3. Vérifiez que les politiques RLS sont correctement configurées

### Erreur "Row Level Security"
**Cause**: Les politiques RLS bloquent l'accès.
**Solution**: Vérifiez que les politiques dans `sql/schema.sql` sont bien créées.

## 📊 Monitoring

### Vérifier les logs
- Supabase Dashboard > Logs
- Filtrez par type: Auth, Database, Storage
- Recherchez les erreurs

### Vérifier les utilisateurs
- Authentication > Users
- Vous devriez voir tous les comptes créés

### Vérifier les données
- Table Editor > Sélectionnez une table
- Visualisez les données insérées

## 🔐 Sécurité

### En Production
1. **Activez la confirmation par email**
   - Authentication > Providers > Email
   - Enable email confirmations: ✅

2. **Configurez les URLs autorisées**
   - Authentication > URL Configuration
   - Ajoutez uniquement vos domaines de production

3. **Renforcez les politiques RLS**
   - Ajoutez des validations supplémentaires
   - Limitez les taux de requêtes

4. **Activez 2FA pour votre compte Supabase**
   - Account > Security
   - Enable Two-Factor Authentication

## 📚 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage](https://supabase.com/docs/guides/storage)

## 🎉 Prochaines Étapes

1. Implémentez la création de contenu
2. Ajoutez l'upload de fichiers
3. Implémentez l'édition de profil
4. Ajoutez des notifications en temps réel
5. Implémentez la recherche d'utilisateurs
6. Ajoutez des analytics (vues, likes)

Bon développement ! 🚀