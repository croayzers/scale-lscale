-- L-Scale · Referencia de proveedor por material
ALTER TABLE lscale.materiales
  ADD COLUMN IF NOT EXISTS referencia_proveedor text;
