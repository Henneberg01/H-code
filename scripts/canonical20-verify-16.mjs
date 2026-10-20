// Whole signed-session apps, immutable contract, and actual three-engine HTTP evidence.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {lockedSource,projectSources,invoke,success,authored,compare} from './canonical20-project-tools.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const folder='compact/canonical20/auth16';
const registrySha='46653ef90ffb3e420fba4ddfbfac3c4cfd57f3b3';
const acceptance='issue/rotate/revoke a signed session using deterministic fixture identity';
export const CONTRACT_COMMIT='01cef3b86b361eafc6accd2b78a6a3be6b20108e';
export const LOCK=Object.freeze({
  contract:Object.freeze([`${folder}/contract.lock.json`,'02cc17e1be5578550837568c77c639dcb4860d51']),
  application:Object.freeze([`${folder}/application.lock.json`,'3bd872683316001a93606a843ff51be1285a7546']),
});
const fail=message=>{throw Error(`Canonical16 ${message}`);};
export function loadCanonical16Sources(base=root){
  const contract=JSON.parse(lockedSource(base,...LOCK.contract));
  const application=JSON.parse(lockedSource(base,...LOCK.application));
  if(contract.workloadId!=='16-auth-sessions'||application.workloadId!==contract.workloadId||
      application.contractCommit!==CONTRACT_COMMIT||application.contractManifest.gitBlobSha!==LOCK.contract[1]||
      application.contractManifest.path!==LOCK.contract[0]||contract.registry.gitBlobSha!==registrySha)fail('source lock provenance changed');
  const bytes={};
  for(const name of ['registry','fixtures','contract','attributes'])bytes[name]=lockedSource(base,contract[name].path,contract[name].gitBlobSha);
  const registry=JSON.parse(bytes.registry),task=registry.workloads[15];
  if(registry.workloads.length!==20||task.id!=='16-auth-sessions'||task.acceptance!==acceptance||
      !['cryptography','http-server','persistent-session'].every(x=>task.requiredCapabilities.includes(x)))fail('source lock acceptance changed');
  const fixture=JSON.parse(bytes.fixtures);
  if(fixture.flows.length!==6||fixture.identity!=='fixture-alice')fail('source lock fixture inventory changed');
  const projects=Object.fromEntries(['hcode','typescript'].map(language=>
    [language,projectSources(base,application.files,`${folder}/${language}`)]));
  if(application.files.length!==projects.hcode.files.length+projects.typescript.files.length)fail('inventory contains uncounted source');
  return {...projects,bytes,fixture};
}
export function verifyCanonical16(){
  const sources=loadCanonical16Sources();
  const proof=JSON.parse(success(invoke(process.execPath,['scripts/canonical20-auth-proof.mjs'],{timeout:240000}),
    'actual session HTTP proof'));
  if(proof.kind!=='full-compiler-evidence'||JSON.stringify(proof.engines)!=='["native","reference","typescript"]'||
      proof.fixedRuns.length!==18||proof.generatedRuns.length!==24||proof.generationBoundaryRuns.length!==3||
      proof.httpAssertions!==888||proof.forcedCrashes!==45||proof.restarts!==78||
      proof.concurrentRotations!==42||proof.keyChanges!==12||proof.startupRejections.length!==18||
      !proof.startupRejections.every(x=>x.rejectedBeforeListen===true)||proof.seededFaultsRejected.length!==9||
      !proof.seededFaultsRejected.every(x=>x.rejectedByHttpAssertions===true)||
      !proof.bomKeyBytesVerified||!proof.minimumScalarBomKeyVerified||!proof.maximumUtf8KeyVerified||
      !proof.sharedReferenceHttpAndCasHost||!proof.independentTypeScriptSQLite||
      !(proof.compiledJavaScript.utf8Bytes>0)||!/^[0-9a-f]{64}$/.test(proof.compiledJavaScript.sha256)||
      proof.globallyVerified70Percent!==false)fail('actual proof incomplete');
  const sharedFixtures={unicodeCodepoints:[...sources.bytes.fixtures.toString('utf8')].length,
    utf8Bytes:sources.bytes.fixtures.length};
  const includingSharedFixtures=Object.fromEntries(['hcode','typescript'].map(language=>[language,{
    unicodeCodepoints:sources[language].unicodeCodepoints+sharedFixtures.unicodeCodepoints,
    utf8Bytes:sources[language].utf8Bytes+sharedFixtures.utf8Bytes}]));
  return {...proof,workloadId:'16-auth-sessions',acceptance,originalRegistryGitBlobSha:registrySha,
    contractCommit:CONTRACT_COMMIT,concreteFixtureEstablishedOn:'2026-10-20',preexistingConcreteTask16Fixture:false,
    nativeRustCompiler:true,independentHCodeJSReference:true,independentIdiomaticTypeScript:true,
    authoredSource:{hcode:authored(sources.hcode),typescript:authored(sources.typescript)},
    sourceCompression:compare(sources.hcode,sources.typescript),sharedFixtures,includingSharedFixtures,
    includingSharedFixtureCompression:compare(includingSharedFixtures.hcode,includingSharedFixtures.typescript),
    externalPackageDependencies:0,minimumTypeScriptNodeVersion:'22.13.0',
    limitations:'Only task16: symmetric HMAC-authenticated stateful session for one fixed fixture identity. No expiration, production credential provider, JWT or asymmetric signature claim. JS language evaluator is independent but shares the generic HTTP/CAS host with native; TypeScript uses independent SQLite transactions. Whole app source includes validation, configuration and persistence glue. JSON fixtures are separate and inclusive; generated runtime is separate, and Node/Rust/toolchain/SQLite size is not zero or measured here. No global median, runtime-performance or AI-token claim.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyCanonical16(),null,2));
