-- Script SQL para crear la tabla de conversaciones en Supabase
-- Ejecuta esto en el SQL Editor de Supabase

-- Crear tabla de conversaciones
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  intent VARCHAR(20) NOT NULL CHECK (intent IN ('purchase_advice', 'other')),
  product VARCHAR(255),
  bot_response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice en user_phone para búsquedas rápidas de historial
CREATE INDEX idx_conversations_user_phone ON conversations(user_phone);

-- Crear índice en created_at para ordenar por fecha
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
2. Consulta en Múltiples Almacenes
El sistema ahora busca en:
-- Crear índice en intent para estadísticas
CREATE INDEX idx_conversations_intent ON conversations(intent);

-- Habilitar Row Level Security (RLS) - Opcional pero recomendado
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura/escritura desde el backend (usando anon key)
CREATE POLICY "Enable all access for service role"
  ON conversations
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Ver tabla creada
SELECT * FROM conversations LIMIT 10;
