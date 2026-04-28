-- Migration: 0002_creator_connections_enhanced.sql
-- Purpose: Add onboarding tracking, verification status, and error handling for Stripe Connect integration
-- Created: 2026-04-28

-- Extend creator_connections table with onboarding workflow fields
ALTER TABLE creator_connections
ADD COLUMN IF NOT EXISTS onboarding_status TEXT CHECK (onboarding_status IN ('pending', 'submitted', 'verified', 'processing', 'rejected')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS last_verification_attempt TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_creator_connections_onboarding_status ON creator_connections(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_creator_connections_creator_id ON creator_connections(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_connections_verified_at ON creator_connections(verified_at DESC) WHERE verified_at IS NOT NULL;

-- Add stripe_account_id to creators table if not exists
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_onboarding_status TEXT CHECK (stripe_onboarding_status IN ('pending', 'submitted', 'verified', 'processing', 'rejected')) DEFAULT 'pending';

-- Create index for creator Stripe lookups
CREATE INDEX IF NOT EXISTS idx_creators_stripe_account_id ON creators(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN creator_connections.onboarding_status IS 'Stripe Connect onboarding workflow status: pending (initial), submitted (joined Stripe), verified (account fully setup), processing (awaiting Stripe), rejected (account not approved)';
COMMENT ON COLUMN creator_connections.submitted_at IS 'Timestamp when creator submitted Stripe Connect info';
COMMENT ON COLUMN creator_connections.verified_at IS 'Timestamp when Stripe account was verified and ready for payouts';
COMMENT ON COLUMN creator_connections.error_message IS 'Last error message if onboarding failed (e.g., "Account restricted", "Tax ID mismatch")';
COMMENT ON COLUMN creator_connections.last_verification_attempt IS 'Last time we checked Stripe API for account status';
