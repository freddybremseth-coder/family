-- Stripe-integrasjon: legg til kolonner for kunde-ID og subscription-ID
-- på user_profiles for å knytte Supabase-brukere til Stripe.

alter table family.user_profiles
  add column if not exists stripe_customer_id text;

alter table family.user_profiles
  add column if not exists stripe_subscription_id text;

create index if not exists idx_user_profiles_stripe_customer
  on family.user_profiles (stripe_customer_id);
