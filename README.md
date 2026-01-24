# RIZE - Plateforme de Progression Transparente

## 🚀 Configuration Supabase

### Étape 1: Créer les tables dans Supabase

1. Connectez-vous à votre projet Supabase: https://supabase.com/dashboard
2. Allez dans l'éditeur SQL (SQL Editor)
3. Copiez et exécutez le contenu du fichier `sql/schema.sql`

Cela créera:
- Table `users` (profils utilisateurs)
- Table `content` (posts journaliers)
- Table `projects` (projets des utilisateurs)
- Table `followers` (relations de suivi)
- Politiques de sécurité RLS (Row Level Security)
- Index pour optimiser les performances

### Étape 2: Configuration de l'authentification

1. Dans Supabase Dashboard, allez dans **Authentication** > **Providers**
2. Activez **Email** comme méthode d'authentification
3. Configurez les paramètres:
   - **Enable email confirmations**: Désactivé pour le développement (activez en production)
   - **Secure email change**: Activé
   - **Enable phone confirmations**: Désactivé

### Étape 3: Configuration du Storage (optionnel)

Pour stocker les images/vidéos uploadées:

1. Allez dans **Storage**
2. Créez un bucket nommé `media`
3. Configurez les politiques:
   ```sql
   -- Permettre à tous de lire
   CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'media');
   
   -- Permettre aux utilisateurs authentifiés d'uploader
   CREATE POLICY "Authenticated users can upload" ON storage.objects 
   FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');
   ```

### Étape 4: Tester l'application

1. Ouvrez `index.html` dans votre navigateur
2. Cliquez sur "Connexion" dans la navigation
3. Créez un compte avec email/mot de passe
4. Explorez les fonctionnalités:
   - Créer votre profil
   - Ajouter des posts journaliers
   - Suivre d'autres utilisateurs
   - Créer des projets

## 📋 Fonctionnalités

### Authentification
- ✅ Inscription avec email/mot de passe
- ✅ Connexion/Déconnexion
- ✅ Session persistante
- ✅ Protection des routes

### Profils Utilisateurs
- ✅ Création et édition de profil
- ✅ Avatar et bannière personnalisés
- ✅ Bio et titre
- ✅ Liens sociaux (GitHub, Twitter, YouTube, etc.)

### Contenu
- ✅ Posts journaliers avec états (succès, échec, pause)
- ✅ Support texte, image, vidéo
- ✅ Timeline chronologique
- ✅ Mode immersif (type TikTok)

### Social
- ✅ Système de followers/following
- ✅ Compteurs d'abonnés
- ✅ Page Discover pour explorer les trajectoires

### Projets
- ✅ Création de projets
- ✅ Association de contenu aux projets
- ✅ Covers personnalisés

## 🔧 Structure de la Base de Données

```
users
├── id (UUID, PK)
├── name (TEXT)
├── title (TEXT)
├── bio (TEXT)
├── avatar (TEXT)
├── banner (TEXT)
├── social_links (JSONB)
└── created_at, updated_at

content
├── id (UUID, PK)
├── user_id (UUID, FK)
├── project_id (UUID, FK)
├── day_number (INTEGER)
├── type (TEXT)
├── state (TEXT)
├── title (TEXT)
├── description (TEXT)
├── media_url (TEXT)
└── created_at, updated_at

projects
├── id (UUID, PK)
├── user_id (UUID, FK)
├── name (TEXT)
├── description (TEXT)
├── cover (TEXT)
└── created_at, updated_at

followers
├── id (UUID, PK)
├── follower_id (UUID, FK)
├── following_id (UUID, FK)
└── created_at
```

## 🛡️ Sécurité

- Row Level Security (RLS) activé sur toutes les tables
- Les utilisateurs ne peuvent modifier que leurs propres données
- Toutes les données publiques sont visibles en lecture seule
- Validation des données côté serveur via les politiques RLS

## 📝 Notes de Développement

### Migration des Données Mock

Les données mock dans `js/app.js` peuvent être migrées vers Supabase en:
1. Créant des comptes utilisateurs via l'interface
2. Utilisant les fonctions `createContent()` et `createProject()` pour peupler la base

### Prochaines Étapes

- [ ] Implémenter l'upload de fichiers vers Supabase Storage
- [ ] Ajouter la pagination pour les listes de contenu
- [ ] Implémenter le système de notifications en temps réel
- [ ] Ajouter des analytics (vues, likes, etc.)
- [ ] Implémenter la recherche d'utilisateurs
- [ ] Ajouter des filtres avancés sur la page Discover

## 🐛 Dépannage

### Erreur "relation does not exist"
- Vérifiez que vous avez bien exécuté le fichier `sql/schema.sql` dans l'éditeur SQL de Supabase

### Erreur d'authentification
- Vérifiez que l'authentification par email est activée dans Supabase Dashboard
- Vérifiez que vos clés API sont correctes dans `js/supabase-config.js`

### Les données ne s'affichent pas
- Ouvrez la console du navigateur pour voir les erreurs
- Vérifiez que les politiques RLS sont correctement configurées
- Testez les requêtes directement dans l'éditeur SQL de Supabase

## 📞 Support

Pour toute question ou problème, consultez:
- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Supabase Auth](https://supabase.com/docs/guides/auth)
- [Documentation Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)