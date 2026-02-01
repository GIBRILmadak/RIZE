-- Ajout des colonnes pour le système d'inscription multi-étapes

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS account_type TEXT,
ADD COLUMN IF NOT EXISTS account_subtype TEXT,
ADD COLUMN IF NOT EXISTS badge TEXT;

-- Validation optionnelle (Check constraints)
-- Note: Supabase/Postgres permet d'ajouter des contraintes CHECK si désiré
-- ALTER TABLE users ADD CONSTRAINT check_account_type CHECK (account_type IN ('Personnel', 'Communauté', 'Entreprise'));
