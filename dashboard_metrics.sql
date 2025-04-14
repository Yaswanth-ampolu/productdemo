-- Create dashboard_metrics table for caching dashboard data
CREATE TABLE IF NOT EXISTS dashboard_metrics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(50) NOT NULL UNIQUE,
  metric_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial metrics
INSERT INTO dashboard_metrics (metric_name, metric_value)
VALUES 
  ('user_stats', '{
    "totalUsers": 0,
    "adminUsers": 0, 
    "regularUsers": 0,
    "recentUsers": 0
  }'::jsonb),
  ('message_stats', '{
    "totalMessages": 0,
    "recentMessages": 0,
    "avgResponseTime": 0,
    "totalPdfs": 0
  }'::jsonb),
  ('license_usage', '{
    "totalLicenses": 25,
    "activeLicenses": 0,
    "expirationDate": "2024-12-31",
    "daysRemaining": 245
  }'::jsonb)
ON CONFLICT (metric_name) DO NOTHING;

-- Create function to update dashboard metrics
CREATE OR REPLACE FUNCTION update_dashboard_metrics()
RETURNS void AS $$
DECLARE
  user_stats jsonb;
  message_stats jsonb;
  pdf_count integer;
BEGIN
  -- Get user statistics
  SELECT jsonb_build_object(
    'totalUsers', COUNT(*),
    'adminUsers', COUNT(CASE WHEN role = 'admin' THEN 1 END),
    'regularUsers', COUNT(CASE WHEN role = 'user' THEN 1 END),
    'recentUsers', COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END)
  ) INTO user_stats FROM users;
  
  -- Get message statistics
  SELECT jsonb_build_object(
    'totalMessages', COUNT(*),
    'recentMessages', COUNT(CASE WHEN timestamp > NOW() - INTERVAL '7 days' THEN 1 END),
    'avgResponseTime', 0
  ) INTO message_stats FROM messages;
  
  -- Get PDF count
  SELECT COUNT(*) INTO pdf_count FROM pdfs;
  
  -- Update message_stats with PDF count
  message_stats := message_stats || jsonb_build_object('totalPdfs', pdf_count);
  
  -- Update the dashboard metrics table
  UPDATE dashboard_metrics SET metric_value = user_stats, updated_at = NOW() WHERE metric_name = 'user_stats';
  UPDATE dashboard_metrics SET metric_value = message_stats, updated_at = NOW() WHERE metric_name = 'message_stats';
  
  -- Update license usage (in a real implementation, this would pull from a license system)
  UPDATE dashboard_metrics 
  SET metric_value = jsonb_build_object(
    'totalLicenses', 25,
    'activeLicenses', LEAST((user_stats->>'totalUsers')::integer, 12),
    'expirationDate', '2024-12-31',
    'daysRemaining', 245
  ),
  updated_at = NOW()
  WHERE metric_name = 'license_usage';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update metrics when user/message tables change
CREATE OR REPLACE FUNCTION trigger_update_dashboard_metrics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_dashboard_metrics();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on users and messages tables
DROP TRIGGER IF EXISTS users_update_metrics ON users;
CREATE TRIGGER users_update_metrics
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_dashboard_metrics();

DROP TRIGGER IF EXISTS messages_update_metrics ON messages;
CREATE TRIGGER messages_update_metrics
AFTER INSERT OR UPDATE OR DELETE ON messages
FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_dashboard_metrics();

DROP TRIGGER IF EXISTS pdfs_update_metrics ON pdfs;
CREATE TRIGGER pdfs_update_metrics
AFTER INSERT OR UPDATE OR DELETE ON pdfs
FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_dashboard_metrics();

-- Initial update of metrics
SELECT update_dashboard_metrics(); 