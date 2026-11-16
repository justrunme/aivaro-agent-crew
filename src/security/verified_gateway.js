/** Secure approval boundary for future tool integration. No MCP tools/call here. */
import { verifyCapability } from './capabilities.js';
import { createReplayStore } from './replay_store.js';
export function authorizeSignedProposal(proposal,capability,trustedPublicKey,db,{now=Date.now()}={}) {
  if(!trustedPublicKey || !db)return {ok:false,reason:'missing_trust_configuration'};
  return verifyCapability(proposal,capability,trustedPublicKey,{now,consumeNonce:createReplayStore(db)});
}
