// Dev helper: clear graph-only data (relations, concept_relations, embeddings) and VACUUM
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, '..', 'db', 'notes.db');
const db = new sqlite3.Database(dbPath);

function run(sql) {
  return new Promise((resolve) => {
    db.run(sql, (err) => {
      if (err) {
        console.warn(`[clear-graph] WARN executing: ${sql} -> ${err.message}`);
      }
      resolve();
    });
  });
}

function getCount(table) {
  return new Promise((resolve) => {
    db.get(`SELECT COUNT(*) AS c FROM ${table}`, (err, row) => {
      if (err) return resolve({ table, error: err.message, count: null });
      resolve({ table, count: row.c });
    });
  });
}

(async () => {
  console.log(`[clear-graph] Target DB: ${dbPath}`);
  db.serialize(async () => {
    try {
      await run('BEGIN');
      await run('DELETE FROM relations');
      await run('DELETE FROM concept_relations');
      await run('DELETE FROM embeddings');
      await run("DELETE FROM sqlite_sequence WHERE name IN ('relations','concept_relations','embeddings')");
      await run('COMMIT');
      await run('VACUUM');

      const results = [];
      results.push(await getCount('relations'));
      results.push(await getCount('concept_relations'));
      results.push(await getCount('embeddings'));

      for (const r of results) {
        if (r.error) console.log(`[verify] ${r.table}: ERROR ${r.error}`);
        else console.log(`[verify] ${r.table}: ${r.count}`);
      }

      console.log('[Codex Clean]  Graph data cleared (relations, concept_relations, embeddings).');
      db.close();
    } catch (e) {
      console.error('[clear-graph] ERROR:', e?.message || e);
      try { await run('ROLLBACK'); } catch {}
      db.close();
      process.exitCode = 1;
    }
  });
})();
