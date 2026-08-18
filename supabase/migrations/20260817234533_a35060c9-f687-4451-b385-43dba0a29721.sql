CREATE TABLE public.guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'Hometown',
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  rsvp TEXT NOT NULL DEFAULT 'pending',
  transport TEXT,
  seat_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.event_settings (
  id BOOLEAN NOT NULL DEFAULT true PRIMARY KEY,
  bus_seats INTEGER NOT NULL DEFAULT 50,
  event_title TEXT NOT NULL DEFAULT 'My Birthday',
  event_details TEXT NOT NULL DEFAULT '',
  CONSTRAINT event_settings_singleton CHECK (id)
);

INSERT INTO public.event_settings (id) VALUES (true);

GRANT ALL ON public.guests TO service_role;
GRANT ALL ON public.event_settings TO service_role;

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;