import Database from "better-sqlite3";

const DB_FILE_NAME = process.env["SQLITE_FILE"];
const TABLE_NAME = "stringkeyvalue" as const;
const options: Database.Options = { verbose: console.log } as const;

let cachedDatabase: Database.Database | null = null;

function getDb() {
  if (!!cachedDatabase) return cachedDatabase;

  if (!DB_FILE_NAME) throw new Error("Missing database file");
  const db = new Database(DB_FILE_NAME, options);
  db.pragma("journal_mode = WAL");
  console.log("Initialized database");
  cachedDatabase = db;
  db
    .prepare(
      "CREATE TABLE IF NOT EXISTS " +
        TABLE_NAME +
        "(key TEXT PRIMARY KEY ASC, value TEXT)",
    )
    .run().changes;

  return cachedDatabase;
}

export function storeValue(key: string, value: string | null): void {
  if (!key) {
    throw new Error("Invalid key" + key);
  }
  const db = getDb();
  db.prepare(`REPLACE INTO ${TABLE_NAME} (key, value) VALUES (?, ?)`).run(
    key,
    value,
  );
}

export function getValue(key: string): string | undefined {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM ${TABLE_NAME} WHERE key=?;`)
    .get(key) as string;
}

export function deleteValue(key: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM ${TABLE_NAME} WHERE key=?;`).run(key);
}
