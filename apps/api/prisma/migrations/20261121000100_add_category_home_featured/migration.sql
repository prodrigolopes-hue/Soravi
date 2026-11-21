ALTER TABLE "categories" ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

UPDATE "categories" SET "is_featured" = true
WHERE "is_active" = true AND "slug" IN (
  'eletricista', 'encanador', 'pintor', 'diarista', 'jardineiro',
  'montador-de-moveis', 'climatizacao-e-ar-condicionado', 'reparos-e-manutencao-residencial'
);
