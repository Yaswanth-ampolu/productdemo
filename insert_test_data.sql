-- Insert a test admin user if not exists
INSERT INTO users (username, password, role, email, name)
SELECT 'testadmin', '$2a$10$1mH8Jc8Oj.u.I.oA/B7xaeJsR0/mkNoVOSNJkDX.wX.vYgDI5lcLK', 'admin', 'admin@test.com', 'Test Admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'testadmin');

-- Insert a test regular user if not exists
INSERT INTO users (username, password, role, email, name)
SELECT 'testuser', '$2a$10$1mH8Jc8Oj.u.I.oA/B7xaeJsR0/mkNoVOSNJkDX.wX.vYgDI5lcLK', 'user', 'user@test.com', 'Test User'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'testuser');

-- Insert some test messages
INSERT INTO messages (user_id, message, response, timestamp)
SELECT 
  (SELECT id FROM users WHERE username = 'testuser' LIMIT 1),
  'This is a test message',
  'This is a test response',
  NOW()
WHERE EXISTS (SELECT 1 FROM users WHERE username = 'testuser');

-- Insert a test PDF
INSERT INTO pdfs (id, user_id, file_path, file_name, uploaded_at)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM users WHERE username = 'testuser' LIMIT 1),
  '/test/path/to/file.pdf',
  'test_file.pdf',
  NOW()
WHERE EXISTS (SELECT 1 FROM users WHERE username = 'testuser');

-- Force update dashboard metrics
SELECT update_dashboard_metrics();

-- Check the metrics
SELECT * FROM dashboard_metrics; 