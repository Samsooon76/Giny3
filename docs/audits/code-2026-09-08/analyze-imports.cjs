const ts=require('/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/node_modules/typescript');
const fs=require('fs'),path=require('path');
const root='/Users/hugo/Downloads/Giny.NETCore-2.68/client/web';
const config=ts.readConfigFile(root+'/tsconfig.app.json',ts.sys.readFile);
const cfg=ts.parseJsonConfigFileContent(config.config,ts.sys,root);cfg.options.allowJs=true;
const program=ts.createProgram(cfg.fileNames,cfg.options), checker=program.getTypeChecker();
const files=program.getSourceFiles().filter(f=>f.fileName.startsWith(root+'/src/')&&!f.isDeclarationFile);
const edges=new Map(),symbols=new Map();
const isTest=f=>/\.test\.[jt]sx?$/.test(f);
for(const f of files){const deps=[];function visit(n){if(ts.isStringLiteral(n)&&((ts.isImportDeclaration(n.parent)||ts.isExportDeclaration(n.parent))&&n.parent.moduleSpecifier===n||ts.isCallExpression(n.parent)&&n.parent.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isNewExpression(n.parent)&&n.parent.expression.getText(f)==='URL')){const r=ts.resolveModuleName(n.text,f.fileName,cfg.options,ts.sys).resolvedModule;if(r)deps.push(r.resolvedFileName);}
if(ts.isIdentifier(n)){let s=checker.getSymbolAtLocation(n);if(s?.flags&ts.SymbolFlags.Alias){try{s=checker.getAliasedSymbol(s);}catch{}}if(s){let refs=symbols.get(s);if(!refs)symbols.set(s,refs=[]);refs.push({file:f.fileName,node:n});}}ts.forEachChild(n,visit);}visit(f);edges.set(f.fileName,deps);}
const reached=new Set();function reach(f){if(reached.has(f))return;reached.add(f);for(const d of edges.get(f)||[])reach(d);}reach(root+'/src/main.tsx');
const rel=f=>path.relative(root,f);
const unused=[];for(const f of files){if(isTest(f.fileName))continue;const m=checker.getSymbolAtLocation(f);if(!m)continue;for(const s of checker.getExportsOfModule(m)){const ds=s.declarations||[];if(ds.length!==1)continue;const d=ds[0];if(!ts.isFunctionDeclaration(d)&&!ts.isClassDeclaration(d)&&!ts.isVariableDeclaration(d))continue;const refs=(symbols.get(s)||[]).filter(r=>r.node!==d.name);const external=refs.filter(r=>r.file!==f.fileName&&!isTest(r.file));const internal=refs.filter(r=>r.file===f.fileName);const tests=refs.filter(r=>isTest(r.file));if(external.length===0)unused.push({file:rel(f.fileName),line:f.getLineAndCharacterOfPosition(d.getStart()).line+1,name:s.name,internal:internal.length,testRefs:tests.length});}}
const result={method:'TypeScript compiler AST, import/export/dynamic import/new URL graph from src/main.tsx; exported declaration symbol reference candidates require manual validation',fileCount:files.length,unreachable:files.filter(f=>!isTest(f.fileName)&&!reached.has(f.fileName)).map(f=>rel(f.fileName)),exportsWithoutExternalProductionReference:unused};
fs.writeFileSync(path.join(__dirname,'import-graph.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));