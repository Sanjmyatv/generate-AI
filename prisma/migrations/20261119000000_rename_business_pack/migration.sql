-- The Business pack is renamed Pro+ ("Про + багц"). Only while it still has its original name, so a name an
-- admin typed in /admin/packs is kept. Price, credits, balances and past purchases are untouched.
UPDATE "CreditPackage" SET "name" = 'Pro+' WHERE "id" = 'business' AND "name" = 'Business';
UPDATE "CreditPackage" SET "nameMn" = 'Про + багц' WHERE "id" = 'business' AND "nameMn" = 'Бизнесийн багц';
