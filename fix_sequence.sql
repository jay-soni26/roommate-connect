SELECT setval('"Message_id_seq"', (SELECT COALESCE(MAX(id), 0) + 1000 FROM "Message"), false);
