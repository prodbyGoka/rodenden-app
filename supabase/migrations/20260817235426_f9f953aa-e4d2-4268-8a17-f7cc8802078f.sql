ALTER TABLE public.guests
  ADD COLUMN group_token TEXT,
  ADD COLUMN group_name TEXT;

CREATE INDEX IF NOT EXISTS guests_group_token_idx ON public.guests (group_token);