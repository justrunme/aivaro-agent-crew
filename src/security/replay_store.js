/** Persistent atomic nonce consumption; call only after signature verification. */
export function createReplayStore(db){
  db.exec(`CREATE TABLE IF NOT EXISTS consumed_capabilities (nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)`);
  const insert=db.prepare('INSERT OR IGNORE INTO consumed_capabilities (nonce, expires_at) VALUES (?, ?)');
  return (nonce,expiresAt)=>{
    if(typeof nonce!=='string'||!nonce||!Number.isSafeInteger(expiresAt))return false;
    return insert.run(nonce,expiresAt).changes===1;
  };
}
