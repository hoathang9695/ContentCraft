
-- First update the column type to JSONB
ALTER TABLE real_users 
ALTER COLUMN full_name TYPE JSONB USING full_name::jsonb;

-- Then update the data for specific users
UPDATE real_users 
SET full_name = jsonb_build_object(
  'id', id::text,
  'name', CASE 
    WHEN id = 2 THEN 'Hoàng Ngọc Lan'::text
    WHEN id = 3 THEN 'Hoàng Ngọc Dương'::text
    ELSE full_name->>'name'
  END
)
WHERE id IN (2, 3);
