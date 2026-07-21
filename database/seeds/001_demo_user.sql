INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Professor Demo',
  'demo@example.com',
  crypt('demo123', gen_salt('bf')),
  'teacher'
)
ON CONFLICT (email) DO NOTHING;
