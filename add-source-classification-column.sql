
-- Add source_classification column to contents table
ALTER TABLE contents 
ADD COLUMN IF NOT EXISTS source_classification VARCHAR(20) DEFAULT 'new';

-- Update existing records to have default classification
UPDATE contents 
SET source_classification = 'new' 
WHERE source_classification IS NULL;

-- Create index to optimize query performance
CREATE INDEX IF NOT EXISTS idx_contents_source_classification 
ON contents(source_classification);

-- Drop existing constraint if it exists first
ALTER TABLE contents 
DROP CONSTRAINT IF EXISTS chk_source_classification;

-- Add check constraint to ensure valid values
ALTER TABLE contents 
ADD CONSTRAINT chk_source_classification 
CHECK (source_classification IN ('new', 'potential', 'non_potential', 'positive'));
