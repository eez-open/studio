const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const { initializeWasm } = require('./initialize-wasm.cjs');
exports.run=async(app,out)=>{
  const wasmDirectory=path.join(app,'build/project-editor/flow/runtime/wasm');
  const load=Module._load;
  Module._load=function(request,parent,isMain){
    if(request.startsWith('project-editor/'))return load.call(this,path.join(app,'build',request+'.js'),parent,isMain);
    return load.call(this,request,parent,isMain);
  };
  try {
    const binding=require(path.join(app,'build/project-editor/flow/runtime/wasm-value.js'));
    const types=require(path.join(app,'build/project-editor/build/value-types.js'));
    const map=JSON.parse(fs.readFileSync(path.join(out,'assets-map.json'),'utf8'));
    const data=fs.readFileSync(path.join(out,'preview-assets.bin'));
    const messages=[];
    for(const name of ['startToDebuggerMessage','finishToDebuggerMessage','lvglScreenTick'])globalThis[name]=()=>{};
    globalThis.writeDebuggerBuffer=(_,buffer)=>messages.push(Buffer.from(buffer).toString());
    let checks=0;
    for(const version of ['8.4.0','9.2.2','9.3.0','9.4.0','9.5.0']) {
      const constructor=require(path.join(wasmDirectory,'lvgl_runtime_v'+version+'.js'));
      for(const debug of [false,true])for(const flag of [false,true]) {
        const rt = await initializeWasm(constructor, 'LVGL ' + version);
        rt.assetsMap=map;rt.wasmModuleId=1;
        const ptr=rt._malloc(data.length);rt.HEAPU8.set(data,ptr);
        rt._init(1,0xffffffff,ptr,data.length,320,240,true,300,false);rt._free(ptr);
        try {
          const flagPtr=rt._createBooleanValue(flag?1:0);rt._setGlobalVariable(0,flagPtr);rt._valueFree(flagPtr);
          const state=rt._lvglGetFlowState(0,0);assert.ok(state>0);
          const component=map.flows[0].components.find(c=>c.path.endsWith('/components/2')).componentIndex;
          const evalProp=i=>{const p=rt._evalProperty(state,component,i,0,false);assert.ok(p);try{return binding.getValue(rt,p).value;}finally{rt._valueFree(p);}};
          const initialTargets = [flag ? 10 : 20, flag ? 'alpha' : 'beta', 42, flag ? 70 : 80, undefined];
          assert.deepEqual(evalProp(1), initialTargets);
          const ordinary=evalProp(2);assert.deepEqual(ordinary,[10,42]);
          const command=text=>{const p=rt.stringToNewUTF8(text);rt._onMessageFromDebugger(p,Buffer.byteLength(text));rt._free(p);};
          if(debug) {
            command('7\t1\n');command('1\n');rt._mainLoop();
            assert.deepEqual(evalProp(1), initialTargets);
          }else command('7\t0\n');
          command('0\n');for(let i=0;i<8;i++)assert.ok(rt._mainLoop());
          const read=name=>binding.getValue(rt,rt._getGlobalVariable(map.globalVariables.find(v=>v.name===name).index)).value;
          assert.equal(read('Count'),flag?202:101);assert.equal(read('OtherCount'),flag?20:202);
          assert.equal(read(flag?'Text':'OtherText'),'changed');assert.deepEqual(read('Numbers'),[41,303]);
          assert.equal(read('Drive.Setpoint'), flag ? 404 : 70);
          assert.equal(read('Setpoint'), flag ? 80 : 404);
          assert.equal(read('Port'), 900);
          assert.deepEqual(evalProp(1), [202, 'changed', 303, 404, undefined]);
          assert.deepEqual(ordinary, [10,42]);
          const output=rt._malloc(16);rt.HEAPU8.fill(0,output,output+16);rt.HEAPU8[output]=types.FLOW_VALUE_TYPE_FLOW_OUTPUT;
          try{assert.deepEqual(binding.getValue(rt,output),{value:undefined,valueType:'undefined'});}finally{rt._free(output);}
          checks++;
          console.log('PASS actual Studio preview assets, LVGL '+version+', '+(debug?'Debug pause/resume':'Run')+', condition='+flag);
        }finally{rt._stopScript();}
      }
    }
    assert.ok(!messages.some(s=>s.includes('Invalid assignable')||s.includes('throwError')));
    fs.writeFileSync(path.join(out,'wasm-result.json'),JSON.stringify({passed:true,checks,realStudioBuildAssets:true,realCallAction:true,parameterInspection:true,ordinarySnapshots:true,debugPauseResume:true},null,2));
  }finally{Module._load=load;}
};
