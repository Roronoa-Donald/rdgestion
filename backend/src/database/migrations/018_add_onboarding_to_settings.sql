-- Migration 018: Ajouter les champs d'onboarding à la table settings
-- Par défaut, pour les boutiques existantes, onboarding_completed est TRUE pour éviter toute gêne retro-active.

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 1;
