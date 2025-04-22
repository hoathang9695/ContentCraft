
-- First update the column type to JSONB
ALTER TABLE real_users 
ALTER COLUMN full_name TYPE JSONB USING full_name::jsonb;

-- Then update the data for specific users with exact IDs
UPDATE real_users 
SET full_name = jsonb_build_object(
  'id', CASE 
    WHEN id = 2 THEN '113728049762216423'
    WHEN id = 3 THEN '113728049762216424'
    ELSE id::text
  END,
  'name', CASE 
    WHEN id = 2 THEN 'Hoàng Ngọc Lan'
    WHEN id = 3 THEN 'Hoàng Ngọc Dương'
    ELSE full_name->>'name'
  END
)
WHERE id IN (2, 3);
