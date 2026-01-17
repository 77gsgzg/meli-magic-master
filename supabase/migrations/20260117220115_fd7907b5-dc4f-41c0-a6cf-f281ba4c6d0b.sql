-- Enable realtime for campaign_history table to support push notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_history;