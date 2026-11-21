import {useMemo} from "react";
import type {InputFile} from "./xcode-session";

function cellPosition(address:string) {
  const match=/^([A-Z]{1,3})([1-9]\d*)$/.exec(address);
  if (!match) return;
  let column=0;
  for(const ch of match[1]) column=column*26+ch.charCodeAt(0)-64;
  return [column,Number(match[2])];
}
function resolve(files:InputFile[], citation:string) {
  const hits=files.flatMap(file=>{
    if (!("text" in file) || !file.sources || !citation.startsWith(file.name+"#")) return [];
    const place=citation.slice(file.name.length+1);
    const exact=file.sources.find(s=>s.place===place);
    if(exact) return [file.text.slice(exact.start,exact.start+exact.length)];
    const range=/^(.*)!([A-Z]+\d+):([A-Z]+\d+)$/.exec(place);
    if(!range) return [];
    const [,sheet,first,last]=range;
    const a=cellPosition(first), b=cellPosition(last);
    if(!a || !b || a[0]>b[0] || a[1]>b[1]) return [];
    const members=file.sources.filter(s=>s.place.startsWith(sheet+"!"));
    if(![first,last].every(cell=>members.some(s=>s.place===sheet+"!"+cell))) return [];
    return [members.filter(s=>{
      const c=cellPosition(s.place.slice(sheet.length+1));
      return c && c[0]>=a[0] && c[0]<=b[0] && c[1]>=a[1] && c[1]<=b[1];
    }).map(s=>s.place+" · "+file.text.slice(s.start,s.start+s.length)).join("\n")];
  });
  const unique=[...new Set(hits)];
  return unique.length===1 ? unique[0] : undefined;
}
export default function AnswerSources({text,files}:{text:string;files:InputFile[]}) {
  const citations=useMemo(()=>[...new Set(Array.from(text.matchAll(/\[([^\[\]\n]{1,400}#[^\[\]\n]{1,200})\]/g),m=>m[1]))]
    .flatMap(label=>{const value=resolve(files,label);return value?[{label,value}]:[];}),[text,files]);
  return <>{citations.map(c=><details className="answer-source" key={c.label}><summary>{c.label}</summary><pre>{c.value}</pre></details>)}</>;
}
