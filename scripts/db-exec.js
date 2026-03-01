// Execute given maintenance SQL against the project DB
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, '..', 'db', 'notes.db');
const db = new sqlite3.Database(dbPath);

function run(sql){
  return new Promise((resolve)=>{
    db.run(sql, (err)=>{
      if (err) console.warn(`[db:exec] WARN ${sql} -> ${err.message}`);
      resolve();
    });
  });
}

(async () => {
  console.log(`[db:exec] Target DB: ${dbPath}`);
  db.serialize(async ()=>{
    try {
      await run('BEGIN');
      await run('DELETE FROM concept_relations');
      await run('DELETE FROM relations');
      await run('COMMIT');
      await run('VACUUM');
      console.log('[db:exec] Done: DELETE concept_relations, relations + VACUUM');
      db.close();
    } catch (e) {
      console.error('[db:exec] ERROR:', e?.message || e);
      try { await run('ROLLBACK'); } catch{}
      db.close();
      process.exitCode = 1;
    }
  });
})();
