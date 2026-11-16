#!/usr/bin/env node
import {inventoryAivaro} from '../src/aivaro_inventory.js';
const result=await inventoryAivaro();console.log(JSON.stringify(result,null,2));if(result.status==='unavailable')process.exitCode=1;
