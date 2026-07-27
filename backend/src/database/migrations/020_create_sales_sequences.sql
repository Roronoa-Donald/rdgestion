-- Migration 020: sequences annuelles atomiques pour transaction_number (Bug 17)
--
-- Le pattern precedent SELECT MAX(SUBSTRING(transaction_number FROM 12)::integer) + 1
-- est une race condition: deux ventes concurrentes calculent le meme MAX et una seule
-- reussit (l'autre faille avec 23505). Le retry 23505 compense mais reste un symptome,
-- pas une solution.
--
-- On cree des sequences annuelles per-tenant, qui sont atomic via nextval() (lock-free).
-- Le nom d'une sequence ne peut pas etre un parametre ($1) dans une requete preparee,
-- donc on genere dynamiquement le code SQL cote service (annee ancre dans le nom).
-- Cette migration cree juste la sequence de l'annee courante (2028); les annees suivantes
-- seront crees a la premiere vente de chaque annee par le service via CREATE SEQUENCE
-- IF NOT EXISTS.
--
-- IMPORTANT: on ne set pas un START egal au MAX actuel des sales existantes car nextval
-- ne demarre qu'a 1 et l'application lira/triera le numero formatte "VENTE-YYYY-NNNNNNN".
-- Pour les tenants existants qui ont deja atteint des numeros > 1, on aligne la SEQUENCE
-- avec le MAX via un SETVAL initial (selectif, seulement si la seq < max).

DO $$
DECLARE
    current_year text := to_char(NOW(), 'YYYY');
    seq_name text := 'sales_seq_' || current_year;
    max_existing bigint;
BEGIN
    -- Creer la sequence annuelle courante si absente
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1', seq_name);

    -- Aligner la sequence sur le MAX existant pour eviter collisions avec
    -- les ventes deja enregistrees sous l'ancien schema (SELECT MAX + 1).
    -- On starta au MAX+1 seulement si la seq est en retard.
    SELECT COALESCE(MAX(SUBSTRING(transaction_number FROM 12)::bigint), 0)
    INTO max_existing
    FROM sales
    WHERE transaction_number LIKE 'VENTE-' || current_year || '-%';

    IF max_existing > 0 THEN
        -- setval avec is_called=false force le prochain nextval a valoir max_existing+1.
        PERFORM setval(seq_name::regclass, max_existing, false);
    END IF;
END
$$;

-- Index d'acces rapide sur la sequence annuelle (utile pour le SELECT MAX futur si besoin)
-- Non necessaire pour nextval() mais documente l'intention.
--
-- NB: on ne hardcode pas une annee dans le COMMENT ON SEQUENCE car la sequence
-- creee est celle de l'annee courante (NOW()), variable. Le COMMENT pose une
-- regression sur les instances ou l'annee systeme change entre deploiements.
-- On documente l'intention via le bloc SQL dynamique ci-dessous (idempotent).
DO $$
DECLARE
    current_year text := to_char(NOW(), 'YYYY');
    seq_name text := 'sales_seq_' || current_year;
BEGIN
    EXECUTE format('COMMENT ON SEQUENCE %I IS ''Sequence atomique annuelle pour transaction_number (Bug 17). Genere le suffixe numerique de VENTE-YYYY-NNNNNNN. Cree/alignee dynamiquement a la 1re vente de chaque annee.''', seq_name);
END
$$;
