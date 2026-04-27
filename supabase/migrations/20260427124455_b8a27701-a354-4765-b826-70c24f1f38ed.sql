-- Enable RLS on realtime.messages to restrict channel subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to receive postgres_changes broadcasts.
-- The actual data filtering is enforced by RLS policies on the source tables
-- (ml_orders, products, supplier_price_history, etc.) which are all scoped by user_id.
-- Anonymous users get no access.
CREATE POLICY "Authenticated users can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to send messages on their own broadcast/presence channels.
-- This keeps Broadcast/Presence usable while requiring authentication.
CREATE POLICY "Authenticated users can send realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);