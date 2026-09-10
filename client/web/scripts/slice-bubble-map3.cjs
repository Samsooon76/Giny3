// Select the native scene dependency closure with the TypeScript binder.
// The app module contributes only two enum initializers; no app lifecycle is imported.
const ts=require('../node_modules/typescript'),fs=require('fs'),path=require('path');
const dir=process.argv[2],out=process.argv[3]; if(!dir || !out) throw new Error('Usage: slice-bubble-map3.cjs <verified modules> <output>');fs.mkdirSync(out,{recursive:true});
const files=fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>path.join(dir,n));
const prog=ts.createProgram(files,{allowJs:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,noResolve:false});const checker=prog.getTypeChecker(),keep=new Set(),imports=new Set(),full=new Set();
function unit(d){while(d.parent && !ts.isSourceFile(d.parent)){if(ts.isVariableDeclaration(d)&&ts.isVariableDeclarationList(d.parent)&&ts.isVariableStatement(d.parent.parent)&&ts.isSourceFile(d.parent.parent.parent))return d;d=d.parent;}return d;}
function symbol(s){if(!s)return;for(const d of s.declarations||[]){if(ts.isImportSpecifier(d)||ts.isImportClause(d)||ts.isNamespaceImport(d)){imports.add(d);const a=checker.getAliasedSymbol(s);if(a!==s)symbol(a);}else{const u=unit(d);if(u.getSourceFile().fileName.startsWith(dir))take(u);}}}
const appAllowed=new Set(['oH','lH','tH','xE','Os','$_','Y_','p7','pi','b7','X7','Z7','eH','nH','sH','aH','u1','rH','W_','c1','d1']);
function take(n){if(n.getSourceFile().fileName.endsWith('/app-CgRsD63L.js')&&!appAllowed.has(n.name?.text))return;if(n.getSourceFile().fileName.endsWith('/app-CgRsD63L.js') && ts.isVariableDeclaration(n)&&['oH','lH'].includes(n.name.text)){keep.add(n);return;}if(keep.has(n))return;keep.add(n);walk(n);}
function walk(n){if(ts.isIdentifier(n))symbol(checker.getSymbolAtLocation(n)); if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(n.arguments[0])){const f=prog.getSourceFile(path.resolve(path.dirname(n.getSourceFile().fileName),n.arguments[0].text));if(f&&!full.has(f)){full.add(f);for(const s of f.statements)take(s);}}ts.forEachChild(n,walk);}
const root=prog.getSourceFile(path.join(dir,'x-D8TUb0j1.js'));const cls=root.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='Y_');take(cls);
const roots = {
 'character-preview-render-D01yieWl.js': {Xr:'BubbleLookRenderer'},
 'x-D8TUb0j1.js': {iv:'BubbleActorFrameKey',No:'actorTextureUrls',Z0:'actorTexturesReady',ft:'actorToMap',Aa:'readMapGrid',Td:'mapCellPosition',Dc:'interactiveIndex',WT:'initialInteractiveState',qT:'changeInteractiveState'},
 'breed-modifiers-ByNQEApc.js': {Ae:'BubbleEntity',Ms:'BubbleSubEntity',Os:'applyBreedModifiers',Xs:'applyHiddenParts',Ns:'applyCombatIdle'},
 'index-AJmcKxRp.js': {Xe:'BubbleAssetLoader'},
 'look-NjTf_W2k.js': {hn:'parseBubbleLook'},
 'index-BP60ZkRz.js': {Hn:'createMovement',qn:'startMovement',Hr:'advanceMovement',Di:'cancelMovement',Li:'settleMovement'},
 'app-CgRsD63L.js': {tH:'findBubblePath'},
};
for(const [name,names] of Object.entries(roots)){const f=prog.getSourceFile(path.join(dir,name));if(!f)throw new Error('Missing source '+name); for(const id of Object.keys(names)){const n=f.statements.find(n=>n.name?.text===id);if(!n)throw new Error('Missing declaration '+id);take(n);}}
const printer=ts.createPrinter();let count=0;
for(const file of prog.getSourceFiles().filter(f=>f.fileName.startsWith(dir))){const chunks=[];
 for(const s of file.statements){if(ts.isImportDeclaration(s)){const c=s.importClause;if(!c)continue;let def=c.name&&imports.has(c)?c.name:undefined;let bindings=c.namedBindings;if(bindings&&ts.isNamedImports(bindings)){const el=bindings.elements.filter(e=>imports.has(e));bindings=el.length?ts.factory.updateNamedImports(bindings,el):undefined;}else if(bindings&&!imports.has(bindings))bindings=undefined;if(def||bindings)chunks.push(printer.printNode(ts.EmitHint.Unspecified,ts.factory.updateImportDeclaration(s,s.modifiers,ts.factory.updateImportClause(c,false,def,bindings),s.moduleSpecifier,s.attributes),file));}
 else if(ts.isVariableStatement(s)){const ds=s.declarationList.declarations.filter(d=>keep.has(d)||keep.has(s));if(ds.length)chunks.push(printer.printNode(ts.EmitHint.Unspecified,ts.factory.updateVariableStatement(s,s.modifiers,ts.factory.updateVariableDeclarationList(s.declarationList,ds)),file));}
 else if(ts.isExportDeclaration(s)&&s.exportClause&&ts.isNamedExports(s.exportClause)){const es=s.exportClause.elements.filter(e=>{let sym=checker.getSymbolAtLocation(e.propertyName||e.name);if(sym?.flags&ts.SymbolFlags.Alias)sym=checker.getAliasedSymbol(sym);return sym?.declarations?.some(d=>keep.has(unit(d)));});if(es.length)chunks.push(printer.printNode(ts.EmitHint.Unspecified,ts.factory.updateExportDeclaration(s,s.modifiers,false,ts.factory.updateNamedExports(s.exportClause,es),s.moduleSpecifier,s.attributes),file));}
 else if(keep.has(s))chunks.push(printer.printNode(ts.EmitHint.Unspecified,s,file));}
 if(chunks.length){if(file===root)chunks.push('export { Y_ as BubbleMapScene };');const added=roots[path.basename(file.fileName)];if(added)chunks.push('export { '+Object.entries(added).map(([k,v])=>k+' as '+v).join(', ')+' };');fs.writeFileSync(path.join(out,path.basename(file.fileName)),'// Generated from local Bubble 0.1.328; see import-bubble-map3 script.\n'+chunks.join('\n'));count++;}}
console.log(count,'modules',keep.size,'declarations');
