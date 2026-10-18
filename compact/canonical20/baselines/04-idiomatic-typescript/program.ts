import {readUsers} from "./reader.ts";
console.log(JSON.stringify(readUsers("canonical04/users.csv")));
console.log(JSON.stringify(readUsers("canonical04/bom-crlf.csv")));
console.log(JSON.stringify(readUsers("canonical04/header-only.csv")));
console.log(JSON.stringify(readUsers("canonical04/unicode.csv")));
