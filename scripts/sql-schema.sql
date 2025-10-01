-- Enable pgvector.
CREATE EXTENSION vector;

-- For document's vector.
CREATE TABLE IF NOT EXISTS documents (
 id BIGSERIAL PRIMARY KEY,
 content TEXT,
 metadata JSONB,
 embedding VECTOR(1536)
);

-- Function to search for documents
CREATE FUNCTION match_documents (
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 4,
  filter JSONB DEFAULT '{}'
) returns table (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  embedding VECTOR(1536),
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  return query
  SELECT
    id,
    content,
    metadata,
    embedding,
    1 - (documents.embedding <=> query_embedding) as similarity
    FROM documents
    WHERE metadata @> filter
    ORDER by documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

CREATE TABLE IF NOT EXISTS guilds (
  id BIGSERIAL PRIMARY KEY,
  guild_id VARCHAR(255),
  category_id VARCHAR(255)
);

CREATE UNIQUE INDEX IF NOT EXISTS guild_id_idx ON guilds (guild_id);

CREATE TABLE IF NOT EXISTS chats (
  id BIGSERIAL PRIMARY KEY,
  guild_id VARCHAR(255),
  member_id VARCHAR(255),
  channel_id VARCHAR(255),
  CONSTRAINT fk_chats_guild
    FOREIGN KEY (guild_id)
      REFERENCES guilds(guild_id)
);

CREATE TABLE IF NOT EXISTS guild_moderators (
  id BIGSERIAL PRIMARY KEY,
  guild_id VARCHAR(255),
  role_id VARCHAR(255),
  CONSTRAINT fk_guild_moderator_guild
    FOREIGN KEY (guild_id)
      REFERENCES guilds(guild_id)
);

-- Function to add guild setup.
CREATE OR REPLACE FUNCTION create_guild_data (
  guild_id VARCHAR(255),
  category_id VARCHAR(255),
) RETURNS VOID AS $$
BEGIN
  INSERT INTO guilds (guild_id, category_id)
  VALUES (guild_id, category_id);
END;
$$ LANGUAGE plpgsql;

-- Function to add guild moderator role.
CREATE OR REPLACE FUNCTION create_guild_moderator (
  guild_id VARCHAR(255),
  role_id VARCHAR(255)
) RETURNS VOID AS $$
BEGIN
  INSERT INTO guild_moderators (guild_id, role_id)
  VALUES (guild_id, role_id);
END;
$$ LANGUAGE plpgsql;