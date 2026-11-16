/** Real local Aivaro MCP discovery, capability inventory only. Never calls tools. */
import { discoverAivaroTools } from './aivaro_discovery.js';
const REQUIRED=['terminal_create','terminal_send','terminal_read','terminal_interrupt','terminal_close'];
export function assessAivaroInventory(result){
  const names=new Set((Array.isArray(result?.tools)?result.tools:[]).map(x=>x.name));
  const has=prefix=>[...names].some(x=>x.startsWith(prefix));
  return Object.freeze({status:result?.status||'unavailable',discovered:[...names].sort(),terminal_mcp:REQUIRED.every(x=>names.has(x)),browser_mcp:has('browser_'),desktop_mcp:has('desktop_'),system_mcp:has('system_'),phone_approval_verified:false,trust_execution_verified:false,warning:'Discovery does not grant tool execution or prove Trust/Android/sandbox integration.'});
}
export async function inventoryAivaro(){return assessAivaroInventory(await discoverAivaroTools());}
