SELECT conname, contype FROM pg_constraint WHERE conrelid = 'stock'::regclass;
