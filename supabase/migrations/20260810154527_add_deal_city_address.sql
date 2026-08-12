ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS city VARCHAR(120),
  ADD COLUMN IF NOT EXISTS address VARCHAR(500);

COMMENT ON COLUMN public.deals.city IS 'Город клиента';
COMMENT ON COLUMN public.deals.address IS 'Адрес клиента';
