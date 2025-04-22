
-- Update real_users fullname to JSON format
UPDATE real_users 
SET full_name = json_build_object(
  'id', CASE 
    WHEN id = 2 THEN '113728049762216423'
    WHEN id = 3 THEN '113728049762216424'
    ELSE id::text
  END,
  'name', CASE 
    WHEN id = 2 THEN 'Hoàng Ngọc Lan'
    WHEN id = 3 THEN 'Hoàng Ngọc Dương'
    ELSE full_name
  END
)::text
WHERE id IN (2, 3);
