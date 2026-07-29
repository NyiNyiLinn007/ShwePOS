-- A cashier can have only one active cash drawer shift at a time.
CREATE UNIQUE INDEX "Shift_one_open_per_user_idx"
ON "Shift" ("userId")
WHERE "status" = 'OPEN';
