// Frozen whole applications and actual wire evidence; no registry status promotion.
import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {lockedSource,projectSources,invoke,success,authored,compare} from './canonical20-project-tools.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),folder='compact/canonical20/chat17';
const registrySha='46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3';
const acceptance='two isolated clients, room join, ordered message delivery and disconnect';
export const CONTRACT_COMMIT='6489e6d8a9b9997a71da7af29d6ba063858d664e';
export const LOCK=Object.freeze({
 contract:Object.freeze([`${folder}/contract.lock.json`,'d6fd2be3672e671db7d7974529eb730985d7151f']),
 application:Object.freeze([`${folder}/application.lock.json`,'7529ca8ada7ae1729ade3a8fe9892bff0f6b5496'])
});
const integrity='sha512-Ydggc987+RO0AnWtZ/7Wq9FtNvcrL1b/RO0ud9mWjUPgDrsAAwQSF51sm2hm1XofbU/4jkpGEsLFsZZxU+1DOg==';
const fail=message=>{throw Error(`Canonical17 ${message}`);};
export function loadCanonical17Sources(base=root){
 const contract=JSON.parse(lockedSource(base,...LOCK.contract)),application=JSON.parse(lockedSource(base,...LOCK.application));
 if(contract.workloadId!=='17-websocket-chat'||application.workloadId!==contract.workloadId||application.contractCommit!==CONTRACT_COMMIT||
    application.contractManifest.path!==LOCK.contract[0]||application.contractManifest.gitBlobSha!==LOCK.contract[1]||
    contract.registry.gitBlobSha!==registrySha)fail('source lock provenance changed');
 const bytes={};
 for(const key of ['registry','contract','fixtures','attributes'])bytes[key]=lockedSource(base,contract[key].path,contract[key].gitBlobSha);
 for(const key of ['dependencyLock','dependencyNotice'])bytes[key]=lockedSource(base,application[key].path,application[key].gitBlobSha);
 const registry=JSON.parse(bytes.registry),task=registry.workloads[16],fixture=JSON.parse(bytes.fixtures);
 if(registry.workloads.length!==20||task.id!==contract.workloadId||task.acceptance!==acceptance||
    !['websocket','async','server'].every(x=>task.requiredCapabilities.includes(x))||fixture.scenarios.length!==4)fail('source lock acceptance changed');
 const dependency=JSON.parse(bytes.dependencyLock).packages['node_modules/ws'];
 if(dependency.version!=='8.22.0'||dependency.integrity!==integrity||dependency.resolved!=='https://registry.npmjs.org/ws/-/ws-8.22.0.tgz')fail('source lock dependency changed');
 const projects=Object.fromEntries(['hcode','typescript'].map(language=>[language,projectSources(base,application.files,`${folder}/${language}`)]));
 if(application.files.length!==projects.hcode.files.length+projects.typescript.files.length)fail('inventory contains uncounted application source');
 return {...projects,bytes,fixture};
}
function checkRuns(runs,ids){
 const expected=['native','reference','typescript'].flatMap(engine=>ids.map(id=>`${engine}/${id}`)).sort();
 if(JSON.stringify(runs.map(r=>`${r.engine}/${r.scenario}`).sort())!==JSON.stringify(expected)||runs.some(r=>r.wireAssertions<5))fail('missing actual wire runs');
}
function installedDependency(){
 const base=join(root,'node_modules/ws');
 if(JSON.parse(readFileSync(join(base,'package.json'))).version!=='8.22.0')fail('installed ws version differs from source lock');
 const files=[];
 function walk(directory=''){
  for(const entry of readdirSync(join(base,directory),{withFileTypes:true})){
   const path=directory?`${directory}/${entry.name}`:entry.name;
   if(entry.isSymbolicLink())fail('dependency inventory contains symbolic link');
   if(entry.isDirectory())walk(path);
   else if(entry.isFile()){
    const bytes=readFileSync(join(base,path));files.push({path,utf8Bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
   }else fail('dependency inventory contains non-file');
  }
 }
 walk();files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 return {name:'ws',version:'8.22.0',integrity,files,totalBytes:files.reduce((n,f)=>n+f.utf8Bytes,0)};
}
export function verifyCanonical17(){
 const s=loadCanonical17Sources();
 const proof=JSON.parse(success(invoke(process.execPath,['scripts/canonical20-chat-proof.mjs'],{timeout:240000}),'actual WebSocket proof'));
 checkRuns(proof.fixedRuns,s.fixture.scenarios.map(x=>x.id));
 checkRuns(proof.generatedRuns,Array.from({length:8},(_,i)=>`generated-${i}`));
 checkRuns(proof.abruptRuns,['abrupt-process-disconnect']);checkRuns(proof.counterBoundaryRuns,['maximum-sequence']);
 if(proof.kind!=='full-compiler-evidence'||JSON.stringify(proof.engines)!=='["native","reference","typescript"]'||
    proof.wireAssertions<950||proof.sentMessages<3000||proof.acceptedChatMessages!==2526||proof.disconnects!==30||
    proof.concurrentSends!==2388||proof.forcedDisconnects!==3||proof.isolatedClientProcesses!==3||
    !proof.independentNodeWebSocketClients||!proof.sharedReferenceTransport||!proof.independentTypeScriptPolicy||
    proof.globallyVerified70Percent!==false||!(proof.compiledJavaScript.utf8Bytes>0))fail('actual wire evidence incomplete');
 const faults=['native','reference','typescript'].flatMap(engine=>['room-leak','sequence-reuse','disconnect-retained'].map(id=>`${engine}/${id}`)).sort();
 if(JSON.stringify(proof.seededFaultsRejected.map(r=>`${r.engine}/${r.id}`).sort())!==JSON.stringify(faults)||
    !proof.seededFaultsRejected.every(r=>r.rejectedByWireAssertions===true))fail('policy faults not rejected');
 const sharedFixtures={unicodeCodepoints:[...s.bytes.fixtures.toString('utf8')].length,utf8Bytes:s.bytes.fixtures.length};
 const includingSharedFixtures=Object.fromEntries(['hcode','typescript'].map(language=>[language,{
  unicodeCodepoints:s[language].unicodeCodepoints+sharedFixtures.unicodeCodepoints,
  utf8Bytes:s[language].utf8Bytes+sharedFixtures.utf8Bytes}]));
 return {...proof,workloadId:'17-websocket-chat',acceptance,originalRegistryGitBlobSha:registrySha,contractCommit:CONTRACT_COMMIT,
  concreteFixtureEstablishedOn:'2026-10-20',preexistingConcreteTask17Fixture:false,nativeRustCompiler:true,independentHCodeJSReference:true,
  authoredSource:{hcode:authored(s.hcode),typescript:authored(s.typescript)},sourceCompression:compare(s.hcode,s.typescript),
  sharedFixtures,includingSharedFixtures,includingSharedFixtureCompression:compare(includingSharedFixtures.hcode,includingSharedFixtures.typescript),
  externalPackageDependencies:1,maintainedDependency:installedDependency(),minimumProofNodeVersion:'22.13.0',
  sharedDependencyMetadataBytes:s.bytes.dependencyLock.length+s.bytes.dependencyNotice.length,
  limitations:'Only task17. Independent language evaluator shares the generic transport with native; TypeScript owns separate application/routing logic but both use maintained ws. Primary clients use Node standard WebSocket; forced-disconnect clients run in separate killed processes. Counter-boundary runs use temporary initialization variants. No authentication, TLS, persistence, offline delivery or multi-process room claim. Complete app source includes configuration, protocol/input and transport glue. Shared JSON, dependency/metadata and emitted runtime are separate. No global median, runtime-performance or AI-token claim.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyCanonical17(),null,2));
