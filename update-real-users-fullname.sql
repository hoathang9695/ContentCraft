
-- First make the column accept JSON
ALTER TABLE real_users 
ALTER COLUMN full_name TYPE TEXT;

-- Then update with properly formatted JSON strings
UPDATE real_users 
SET full_name = (
  CASE 
    WHEN id = 2 THEN '{"id": "113728049762216423", "name": "Hoàng Ngọc Lan"}'
    WHEN id = 3 THEN '{"id": "113728049762216424", "name": "Hoàng Ngọc Dương"}'
    ELSE full_name
  END
)::jsonb
WHERE id IN (2, 3);
