/** Offline-verifiable, one-time Ed25519 approval capabilities.
 * A verified signature is necessary but never sufficient to bypass local policy.
 * The caller must persist consumed nonces before invoking a tool.
 */
import { createHash, generateKeyPairSync, sign, verify, randomUUID, createPublicKey } from 'node:crypto';
import { hashPayload } from '../gateway.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
const bytes = value => Buffer.from(JSON.stringify(canonical(value)),'utf8');
export function proposalDigest(proposal) {
  if (!proposal || typeof proposal.run_id!=='string' || typeof proposal.agent_id!=='string' || typeof proposal.action_type!=='string' || !proposal.payload || typeof proposal.payload!=='object') throw Error('Invalid proposal');
  const actual=hashPayload(proposal.payload);
  if (actual!==proposal.payload_hash) throw Error('Proposal payload hash mismatch');
  return createHash('sha256').update(bytes({run_id:proposal.run_id,agent_id:proposal.agent_id,action_type:proposal.action_type,payload_hash:actual})).digest('hex');
}
export function generateDemoSigner(){return generateKeyPairSync('ed25519')}
export function issueCapability(proposal,privateKey,{issuer='local-demo',now=Date.now(),ttlMs=60000}={}) {
  if (!Number.isSafeInteger(now)||!Number.isSafeInteger(ttlMs)||ttlMs<=0||ttlMs>300000) throw Error('Invalid capability lifetime');
  const claims={version:1,issuer,proposal_digest:proposalDigest(proposal),nonce:randomUUID(),issued_at:now,expires_at:now+ttlMs};
  return {claims,signature:sign(null,bytes(claims),privateKey).toString('base64url')};
}
export function verifyCapability(proposal,capability,publicKey,{now=Date.now(),consumeNonce}={}) {
  try {
    if (!capability || !capability.claims || typeof capability.signature!=='string') return {ok:false,reason:'malformed'};
    const c=capability.claims;
    if(c.version!==1||typeof c.issuer!=='string'||typeof c.nonce!=='string'||!Number.isSafeInteger(c.issued_at)||!Number.isSafeInteger(c.expires_at)||c.expires_at<=c.issued_at||c.expires_at-c.issued_at>300000||now<c.issued_at||now>=c.expires_at)return {ok:false,reason:'expired_or_invalid'};
    if(c.proposal_digest!==proposalDigest(proposal))return {ok:false,reason:'proposal_mismatch'};
    const sig=Buffer.from(capability.signature,'base64url');
    if(sig.length!==64||!verify(null,bytes(c),(publicKey?.type==='public'?publicKey:createPublicKey(publicKey)),sig))return {ok:false,reason:'invalid_signature'};
    if(typeof consumeNonce!=='function')return {ok:false,reason:'replay_store_required'};
    if(!consumeNonce(c.nonce,c.expires_at))return {ok:false,reason:'replayed'};
    return {ok:true,issuer:c.issuer,nonce:c.nonce};
  }catch{return {ok:false,reason:'verification_failed'}}
}
