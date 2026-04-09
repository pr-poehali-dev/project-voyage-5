
CREATE TABLE IF NOT EXISTS channels (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id),
  name VARCHAR(64) NOT NULL,
  username VARCHAR(32) UNIQUE,
  description TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT TRUE,
  avatar_color VARCHAR(16) DEFAULT '#5865f2',
  subscribers_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_subscriptions (
  channel_id INTEGER REFERENCES channels(id),
  user_id INTEGER REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS channel_posts (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER REFERENCES channels(id),
  author_id INTEGER REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
