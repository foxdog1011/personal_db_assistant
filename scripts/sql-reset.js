// Dev helper: execute cleanup SQL against the project DB
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, '..', 'db', 'notes.db');
const db = new sqlite3.Database(dbPath);

function run(sql) {
  return new Promise((resolve) => {
    db.run(sql, (err) => {
      if (err) {
        console.warn(`[sql-reset] WARN executing: ${sql} -> ${err.message}`);
      }
      resolve();
    });
  });
}

(async () => {
  console.log(`[sql-reset] Target DB: ${dbPath}`);
  db.serialize(async () => {
    try {
      await run('BEGIN');
      await run('DELETE FROM notes');
      await run('DELETE FROM relations');
      await run('DELETE FROM concept_relations');
      await run('DELETE FROM embeddings');
      await run("DELETE FROM sqlite_sequence WHERE name IN ('notes','relations','concept_relations','embeddings')");
      await run('COMMIT');
      await run('VACUUM');

      db.get('SELECT COUNT(*) AS c FROM notes', (err, row) => {
        if (err) {
          console.error('[sql-reset] Verify failed:', err.message);
          process.exitCode = 1;
          db.close();
          return;
        }
        console.log(`[sql-reset] notes count after cleanup: ${row.c}`);
        console.log('[sql-reset] Cleanup complete (DELETE + VACUUM)');
        console.log('[Codex Clean]  Database reset complete. All tables are now empty.');
        db.close();
      });
    } catch (e) {
      console.error('[sql-reset] ERROR:', e?.message || e);
      try { await run('ROLLBACK'); } catch {}
      db.close();
      process.exitCode = 1;
    }
  });
})();

