#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {parse,evaluate,linkProgram} from '../src/hcode.mjs';
import {loadLockedPackages} from '../src/packages.mjs';

const [action,file,...flags]=process.argv.slice(2);
function usage(){console.error('Usage: node prototype/bin/hcode.mjs <check|run|ast> <file.hc> [--lock <hcode.lock.json>]');}
if(!['check','run','ast'].includes(action)||!file){usage();process.exitCode=2;}
else {
  try {
    let lock=null;
    if(flags.length){
      if(flags.length!==2||flags[0]!=='--lock'||!flags[1])throw Error('Only --lock <file> is supported');
      lock=flags[1];
    }
    const registry=lock?loadLockedPackages(lock):new Map();
    const source=readFileSync(file,'utf8');
    const ast=linkProgram(parse(source),registry);
    if(action==='check')console.log(`Syntax/link OK: ${file} (${ast.body.length} top-level statement(s))`);
    if(action==='ast')console.log(JSON.stringify(ast,null,2));
    if(action==='run')evaluate(ast,{registry,stdout:line=>console.log(line)});
  } catch(error){console.error(`${error.name}: ${error.message}`);process.exitCode=1;}
}
