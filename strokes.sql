BEGIN TRANSACTION;
CREATE TABLE "strokes" (
	`code_point`	INTEGER,
	`ordinal`	INTEGER,
	`direction`	INTEGER,
	`type`	INTEGER,
	`is_radical`	INTEGER,
	`is_continuation`	INTEGER,
	`path`	TEXT
);
CREATE UNIQUE INDEX `character_stroke` ON `strokes` (`code_point` ,`ordinal` );
COMMIT;
