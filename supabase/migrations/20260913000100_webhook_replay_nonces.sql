-- Fluxentiq · machine webhook replay protection
-- One-time event identity is stored under a unique provider/event key. The
-- service-role webhook handlers claim it before performing mutations.
CREATE TABLE IF NOT EXISTS public.webhook_replay_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payload_hash TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS webhook_replay_nonces_received_idx
  ON public.webhook_replay_nonces (received_at);

ALTER TABLE public.webhook_replay_nonces ENABLE ROW LEVEL SECURITY;
-- Machine handlers use the approved service-role boundary. Members may not
-- inspect or mint replay claims from the client.
