// TEST ONLY: deterministic OS-entropy substitute; never imported by production.
import crypto from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
if(!process.env.JFH_TEST_SESSION_ID)throw Error('Test ID required');
const bytes=Buffer.from(process.env.JFH_TEST_SESSION_ID,'base64url');
if(bytes.length!==18||bytes.toString('base64url')!==process.env.JFH_TEST_SESSION_ID)throw Error('Invalid test ID');
crypto.randomBytes=size=>{if(size!==18)throw Error('Unexpected test entropy request');return Buffer.from(bytes);};
syncBuiltinESMExports();
