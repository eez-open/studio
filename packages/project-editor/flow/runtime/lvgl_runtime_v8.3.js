// include: shell.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
module["exports"] = function (postWorkerToRendererMessage) {
    var Module = {};

    Module.postWorkerToRendererMessage = postWorkerToRendererMessage;

    Module.onRuntimeInitialized = function () {
        postWorkerToRendererMessage({ init: {} });
    }

    Module.print = function (args) {
        console.log("From LVGL-WASM flow runtime:", args);
    };

    Module.printErr = function (args) {
        console.error("From LVGL-WASM flow runtime:", args);
    };

    runWasmModule(Module);

    return Module;
}

function runWasmModule(Module) {



// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = Object.assign({}, Module);

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window == 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts == 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process == 'object' && typeof process.versions == 'object' && typeof process.versions.node == 'string';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)');
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary;

if (ENVIRONMENT_IS_NODE) {
  if (typeof process == 'undefined' || !process.release || process.release.name !== 'node') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  var nodeVersion = process.versions.node;
  var numericVersion = nodeVersion.split('.').slice(0, 3);
  numericVersion = (numericVersion[0] * 10000) + (numericVersion[1] * 100) + (numericVersion[2].split('-')[0] * 1);
  var minVersion = 160000;
  if (numericVersion < 160000) {
    throw new Error('This emscripten-generated code requires node v16.0.0 (detected v' + nodeVersion + ')');
  }

  // `require()` is no-op in an ESM module, use `createRequire()` to construct
  // the require()` function.  This is only necessary for multi-environment
  // builds, `-sENVIRONMENT=node` emits a static import declaration instead.
  // TODO: Swap all `require()`'s with `import()`'s?
  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require('fs');
  var nodePath = require('path');

  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = nodePath.dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }

// include: node_shell_read.js
read_ = (filename, binary) => {
  // We need to re-wrap `file://` strings to URLs. Normalizing isn't
  // necessary in that case, the path should already be absolute.
  filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
  return fs.readFileSync(filename, binary ? undefined : 'utf8');
};

readBinary = (filename) => {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

readAsync = (filename, onload, onerror, binary = true) => {
  // See the comment in the `read_` function.
  filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
  fs.readFile(filename, binary ? undefined : 'utf8', (err, data) => {
    if (err) onerror(err);
    else onload(binary ? data.buffer : data);
  });
};
// end include: node_shell_read.js
  if (!Module['thisProgram'] && process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, '/');
  }

  arguments_ = process.argv.slice(2);

  if (typeof module != 'undefined') {
    module['exports'] = Module;
  }

  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };

  Module['inspect'] = () => '[Emscripten Module object]';

} else
if (ENVIRONMENT_IS_SHELL) {

  if ((typeof process == 'object' && typeof require === 'function') || typeof window == 'object' || typeof importScripts == 'function') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  if (typeof read != 'undefined') {
    read_ = read;
  }

  readBinary = (f) => {
    if (typeof readbuffer == 'function') {
      return new Uint8Array(readbuffer(f));
    }
    let data = read(f, 'binary');
    assert(typeof data == 'object');
    return data;
  };

  readAsync = (f, onload, onerror) => {
    setTimeout(() => onload(readBinary(f)));
  };

  if (typeof clearTimeout == 'undefined') {
    globalThis.clearTimeout = (id) => {};
  }

  if (typeof setTimeout == 'undefined') {
    // spidermonkey lacks setTimeout but we use it above in readAsync.
    globalThis.setTimeout = (f) => (typeof f == 'function') ? f() : abort();
  }

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit == 'function') {
    quit_ = (status, toThrow) => {
      // Unlike node which has process.exitCode, d8 has no such mechanism. So we
      // have no way to set the exit code and then let the program exit with
      // that code when it naturally stops running (say, when all setTimeouts
      // have completed). For that reason, we must call `quit` - the only way to
      // set the exit code - but quit also halts immediately.  To increase
      // consistency with node (and the web) we schedule the actual quit call
      // using a setTimeout to give the current stack and any exception handlers
      // a chance to run.  This enables features such as addOnPostRun (which
      // expected to be able to run code after main returns).
      setTimeout(() => {
        if (!(toThrow instanceof ExitStatus)) {
          let toLog = toThrow;
          if (toThrow && typeof toThrow == 'object' && toThrow.stack) {
            toLog = [toThrow, toThrow.stack];
          }
          err(`exiting due to exception: ${toLog}`);
        }
        quit(status);
      });
      throw toThrow;
    };
  }

  if (typeof print != 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console == 'undefined') console = /** @type{!Console} */({});
    console.log = /** @type{!function(this:Console, ...*): undefined} */ (print);
    console.warn = console.error = /** @type{!function(this:Console, ...*): undefined} */ (typeof printErr != 'undefined' ? printErr : print);
  }

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document != 'undefined' && document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }

  if (!(typeof window == 'object' || typeof importScripts == 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {
// include: web_or_worker_shell_read.js
read_ = (url) => {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  }

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = (url) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
    };
  }

  readAsync = (url, onload, onerror) => {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  }

// end include: web_or_worker_shell_read.js
  }
} else
{
  throw new Error('environment detection error');
}

var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.error.bind(console);

// Merge back in the overrides
Object.assign(Module, moduleOverrides);
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;
checkIncomingModuleAPI();

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.

if (Module['arguments']) arguments_ = Module['arguments'];legacyModuleProp('arguments', 'arguments_');

if (Module['thisProgram']) thisProgram = Module['thisProgram'];legacyModuleProp('thisProgram', 'thisProgram');

if (Module['quit']) quit_ = Module['quit'];legacyModuleProp('quit', 'quit_');

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] == 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] == 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] == 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] == 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] == 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] == 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] == 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] == 'undefined', 'Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)');
assert(typeof Module['TOTAL_MEMORY'] == 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');
legacyModuleProp('asm', 'wasmExports');
legacyModuleProp('read', 'read_');
legacyModuleProp('readAsync', 'readAsync');
legacyModuleProp('readBinary', 'readBinary');
legacyModuleProp('setWindowTitle', 'setWindowTitle');
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var FETCHFS = 'FETCHFS is no longer included by default; build with -lfetchfs.js';
var ICASEFS = 'ICASEFS is no longer included by default; build with -licasefs.js';
var JSFILEFS = 'JSFILEFS is no longer included by default; build with -ljsfilefs.js';
var OPFS = 'OPFS is no longer included by default; build with -lopfs.js';

var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';

assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add 'shell' to `-sENVIRONMENT` to enable.");


// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];legacyModuleProp('wasmBinary', 'wasmBinary');

if (typeof WebAssembly != 'object') {
  abort('no native wasm support detected');
}

// Wasm globals

var wasmMemory;

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

// Memory management

var HEAP,
/** @type {!Int8Array} */
  HEAP8,
/** @type {!Uint8Array} */
  HEAPU8,
/** @type {!Int16Array} */
  HEAP16,
/** @type {!Uint16Array} */
  HEAPU16,
/** @type {!Int32Array} */
  HEAP32,
/** @type {!Uint32Array} */
  HEAPU32,
/** @type {!Float32Array} */
  HEAPF32,
/** @type {!Float64Array} */
  HEAPF64;

function updateMemoryViews() {
  var b = wasmMemory.buffer;
  Module['HEAP8'] = HEAP8 = new Int8Array(b);
  Module['HEAP16'] = HEAP16 = new Int16Array(b);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(b);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(b);
  Module['HEAP32'] = HEAP32 = new Int32Array(b);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(b);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(b);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(b);
}

assert(!Module['STACK_SIZE'], 'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time')

assert(typeof Int32Array != 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray != undefined && Int32Array.prototype.set != undefined,
       'JS engine does not provide full typed array support');

// If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
assert(!Module['wasmMemory'], 'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally');
assert(!Module['INITIAL_MEMORY'], 'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically');

// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4;
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  HEAPU32[((max)>>2)] = 0x02135467;
  HEAPU32[(((max)+(4))>>2)] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  HEAPU32[((0)>>2)] = 1668509029;
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  // See writeStackCookie().
  if (max == 0) {
    max += 4;
  }
  var cookie1 = HEAPU32[((max)>>2)];
  var cookie2 = HEAPU32[(((max)+(4))>>2)];
  if (cookie1 != 0x02135467 || cookie2 != 0x89BACDFE) {
    abort(`Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`);
  }
  // Also test the global address 0 for integrity.
  if (HEAPU32[((0)>>2)] != 0x63736d65 /* 'emsc' */) {
    abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
  }
}
// end include: runtime_stack_check.js
// include: runtime_assertions.js
// Endianness check
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)';
})();

// end include: runtime_assertions.js
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;

function preRun() {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  checkStackCookie();

  
if (!Module["noFSInit"] && !FS.init.initialized)
  FS.init();
FS.ignorePermissions = false;

TTY.init();
  callRuntimeCallbacks(__ATINIT__);
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval != 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(() => {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err(`dependency: ${dep}`);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

/** @param {string|number=} what */
function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  what = 'Aborted(' + what + ')';
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.

  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // defintion for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// include: URIUtils.js
// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

/**
 * Indicates whether filename is a base64 data URI.
 * @noinline
 */
var isDataURI = (filename) => filename.startsWith(dataURIPrefix);

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */
var isFileURI = (filename) => filename.startsWith('file://');
// end include: URIUtils.js
function createExportWrapper(name) {
  return function() {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    var f = wasmExports[name];
    assert(f, `exported native function \`${name}\` not found`);
    return f.apply(null, arguments);
  };
}

// include: runtime_exceptions.js
// end include: runtime_exceptions.js
var wasmBinaryFile;
  wasmBinaryFile = 'lvgl_runtime_v8.3.wasm';
  if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile);
  }

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  throw "both async and sync fetching of the wasm failed";
}

function getBinaryPromise(binaryFile) {
  // If we don't have the binary yet, try to load it asynchronously.
  // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
  // See https://github.com/github/fetch/pull/92#issuecomment-140665932
  // Cordova or Electron apps are typically loaded from a file:// url.
  // So use fetch if it is available and the url is not a file, otherwise fall back to XHR.
  if (!wasmBinary
      && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch == 'function'
      && !isFileURI(binaryFile)
    ) {
      return fetch(binaryFile, { credentials: 'same-origin' }).then((response) => {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + binaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(() => getBinarySync(binaryFile));
    }
    else if (readAsync) {
      // fetch is not available or url is file => try XHR (readAsync uses XHR internally)
      return new Promise((resolve, reject) => {
        readAsync(binaryFile, (response) => resolve(new Uint8Array(/** @type{!ArrayBuffer} */(response))), reject)
      });
    }
  }

  // Otherwise, getBinarySync should be able to get it synchronously
  return Promise.resolve().then(() => getBinarySync(binaryFile));
}

function instantiateArrayBuffer(binaryFile, imports, receiver) {
  return getBinaryPromise(binaryFile).then((binary) => {
    return WebAssembly.instantiate(binary, imports);
  }).then((instance) => {
    return instance;
  }).then(receiver, (reason) => {
    err(`failed to asynchronously prepare wasm: ${reason}`);

    // Warn on some common problems.
    if (isFileURI(wasmBinaryFile)) {
      err(`warning: Loading from a file URI (${wasmBinaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  });
}

function instantiateAsync(binary, binaryFile, imports, callback) {
  if (!binary &&
      typeof WebAssembly.instantiateStreaming == 'function' &&
      !isDataURI(binaryFile) &&
      // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
      !isFileURI(binaryFile) &&
      // Avoid instantiateStreaming() on Node.js environment for now, as while
      // Node.js v18.1.0 implements it, it does not have a full fetch()
      // implementation yet.
      //
      // Reference:
      //   https://github.com/emscripten-core/emscripten/pull/16917
      !ENVIRONMENT_IS_NODE &&
      typeof fetch == 'function') {
    return fetch(binaryFile, { credentials: 'same-origin' }).then((response) => {
      // Suppress closure warning here since the upstream definition for
      // instantiateStreaming only allows Promise<Repsponse> rather than
      // an actual Response.
      // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure is fixed.
      /** @suppress {checkTypes} */
      var result = WebAssembly.instantiateStreaming(response, imports);

      return result.then(
        callback,
        function(reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          err(`wasm streaming compile failed: ${reason}`);
          err('falling back to ArrayBuffer instantiation');
          return instantiateArrayBuffer(binaryFile, imports, callback);
        });
    });
  }
  return instantiateArrayBuffer(binaryFile, imports, callback);
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': wasmImports,
    'wasi_snapshot_preview1': wasmImports,
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    wasmExports = instance.exports;

    

    wasmMemory = wasmExports['memory'];
    
    assert(wasmMemory, "memory not found in wasm exports");
    // This assertion doesn't hold when emscripten is run in --post-link
    // mode.
    // TODO(sbc): Read INITIAL_MEMORY out of the wasm file in post-link mode.
    //assert(wasmMemory.buffer.byteLength === 83886080);
    updateMemoryViews();

    addOnInit(wasmExports['__wasm_call_ctors']);

    removeRunDependency('wasm-instantiate');
    return wasmExports;
  }
  // wait for the pthread pool (if any)
  addRunDependency('wasm-instantiate');

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    receiveInstance(result['instance']);
  }

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module['instantiateWasm']) {

    try {
      return Module['instantiateWasm'](info, receiveInstance);
    } catch(e) {
      err(`Module.instantiateWasm callback failed with error: ${e}`);
        return false;
    }
  }

  instantiateAsync(wasmBinary, wasmBinaryFile, info, receiveInstantiationResult);
  return {}; // no exports yet; we'll fill them in later
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// include: runtime_debug.js
function legacyModuleProp(prop, newName, incomming=true) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      get() {
        let extra = incomming ? ' (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)' : '';
        abort(`\`Module.${prop}\` has been replaced by \`${newName}\`` + extra);

      }
    });
  }
}

function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(`\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`);
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
  return name === 'FS_createPath' ||
         name === 'FS_createDataFile' ||
         name === 'FS_createPreloadedFile' ||
         name === 'FS_unlink' ||
         name === 'addRunDependency' ||
         // The old FS has some functionality that WasmFS lacks.
         name === 'FS_createLazyFile' ||
         name === 'FS_createDevice' ||
         name === 'removeRunDependency';
}

function missingGlobal(sym, msg) {
  if (typeof globalThis !== 'undefined') {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        warnOnce('`' + sym + '` is not longer defined by emscripten. ' + msg);
        return undefined;
      }
    });
  }
}

missingGlobal('buffer', 'Please use HEAP8.buffer or wasmMemory.buffer');
missingGlobal('asm', 'Please use wasmExports instead');

function missingLibrarySymbol(sym) {
  if (typeof globalThis !== 'undefined' && !Object.getOwnPropertyDescriptor(globalThis, sym)) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        // Can't `abort()` here because it would break code that does runtime
        // checks.  e.g. `if (typeof SDL === 'undefined')`.
        var msg = '`' + sym + '` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line';
        // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
        // library.js, which means $name for a JS name with no prefix, or name
        // for a JS name like _name.
        var librarySymbol = sym;
        if (!librarySymbol.startsWith('_')) {
          librarySymbol = '$' + sym;
        }
        msg += " (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='" + librarySymbol + "')";
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        warnOnce(msg);
        return undefined;
      }
    });
  }
  // Any symbol that is not included from the JS libary is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = "'" + sym + "' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)";
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        abort(msg);
      }
    });
  }
}

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(text) {
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn.apply(console, arguments);
}
// end include: runtime_debug.js
// === Body ===

var ASM_CONSTS = {
  1046032: ($0) => { startToDebuggerMessage($0); },  
 1046064: ($0, $1, $2) => { writeDebuggerBuffer($0, new Uint8Array(Module.HEAPU8.buffer, $1, $2)); },  
 1046139: ($0, $1, $2) => { writeDebuggerBuffer($0, new Uint8Array(Module.HEAPU8.buffer, $1, $2)); },  
 1046214: ($0) => { finishToDebuggerMessage($0); },  
 1046247: ($0, $1) => { lvglCreateScreen($0, $1); },  
 1046277: ($0, $1) => { lvglDeleteScreen($0, $1); },  
 1046307: ($0) => { lvglScreenTick($0); },  
 1046331: ($0, $1, $2, $3) => { lvglOnEventHandler($0, $1, $2, $3); },  
 1046371: ($0, $1) => { return getLvglScreenByName($0, UTF8ToString($1)); },  
 1046425: ($0, $1) => { return getLvglObjectByName($0, UTF8ToString($1)); },  
 1046479: ($0, $1) => { return getLvglGroupByName($0, UTF8ToString($1)); },  
 1046532: ($0, $1) => { return getLvglStyleByName($0, UTF8ToString($1)); },  
 1046585: ($0, $1) => { return getLvglImageByName($0, UTF8ToString($1)); },  
 1046638: ($0, $1, $2) => { lvglObjAddStyle($0, $1, $2); },  
 1046671: ($0, $1, $2) => { lvglObjRemoveStyle($0, $1, $2); },  
 1046707: ($0, $1) => { lvglSetColorTheme($0, UTF8ToString($1)); },  
 1046752: ($0, $1, $2, $3, $4, $5) => { return eez_mqtt_init($0, UTF8ToString($1), UTF8ToString($2), $3, UTF8ToString($4), UTF8ToString($5)); },  
 1046858: ($0, $1) => { return eez_mqtt_deinit($0, $1); },  
 1046894: ($0, $1) => { return eez_mqtt_connect($0, $1); },  
 1046931: ($0, $1) => { return eez_mqtt_disconnect($0, $1); },  
 1046971: ($0, $1, $2) => { return eez_mqtt_subscribe($0, $1, UTF8ToString($2)); },  
 1047028: ($0, $1, $2) => { return eez_mqtt_unsubscribe($0, $1, UTF8ToString($2)); },  
 1047087: ($0, $1, $2, $3) => { return eez_mqtt_publish($0, $1, UTF8ToString($2), UTF8ToString($3)); }
};


// end include: preamble.js

  /** @constructor */
  function ExitStatus(status) {
      this.name = 'ExitStatus';
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }

  var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        // Pass the module as the first argument.
        callbacks.shift()(Module);
      }
    };

  var withStackSave = (f) => {
      var stack = stackSave();
      var ret = f();
      stackRestore(stack);
      return ret;
    };
  
  
  
  var lengthBytesUTF8 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var c = str.charCodeAt(i); // possibly a lead surrogate
        if (c <= 0x7F) {
          len++;
        } else if (c <= 0x7FF) {
          len += 2;
        } else if (c >= 0xD800 && c <= 0xDFFF) {
          len += 4; ++i;
        } else {
          len += 3;
        }
      }
      return len;
    };
  
  var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
      assert(typeof str === 'string');
      // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
      // undefined and false each don't write out any bytes.
      if (!(maxBytesToWrite > 0))
        return 0;
  
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
        // and https://www.ietf.org/rfc/rfc2279.txt
        // and https://tools.ietf.org/html/rfc3629
        var u = str.charCodeAt(i); // possibly a lead surrogate
        if (u >= 0xD800 && u <= 0xDFFF) {
          var u1 = str.charCodeAt(++i);
          u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
        }
        if (u <= 0x7F) {
          if (outIdx >= endIdx) break;
          heap[outIdx++] = u;
        } else if (u <= 0x7FF) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++] = 0xC0 | (u >> 6);
          heap[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0xFFFF) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++] = 0xE0 | (u >> 12);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
        } else {
          if (outIdx + 3 >= endIdx) break;
          if (u > 0x10FFFF) warnOnce('Invalid Unicode code point ' + ptrToString(u) + ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).');
          heap[outIdx++] = 0xF0 | (u >> 18);
          heap[outIdx++] = 0x80 | ((u >> 12) & 63);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
        }
      }
      // Null-terminate the pointer to the buffer.
      heap[outIdx] = 0;
      return outIdx - startIdx;
    };
  var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };
  var stringToUTF8OnStack = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = stackAlloc(size);
      stringToUTF8(str, ret, size);
      return ret;
    };
  
  var UTF8Decoder = typeof TextDecoder != 'undefined' ? new TextDecoder('utf8') : undefined;
  
    /**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */
  var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
      var endIdx = idx + maxBytesToRead;
      var endPtr = idx;
      // TextDecoder needs to know the byte length in advance, it doesn't stop on
      // null terminator by itself.  Also, use the length info to avoid running tiny
      // strings through TextDecoder, since .subarray() allocates garbage.
      // (As a tiny code save trick, compare endPtr against endIdx using a negation,
      // so that undefined means Infinity)
      while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      }
      var str = '';
      // If building with TextDecoder, we have already computed the string length
      // above, so test loop end condition against that
      while (idx < endPtr) {
        // For UTF8 byte structure, see:
        // http://en.wikipedia.org/wiki/UTF-8#Description
        // https://www.ietf.org/rfc/rfc2279.txt
        // https://tools.ietf.org/html/rfc3629
        var u0 = heapOrArray[idx++];
        if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 0xF0) == 0xE0) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte ' + ptrToString(u0) + ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!');
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
        }
  
        if (u0 < 0x10000) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 0x10000;
          str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        }
      }
      return str;
    };
  
    /**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index (i.e. maxBytesToRead will not
     *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
     *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
     *   JS JIT optimizations off, so it is worth to consider consistently using one
     * @return {string}
     */
  var UTF8ToString = (ptr, maxBytesToRead) => {
      assert(typeof ptr == 'number');
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
    };
  var demangle = (func) => {
      // If demangle has failed before, stop demangling any further function names
      // This avoids an infinite recursion with malloc()->abort()->stackTrace()->demangle()->malloc()->...
      demangle.recursionGuard = (demangle.recursionGuard|0)+1;
      if (demangle.recursionGuard > 1) return func;
      return withStackSave(() => {
        try {
          var s = func;
          if (s.startsWith('__Z'))
            s = s.substr(1);
          var buf = stringToUTF8OnStack(s);
          var status = stackAlloc(4);
          var ret = ___cxa_demangle(buf, 0, 0, status);
          if (HEAP32[((status)>>2)] === 0 && ret) {
            return UTF8ToString(ret);
          }
          // otherwise, libcxxabi failed
        } catch(e) {
        } finally {
          _free(ret);
          if (demangle.recursionGuard < 2) --demangle.recursionGuard;
        }
        // failure when using libcxxabi, don't demangle
        return func;
      });
    };

  
    /**
     * @param {number} ptr
     * @param {string} type
     */
  function getValue(ptr, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': abort('to do getValue(i64) use WASM_BIGINT');
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      case '*': return HEAPU32[((ptr)>>2)];
      default: abort(`invalid type for getValue: ${type}`);
    }
  }

  var noExitRuntime = Module['noExitRuntime'] || true;

  var ptrToString = (ptr) => {
      assert(typeof ptr === 'number');
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      ptr >>>= 0;
      return '0x' + ptr.toString(16).padStart(8, '0');
    };

  
    /**
     * @param {number} ptr
     * @param {number} value
     * @param {string} type
     */
  function setValue(ptr, value, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': HEAP8[((ptr)>>0)] = value; break;
      case 'i8': HEAP8[((ptr)>>0)] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': abort('to do setValue(i64) use WASM_BIGINT');
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      case '*': HEAPU32[((ptr)>>2)] = value; break;
      default: abort(`invalid type for setValue: ${type}`);
    }
  }

  function jsStackTrace() {
      var error = new Error();
      if (!error.stack) {
        // IE10+ special cases: It does have callstack info, but it is only
        // populated if an Error object is thrown, so try that as a special-case.
        try {
          throw new Error();
        } catch(e) {
          error = e;
        }
        if (!error.stack) {
          return '(no stack trace available)';
        }
      }
      return error.stack.toString();
    }
  
  var demangleAll = (text) => {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    };
  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  var warnOnce = (text) => {
      if (!warnOnce.shown) warnOnce.shown = {};
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text;
        err(text);
      }
    };

  var ___assert_fail = (condition, filename, line, func) => {
      abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);
    };

  /** @constructor */
  function ExceptionInfo(excPtr) {
      this.excPtr = excPtr;
      this.ptr = excPtr - 24;
  
      this.set_type = function(type) {
        HEAPU32[(((this.ptr)+(4))>>2)] = type;
      };
  
      this.get_type = function() {
        return HEAPU32[(((this.ptr)+(4))>>2)];
      };
  
      this.set_destructor = function(destructor) {
        HEAPU32[(((this.ptr)+(8))>>2)] = destructor;
      };
  
      this.get_destructor = function() {
        return HEAPU32[(((this.ptr)+(8))>>2)];
      };
  
      this.set_caught = function(caught) {
        caught = caught ? 1 : 0;
        HEAP8[(((this.ptr)+(12))>>0)] = caught;
      };
  
      this.get_caught = function() {
        return HEAP8[(((this.ptr)+(12))>>0)] != 0;
      };
  
      this.set_rethrown = function(rethrown) {
        rethrown = rethrown ? 1 : 0;
        HEAP8[(((this.ptr)+(13))>>0)] = rethrown;
      };
  
      this.get_rethrown = function() {
        return HEAP8[(((this.ptr)+(13))>>0)] != 0;
      };
  
      // Initialize native structure fields. Should be called once after allocated.
      this.init = function(type, destructor) {
        this.set_adjusted_ptr(0);
        this.set_type(type);
        this.set_destructor(destructor);
      }
  
      this.set_adjusted_ptr = function(adjustedPtr) {
        HEAPU32[(((this.ptr)+(16))>>2)] = adjustedPtr;
      };
  
      this.get_adjusted_ptr = function() {
        return HEAPU32[(((this.ptr)+(16))>>2)];
      };
  
      // Get pointer which is expected to be received by catch clause in C++ code. It may be adjusted
      // when the pointer is casted to some of the exception object base classes (e.g. when virtual
      // inheritance is used). When a pointer is thrown this method should return the thrown pointer
      // itself.
      this.get_exception_ptr = function() {
        // Work around a fastcomp bug, this code is still included for some reason in a build without
        // exceptions support.
        var isPointer = ___cxa_is_pointer_type(this.get_type());
        if (isPointer) {
          return HEAPU32[((this.excPtr)>>2)];
        }
        var adjusted = this.get_adjusted_ptr();
        if (adjusted !== 0) return adjusted;
        return this.excPtr;
      };
    }
  
  var exceptionLast = 0;
  
  var uncaughtExceptionCount = 0;
  var ___cxa_throw = (ptr, type, destructor) => {
      var info = new ExceptionInfo(ptr);
      // Initialize ExceptionInfo content after it was allocated in __cxa_allocate_exception.
      info.init(type, destructor);
      exceptionLast = ptr;
      uncaughtExceptionCount++;
      assert(false, 'Exception thrown, but exception catching is not enabled. Compile with -sNO_DISABLE_EXCEPTION_CATCHING or -sEXCEPTION_CATCHING_ALLOWED=[..] to catch.');
    };

  var setErrNo = (value) => {
      HEAP32[((___errno_location())>>2)] = value;
      return value;
    };
  
  var PATH = {
  isAbs:(path) => path.charAt(0) === '/',
  splitPath:(filename) => {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },
  normalizeArray:(parts, allowAboveRoot) => {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..');
          }
        }
        return parts;
      },
  normalize:(path) => {
        var isAbsolute = PATH.isAbs(path),
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter((p) => !!p), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },
  dirname:(path) => {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },
  basename:(path) => {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        path = PATH.normalize(path);
        path = path.replace(/\/$/, "");
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },
  join:function() {
        var paths = Array.prototype.slice.call(arguments);
        return PATH.normalize(paths.join('/'));
      },
  join2:(l, r) => {
        return PATH.normalize(l + '/' + r);
      },
  };
  
  var initRandomFill = () => {
      if (typeof crypto == 'object' && typeof crypto['getRandomValues'] == 'function') {
        // for modern web browsers
        return (view) => crypto.getRandomValues(view);
      } else
      if (ENVIRONMENT_IS_NODE) {
        // for nodejs with or without crypto support included
        try {
          var crypto_module = require('crypto');
          var randomFillSync = crypto_module['randomFillSync'];
          if (randomFillSync) {
            // nodejs with LTS crypto support
            return (view) => crypto_module['randomFillSync'](view);
          }
          // very old nodejs with the original crypto API
          var randomBytes = crypto_module['randomBytes'];
          return (view) => (
            view.set(randomBytes(view.byteLength)),
            // Return the original view to match modern native implementations.
            view
          );
        } catch (e) {
          // nodejs doesn't have crypto support
        }
      }
      // we couldn't find a proper implementation, as Math.random() is not suitable for /dev/random, see emscripten-core/emscripten/pull/7096
      abort("no cryptographic support found for randomDevice. consider polyfilling it if you want to use something insecure like Math.random(), e.g. put this in a --pre-js: var crypto = { getRandomValues: (array) => { for (var i = 0; i < array.length; i++) array[i] = (Math.random()*256)|0 } };");
    };
  var randomFill = (view) => {
      // Lazily init on the first invocation.
      return (randomFill = initRandomFill())(view);
    };
  
  
  
  var PATH_FS = {
  resolve:function() {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path != 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = PATH.isAbs(path);
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter((p) => !!p), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },
  relative:(from, to) => {
        from = PATH_FS.resolve(from).substr(1);
        to = PATH_FS.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      },
  };
  
  
  
  var FS_stdin_getChar_buffer = [];
  
  
  /** @type {function(string, boolean=, number=)} */
  function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
    if (dontAddNull) u8array.length = numBytesWritten;
    return u8array;
  }
  var FS_stdin_getChar = () => {
      if (!FS_stdin_getChar_buffer.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
          // we will read data by chunks of BUFSIZE
          var BUFSIZE = 256;
          var buf = Buffer.alloc(BUFSIZE);
          var bytesRead = 0;
  
          // For some reason we must suppress a closure warning here, even though
          // fd definitely exists on process.stdin, and is even the proper way to
          // get the fd of stdin,
          // https://github.com/nodejs/help/issues/2136#issuecomment-523649904
          // This started to happen after moving this logic out of library_tty.js,
          // so it is related to the surrounding code in some unclear manner.
          /** @suppress {missingProperties} */
          var fd = process.stdin.fd;
  
          try {
            bytesRead = fs.readSync(fd, buf);
          } catch(e) {
            // Cross-platform differences: on Windows, reading EOF throws an exception, but on other OSes,
            // reading EOF returns 0. Uniformize behavior by treating the EOF exception to return 0.
            if (e.toString().includes('EOF')) bytesRead = 0;
            else throw e;
          }
  
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString('utf-8');
          } else {
            result = null;
          }
        } else
        if (typeof window != 'undefined' &&
          typeof window.prompt == 'function') {
          // Browser.
          result = window.prompt('Input: ');  // returns null on cancel
          if (result !== null) {
            result += '\n';
          }
        } else if (typeof readline == 'function') {
          // Command line.
          result = readline();
          if (result !== null) {
            result += '\n';
          }
        }
        if (!result) {
          return null;
        }
        FS_stdin_getChar_buffer = intArrayFromString(result, true);
      }
      return FS_stdin_getChar_buffer.shift();
    };
  var TTY = {
  ttys:[],
  init() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process.stdin.setEncoding('utf8');
        // }
      },
  shutdown() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process.stdin.pause();
        // }
      },
  register(dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },
  stream_ops:{
  open(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        },
  close(stream) {
          // flush any pending line data
          stream.tty.ops.fsync(stream.tty);
        },
  fsync(stream) {
          stream.tty.ops.fsync(stream.tty);
        },
  read(stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },
  write(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        },
  },
  default_tty_ops:{
  get_char(tty) {
          return FS_stdin_getChar();
        },
  put_char(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },
  fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        },
  ioctl_tcgets(tty) {
          // typical setting
          return {
            c_iflag: 25856,
            c_oflag: 5,
            c_cflag: 191,
            c_lflag: 35387,
            c_cc: [
              0x03, 0x1c, 0x7f, 0x15, 0x04, 0x00, 0x01, 0x00, 0x11, 0x13, 0x1a, 0x00,
              0x12, 0x0f, 0x17, 0x16, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
              0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ]
          };
        },
  ioctl_tcsets(tty, optional_actions, data) {
          // currently just ignore
          return 0;
        },
  ioctl_tiocgwinsz(tty) {
          return [24, 80];
        },
  },
  default_tty1_ops:{
  put_char(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
  fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        },
  },
  };
  
  
  var zeroMemory = (address, size) => {
      HEAPU8.fill(0, address, address + size);
      return address;
    };
  
  var alignMemory = (size, alignment) => {
      assert(alignment, "alignment argument is required");
      return Math.ceil(size / alignment) * alignment;
    };
  var mmapAlloc = (size) => {
      abort('internal error: mmapAlloc called but `emscripten_builtin_memalign` native symbol not exported');
    };
  var MEMFS = {
  ops_table:null,
  mount(mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },
  createNode(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(63);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
          parent.timestamp = node.timestamp;
        }
        return node;
      },
  getFileDataAsTypedArray(node) {
        if (!node.contents) return new Uint8Array(0);
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },
  expandFileStorage(node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
        // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
        // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
        // avoid overshooting the allocation cap by a very large margin.
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) >>> 0);
        if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity); // Allocate new storage.
        if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
      },
  resizeFileStorage(node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
        } else {
          var oldContents = node.contents;
          node.contents = new Uint8Array(newSize); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
        }
      },
  node_ops:{
  getattr(node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },
  setattr(node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },
  lookup(parent, name) {
          throw FS.genericErrors[44];
        },
  mknod(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },
  rename(old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.parent.timestamp = Date.now()
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          new_dir.timestamp = old_node.parent.timestamp;
          old_node.parent = new_dir;
        },
  unlink(parent, name) {
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },
  rmdir(parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },
  readdir(node) {
          var entries = ['.', '..'];
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },
  symlink(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },
  readlink(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        },
  },
  stream_ops:{
  read(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },
  write(stream, buffer, offset, length, position, canOwn) {
          // The data buffer should be a typed array view
          assert(!(buffer instanceof ArrayBuffer));
          // If the buffer is located in main memory (HEAP), and if
          // memory can grow, we can't hold on to references of the
          // memory buffer, as they may get invalidated. That means we
          // need to do copy its contents.
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }
  
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) {
              assert(position === 0, 'canOwn must imply no weird position inside the file');
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = buffer.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) {
            // Use typed array write which is available.
            node.contents.set(buffer.subarray(offset, offset + length), position);
          } else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position + length);
          return length;
        },
  llseek(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        },
  allocate(stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },
  mmap(stream, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if (!(flags & 2) && contents.buffer === HEAP8.buffer) {
            // We can't emulate MAP_SHARED when the file is not backed by the
            // buffer we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            HEAP8.set(contents, ptr);
          }
          return { ptr, allocated };
        },
  msync(stream, buffer, offset, length, mmapFlags) {
          MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        },
  },
  };
  
  /** @param {boolean=} noRunDep */
  var asyncLoad = (url, onload, onerror, noRunDep) => {
      var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : '';
      readAsync(url, (arrayBuffer) => {
        assert(arrayBuffer, `Loading data file "${url}" failed (no arrayBuffer).`);
        onload(new Uint8Array(arrayBuffer));
        if (dep) removeRunDependency(dep);
      }, (event) => {
        if (onerror) {
          onerror();
        } else {
          throw `Loading data file "${url}" failed.`;
        }
      });
      if (dep) addRunDependency(dep);
    };
  
  
  var FS_createDataFile = (parent, name, fileData, canRead, canWrite, canOwn) => {
      return FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
    };
  
  var preloadPlugins = Module['preloadPlugins'] || [];
  var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
      // Ensure plugins are ready.
      if (typeof Browser != 'undefined') Browser.init();
  
      var handled = false;
      preloadPlugins.forEach((plugin) => {
        if (handled) return;
        if (plugin['canHandle'](fullname)) {
          plugin['handle'](byteArray, fullname, finish, onerror);
          handled = true;
        }
      });
      return handled;
    };
  var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
      // TODO we should allow people to just pass in a complete filename instead
      // of parent and name being that we just join them anyways
      var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
      var dep = getUniqueRunDependency(`cp ${fullname}`); // might have several active requests for the same fullname
      function processData(byteArray) {
        function finish(byteArray) {
          if (preFinish) preFinish();
          if (!dontCreateFile) {
            FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
          }
          if (onload) onload();
          removeRunDependency(dep);
        }
        if (FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
          if (onerror) onerror();
          removeRunDependency(dep);
        })) {
          return;
        }
        finish(byteArray);
      }
      addRunDependency(dep);
      if (typeof url == 'string') {
        asyncLoad(url, (byteArray) => processData(byteArray), onerror);
      } else {
        processData(url);
      }
    };
  
  var FS_modeStringToFlags = (str) => {
      var flagModes = {
        'r': 0,
        'r+': 2,
        'w': 512 | 64 | 1,
        'w+': 512 | 64 | 2,
        'a': 1024 | 64 | 1,
        'a+': 1024 | 64 | 2,
      };
      var flags = flagModes[str];
      if (typeof flags == 'undefined') {
        throw new Error(`Unknown file open mode: ${str}`);
      }
      return flags;
    };
  
  var FS_getMode = (canRead, canWrite) => {
      var mode = 0;
      if (canRead) mode |= 292 | 73;
      if (canWrite) mode |= 146;
      return mode;
    };
  
  
  
  
  var ERRNO_MESSAGES = {
  0:"Success",
  1:"Arg list too long",
  2:"Permission denied",
  3:"Address already in use",
  4:"Address not available",
  5:"Address family not supported by protocol family",
  6:"No more processes",
  7:"Socket already connected",
  8:"Bad file number",
  9:"Trying to read unreadable message",
  10:"Mount device busy",
  11:"Operation canceled",
  12:"No children",
  13:"Connection aborted",
  14:"Connection refused",
  15:"Connection reset by peer",
  16:"File locking deadlock error",
  17:"Destination address required",
  18:"Math arg out of domain of func",
  19:"Quota exceeded",
  20:"File exists",
  21:"Bad address",
  22:"File too large",
  23:"Host is unreachable",
  24:"Identifier removed",
  25:"Illegal byte sequence",
  26:"Connection already in progress",
  27:"Interrupted system call",
  28:"Invalid argument",
  29:"I/O error",
  30:"Socket is already connected",
  31:"Is a directory",
  32:"Too many symbolic links",
  33:"Too many open files",
  34:"Too many links",
  35:"Message too long",
  36:"Multihop attempted",
  37:"File or path name too long",
  38:"Network interface is not configured",
  39:"Connection reset by network",
  40:"Network is unreachable",
  41:"Too many open files in system",
  42:"No buffer space available",
  43:"No such device",
  44:"No such file or directory",
  45:"Exec format error",
  46:"No record locks available",
  47:"The link has been severed",
  48:"Not enough core",
  49:"No message of desired type",
  50:"Protocol not available",
  51:"No space left on device",
  52:"Function not implemented",
  53:"Socket is not connected",
  54:"Not a directory",
  55:"Directory not empty",
  56:"State not recoverable",
  57:"Socket operation on non-socket",
  59:"Not a typewriter",
  60:"No such device or address",
  61:"Value too large for defined data type",
  62:"Previous owner died",
  63:"Not super-user",
  64:"Broken pipe",
  65:"Protocol error",
  66:"Unknown protocol",
  67:"Protocol wrong type for socket",
  68:"Math result not representable",
  69:"Read only file system",
  70:"Illegal seek",
  71:"No such process",
  72:"Stale file handle",
  73:"Connection timed out",
  74:"Text file busy",
  75:"Cross-device link",
  100:"Device not a stream",
  101:"Bad font file fmt",
  102:"Invalid slot",
  103:"Invalid request code",
  104:"No anode",
  105:"Block device required",
  106:"Channel number out of range",
  107:"Level 3 halted",
  108:"Level 3 reset",
  109:"Link number out of range",
  110:"Protocol driver not attached",
  111:"No CSI structure available",
  112:"Level 2 halted",
  113:"Invalid exchange",
  114:"Invalid request descriptor",
  115:"Exchange full",
  116:"No data (for no delay io)",
  117:"Timer expired",
  118:"Out of streams resources",
  119:"Machine is not on the network",
  120:"Package not installed",
  121:"The object is remote",
  122:"Advertise error",
  123:"Srmount error",
  124:"Communication error on send",
  125:"Cross mount point (not really error)",
  126:"Given log. name not unique",
  127:"f.d. invalid for this operation",
  128:"Remote address changed",
  129:"Can   access a needed shared lib",
  130:"Accessing a corrupted shared lib",
  131:".lib section in a.out corrupted",
  132:"Attempting to link in too many libs",
  133:"Attempting to exec a shared library",
  135:"Streams pipe error",
  136:"Too many users",
  137:"Socket type not supported",
  138:"Not supported",
  139:"Protocol family not supported",
  140:"Can't send after socket shutdown",
  141:"Too many references",
  142:"Host is down",
  148:"No medium (in tape drive)",
  156:"Level 2 not synchronized",
  };
  
  var ERRNO_CODES = {
  };
  
  var FS = {
  root:null,
  mounts:[],
  devices:{
  },
  streams:[],
  nextInode:1,
  nameTable:null,
  currentPath:"/",
  initialized:false,
  ignorePermissions:true,
  ErrnoError:null,
  genericErrors:{
  },
  filesystems:null,
  syncFSRequests:0,
  lookupPath(path, opts = {}) {
        path = PATH_FS.resolve(path);
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        opts = Object.assign(defaults, opts)
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(32);
        }
  
        // split the absolute path
        var parts = path.split('/').filter((p) => !!p);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count + 1 });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(32);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },
  getPath(node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? `${mount}/${path}` : mount + path;
          }
          path = path ? `${node.name}/${path}` : node.name;
          node = node.parent;
        }
      },
  hashName(parentid, name) {
        var hash = 0;
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },
  hashAddNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },
  hashRemoveNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },
  lookupNode(parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
          throw new FS.ErrnoError(errCode, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },
  createNode(parent, name, mode, rdev) {
        assert(typeof parent == 'object')
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },
  destroyNode(node) {
        FS.hashRemoveNode(node);
      },
  isRoot(node) {
        return node === node.parent;
      },
  isMountpoint(node) {
        return !!node.mounted;
      },
  isFile(mode) {
        return (mode & 61440) === 32768;
      },
  isDir(mode) {
        return (mode & 61440) === 16384;
      },
  isLink(mode) {
        return (mode & 61440) === 40960;
      },
  isChrdev(mode) {
        return (mode & 61440) === 8192;
      },
  isBlkdev(mode) {
        return (mode & 61440) === 24576;
      },
  isFIFO(mode) {
        return (mode & 61440) === 4096;
      },
  isSocket(mode) {
        return (mode & 49152) === 49152;
      },
  flagsToPermissionString(flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },
  nodePermissions(node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.includes('r') && !(node.mode & 292)) {
          return 2;
        } else if (perms.includes('w') && !(node.mode & 146)) {
          return 2;
        } else if (perms.includes('x') && !(node.mode & 73)) {
          return 2;
        }
        return 0;
      },
  mayLookup(dir) {
        var errCode = FS.nodePermissions(dir, 'x');
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },
  mayCreate(dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return 20;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },
  mayDelete(dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var errCode = FS.nodePermissions(dir, 'wx');
        if (errCode) {
          return errCode;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return 31;
          }
        }
        return 0;
      },
  mayOpen(node, flags) {
        if (!node) {
          return 44;
        }
        if (FS.isLink(node.mode)) {
          return 32;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== 'r' || // opening for write
              (flags & 512)) { // TODO: check for O_SEARCH? (== search for dir only)
            return 31;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },
  MAX_OPEN_FDS:4096,
  nextfd() {
        for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(33);
      },
  getStreamChecked(fd) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        return stream;
      },
  getStream:(fd) => FS.streams[fd],
  createStream(stream, fd = -1) {
        if (!FS.FSStream) {
          FS.FSStream = /** @constructor */ function() {
            this.shared = { };
          };
          FS.FSStream.prototype = {};
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              /** @this {FS.FSStream} */
              get() { return this.node; },
              /** @this {FS.FSStream} */
              set(val) { this.node = val; }
            },
            isRead: {
              /** @this {FS.FSStream} */
              get() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              /** @this {FS.FSStream} */
              get() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              /** @this {FS.FSStream} */
              get() { return (this.flags & 1024); }
            },
            flags: {
              /** @this {FS.FSStream} */
              get() { return this.shared.flags; },
              /** @this {FS.FSStream} */
              set(val) { this.shared.flags = val; },
            },
            position : {
              /** @this {FS.FSStream} */
              get() { return this.shared.position; },
              /** @this {FS.FSStream} */
              set(val) { this.shared.position = val; },
            },
          });
        }
        // clone it, so we can return an instance of FSStream
        stream = Object.assign(new FS.FSStream(), stream);
        if (fd == -1) {
          fd = FS.nextfd();
        }
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },
  closeStream(fd) {
        FS.streams[fd] = null;
      },
  chrdev_stream_ops:{
  open(stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },
  llseek() {
          throw new FS.ErrnoError(70);
        },
  },
  major:(dev) => ((dev) >> 8),
  minor:(dev) => ((dev) & 0xff),
  makedev:(ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },
  getDevice:(dev) => FS.devices[dev],
  getMounts(mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },
  syncfs(populate, callback) {
        if (typeof populate == 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(errCode) {
          assert(FS.syncFSRequests > 0);
          FS.syncFSRequests--;
          return callback(errCode);
        }
  
        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(errCode);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach((mount) => {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },
  mount(type, opts, mountpoint) {
        if (typeof type == 'string') {
          // The filesystem was not included, and instead we have an error
          // message stored in the variable.
          throw type;
        }
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(10);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
        }
  
        var mount = {
          type,
          opts,
          mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },
  unmount(mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach((hash) => {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.includes(current.mount)) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },
  lookup(parent, name) {
        return parent.node_ops.lookup(parent, name);
      },
  mknod(path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },
  create(path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },
  mkdir(path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },
  mkdirTree(path, mode) {
        var dirs = path.split('/');
        var d = '';
        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue;
          d += '/' + dirs[i];
          try {
            FS.mkdir(d, mode);
          } catch(e) {
            if (e.errno != 20) throw e;
          }
        }
      },
  mkdev(path, mode, dev) {
        if (typeof dev == 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },
  symlink(oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },
  rename(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
  
        // let the errors from non existant directories percolate up
        lookup = FS.lookupPath(old_path, { parent: true });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, { parent: true });
        new_dir = lookup.node;
  
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(28);
        }
        // new path should not be an ancestor of the old path
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(55);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        errCode = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(10);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, 'w');
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
      },
  rmdir(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
      },
  readdir(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(54);
        }
        return node.node_ops.readdir(node);
      },
  unlink(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
      },
  readlink(path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(44);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28);
        }
        return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },
  stat(path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(63);
        }
        return node.node_ops.getattr(node);
      },
  lstat(path) {
        return FS.stat(path, true);
      },
  chmod(path, mode, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },
  lchmod(path, mode) {
        FS.chmod(path, mode, true);
      },
  fchmod(fd, mode) {
        var stream = FS.getStreamChecked(fd);
        FS.chmod(stream.node, mode);
      },
  chown(path, uid, gid, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },
  lchown(path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },
  fchown(fd, uid, gid) {
        var stream = FS.getStreamChecked(fd);
        FS.chown(stream.node, uid, gid);
      },
  truncate(path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28);
        }
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.nodePermissions(node, 'w');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },
  ftruncate(fd, len) {
        var stream = FS.getStreamChecked(fd);
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }
        FS.truncate(stream.node, len);
      },
  utime(path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },
  open(path, flags, mode) {
        if (path === "") {
          throw new FS.ErrnoError(44);
        }
        flags = typeof flags == 'string' ? FS_modeStringToFlags(flags) : flags;
        mode = typeof mode == 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path == 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(20);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var errCode = FS.mayOpen(node, flags);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // do truncation if necessary
        if ((flags & 512) && !created) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512 | 131072);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        });
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
          }
        }
        return stream;
      },
  close(stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
        stream.fd = null;
      },
  isClosed(stream) {
        return stream.fd === null;
      },
  llseek(stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70);
        }
        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },
  read(stream, buffer, offset, length, position) {
        assert(offset >= 0);
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28);
        }
        var seeking = typeof position != 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },
  write(stream, buffer, offset, length, position, canOwn) {
        assert(offset >= 0);
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28);
        }
        if (stream.seekable && stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position != 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        return bytesWritten;
      },
  allocate(stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(28);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(138);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },
  mmap(stream, length, position, prot, flags) {
        // User requests writing to file (prot & PROT_WRITE != 0).
        // Checking if we have permissions to write to the file unless
        // MAP_PRIVATE flag is set. According to POSIX spec it is possible
        // to write to file opened in read-only mode with MAP_PRIVATE flag,
        // as all modifications will be visible only in the memory of
        // the current process.
        if ((prot & 2) !== 0
            && (flags & 2) === 0
            && (stream.flags & 2097155) !== 2) {
          throw new FS.ErrnoError(2);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43);
        }
        return stream.stream_ops.mmap(stream, length, position, prot, flags);
      },
  msync(stream, buffer, offset, length, mmapFlags) {
        assert(offset >= 0);
        if (!stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },
  munmap:(stream) => 0,
  ioctl(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },
  readFile(path, opts = {}) {
        opts.flags = opts.flags || 0;
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error(`Invalid encoding type "${opts.encoding}"`);
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },
  writeFile(path, data, opts = {}) {
        opts.flags = opts.flags || 577;
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data == 'string') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
        } else if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        } else {
          throw new Error('Unsupported data type');
        }
        FS.close(stream);
      },
  cwd:() => FS.currentPath,
  chdir(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (lookup.node === null) {
          throw new FS.ErrnoError(44);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54);
        }
        var errCode = FS.nodePermissions(lookup.node, 'x');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.currentPath = lookup.path;
      },
  createDefaultDirectories() {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },
  createDefaultDevices() {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: () => 0,
          write: (stream, buffer, offset, length, pos) => length,
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using err() rather than out()
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        // use a buffer to avoid overhead of individual crypto calls per byte
        var randomBuffer = new Uint8Array(1024), randomLeft = 0;
        var randomByte = () => {
          if (randomLeft === 0) {
            randomLeft = randomFill(randomBuffer).byteLength;
          }
          return randomBuffer[--randomLeft];
        };
        FS.createDevice('/dev', 'random', randomByte);
        FS.createDevice('/dev', 'urandom', randomByte);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },
  createSpecialDirectories() {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
        // name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        var proc_self = FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount() {
            var node = FS.createNode(proc_self, 'fd', 16384 | 511 /* 0777 */, 73);
            node.node_ops = {
              lookup(parent, name) {
                var fd = +name;
                var stream = FS.getStreamChecked(fd);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: () => stream.path },
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },
  createStandardStreams() {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 0);
        var stdout = FS.open('/dev/stdout', 1);
        var stderr = FS.open('/dev/stderr', 1);
        assert(stdin.fd === 0, `invalid handle for stdin (${stdin.fd})`);
        assert(stdout.fd === 1, `invalid handle for stdout (${stdout.fd})`);
        assert(stderr.fd === 2, `invalid handle for stderr (${stderr.fd})`);
      },
  ensureErrnoError() {
        if (FS.ErrnoError) return;
        FS.ErrnoError = /** @this{Object} */ function ErrnoError(errno, node) {
          // We set the `name` property to be able to identify `FS.ErrnoError`
          // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
          // - when using PROXYFS, an error can come from an underlying FS
          // as different FS objects have their own FS.ErrnoError each,
          // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
          // we'll use the reliable test `err.name == "ErrnoError"` instead
          this.name = 'ErrnoError';
          this.node = node;
          this.setErrno = /** @this{Object} */ function(errno) {
            this.errno = errno;
            for (var key in ERRNO_CODES) {
              if (ERRNO_CODES[key] === errno) {
                this.code = key;
                break;
              }
            }
          };
          this.setErrno(errno);
          this.message = ERRNO_MESSAGES[errno];
  
          // Try to get a maximally helpful stack trace. On Node.js, getting Error.stack
          // now ensures it shows what we want.
          if (this.stack) {
            // Define the stack property for Node.js 4, which otherwise errors on the next line.
            Object.defineProperty(this, "stack", { value: (new Error).stack, writable: true });
            this.stack = demangleAll(this.stack);
          }
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [44].forEach((code) => {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },
  staticInit() {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
        };
      },
  init(input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },
  quit() {
        FS.init.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        _fflush(0);
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },
  findObject(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (!ret.exists) {
          return null;
        }
        return ret.object;
      },
  analyzePath(path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },
  createPath(parent, path, canRead, canWrite) {
        parent = typeof parent == 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },
  createFile(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(canRead, canWrite);
        return FS.create(path, mode);
      },
  createDataFile(parent, name, data, canRead, canWrite, canOwn) {
        var path = name;
        if (parent) {
          parent = typeof parent == 'string' ? parent : FS.getPath(parent);
          path = name ? PATH.join2(parent, name) : parent;
        }
        var mode = FS_getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data == 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 577);
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },
  createDevice(parent, name, input, output) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open(stream) {
            stream.seekable = false;
          },
          close(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },
  forceLoadFile(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        if (typeof XMLHttpRequest != 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (read_) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(read_(obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
      },
  createLazyFile(parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        /** @constructor */
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = /** @this{Object} */ function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        };
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        };
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (from, to) => {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(/** @type{Array<number>} */(xhr.response || []));
            }
            return intArrayFromString(xhr.responseText || '', true);
          };
          var lazyArray = this;
          lazyArray.setDataGetter((chunkNum) => {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof lazyArray.chunks[chunkNum] == 'undefined') {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof lazyArray.chunks[chunkNum] == 'undefined') throw new Error('doXHR failed!');
            return lazyArray.chunks[chunkNum];
          });
  
          if (usesGzip || !datalength) {
            // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
            chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
            datalength = this.getter(0).length;
            chunkSize = datalength;
            out("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        };
        if (typeof XMLHttpRequest != 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: /** @this{Object} */ function() {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
            },
            chunkSize: {
              get: /** @this{Object} */ function() {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: /** @this {FSNode} */ function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach((key) => {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            FS.forceLoadFile(node);
            return fn.apply(null, arguments);
          };
        });
        function writeChunks(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        }
        // use a custom read function
        stream_ops.read = (stream, buffer, offset, length, position) => {
          FS.forceLoadFile(node);
          return writeChunks(stream, buffer, offset, length, position)
        };
        // use a custom mmap function
        stream_ops.mmap = (stream, length, position, prot, flags) => {
          FS.forceLoadFile(node);
          var ptr = mmapAlloc(length);
          if (!ptr) {
            throw new FS.ErrnoError(48);
          }
          writeChunks(stream, HEAP8, ptr, length, position);
          return { ptr, allocated: true };
        };
        node.stream_ops = stream_ops;
        return node;
      },
  absolutePath() {
        abort('FS.absolutePath has been removed; use PATH_FS.resolve instead');
      },
  createFolder() {
        abort('FS.createFolder has been removed; use FS.mkdir instead');
      },
  createLink() {
        abort('FS.createLink has been removed; use FS.symlink instead');
      },
  joinPath() {
        abort('FS.joinPath has been removed; use PATH.join instead');
      },
  mmapAlloc() {
        abort('FS.mmapAlloc has been replaced by the top level function mmapAlloc');
      },
  standardizePath() {
        abort('FS.standardizePath has been removed; use PATH.normalize instead');
      },
  };
  
  var SYSCALLS = {
  DEFAULT_POLLMASK:5,
  calculateAt(dirfd, path, allowEmpty) {
        if (PATH.isAbs(path)) {
          return path;
        }
        // relative path
        var dir;
        if (dirfd === -100) {
          dir = FS.cwd();
        } else {
          var dirstream = SYSCALLS.getStreamFromFD(dirfd);
          dir = dirstream.path;
        }
        if (path.length == 0) {
          if (!allowEmpty) {
            throw new FS.ErrnoError(44);;
          }
          return dir;
        }
        return PATH.join2(dir, path);
      },
  doStat(func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -54;
          }
          throw e;
        }
        HEAP32[((buf)>>2)] = stat.dev;
        HEAP32[(((buf)+(4))>>2)] = stat.mode;
        HEAPU32[(((buf)+(8))>>2)] = stat.nlink;
        HEAP32[(((buf)+(12))>>2)] = stat.uid;
        HEAP32[(((buf)+(16))>>2)] = stat.gid;
        HEAP32[(((buf)+(20))>>2)] = stat.rdev;
        (tempI64 = [stat.size>>>0,(tempDouble=stat.size,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(24))>>2)] = tempI64[0],HEAP32[(((buf)+(28))>>2)] = tempI64[1]);
        HEAP32[(((buf)+(32))>>2)] = 4096;
        HEAP32[(((buf)+(36))>>2)] = stat.blocks;
        var atime = stat.atime.getTime();
        var mtime = stat.mtime.getTime();
        var ctime = stat.ctime.getTime();
        (tempI64 = [Math.floor(atime / 1000)>>>0,(tempDouble=Math.floor(atime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(40))>>2)] = tempI64[0],HEAP32[(((buf)+(44))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(48))>>2)] = (atime % 1000) * 1000;
        (tempI64 = [Math.floor(mtime / 1000)>>>0,(tempDouble=Math.floor(mtime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(56))>>2)] = tempI64[0],HEAP32[(((buf)+(60))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(64))>>2)] = (mtime % 1000) * 1000;
        (tempI64 = [Math.floor(ctime / 1000)>>>0,(tempDouble=Math.floor(ctime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(72))>>2)] = tempI64[0],HEAP32[(((buf)+(76))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(80))>>2)] = (ctime % 1000) * 1000;
        (tempI64 = [stat.ino>>>0,(tempDouble=stat.ino,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(88))>>2)] = tempI64[0],HEAP32[(((buf)+(92))>>2)] = tempI64[1]);
        return 0;
      },
  doMsync(addr, stream, len, flags, offset) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (flags & 2) {
          // MAP_PRIVATE calls need not to be synced back to underlying fs
          return 0;
        }
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },
  varargs:undefined,
  get() {
        assert(SYSCALLS.varargs != undefined);
        // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
        var ret = HEAP32[((+SYSCALLS.varargs)>>2)];
        SYSCALLS.varargs += 4;
        return ret;
      },
  getp() { return SYSCALLS.get() },
  getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
  getStreamFromFD(fd) {
        var stream = FS.getStreamChecked(fd);
        return stream;
      },
  };
  function ___syscall_fcntl64(fd, cmd, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (cmd) {
        case 0: {
          var arg = SYSCALLS.get();
          if (arg < 0) {
            return -28;
          }
          while (FS.streams[arg]) {
            arg++;
          }
          var newStream;
          newStream = FS.createStream(stream, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = SYSCALLS.get();
          stream.flags |= arg;
          return 0;
        }
        case 5: {
          var arg = SYSCALLS.getp();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)] = 2;
          return 0;
        }
        case 6:
        case 7:
          return 0; // Pretend that the locking is successful.
        case 16:
        case 8:
          return -28; // These are for sockets. We don't have them fully implemented yet.
        case 9:
          // musl trusts getown return values, due to a bug where they must be, as they overlap with errors. just return -1 here, so fcntl() returns that, and we set errno ourselves.
          setErrNo(28);
          return -1;
        default: {
          return -28;
        }
      }
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  
  function ___syscall_getdents64(fd, dirp, count) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd)
      if (!stream.getdents) {
        stream.getdents = FS.readdir(stream.path);
      }
  
      var struct_size = 280;
      var pos = 0;
      var off = FS.llseek(stream, 0, 1);
  
      var idx = Math.floor(off / struct_size);
  
      while (idx < stream.getdents.length && pos + struct_size <= count) {
        var id;
        var type;
        var name = stream.getdents[idx];
        if (name === '.') {
          id = stream.node.id;
          type = 4; // DT_DIR
        }
        else if (name === '..') {
          var lookup = FS.lookupPath(stream.path, { parent: true });
          id = lookup.node.id;
          type = 4; // DT_DIR
        }
        else {
          var child = FS.lookupNode(stream.node, name);
          id = child.id;
          type = FS.isChrdev(child.mode) ? 2 :  // DT_CHR, character device.
                 FS.isDir(child.mode) ? 4 :     // DT_DIR, directory.
                 FS.isLink(child.mode) ? 10 :   // DT_LNK, symbolic link.
                 8;                             // DT_REG, regular file.
        }
        assert(id);
        (tempI64 = [id>>>0,(tempDouble=id,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[((dirp + pos)>>2)] = tempI64[0],HEAP32[(((dirp + pos)+(4))>>2)] = tempI64[1]);
        (tempI64 = [(idx + 1) * struct_size>>>0,(tempDouble=(idx + 1) * struct_size,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((dirp + pos)+(8))>>2)] = tempI64[0],HEAP32[(((dirp + pos)+(12))>>2)] = tempI64[1]);
        HEAP16[(((dirp + pos)+(16))>>1)] = 280;
        HEAP8[(((dirp + pos)+(18))>>0)] = type;
        stringToUTF8(name, dirp + pos + 19, 256);
        pos += struct_size;
        idx += 1;
      }
      FS.llseek(stream, idx * struct_size, 0);
      return pos;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_ioctl(fd, op, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (op) {
        case 21509: {
          if (!stream.tty) return -59;
          return 0;
        }
        case 21505: {
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tcgets) {
            var termios = stream.tty.ops.ioctl_tcgets(stream);
            var argp = SYSCALLS.getp();
            HEAP32[((argp)>>2)] = termios.c_iflag || 0;
            HEAP32[(((argp)+(4))>>2)] = termios.c_oflag || 0;
            HEAP32[(((argp)+(8))>>2)] = termios.c_cflag || 0;
            HEAP32[(((argp)+(12))>>2)] = termios.c_lflag || 0;
            for (var i = 0; i < 32; i++) {
              HEAP8[(((argp + i)+(17))>>0)] = termios.c_cc[i] || 0;
            }
            return 0;
          }
          return 0;
        }
        case 21510:
        case 21511:
        case 21512: {
          if (!stream.tty) return -59;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21506:
        case 21507:
        case 21508: {
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tcsets) {
            var argp = SYSCALLS.getp();
            var c_iflag = HEAP32[((argp)>>2)];
            var c_oflag = HEAP32[(((argp)+(4))>>2)];
            var c_cflag = HEAP32[(((argp)+(8))>>2)];
            var c_lflag = HEAP32[(((argp)+(12))>>2)];
            var c_cc = []
            for (var i = 0; i < 32; i++) {
              c_cc.push(HEAP8[(((argp + i)+(17))>>0)]);
            }
            return stream.tty.ops.ioctl_tcsets(stream.tty, op, { c_iflag, c_oflag, c_cflag, c_lflag, c_cc });
          }
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -59;
          var argp = SYSCALLS.getp();
          HEAP32[((argp)>>2)] = 0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -59;
          return -28; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.getp();
          return FS.ioctl(stream, op, argp);
        }
        case 21523: {
          // TODO: in theory we should write to the winsize struct that gets
          // passed in, but for now musl doesn't read anything on it
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tiocgwinsz) {
            var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
            var argp = SYSCALLS.getp();
            HEAP16[((argp)>>1)] = winsize[0];
            HEAP16[(((argp)+(2))>>1)] = winsize[1];
          }
          return 0;
        }
        case 21524: {
          // TODO: technically, this ioctl call should change the window size.
          // but, since emscripten doesn't have any concept of a terminal window
          // yet, we'll just silently throw it away as we do TIOCGWINSZ
          if (!stream.tty) return -59;
          return 0;
        }
        case 21515: {
          if (!stream.tty) return -59;
          return 0;
        }
        default: return -28; // not supported
      }
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_openat(dirfd, path, flags, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      path = SYSCALLS.getStr(path);
      path = SYSCALLS.calculateAt(dirfd, path);
      var mode = varargs ? SYSCALLS.get() : 0;
      return FS.open(path, flags, mode).fd;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  var nowIsMonotonic = true;;
  var __emscripten_get_now_is_monotonic = () => nowIsMonotonic;

  var _abort = () => {
      abort('native code called abort()');
    };

  var readEmAsmArgsArray = [];
  var readEmAsmArgs = (sigPtr, buf) => {
      // Nobody should have mutated _readEmAsmArgsArray underneath us to be something else than an array.
      assert(Array.isArray(readEmAsmArgsArray));
      // The input buffer is allocated on the stack, so it must be stack-aligned.
      assert(buf % 16 == 0);
      readEmAsmArgsArray.length = 0;
      var ch;
      // Most arguments are i32s, so shift the buffer pointer so it is a plain
      // index into HEAP32.
      while (ch = HEAPU8[sigPtr++]) {
        var chr = String.fromCharCode(ch);
        var validChars = ['d', 'f', 'i', 'p'];
        assert(validChars.includes(chr), `Invalid character ${ch}("${chr}") in readEmAsmArgs! Use only [${validChars}], and do not specify "v" for void return argument.`);
        // Floats are always passed as doubles, so all types except for 'i'
        // are 8 bytes and require alignment.
        var wide = (ch != 105);
        wide &= (ch != 112);
        buf += wide && (buf % 8) ? 4 : 0;
        readEmAsmArgsArray.push(
          // Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
          ch == 112 ? HEAPU32[((buf)>>2)] :
          ch == 105 ?
            HEAP32[((buf)>>2)] :
            HEAPF64[((buf)>>3)]
        );
        buf += wide ? 8 : 4;
      }
      return readEmAsmArgsArray;
    };
  var runEmAsmFunction = (code, sigPtr, argbuf) => {
      var args = readEmAsmArgs(sigPtr, argbuf);
      assert(ASM_CONSTS.hasOwnProperty(code), `No EM_ASM constant found at address ${code}.  The loaded WebAssembly file is likely out of sync with the generated JavaScript.`);
      return ASM_CONSTS[code].apply(null, args);
    };
  var _emscripten_asm_const_int = (code, sigPtr, argbuf) => {
      return runEmAsmFunction(code, sigPtr, argbuf);
    };

  var _emscripten_date_now = () => Date.now();

  
  var runtimeKeepaliveCounter = 0;
  var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
  
  var _proc_exit = (code) => {
      EXITSTATUS = code;
      if (!keepRuntimeAlive()) {
        if (Module['onExit']) Module['onExit'](code);
        ABORT = true;
      }
      quit_(code, new ExitStatus(code));
    };
  
  /** @suppress {duplicate } */
  /** @param {boolean|number=} implicit */
  var exitJS = (status, implicit) => {
      EXITSTATUS = status;
  
      checkUnflushedContent();
  
      // if exit() was called explicitly, warn the user if the runtime isn't actually being shut down
      if (keepRuntimeAlive() && !implicit) {
        var msg = `program exited (with status: ${status}), but keepRuntimeAlive() is set (counter=${runtimeKeepaliveCounter}) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)`;
        err(msg);
      }
  
      _proc_exit(status);
    };
  var _exit = exitJS;
  
  var __emscripten_runtime_keepalive_clear = () => {
      noExitRuntime = false;
      runtimeKeepaliveCounter = 0;
    };
  
  
  var _emscripten_force_exit = (status) => {
      warnOnce('emscripten_force_exit cannot actually shut down the runtime, as the build does not have EXIT_RUNTIME set');
      __emscripten_runtime_keepalive_clear();
      _exit(status);
    };

  var _emscripten_get_now;
      // Modern environment where performance.now() is supported:
      // N.B. a shorter form "_emscripten_get_now = performance.now;" is
      // unfortunately not allowed even in current browsers (e.g. FF Nightly 75).
      _emscripten_get_now = () => performance.now();
  ;

  var _emscripten_memcpy_js = (dest, src, num) => HEAPU8.copyWithin(dest, src, src + num);

  var getHeapMax = () =>
      // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
      // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
      // for any code that deals with heap sizes, which would require special
      // casing all heap size related code to treat 0 specially.
      2147483648;
  
  var growMemory = (size) => {
      var b = wasmMemory.buffer;
      var pages = (size - b.byteLength + 65535) / 65536;
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow(pages); // .grow() takes a delta compared to the previous size
        updateMemoryViews();
        return 1 /*success*/;
      } catch(e) {
        err(`growMemory: Attempted to grow heap from ${b.byteLength} bytes to ${size} bytes, but got error: ${e}`);
      }
      // implicit 0 return to save code size (caller will cast "undefined" into 0
      // anyhow)
    };
  var _emscripten_resize_heap = (requestedSize) => {
      var oldSize = HEAPU8.length;
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      requestedSize >>>= 0;
      // With multithreaded builds, races can happen (another thread might increase the size
      // in between), so return a failure, and let the caller retry.
      assert(requestedSize > oldSize);
  
      // Memory resize rules:
      // 1.  Always increase heap size to at least the requested size, rounded up
      //     to next page multiple.
      // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
      //     geometrically: increase the heap size according to
      //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
      //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
      //     linearly: increase the heap size by at least
      //     MEMORY_GROWTH_LINEAR_STEP bytes.
      // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
      //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
      // 4.  If we were unable to allocate as much memory, it may be due to
      //     over-eager decision to excessively reserve due to (3) above.
      //     Hence if an allocation fails, cut down on the amount of excess
      //     growth, in an attempt to succeed to perform a smaller allocation.
  
      // A limit is set for how much we can grow. We should not exceed that
      // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
      var maxHeapSize = getHeapMax();
      if (requestedSize > maxHeapSize) {
        err(`Cannot enlarge memory, requested ${requestedSize} bytes, but the limit is ${maxHeapSize} bytes!`);
        return false;
      }
  
      var alignUp = (x, multiple) => x + (multiple - x % multiple) % multiple;
  
      // Loop through potential heap size increases. If we attempt a too eager
      // reservation that fails, cut down on the attempted size and reserve a
      // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
  
        var replacement = growMemory(newSize);
        if (replacement) {
  
          return true;
        }
      }
      err(`Failed to grow the heap from ${oldSize} bytes to ${newSize} bytes, not enough memory!`);
      return false;
    };

  function _fd_close(fd) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }

  /** @param {number=} offset */
  var doReadv = (stream, iov, iovcnt, offset) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        var curr = FS.read(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (curr < len) break; // nothing more to read
        if (typeof offset !== 'undefined') {
          offset += curr;
        }
      }
      return ret;
    };
  
  function _fd_read(fd, iov, iovcnt, pnum) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = doReadv(stream, iov, iovcnt);
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }

  
  var convertI32PairToI53Checked = (lo, hi) => {
      assert(lo == (lo >>> 0) || lo == (lo|0)); // lo should either be a i32 or a u32
      assert(hi === (hi|0));                    // hi should be a i32
      return ((hi + 0x200000) >>> 0 < 0x400001 - !!lo) ? (lo >>> 0) + hi * 4294967296 : NaN;
    };
  function _fd_seek(fd,offset_low, offset_high,whence,newOffset) {
    var offset = convertI32PairToI53Checked(offset_low, offset_high);;
  
    
  try {
  
      if (isNaN(offset)) return 61;
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.llseek(stream, offset, whence);
      (tempI64 = [stream.position>>>0,(tempDouble=stream.position,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[((newOffset)>>2)] = tempI64[0],HEAP32[(((newOffset)+(4))>>2)] = tempI64[1]);
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  ;
  }

  /** @param {number=} offset */
  var doWritev = (stream, iov, iovcnt, offset) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        var curr = FS.write(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (typeof offset !== 'undefined') {
          offset += curr;
        }
      }
      return ret;
    };
  
  function _fd_write(fd, iov, iovcnt, pnum) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = doWritev(stream, iov, iovcnt);
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }

  
  
  /** @suppress {duplicate } */
  var stringToNewUTF8 = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = _malloc(size);
      if (ret) stringToUTF8(str, ret, size);
      return ret;
    };
  var allocateUTF8 = stringToNewUTF8;

  var AsciiToString = (ptr) => {
      var str = '';
      while (1) {
        var ch = HEAPU8[((ptr++)>>0)];
        if (!ch) return str;
        str += String.fromCharCode(ch);
      }
    };


  var FSNode = /** @constructor */ function(parent, name, mode, rdev) {
    if (!parent) {
      parent = this;  // root node sets parent to itself
    }
    this.parent = parent;
    this.mount = parent.mount;
    this.mounted = null;
    this.id = FS.nextInode++;
    this.name = name;
    this.mode = mode;
    this.node_ops = {};
    this.stream_ops = {};
    this.rdev = rdev;
  };
  var readMode = 292/*292*/ | 73/*73*/;
  var writeMode = 146/*146*/;
  Object.defineProperties(FSNode.prototype, {
   read: {
    get: /** @this{FSNode} */function() {
     return (this.mode & readMode) === readMode;
    },
    set: /** @this{FSNode} */function(val) {
     val ? this.mode |= readMode : this.mode &= ~readMode;
    }
   },
   write: {
    get: /** @this{FSNode} */function() {
     return (this.mode & writeMode) === writeMode;
    },
    set: /** @this{FSNode} */function(val) {
     val ? this.mode |= writeMode : this.mode &= ~writeMode;
    }
   },
   isFolder: {
    get: /** @this{FSNode} */function() {
     return FS.isDir(this.mode);
    }
   },
   isDevice: {
    get: /** @this{FSNode} */function() {
     return FS.isChrdev(this.mode);
    }
   }
  });
  FS.FSNode = FSNode;
  FS.createPreloadedFile = FS_createPreloadedFile;
  FS.staticInit();;
ERRNO_CODES = {
      'EPERM': 63,
      'ENOENT': 44,
      'ESRCH': 71,
      'EINTR': 27,
      'EIO': 29,
      'ENXIO': 60,
      'E2BIG': 1,
      'ENOEXEC': 45,
      'EBADF': 8,
      'ECHILD': 12,
      'EAGAIN': 6,
      'EWOULDBLOCK': 6,
      'ENOMEM': 48,
      'EACCES': 2,
      'EFAULT': 21,
      'ENOTBLK': 105,
      'EBUSY': 10,
      'EEXIST': 20,
      'EXDEV': 75,
      'ENODEV': 43,
      'ENOTDIR': 54,
      'EISDIR': 31,
      'EINVAL': 28,
      'ENFILE': 41,
      'EMFILE': 33,
      'ENOTTY': 59,
      'ETXTBSY': 74,
      'EFBIG': 22,
      'ENOSPC': 51,
      'ESPIPE': 70,
      'EROFS': 69,
      'EMLINK': 34,
      'EPIPE': 64,
      'EDOM': 18,
      'ERANGE': 68,
      'ENOMSG': 49,
      'EIDRM': 24,
      'ECHRNG': 106,
      'EL2NSYNC': 156,
      'EL3HLT': 107,
      'EL3RST': 108,
      'ELNRNG': 109,
      'EUNATCH': 110,
      'ENOCSI': 111,
      'EL2HLT': 112,
      'EDEADLK': 16,
      'ENOLCK': 46,
      'EBADE': 113,
      'EBADR': 114,
      'EXFULL': 115,
      'ENOANO': 104,
      'EBADRQC': 103,
      'EBADSLT': 102,
      'EDEADLOCK': 16,
      'EBFONT': 101,
      'ENOSTR': 100,
      'ENODATA': 116,
      'ETIME': 117,
      'ENOSR': 118,
      'ENONET': 119,
      'ENOPKG': 120,
      'EREMOTE': 121,
      'ENOLINK': 47,
      'EADV': 122,
      'ESRMNT': 123,
      'ECOMM': 124,
      'EPROTO': 65,
      'EMULTIHOP': 36,
      'EDOTDOT': 125,
      'EBADMSG': 9,
      'ENOTUNIQ': 126,
      'EBADFD': 127,
      'EREMCHG': 128,
      'ELIBACC': 129,
      'ELIBBAD': 130,
      'ELIBSCN': 131,
      'ELIBMAX': 132,
      'ELIBEXEC': 133,
      'ENOSYS': 52,
      'ENOTEMPTY': 55,
      'ENAMETOOLONG': 37,
      'ELOOP': 32,
      'EOPNOTSUPP': 138,
      'EPFNOSUPPORT': 139,
      'ECONNRESET': 15,
      'ENOBUFS': 42,
      'EAFNOSUPPORT': 5,
      'EPROTOTYPE': 67,
      'ENOTSOCK': 57,
      'ENOPROTOOPT': 50,
      'ESHUTDOWN': 140,
      'ECONNREFUSED': 14,
      'EADDRINUSE': 3,
      'ECONNABORTED': 13,
      'ENETUNREACH': 40,
      'ENETDOWN': 38,
      'ETIMEDOUT': 73,
      'EHOSTDOWN': 142,
      'EHOSTUNREACH': 23,
      'EINPROGRESS': 26,
      'EALREADY': 7,
      'EDESTADDRREQ': 17,
      'EMSGSIZE': 35,
      'EPROTONOSUPPORT': 66,
      'ESOCKTNOSUPPORT': 137,
      'EADDRNOTAVAIL': 4,
      'ENETRESET': 39,
      'EISCONN': 30,
      'ENOTCONN': 53,
      'ETOOMANYREFS': 141,
      'EUSERS': 136,
      'EDQUOT': 19,
      'ESTALE': 72,
      'ENOTSUP': 138,
      'ENOMEDIUM': 148,
      'EILSEQ': 25,
      'EOVERFLOW': 61,
      'ECANCELED': 11,
      'ENOTRECOVERABLE': 56,
      'EOWNERDEAD': 62,
      'ESTRPIPE': 135,
    };;
function checkIncomingModuleAPI() {
  ignoredModuleProp('fetchSettings');
}
var wasmImports = {
  /** @export */
  __assert_fail: ___assert_fail,
  /** @export */
  __cxa_throw: ___cxa_throw,
  /** @export */
  __syscall_fcntl64: ___syscall_fcntl64,
  /** @export */
  __syscall_getdents64: ___syscall_getdents64,
  /** @export */
  __syscall_ioctl: ___syscall_ioctl,
  /** @export */
  __syscall_openat: ___syscall_openat,
  /** @export */
  _emscripten_get_now_is_monotonic: __emscripten_get_now_is_monotonic,
  /** @export */
  abort: _abort,
  /** @export */
  emscripten_asm_const_int: _emscripten_asm_const_int,
  /** @export */
  emscripten_date_now: _emscripten_date_now,
  /** @export */
  emscripten_force_exit: _emscripten_force_exit,
  /** @export */
  emscripten_get_now: _emscripten_get_now,
  /** @export */
  emscripten_memcpy_js: _emscripten_memcpy_js,
  /** @export */
  emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */
  fd_close: _fd_close,
  /** @export */
  fd_read: _fd_read,
  /** @export */
  fd_seek: _fd_seek,
  /** @export */
  fd_write: _fd_write
};
var wasmExports = createWasm();
var ___wasm_call_ctors = createExportWrapper('__wasm_call_ctors');
var _lv_disp_flush_ready = Module['_lv_disp_flush_ready'] = createExportWrapper('lv_disp_flush_ready');
var _lv_mem_alloc = Module['_lv_mem_alloc'] = createExportWrapper('lv_mem_alloc');
var _lv_mem_free = Module['_lv_mem_free'] = createExportWrapper('lv_mem_free');
var _lvglSetEncoderGroup = Module['_lvglSetEncoderGroup'] = createExportWrapper('lvglSetEncoderGroup');
var _lv_indev_set_group = Module['_lv_indev_set_group'] = createExportWrapper('lv_indev_set_group');
var _lvglSetKeyboardGroup = Module['_lvglSetKeyboardGroup'] = createExportWrapper('lvglSetKeyboardGroup');
var _init = Module['_init'] = createExportWrapper('init');
var _lv_init = Module['_lv_init'] = createExportWrapper('lv_init');
var _malloc = Module['_malloc'] = createExportWrapper('malloc');
var _lv_disp_draw_buf_init = Module['_lv_disp_draw_buf_init'] = createExportWrapper('lv_disp_draw_buf_init');
var _lv_disp_drv_init = Module['_lv_disp_drv_init'] = createExportWrapper('lv_disp_drv_init');
var _lv_disp_drv_register = Module['_lv_disp_drv_register'] = createExportWrapper('lv_disp_drv_register');
var _lv_indev_drv_init = Module['_lv_indev_drv_init'] = createExportWrapper('lv_indev_drv_init');
var _lv_indev_drv_register = Module['_lv_indev_drv_register'] = createExportWrapper('lv_indev_drv_register');
var _lv_fs_drv_init = Module['_lv_fs_drv_init'] = createExportWrapper('lv_fs_drv_init');
var _lv_fs_drv_register = Module['_lv_fs_drv_register'] = createExportWrapper('lv_fs_drv_register');
var _lv_disp_get_default = Module['_lv_disp_get_default'] = createExportWrapper('lv_disp_get_default');
var _lv_palette_main = Module['_lv_palette_main'] = createExportWrapper('lv_palette_main');
var _lv_theme_default_init = Module['_lv_theme_default_init'] = createExportWrapper('lv_theme_default_init');
var _lv_disp_set_theme = Module['_lv_disp_set_theme'] = createExportWrapper('lv_disp_set_theme');
var _mainLoop = Module['_mainLoop'] = createExportWrapper('mainLoop');
var _lv_timer_handler = Module['_lv_timer_handler'] = createExportWrapper('lv_timer_handler');
var _getSyncedBuffer = Module['_getSyncedBuffer'] = createExportWrapper('getSyncedBuffer');
var _isRTL = Module['_isRTL'] = createExportWrapper('isRTL');
var _onPointerEvent = Module['_onPointerEvent'] = createExportWrapper('onPointerEvent');
var _onMouseWheelEvent = Module['_onMouseWheelEvent'] = createExportWrapper('onMouseWheelEvent');
var _onKeyPressed = Module['_onKeyPressed'] = createExportWrapper('onKeyPressed');
var _lv_spinner_create = Module['_lv_spinner_create'] = createExportWrapper('lv_spinner_create');
var _lv_colorwheel_create = Module['_lv_colorwheel_create'] = createExportWrapper('lv_colorwheel_create');
var _lv_obj_has_flag = Module['_lv_obj_has_flag'] = createExportWrapper('lv_obj_has_flag');
var _lv_obj_create = Module['_lv_obj_create'] = createExportWrapper('lv_obj_create');
var _lv_label_create = Module['_lv_label_create'] = createExportWrapper('lv_label_create');
var _lv_btn_create = Module['_lv_btn_create'] = createExportWrapper('lv_btn_create');
var _lv_img_create = Module['_lv_img_create'] = createExportWrapper('lv_img_create');
var _lv_slider_create = Module['_lv_slider_create'] = createExportWrapper('lv_slider_create');
var _lv_roller_create = Module['_lv_roller_create'] = createExportWrapper('lv_roller_create');
var _lv_switch_create = Module['_lv_switch_create'] = createExportWrapper('lv_switch_create');
var _lv_bar_create = Module['_lv_bar_create'] = createExportWrapper('lv_bar_create');
var _lv_dropdown_create = Module['_lv_dropdown_create'] = createExportWrapper('lv_dropdown_create');
var _lv_arc_create = Module['_lv_arc_create'] = createExportWrapper('lv_arc_create');
var _lv_checkbox_create = Module['_lv_checkbox_create'] = createExportWrapper('lv_checkbox_create');
var _lv_textarea_create = Module['_lv_textarea_create'] = createExportWrapper('lv_textarea_create');
var _lv_keyboard_create = Module['_lv_keyboard_create'] = createExportWrapper('lv_keyboard_create');
var _lv_chart_create = Module['_lv_chart_create'] = createExportWrapper('lv_chart_create');
var _lv_calendar_create = Module['_lv_calendar_create'] = createExportWrapper('lv_calendar_create');
var _lv_imgbtn_create = Module['_lv_imgbtn_create'] = createExportWrapper('lv_imgbtn_create');
var _lv_meter_create = Module['_lv_meter_create'] = createExportWrapper('lv_meter_create');
var _lv_obj_get_style_prop = Module['_lv_obj_get_style_prop'] = createExportWrapper('lv_obj_get_style_prop');
var _lv_obj_set_local_style_prop = Module['_lv_obj_set_local_style_prop'] = createExportWrapper('lv_obj_set_local_style_prop');
var _lv_event_get_code = Module['_lv_event_get_code'] = createExportWrapper('lv_event_get_code');
var _lv_event_get_target = Module['_lv_event_get_target'] = createExportWrapper('lv_event_get_target');
var _lv_obj_has_state = Module['_lv_obj_has_state'] = createExportWrapper('lv_obj_has_state');
var __assignBooleanProperty = Module['__assignBooleanProperty'] = createExportWrapper('_assignBooleanProperty');
var _lv_event_get_draw_part_dsc = Module['_lv_event_get_draw_part_dsc'] = createExportWrapper('lv_event_get_draw_part_dsc');
var __evalTextProperty = Module['__evalTextProperty'] = createExportWrapper('_evalTextProperty');
var __evalBooleanProperty = Module['__evalBooleanProperty'] = createExportWrapper('_evalBooleanProperty');
var _lv_obj_add_state = Module['_lv_obj_add_state'] = createExportWrapper('lv_obj_add_state');
var _lv_obj_clear_state = Module['_lv_obj_clear_state'] = createExportWrapper('lv_obj_clear_state');
var _lv_obj_add_flag = Module['_lv_obj_add_flag'] = createExportWrapper('lv_obj_add_flag');
var _lv_obj_clear_flag = Module['_lv_obj_clear_flag'] = createExportWrapper('lv_obj_clear_flag');
var _stopScript = Module['_stopScript'] = createExportWrapper('stopScript');
var _onMessageFromDebugger = Module['_onMessageFromDebugger'] = createExportWrapper('onMessageFromDebugger');
var _lvglGetFlowState = Module['_lvglGetFlowState'] = createExportWrapper('lvglGetFlowState');
var _setDebuggerMessageSubsciptionFilter = Module['_setDebuggerMessageSubsciptionFilter'] = createExportWrapper('setDebuggerMessageSubsciptionFilter');
var _setObjectIndex = Module['_setObjectIndex'] = createExportWrapper('setObjectIndex');
var _getLvglObjectFromIndex = Module['_getLvglObjectFromIndex'] = createExportWrapper('getLvglObjectFromIndex');
var _lv_group_remove_all_objs = Module['_lv_group_remove_all_objs'] = createExportWrapper('lv_group_remove_all_objs');
var _lv_group_add_obj = Module['_lv_group_add_obj'] = createExportWrapper('lv_group_add_obj');
var _lvglCreateGroup = Module['_lvglCreateGroup'] = createExportWrapper('lvglCreateGroup');
var _lv_group_create = Module['_lv_group_create'] = createExportWrapper('lv_group_create');
var _lvglAddScreenLoadedEventHandler = Module['_lvglAddScreenLoadedEventHandler'] = createExportWrapper('lvglAddScreenLoadedEventHandler');
var _lv_obj_add_event_cb = Module['_lv_obj_add_event_cb'] = createExportWrapper('lv_obj_add_event_cb');
var _lvglGroupAddObject = Module['_lvglGroupAddObject'] = createExportWrapper('lvglGroupAddObject');
var _lvglGroupRemoveObjectsForScreen = Module['_lvglGroupRemoveObjectsForScreen'] = createExportWrapper('lvglGroupRemoveObjectsForScreen');
var _lvglAddEventHandler = Module['_lvglAddEventHandler'] = createExportWrapper('lvglAddEventHandler');
var _lv_event_get_user_data = Module['_lv_event_get_user_data'] = createExportWrapper('lv_event_get_user_data');
var _lvglCreateScreen = Module['_lvglCreateScreen'] = createExportWrapper('lvglCreateScreen');
var _lv_obj_set_pos = Module['_lv_obj_set_pos'] = createExportWrapper('lv_obj_set_pos');
var _lv_obj_set_size = Module['_lv_obj_set_size'] = createExportWrapper('lv_obj_set_size');
var _lv_obj_update_layout = Module['_lv_obj_update_layout'] = createExportWrapper('lv_obj_update_layout');
var _lvglCreateUserWidget = Module['_lvglCreateUserWidget'] = createExportWrapper('lvglCreateUserWidget');
var _lvglScreenLoad = Module['_lvglScreenLoad'] = createExportWrapper('lvglScreenLoad');
var _lv_scr_load_anim = Module['_lv_scr_load_anim'] = createExportWrapper('lv_scr_load_anim');
var _lvglDeleteObject = Module['_lvglDeleteObject'] = createExportWrapper('lvglDeleteObject');
var _lv_obj_del = Module['_lv_obj_del'] = createExportWrapper('lv_obj_del');
var _lv_disp_get_scr_act = Module['_lv_disp_get_scr_act'] = createExportWrapper('lv_disp_get_scr_act');
var _lv_disp_load_scr = Module['_lv_disp_load_scr'] = createExportWrapper('lv_disp_load_scr');
var _lvglDeleteObjectIndex = Module['_lvglDeleteObjectIndex'] = createExportWrapper('lvglDeleteObjectIndex');
var _lvglDeletePageFlowState = Module['_lvglDeletePageFlowState'] = createExportWrapper('lvglDeletePageFlowState');
var _lvglObjAddFlag = Module['_lvglObjAddFlag'] = createExportWrapper('lvglObjAddFlag');
var _lvglObjClearFlag = Module['_lvglObjClearFlag'] = createExportWrapper('lvglObjClearFlag');
var _lvglObjHasFlag = Module['_lvglObjHasFlag'] = createExportWrapper('lvglObjHasFlag');
var _lvglObjAddState = Module['_lvglObjAddState'] = createExportWrapper('lvglObjAddState');
var _lvglObjClearState = Module['_lvglObjClearState'] = createExportWrapper('lvglObjClearState');
var _lvglObjGetStylePropColor = Module['_lvglObjGetStylePropColor'] = createExportWrapper('lvglObjGetStylePropColor');
var _lv_obj_get_state = Module['_lv_obj_get_state'] = createExportWrapper('lv_obj_get_state');
var _lvglObjGetStylePropNum = Module['_lvglObjGetStylePropNum'] = createExportWrapper('lvglObjGetStylePropNum');
var _lvglObjSetLocalStylePropColor = Module['_lvglObjSetLocalStylePropColor'] = createExportWrapper('lvglObjSetLocalStylePropColor');
var _lvglObjSetLocalStylePropNum = Module['_lvglObjSetLocalStylePropNum'] = createExportWrapper('lvglObjSetLocalStylePropNum');
var _lvglObjSetLocalStylePropPtr = Module['_lvglObjSetLocalStylePropPtr'] = createExportWrapper('lvglObjSetLocalStylePropPtr');
var _lvglObjGetStylePropBuiltInFont = Module['_lvglObjGetStylePropBuiltInFont'] = createExportWrapper('lvglObjGetStylePropBuiltInFont');
var _lvglObjGetStylePropFontAddr = Module['_lvglObjGetStylePropFontAddr'] = createExportWrapper('lvglObjGetStylePropFontAddr');
var _lvglObjSetLocalStylePropBuiltInFont = Module['_lvglObjSetLocalStylePropBuiltInFont'] = createExportWrapper('lvglObjSetLocalStylePropBuiltInFont');
var _lvglStyleCreate = Module['_lvglStyleCreate'] = createExportWrapper('lvglStyleCreate');
var _lv_style_init = Module['_lv_style_init'] = createExportWrapper('lv_style_init');
var _lvglStyleSetPropColor = Module['_lvglStyleSetPropColor'] = createExportWrapper('lvglStyleSetPropColor');
var _lv_style_set_prop = Module['_lv_style_set_prop'] = createExportWrapper('lv_style_set_prop');
var _lvglSetStylePropBuiltInFont = Module['_lvglSetStylePropBuiltInFont'] = createExportWrapper('lvglSetStylePropBuiltInFont');
var _lvglSetStylePropPtr = Module['_lvglSetStylePropPtr'] = createExportWrapper('lvglSetStylePropPtr');
var _lvglSetStylePropNum = Module['_lvglSetStylePropNum'] = createExportWrapper('lvglSetStylePropNum');
var _lvglStyleDelete = Module['_lvglStyleDelete'] = createExportWrapper('lvglStyleDelete');
var _lvglObjAddStyle = Module['_lvglObjAddStyle'] = createExportWrapper('lvglObjAddStyle');
var _lv_obj_add_style = Module['_lv_obj_add_style'] = createExportWrapper('lv_obj_add_style');
var _lvglObjRemoveStyle = Module['_lvglObjRemoveStyle'] = createExportWrapper('lvglObjRemoveStyle');
var _lv_obj_remove_style = Module['_lv_obj_remove_style'] = createExportWrapper('lv_obj_remove_style');
var _lvglGetObjRelX = Module['_lvglGetObjRelX'] = createExportWrapper('lvglGetObjRelX');
var _lv_obj_get_parent = Module['_lv_obj_get_parent'] = createExportWrapper('lv_obj_get_parent');
var _lvglGetObjRelY = Module['_lvglGetObjRelY'] = createExportWrapper('lvglGetObjRelY');
var _lvglGetObjWidth = Module['_lvglGetObjWidth'] = createExportWrapper('lvglGetObjWidth');
var _lv_obj_get_width = Module['_lv_obj_get_width'] = createExportWrapper('lv_obj_get_width');
var _lvglGetObjHeight = Module['_lvglGetObjHeight'] = createExportWrapper('lvglGetObjHeight');
var _lv_obj_get_height = Module['_lv_obj_get_height'] = createExportWrapper('lv_obj_get_height');
var _lvglLoadFont = Module['_lvglLoadFont'] = createExportWrapper('lvglLoadFont');
var _lv_font_load = Module['_lv_font_load'] = createExportWrapper('lv_font_load');
var _lvglFreeFont = Module['_lvglFreeFont'] = createExportWrapper('lvglFreeFont');
var _lv_font_free = Module['_lv_font_free'] = createExportWrapper('lv_font_free');
var _lvglAddObjectFlowCallback = Module['_lvglAddObjectFlowCallback'] = createExportWrapper('lvglAddObjectFlowCallback');
var _lvglLedGetColor = Module['_lvglLedGetColor'] = createExportWrapper('lvglLedGetColor');
var _lvglMeterIndicatorNeedleLineSetColor = Module['_lvglMeterIndicatorNeedleLineSetColor'] = createExportWrapper('lvglMeterIndicatorNeedleLineSetColor');
var _lv_obj_invalidate = Module['_lv_obj_invalidate'] = createExportWrapper('lv_obj_invalidate');
var _lvglMeterIndicatorScaleLinesSetColorStart = Module['_lvglMeterIndicatorScaleLinesSetColorStart'] = createExportWrapper('lvglMeterIndicatorScaleLinesSetColorStart');
var _lvglMeterIndicatorScaleLinesSetColorEnd = Module['_lvglMeterIndicatorScaleLinesSetColorEnd'] = createExportWrapper('lvglMeterIndicatorScaleLinesSetColorEnd');
var _lvglMeterIndicatorArcSetColor = Module['_lvglMeterIndicatorArcSetColor'] = createExportWrapper('lvglMeterIndicatorArcSetColor');
var _lvglMeterScaleSetMinorTickColor = Module['_lvglMeterScaleSetMinorTickColor'] = createExportWrapper('lvglMeterScaleSetMinorTickColor');
var _lvglMeterScaleSetMajorTickColor = Module['_lvglMeterScaleSetMajorTickColor'] = createExportWrapper('lvglMeterScaleSetMajorTickColor');
var _lvglGetIndicator_start_value = Module['_lvglGetIndicator_start_value'] = createExportWrapper('lvglGetIndicator_start_value');
var _lvglGetIndicator_end_value = Module['_lvglGetIndicator_end_value'] = createExportWrapper('lvglGetIndicator_end_value');
var _lvglUpdateCheckedState = Module['_lvglUpdateCheckedState'] = createExportWrapper('lvglUpdateCheckedState');
var _lvglUpdateDisabledState = Module['_lvglUpdateDisabledState'] = createExportWrapper('lvglUpdateDisabledState');
var _lvglUpdateHiddenFlag = Module['_lvglUpdateHiddenFlag'] = createExportWrapper('lvglUpdateHiddenFlag');
var _lvglUpdateClickableFlag = Module['_lvglUpdateClickableFlag'] = createExportWrapper('lvglUpdateClickableFlag');
var _lvglAddTimelineKeyframe = Module['_lvglAddTimelineKeyframe'] = createExportWrapper('lvglAddTimelineKeyframe');
var _lvglSetTimelinePosition = Module['_lvglSetTimelinePosition'] = createExportWrapper('lvglSetTimelinePosition');
var _lvglClearTimeline = Module['_lvglClearTimeline'] = createExportWrapper('lvglClearTimeline');
var _lvglSetScrollBarMode = Module['_lvglSetScrollBarMode'] = createExportWrapper('lvglSetScrollBarMode');
var _lv_obj_set_scrollbar_mode = Module['_lv_obj_set_scrollbar_mode'] = createExportWrapper('lv_obj_set_scrollbar_mode');
var _lvglSetScrollDir = Module['_lvglSetScrollDir'] = createExportWrapper('lvglSetScrollDir');
var _lv_obj_set_scroll_dir = Module['_lv_obj_set_scroll_dir'] = createExportWrapper('lv_obj_set_scroll_dir');
var _lvglSetScrollSnapX = Module['_lvglSetScrollSnapX'] = createExportWrapper('lvglSetScrollSnapX');
var _lv_obj_set_scroll_snap_x = Module['_lv_obj_set_scroll_snap_x'] = createExportWrapper('lv_obj_set_scroll_snap_x');
var _lvglSetScrollSnapY = Module['_lvglSetScrollSnapY'] = createExportWrapper('lvglSetScrollSnapY');
var _lv_obj_set_scroll_snap_y = Module['_lv_obj_set_scroll_snap_y'] = createExportWrapper('lv_obj_set_scroll_snap_y');
var _lvglTabviewSetActive = Module['_lvglTabviewSetActive'] = createExportWrapper('lvglTabviewSetActive');
var _lv_tabview_set_act = Module['_lv_tabview_set_act'] = createExportWrapper('lv_tabview_set_act');
var _lvglLineSetPoints = Module['_lvglLineSetPoints'] = createExportWrapper('lvglLineSetPoints');
var _lv_line_set_points = Module['_lv_line_set_points'] = createExportWrapper('lv_line_set_points');
var _lvglScrollTo = Module['_lvglScrollTo'] = createExportWrapper('lvglScrollTo');
var _lv_obj_scroll_to = Module['_lv_obj_scroll_to'] = createExportWrapper('lv_obj_scroll_to');
var _lvglGetScrollX = Module['_lvglGetScrollX'] = createExportWrapper('lvglGetScrollX');
var _lv_obj_get_scroll_x = Module['_lv_obj_get_scroll_x'] = createExportWrapper('lv_obj_get_scroll_x');
var _lvglGetScrollY = Module['_lvglGetScrollY'] = createExportWrapper('lvglGetScrollY');
var _lv_obj_get_scroll_y = Module['_lv_obj_get_scroll_y'] = createExportWrapper('lv_obj_get_scroll_y');
var _lvglObjInvalidate = Module['_lvglObjInvalidate'] = createExportWrapper('lvglObjInvalidate');
var _lvglDeleteScreenOnUnload = Module['_lvglDeleteScreenOnUnload'] = createExportWrapper('lvglDeleteScreenOnUnload');
var _lvglGetTabName = Module['_lvglGetTabName'] = createExportWrapper('lvglGetTabName');
var _v8_lv_slider_set_range = Module['_v8_lv_slider_set_range'] = createExportWrapper('v8_lv_slider_set_range');
var _lv_bar_set_range = Module['_lv_bar_set_range'] = createExportWrapper('lv_bar_set_range');
var _v8_lv_slider_set_mode = Module['_v8_lv_slider_set_mode'] = createExportWrapper('v8_lv_slider_set_mode');
var _lv_bar_set_mode = Module['_lv_bar_set_mode'] = createExportWrapper('lv_bar_set_mode');
var _v8_lv_slider_set_value = Module['_v8_lv_slider_set_value'] = createExportWrapper('v8_lv_slider_set_value');
var _lv_bar_set_value = Module['_lv_bar_set_value'] = createExportWrapper('lv_bar_set_value');
var _v8_lv_slider_get_value = Module['_v8_lv_slider_get_value'] = createExportWrapper('v8_lv_slider_get_value');
var _lv_bar_get_value = Module['_lv_bar_get_value'] = createExportWrapper('lv_bar_get_value');
var _v8_lv_slider_set_left_value = Module['_v8_lv_slider_set_left_value'] = createExportWrapper('v8_lv_slider_set_left_value');
var _lv_bar_set_start_value = Module['_lv_bar_set_start_value'] = createExportWrapper('lv_bar_set_start_value');
var _v8_lv_slider_get_left_value = Module['_v8_lv_slider_get_left_value'] = createExportWrapper('v8_lv_slider_get_left_value');
var _lv_bar_get_start_value = Module['_lv_bar_get_start_value'] = createExportWrapper('lv_bar_get_start_value');
var _lv_disp_get_scr_prev = Module['_lv_disp_get_scr_prev'] = createExportWrapper('lv_disp_get_scr_prev');
var _lv_obj_get_disp = Module['_lv_obj_get_disp'] = createExportWrapper('lv_obj_get_disp');
var _lv_anim_del = Module['_lv_anim_del'] = createExportWrapper('lv_anim_del');
var _lv_obj_remove_local_style_prop = Module['_lv_obj_remove_local_style_prop'] = createExportWrapper('lv_obj_remove_local_style_prop');
var _lv_anim_init = Module['_lv_anim_init'] = createExportWrapper('lv_anim_init');
var _lv_disp_get_hor_res = Module['_lv_disp_get_hor_res'] = createExportWrapper('lv_disp_get_hor_res');
var _lv_disp_get_ver_res = Module['_lv_disp_get_ver_res'] = createExportWrapper('lv_disp_get_ver_res');
var _lv_event_send = Module['_lv_event_send'] = createExportWrapper('lv_event_send');
var _lv_anim_start = Module['_lv_anim_start'] = createExportWrapper('lv_anim_start');
var _lv_disp_get_layer_top = Module['_lv_disp_get_layer_top'] = createExportWrapper('lv_disp_get_layer_top');
var _lv_disp_get_layer_sys = Module['_lv_disp_get_layer_sys'] = createExportWrapper('lv_disp_get_layer_sys');
var _lv_obj_get_child_cnt = Module['_lv_obj_get_child_cnt'] = createExportWrapper('lv_obj_get_child_cnt');
var _lv_theme_apply = Module['_lv_theme_apply'] = createExportWrapper('lv_theme_apply');
var _lv_disp_get_theme = Module['_lv_disp_get_theme'] = createExportWrapper('lv_disp_get_theme');
var _lv_disp_set_bg_color = Module['_lv_disp_set_bg_color'] = createExportWrapper('lv_disp_set_bg_color');
var _lv_area_set = Module['_lv_area_set'] = createExportWrapper('lv_area_set');
var _lv_disp_set_bg_image = Module['_lv_disp_set_bg_image'] = createExportWrapper('lv_disp_set_bg_image');
var _lv_disp_set_bg_opa = Module['_lv_disp_set_bg_opa'] = createExportWrapper('lv_disp_set_bg_opa');
var _lv_obj_set_x = Module['_lv_obj_set_x'] = createExportWrapper('lv_obj_set_x');
var _lv_obj_set_y = Module['_lv_obj_set_y'] = createExportWrapper('lv_obj_set_y');
var _lv_obj_set_style_opa = Module['_lv_obj_set_style_opa'] = createExportWrapper('lv_obj_set_style_opa');
var _lv_disp_get_inactive_time = Module['_lv_disp_get_inactive_time'] = createExportWrapper('lv_disp_get_inactive_time');
var _lv_tick_elaps = Module['_lv_tick_elaps'] = createExportWrapper('lv_tick_elaps');
var _lv_disp_get_next = Module['_lv_disp_get_next'] = createExportWrapper('lv_disp_get_next');
var _lv_disp_trig_activity = Module['_lv_disp_trig_activity'] = createExportWrapper('lv_disp_trig_activity');
var _lv_tick_get = Module['_lv_tick_get'] = createExportWrapper('lv_tick_get');
var _lv_disp_clean_dcache = Module['_lv_disp_clean_dcache'] = createExportWrapper('lv_disp_clean_dcache');
var _lv_disp_enable_invalidation = Module['_lv_disp_enable_invalidation'] = createExportWrapper('lv_disp_enable_invalidation');
var _lv_disp_is_invalidation_enabled = Module['_lv_disp_is_invalidation_enabled'] = createExportWrapper('lv_disp_is_invalidation_enabled');
var _lv_indev_get_act = Module['_lv_indev_get_act'] = createExportWrapper('lv_indev_get_act');
var _lv_obj_event_base = Module['_lv_obj_event_base'] = createExportWrapper('lv_obj_event_base');
var _lv_event_get_current_target = Module['_lv_event_get_current_target'] = createExportWrapper('lv_event_get_current_target');
var _lv_event_get_param = Module['_lv_event_get_param'] = createExportWrapper('lv_event_get_param');
var _lv_event_stop_bubbling = Module['_lv_event_stop_bubbling'] = createExportWrapper('lv_event_stop_bubbling');
var _lv_event_stop_processing = Module['_lv_event_stop_processing'] = createExportWrapper('lv_event_stop_processing');
var _lv_event_register_id = Module['_lv_event_register_id'] = createExportWrapper('lv_event_register_id');
var _lv_obj_allocate_spec_attr = Module['_lv_obj_allocate_spec_attr'] = createExportWrapper('lv_obj_allocate_spec_attr');
var _lv_mem_realloc = Module['_lv_mem_realloc'] = createExportWrapper('lv_mem_realloc');
var _lv_obj_remove_event_cb = Module['_lv_obj_remove_event_cb'] = createExportWrapper('lv_obj_remove_event_cb');
var _lv_obj_remove_event_cb_with_user_data = Module['_lv_obj_remove_event_cb_with_user_data'] = createExportWrapper('lv_obj_remove_event_cb_with_user_data');
var _lv_obj_remove_event_dsc = Module['_lv_obj_remove_event_dsc'] = createExportWrapper('lv_obj_remove_event_dsc');
var _lv_obj_get_event_user_data = Module['_lv_obj_get_event_user_data'] = createExportWrapper('lv_obj_get_event_user_data');
var _lv_event_get_indev = Module['_lv_event_get_indev'] = createExportWrapper('lv_event_get_indev');
var _lv_event_get_draw_ctx = Module['_lv_event_get_draw_ctx'] = createExportWrapper('lv_event_get_draw_ctx');
var _lv_event_get_old_size = Module['_lv_event_get_old_size'] = createExportWrapper('lv_event_get_old_size');
var _lv_event_get_key = Module['_lv_event_get_key'] = createExportWrapper('lv_event_get_key');
var _lv_event_get_scroll_anim = Module['_lv_event_get_scroll_anim'] = createExportWrapper('lv_event_get_scroll_anim');
var _lv_event_set_ext_draw_size = Module['_lv_event_set_ext_draw_size'] = createExportWrapper('lv_event_set_ext_draw_size');
var _lv_event_get_self_size_info = Module['_lv_event_get_self_size_info'] = createExportWrapper('lv_event_get_self_size_info');
var _lv_event_get_hit_test_info = Module['_lv_event_get_hit_test_info'] = createExportWrapper('lv_event_get_hit_test_info');
var _lv_event_get_cover_area = Module['_lv_event_get_cover_area'] = createExportWrapper('lv_event_get_cover_area');
var _lv_event_set_cover_res = Module['_lv_event_set_cover_res'] = createExportWrapper('lv_event_set_cover_res');
var _lv_group_del = Module['_lv_group_del'] = createExportWrapper('lv_group_del');
var _lv_indev_get_next = Module['_lv_indev_get_next'] = createExportWrapper('lv_indev_get_next');
var _lv_indev_get_type = Module['_lv_indev_get_type'] = createExportWrapper('lv_indev_get_type');
var _lv_group_set_default = Module['_lv_group_set_default'] = createExportWrapper('lv_group_set_default');
var _lv_group_get_default = Module['_lv_group_get_default'] = createExportWrapper('lv_group_get_default');
var _lv_group_remove_obj = Module['_lv_group_remove_obj'] = createExportWrapper('lv_group_remove_obj');
var _lv_obj_get_group = Module['_lv_obj_get_group'] = createExportWrapper('lv_obj_get_group');
var _lv_group_swap_obj = Module['_lv_group_swap_obj'] = createExportWrapper('lv_group_swap_obj');
var _lv_group_focus_obj = Module['_lv_group_focus_obj'] = createExportWrapper('lv_group_focus_obj');
var _lv_group_get_focused = Module['_lv_group_get_focused'] = createExportWrapper('lv_group_get_focused');
var _lv_group_set_editing = Module['_lv_group_set_editing'] = createExportWrapper('lv_group_set_editing');
var _lv_group_focus_next = Module['_lv_group_focus_next'] = createExportWrapper('lv_group_focus_next');
var _lv_group_focus_prev = Module['_lv_group_focus_prev'] = createExportWrapper('lv_group_focus_prev');
var _lv_group_focus_freeze = Module['_lv_group_focus_freeze'] = createExportWrapper('lv_group_focus_freeze');
var _lv_group_send_data = Module['_lv_group_send_data'] = createExportWrapper('lv_group_send_data');
var _lv_group_set_focus_cb = Module['_lv_group_set_focus_cb'] = createExportWrapper('lv_group_set_focus_cb');
var _lv_group_set_edge_cb = Module['_lv_group_set_edge_cb'] = createExportWrapper('lv_group_set_edge_cb');
var _lv_group_set_refocus_policy = Module['_lv_group_set_refocus_policy'] = createExportWrapper('lv_group_set_refocus_policy');
var _lv_group_set_wrap = Module['_lv_group_set_wrap'] = createExportWrapper('lv_group_set_wrap');
var _lv_group_get_focus_cb = Module['_lv_group_get_focus_cb'] = createExportWrapper('lv_group_get_focus_cb');
var _lv_group_get_edge_cb = Module['_lv_group_get_edge_cb'] = createExportWrapper('lv_group_get_edge_cb');
var _lv_group_get_editing = Module['_lv_group_get_editing'] = createExportWrapper('lv_group_get_editing');
var _lv_group_get_wrap = Module['_lv_group_get_wrap'] = createExportWrapper('lv_group_get_wrap');
var _lv_group_get_obj_count = Module['_lv_group_get_obj_count'] = createExportWrapper('lv_group_get_obj_count');
var _lv_indev_read_timer_cb = Module['_lv_indev_read_timer_cb'] = createExportWrapper('lv_indev_read_timer_cb');
var _lv_indev_enable = Module['_lv_indev_enable'] = createExportWrapper('lv_indev_enable');
var _lv_obj_is_editable = Module['_lv_obj_is_editable'] = createExportWrapper('lv_obj_is_editable');
var _lv_indev_reset = Module['_lv_indev_reset'] = createExportWrapper('lv_indev_reset');
var _lv_indev_reset_long_press = Module['_lv_indev_reset_long_press'] = createExportWrapper('lv_indev_reset_long_press');
var _lv_indev_set_cursor = Module['_lv_indev_set_cursor'] = createExportWrapper('lv_indev_set_cursor');
var _lv_obj_set_parent = Module['_lv_obj_set_parent'] = createExportWrapper('lv_obj_set_parent');
var _lv_indev_set_button_points = Module['_lv_indev_set_button_points'] = createExportWrapper('lv_indev_set_button_points');
var _lv_indev_get_point = Module['_lv_indev_get_point'] = createExportWrapper('lv_indev_get_point');
var _lv_indev_get_gesture_dir = Module['_lv_indev_get_gesture_dir'] = createExportWrapper('lv_indev_get_gesture_dir');
var _lv_indev_get_key = Module['_lv_indev_get_key'] = createExportWrapper('lv_indev_get_key');
var _lv_indev_get_scroll_dir = Module['_lv_indev_get_scroll_dir'] = createExportWrapper('lv_indev_get_scroll_dir');
var _lv_indev_get_scroll_obj = Module['_lv_indev_get_scroll_obj'] = createExportWrapper('lv_indev_get_scroll_obj');
var _lv_indev_get_vect = Module['_lv_indev_get_vect'] = createExportWrapper('lv_indev_get_vect');
var _lv_indev_wait_release = Module['_lv_indev_wait_release'] = createExportWrapper('lv_indev_wait_release');
var _lv_indev_get_obj_act = Module['_lv_indev_get_obj_act'] = createExportWrapper('lv_indev_get_obj_act');
var _lv_indev_get_read_timer = Module['_lv_indev_get_read_timer'] = createExportWrapper('lv_indev_get_read_timer');
var _lv_indev_search_obj = Module['_lv_indev_search_obj'] = createExportWrapper('lv_indev_search_obj');
var _lv_obj_transform_point = Module['_lv_obj_transform_point'] = createExportWrapper('lv_obj_transform_point');
var _lv_obj_hit_test = Module['_lv_obj_hit_test'] = createExportWrapper('lv_obj_hit_test');
var _lv_point_transform = Module['_lv_point_transform'] = createExportWrapper('lv_point_transform');
var _lv_obj_get_scroll_dir = Module['_lv_obj_get_scroll_dir'] = createExportWrapper('lv_obj_get_scroll_dir');
var _lv_obj_get_scroll_top = Module['_lv_obj_get_scroll_top'] = createExportWrapper('lv_obj_get_scroll_top');
var _lv_obj_get_scroll_bottom = Module['_lv_obj_get_scroll_bottom'] = createExportWrapper('lv_obj_get_scroll_bottom');
var _lv_obj_get_scroll_left = Module['_lv_obj_get_scroll_left'] = createExportWrapper('lv_obj_get_scroll_left');
var _lv_obj_get_scroll_right = Module['_lv_obj_get_scroll_right'] = createExportWrapper('lv_obj_get_scroll_right');
var _lv_obj_get_scroll_snap_y = Module['_lv_obj_get_scroll_snap_y'] = createExportWrapper('lv_obj_get_scroll_snap_y');
var _lv_obj_get_scroll_snap_x = Module['_lv_obj_get_scroll_snap_x'] = createExportWrapper('lv_obj_get_scroll_snap_x');
var _lv_obj_scroll_by = Module['_lv_obj_scroll_by'] = createExportWrapper('lv_obj_scroll_by');
var _lv_obj_has_flag_any = Module['_lv_obj_has_flag_any'] = createExportWrapper('lv_obj_has_flag_any');
var _lv_indev_scroll_throw_predict = Module['_lv_indev_scroll_throw_predict'] = createExportWrapper('lv_indev_scroll_throw_predict');
var _lv_indev_scroll_get_snap_dist = Module['_lv_indev_scroll_get_snap_dist'] = createExportWrapper('lv_indev_scroll_get_snap_dist');
var _lv_is_initialized = Module['_lv_is_initialized'] = createExportWrapper('lv_is_initialized');
var _lv_obj_enable_style_refresh = Module['_lv_obj_enable_style_refresh'] = createExportWrapper('lv_obj_enable_style_refresh');
var _lv_obj_mark_layout_as_dirty = Module['_lv_obj_mark_layout_as_dirty'] = createExportWrapper('lv_obj_mark_layout_as_dirty');
var _lv_obj_scroll_to_y = Module['_lv_obj_scroll_to_y'] = createExportWrapper('lv_obj_scroll_to_y');
var _lv_obj_scroll_to_x = Module['_lv_obj_scroll_to_x'] = createExportWrapper('lv_obj_scroll_to_x');
var _lv_obj_scroll_to_view_recursive = Module['_lv_obj_scroll_to_view_recursive'] = createExportWrapper('lv_obj_scroll_to_view_recursive');
var _lv_obj_get_scrollbar_mode = Module['_lv_obj_get_scrollbar_mode'] = createExportWrapper('lv_obj_get_scrollbar_mode');
var _lv_obj_get_scrollbar_area = Module['_lv_obj_get_scrollbar_area'] = createExportWrapper('lv_obj_get_scrollbar_area');
var _lv_obj_invalidate_area = Module['_lv_obj_invalidate_area'] = createExportWrapper('lv_obj_invalidate_area');
var _lv_obj_calculate_ext_draw_size = Module['_lv_obj_calculate_ext_draw_size'] = createExportWrapper('lv_obj_calculate_ext_draw_size');
var _lv_draw_rect_dsc_init = Module['_lv_draw_rect_dsc_init'] = createExportWrapper('lv_draw_rect_dsc_init');
var _lv_obj_init_draw_rect_dsc = Module['_lv_obj_init_draw_rect_dsc'] = createExportWrapper('lv_obj_init_draw_rect_dsc');
var _lv_obj_draw_dsc_init = Module['_lv_obj_draw_dsc_init'] = createExportWrapper('lv_obj_draw_dsc_init');
var _lv_draw_rect = Module['_lv_draw_rect'] = createExportWrapper('lv_draw_rect');
var _lv_mem_buf_get = Module['_lv_mem_buf_get'] = createExportWrapper('lv_mem_buf_get');
var _lv_draw_mask_radius_init = Module['_lv_draw_mask_radius_init'] = createExportWrapper('lv_draw_mask_radius_init');
var _lv_draw_mask_add = Module['_lv_draw_mask_add'] = createExportWrapper('lv_draw_mask_add');
var _lv_area_get_size = Module['_lv_area_get_size'] = createExportWrapper('lv_area_get_size');
var _lv_obj_get_style_opa_recursive = Module['_lv_obj_get_style_opa_recursive'] = createExportWrapper('lv_obj_get_style_opa_recursive');
var _lv_draw_mask_remove_custom = Module['_lv_draw_mask_remove_custom'] = createExportWrapper('lv_draw_mask_remove_custom');
var _lv_draw_mask_free_param = Module['_lv_draw_mask_free_param'] = createExportWrapper('lv_draw_mask_free_param');
var _lv_mem_buf_release = Module['_lv_mem_buf_release'] = createExportWrapper('lv_mem_buf_release');
var _lv_mem_init = Module['_lv_mem_init'] = createExportWrapper('lv_mem_init');
var _lv_draw_init = Module['_lv_draw_init'] = createExportWrapper('lv_draw_init');
var _lv_extra_init = Module['_lv_extra_init'] = createExportWrapper('lv_extra_init');
var _lv_deinit = Module['_lv_deinit'] = createExportWrapper('lv_deinit');
var _lv_disp_set_default = Module['_lv_disp_set_default'] = createExportWrapper('lv_disp_set_default');
var _lv_mem_deinit = Module['_lv_mem_deinit'] = createExportWrapper('lv_mem_deinit');
var _lv_log_register_print_cb = Module['_lv_log_register_print_cb'] = createExportWrapper('lv_log_register_print_cb');
var _lv_obj_class_create_obj = Module['_lv_obj_class_create_obj'] = createExportWrapper('lv_obj_class_create_obj');
var _lv_obj_class_init_obj = Module['_lv_obj_class_init_obj'] = createExportWrapper('lv_obj_class_init_obj');
var _lv_obj_is_layout_positioned = Module['_lv_obj_is_layout_positioned'] = createExportWrapper('lv_obj_is_layout_positioned');
var _lv_obj_style_get_selector_state = Module['_lv_obj_style_get_selector_state'] = createExportWrapper('lv_obj_style_get_selector_state');
var _lv_obj_style_get_selector_part = Module['_lv_obj_style_get_selector_part'] = createExportWrapper('lv_obj_style_get_selector_part');
var _lv_style_prop_get_default = Module['_lv_style_prop_get_default'] = createExportWrapper('lv_style_prop_get_default');
var _lv_obj_refresh_style = Module['_lv_obj_refresh_style'] = createExportWrapper('lv_obj_refresh_style');
var _lv_obj_refresh_ext_draw_size = Module['_lv_obj_refresh_ext_draw_size'] = createExportWrapper('lv_obj_refresh_ext_draw_size');
var _lv_obj_check_type = Module['_lv_obj_check_type'] = createExportWrapper('lv_obj_check_type');
var _lv_obj_has_class = Module['_lv_obj_has_class'] = createExportWrapper('lv_obj_has_class');
var _lv_obj_get_class = Module['_lv_obj_get_class'] = createExportWrapper('lv_obj_get_class');
var _lv_obj_is_valid = Module['_lv_obj_is_valid'] = createExportWrapper('lv_obj_is_valid');
var _lv_obj_refresh_self_size = Module['_lv_obj_refresh_self_size'] = createExportWrapper('lv_obj_refresh_self_size');
var _lv_obj_is_group_def = Module['_lv_obj_is_group_def'] = createExportWrapper('lv_obj_is_group_def');
var _lv_img_src_get_type = Module['_lv_img_src_get_type'] = createExportWrapper('lv_img_src_get_type');
var _lv_obj_init_draw_label_dsc = Module['_lv_obj_init_draw_label_dsc'] = createExportWrapper('lv_obj_init_draw_label_dsc');
var _lv_obj_init_draw_img_dsc = Module['_lv_obj_init_draw_img_dsc'] = createExportWrapper('lv_obj_init_draw_img_dsc');
var _lv_obj_init_draw_line_dsc = Module['_lv_obj_init_draw_line_dsc'] = createExportWrapper('lv_obj_init_draw_line_dsc');
var _lv_obj_init_draw_arc_dsc = Module['_lv_obj_init_draw_arc_dsc'] = createExportWrapper('lv_obj_init_draw_arc_dsc');
var _lv_obj_draw_part_check_type = Module['_lv_obj_draw_part_check_type'] = createExportWrapper('lv_obj_draw_part_check_type');
var _lv_obj_get_local_style_prop = Module['_lv_obj_get_local_style_prop'] = createExportWrapper('lv_obj_get_local_style_prop');
var _lv_obj_set_style_x = Module['_lv_obj_set_style_x'] = createExportWrapper('lv_obj_set_style_x');
var _lv_obj_set_style_y = Module['_lv_obj_set_style_y'] = createExportWrapper('lv_obj_set_style_y');
var _lv_obj_refr_size = Module['_lv_obj_refr_size'] = createExportWrapper('lv_obj_refr_size');
var _lv_obj_get_content_coords = Module['_lv_obj_get_content_coords'] = createExportWrapper('lv_obj_get_content_coords');
var _lv_obj_scrollbar_invalidate = Module['_lv_obj_scrollbar_invalidate'] = createExportWrapper('lv_obj_scrollbar_invalidate');
var _lv_obj_get_content_width = Module['_lv_obj_get_content_width'] = createExportWrapper('lv_obj_get_content_width');
var _lv_clamp_width = Module['_lv_clamp_width'] = createExportWrapper('lv_clamp_width');
var _lv_obj_get_content_height = Module['_lv_obj_get_content_height'] = createExportWrapper('lv_obj_get_content_height');
var _lv_clamp_height = Module['_lv_clamp_height'] = createExportWrapper('lv_clamp_height');
var _lv_obj_area_is_visible = Module['_lv_obj_area_is_visible'] = createExportWrapper('lv_obj_area_is_visible');
var _lv_obj_get_coords = Module['_lv_obj_get_coords'] = createExportWrapper('lv_obj_get_coords');
var _lv_area_increase = Module['_lv_area_increase'] = createExportWrapper('lv_area_increase');
var _lv_obj_set_style_width = Module['_lv_obj_set_style_width'] = createExportWrapper('lv_obj_set_style_width');
var _lv_obj_set_style_height = Module['_lv_obj_set_style_height'] = createExportWrapper('lv_obj_set_style_height');
var _lv_obj_set_width = Module['_lv_obj_set_width'] = createExportWrapper('lv_obj_set_width');
var _lv_obj_set_height = Module['_lv_obj_set_height'] = createExportWrapper('lv_obj_set_height');
var _lv_obj_set_content_width = Module['_lv_obj_set_content_width'] = createExportWrapper('lv_obj_set_content_width');
var _lv_obj_set_content_height = Module['_lv_obj_set_content_height'] = createExportWrapper('lv_obj_set_content_height');
var _lv_obj_set_layout = Module['_lv_obj_set_layout'] = createExportWrapper('lv_obj_set_layout');
var _lv_obj_set_style_layout = Module['_lv_obj_set_style_layout'] = createExportWrapper('lv_obj_set_style_layout');
var _lv_obj_get_screen = Module['_lv_obj_get_screen'] = createExportWrapper('lv_obj_get_screen');
var _lv_timer_resume = Module['_lv_timer_resume'] = createExportWrapper('lv_timer_resume');
var _lv_obj_refr_pos = Module['_lv_obj_refr_pos'] = createExportWrapper('lv_obj_refr_pos');
var _lv_obj_readjust_scroll = Module['_lv_obj_readjust_scroll'] = createExportWrapper('lv_obj_readjust_scroll');
var _lv_layout_register = Module['_lv_layout_register'] = createExportWrapper('lv_layout_register');
var _lv_obj_set_align = Module['_lv_obj_set_align'] = createExportWrapper('lv_obj_set_align');
var _lv_obj_set_style_align = Module['_lv_obj_set_style_align'] = createExportWrapper('lv_obj_set_style_align');
var _lv_obj_align = Module['_lv_obj_align'] = createExportWrapper('lv_obj_align');
var _lv_obj_align_to = Module['_lv_obj_align_to'] = createExportWrapper('lv_obj_align_to');
var _lv_obj_get_x = Module['_lv_obj_get_x'] = createExportWrapper('lv_obj_get_x');
var _lv_obj_get_x2 = Module['_lv_obj_get_x2'] = createExportWrapper('lv_obj_get_x2');
var _lv_obj_get_y = Module['_lv_obj_get_y'] = createExportWrapper('lv_obj_get_y');
var _lv_obj_get_y2 = Module['_lv_obj_get_y2'] = createExportWrapper('lv_obj_get_y2');
var _lv_obj_get_x_aligned = Module['_lv_obj_get_x_aligned'] = createExportWrapper('lv_obj_get_x_aligned');
var _lv_obj_get_y_aligned = Module['_lv_obj_get_y_aligned'] = createExportWrapper('lv_obj_get_y_aligned');
var _lv_obj_get_self_width = Module['_lv_obj_get_self_width'] = createExportWrapper('lv_obj_get_self_width');
var _lv_obj_get_self_height = Module['_lv_obj_get_self_height'] = createExportWrapper('lv_obj_get_self_height');
var _lv_obj_move_to = Module['_lv_obj_move_to'] = createExportWrapper('lv_obj_move_to');
var _lv_obj_move_children_by = Module['_lv_obj_move_children_by'] = createExportWrapper('lv_obj_move_children_by');
var _lv_obj_get_transformed_area = Module['_lv_obj_get_transformed_area'] = createExportWrapper('lv_obj_get_transformed_area');
var _lv_obj_is_visible = Module['_lv_obj_is_visible'] = createExportWrapper('lv_obj_is_visible');
var _lv_obj_set_ext_click_area = Module['_lv_obj_set_ext_click_area'] = createExportWrapper('lv_obj_set_ext_click_area');
var _lv_obj_get_click_area = Module['_lv_obj_get_click_area'] = createExportWrapper('lv_obj_get_click_area');
var _lv_obj_get_scroll_end = Module['_lv_obj_get_scroll_end'] = createExportWrapper('lv_obj_get_scroll_end');
var _lv_anim_get = Module['_lv_anim_get'] = createExportWrapper('lv_anim_get');
var _lv_obj_scroll_by_bounded = Module['_lv_obj_scroll_by_bounded'] = createExportWrapper('lv_obj_scroll_by_bounded');
var _lv_anim_speed_to_time = Module['_lv_anim_speed_to_time'] = createExportWrapper('lv_anim_speed_to_time');
var _lv_anim_path_ease_out = Module['_lv_anim_path_ease_out'] = createExportWrapper('lv_anim_path_ease_out');
var _lv_obj_scroll_to_view = Module['_lv_obj_scroll_to_view'] = createExportWrapper('lv_obj_scroll_to_view');
var _lv_obj_is_scrolling = Module['_lv_obj_is_scrolling'] = createExportWrapper('lv_obj_is_scrolling');
var _lv_obj_update_snap = Module['_lv_obj_update_snap'] = createExportWrapper('lv_obj_update_snap');
var _lv_disp_get_dpi = Module['_lv_disp_get_dpi'] = createExportWrapper('lv_disp_get_dpi');
var _lv_style_remove_prop = Module['_lv_style_remove_prop'] = createExportWrapper('lv_style_remove_prop');
var _lv_style_reset = Module['_lv_style_reset'] = createExportWrapper('lv_style_reset');
var _lv_obj_report_style_change = Module['_lv_obj_report_style_change'] = createExportWrapper('lv_obj_report_style_change');
var _lv_style_get_prop = Module['_lv_style_get_prop'] = createExportWrapper('lv_style_get_prop');
var _lv_obj_set_local_style_prop_meta = Module['_lv_obj_set_local_style_prop_meta'] = createExportWrapper('lv_obj_set_local_style_prop_meta');
var _lv_style_set_prop_meta = Module['_lv_style_set_prop_meta'] = createExportWrapper('lv_style_set_prop_meta');
var _lv_style_is_empty = Module['_lv_style_is_empty'] = createExportWrapper('lv_style_is_empty');
var _lv_obj_fade_in = Module['_lv_obj_fade_in'] = createExportWrapper('lv_obj_fade_in');
var _lv_obj_fade_out = Module['_lv_obj_fade_out'] = createExportWrapper('lv_obj_fade_out');
var _lv_obj_calculate_style_text_align = Module['_lv_obj_calculate_style_text_align'] = createExportWrapper('lv_obj_calculate_style_text_align');
var _lv_bidi_calculate_align = Module['_lv_bidi_calculate_align'] = createExportWrapper('lv_bidi_calculate_align');
var _lv_obj_set_style_min_width = Module['_lv_obj_set_style_min_width'] = createExportWrapper('lv_obj_set_style_min_width');
var _lv_obj_set_style_max_width = Module['_lv_obj_set_style_max_width'] = createExportWrapper('lv_obj_set_style_max_width');
var _lv_obj_set_style_min_height = Module['_lv_obj_set_style_min_height'] = createExportWrapper('lv_obj_set_style_min_height');
var _lv_obj_set_style_max_height = Module['_lv_obj_set_style_max_height'] = createExportWrapper('lv_obj_set_style_max_height');
var _lv_obj_set_style_transform_width = Module['_lv_obj_set_style_transform_width'] = createExportWrapper('lv_obj_set_style_transform_width');
var _lv_obj_set_style_transform_height = Module['_lv_obj_set_style_transform_height'] = createExportWrapper('lv_obj_set_style_transform_height');
var _lv_obj_set_style_translate_x = Module['_lv_obj_set_style_translate_x'] = createExportWrapper('lv_obj_set_style_translate_x');
var _lv_obj_set_style_translate_y = Module['_lv_obj_set_style_translate_y'] = createExportWrapper('lv_obj_set_style_translate_y');
var _lv_obj_set_style_transform_zoom = Module['_lv_obj_set_style_transform_zoom'] = createExportWrapper('lv_obj_set_style_transform_zoom');
var _lv_obj_set_style_transform_angle = Module['_lv_obj_set_style_transform_angle'] = createExportWrapper('lv_obj_set_style_transform_angle');
var _lv_obj_set_style_transform_pivot_x = Module['_lv_obj_set_style_transform_pivot_x'] = createExportWrapper('lv_obj_set_style_transform_pivot_x');
var _lv_obj_set_style_transform_pivot_y = Module['_lv_obj_set_style_transform_pivot_y'] = createExportWrapper('lv_obj_set_style_transform_pivot_y');
var _lv_obj_set_style_pad_top = Module['_lv_obj_set_style_pad_top'] = createExportWrapper('lv_obj_set_style_pad_top');
var _lv_obj_set_style_pad_bottom = Module['_lv_obj_set_style_pad_bottom'] = createExportWrapper('lv_obj_set_style_pad_bottom');
var _lv_obj_set_style_pad_left = Module['_lv_obj_set_style_pad_left'] = createExportWrapper('lv_obj_set_style_pad_left');
var _lv_obj_set_style_pad_right = Module['_lv_obj_set_style_pad_right'] = createExportWrapper('lv_obj_set_style_pad_right');
var _lv_obj_set_style_pad_row = Module['_lv_obj_set_style_pad_row'] = createExportWrapper('lv_obj_set_style_pad_row');
var _lv_obj_set_style_pad_column = Module['_lv_obj_set_style_pad_column'] = createExportWrapper('lv_obj_set_style_pad_column');
var _lv_obj_set_style_bg_color = Module['_lv_obj_set_style_bg_color'] = createExportWrapper('lv_obj_set_style_bg_color');
var _lv_obj_set_style_bg_opa = Module['_lv_obj_set_style_bg_opa'] = createExportWrapper('lv_obj_set_style_bg_opa');
var _lv_obj_set_style_bg_grad_color = Module['_lv_obj_set_style_bg_grad_color'] = createExportWrapper('lv_obj_set_style_bg_grad_color');
var _lv_obj_set_style_bg_grad_dir = Module['_lv_obj_set_style_bg_grad_dir'] = createExportWrapper('lv_obj_set_style_bg_grad_dir');
var _lv_obj_set_style_bg_main_stop = Module['_lv_obj_set_style_bg_main_stop'] = createExportWrapper('lv_obj_set_style_bg_main_stop');
var _lv_obj_set_style_bg_grad_stop = Module['_lv_obj_set_style_bg_grad_stop'] = createExportWrapper('lv_obj_set_style_bg_grad_stop');
var _lv_obj_set_style_bg_grad = Module['_lv_obj_set_style_bg_grad'] = createExportWrapper('lv_obj_set_style_bg_grad');
var _lv_obj_set_style_bg_dither_mode = Module['_lv_obj_set_style_bg_dither_mode'] = createExportWrapper('lv_obj_set_style_bg_dither_mode');
var _lv_obj_set_style_bg_img_src = Module['_lv_obj_set_style_bg_img_src'] = createExportWrapper('lv_obj_set_style_bg_img_src');
var _lv_obj_set_style_bg_img_opa = Module['_lv_obj_set_style_bg_img_opa'] = createExportWrapper('lv_obj_set_style_bg_img_opa');
var _lv_obj_set_style_bg_img_recolor = Module['_lv_obj_set_style_bg_img_recolor'] = createExportWrapper('lv_obj_set_style_bg_img_recolor');
var _lv_obj_set_style_bg_img_recolor_opa = Module['_lv_obj_set_style_bg_img_recolor_opa'] = createExportWrapper('lv_obj_set_style_bg_img_recolor_opa');
var _lv_obj_set_style_bg_img_tiled = Module['_lv_obj_set_style_bg_img_tiled'] = createExportWrapper('lv_obj_set_style_bg_img_tiled');
var _lv_obj_set_style_border_color = Module['_lv_obj_set_style_border_color'] = createExportWrapper('lv_obj_set_style_border_color');
var _lv_obj_set_style_border_opa = Module['_lv_obj_set_style_border_opa'] = createExportWrapper('lv_obj_set_style_border_opa');
var _lv_obj_set_style_border_width = Module['_lv_obj_set_style_border_width'] = createExportWrapper('lv_obj_set_style_border_width');
var _lv_obj_set_style_border_side = Module['_lv_obj_set_style_border_side'] = createExportWrapper('lv_obj_set_style_border_side');
var _lv_obj_set_style_border_post = Module['_lv_obj_set_style_border_post'] = createExportWrapper('lv_obj_set_style_border_post');
var _lv_obj_set_style_outline_width = Module['_lv_obj_set_style_outline_width'] = createExportWrapper('lv_obj_set_style_outline_width');
var _lv_obj_set_style_outline_color = Module['_lv_obj_set_style_outline_color'] = createExportWrapper('lv_obj_set_style_outline_color');
var _lv_obj_set_style_outline_opa = Module['_lv_obj_set_style_outline_opa'] = createExportWrapper('lv_obj_set_style_outline_opa');
var _lv_obj_set_style_outline_pad = Module['_lv_obj_set_style_outline_pad'] = createExportWrapper('lv_obj_set_style_outline_pad');
var _lv_obj_set_style_shadow_width = Module['_lv_obj_set_style_shadow_width'] = createExportWrapper('lv_obj_set_style_shadow_width');
var _lv_obj_set_style_shadow_ofs_x = Module['_lv_obj_set_style_shadow_ofs_x'] = createExportWrapper('lv_obj_set_style_shadow_ofs_x');
var _lv_obj_set_style_shadow_ofs_y = Module['_lv_obj_set_style_shadow_ofs_y'] = createExportWrapper('lv_obj_set_style_shadow_ofs_y');
var _lv_obj_set_style_shadow_spread = Module['_lv_obj_set_style_shadow_spread'] = createExportWrapper('lv_obj_set_style_shadow_spread');
var _lv_obj_set_style_shadow_color = Module['_lv_obj_set_style_shadow_color'] = createExportWrapper('lv_obj_set_style_shadow_color');
var _lv_obj_set_style_shadow_opa = Module['_lv_obj_set_style_shadow_opa'] = createExportWrapper('lv_obj_set_style_shadow_opa');
var _lv_obj_set_style_img_opa = Module['_lv_obj_set_style_img_opa'] = createExportWrapper('lv_obj_set_style_img_opa');
var _lv_obj_set_style_img_recolor = Module['_lv_obj_set_style_img_recolor'] = createExportWrapper('lv_obj_set_style_img_recolor');
var _lv_obj_set_style_img_recolor_opa = Module['_lv_obj_set_style_img_recolor_opa'] = createExportWrapper('lv_obj_set_style_img_recolor_opa');
var _lv_obj_set_style_line_width = Module['_lv_obj_set_style_line_width'] = createExportWrapper('lv_obj_set_style_line_width');
var _lv_obj_set_style_line_dash_width = Module['_lv_obj_set_style_line_dash_width'] = createExportWrapper('lv_obj_set_style_line_dash_width');
var _lv_obj_set_style_line_dash_gap = Module['_lv_obj_set_style_line_dash_gap'] = createExportWrapper('lv_obj_set_style_line_dash_gap');
var _lv_obj_set_style_line_rounded = Module['_lv_obj_set_style_line_rounded'] = createExportWrapper('lv_obj_set_style_line_rounded');
var _lv_obj_set_style_line_color = Module['_lv_obj_set_style_line_color'] = createExportWrapper('lv_obj_set_style_line_color');
var _lv_obj_set_style_line_opa = Module['_lv_obj_set_style_line_opa'] = createExportWrapper('lv_obj_set_style_line_opa');
var _lv_obj_set_style_arc_width = Module['_lv_obj_set_style_arc_width'] = createExportWrapper('lv_obj_set_style_arc_width');
var _lv_obj_set_style_arc_rounded = Module['_lv_obj_set_style_arc_rounded'] = createExportWrapper('lv_obj_set_style_arc_rounded');
var _lv_obj_set_style_arc_color = Module['_lv_obj_set_style_arc_color'] = createExportWrapper('lv_obj_set_style_arc_color');
var _lv_obj_set_style_arc_opa = Module['_lv_obj_set_style_arc_opa'] = createExportWrapper('lv_obj_set_style_arc_opa');
var _lv_obj_set_style_arc_img_src = Module['_lv_obj_set_style_arc_img_src'] = createExportWrapper('lv_obj_set_style_arc_img_src');
var _lv_obj_set_style_text_color = Module['_lv_obj_set_style_text_color'] = createExportWrapper('lv_obj_set_style_text_color');
var _lv_obj_set_style_text_opa = Module['_lv_obj_set_style_text_opa'] = createExportWrapper('lv_obj_set_style_text_opa');
var _lv_obj_set_style_text_font = Module['_lv_obj_set_style_text_font'] = createExportWrapper('lv_obj_set_style_text_font');
var _lv_obj_set_style_text_letter_space = Module['_lv_obj_set_style_text_letter_space'] = createExportWrapper('lv_obj_set_style_text_letter_space');
var _lv_obj_set_style_text_line_space = Module['_lv_obj_set_style_text_line_space'] = createExportWrapper('lv_obj_set_style_text_line_space');
var _lv_obj_set_style_text_decor = Module['_lv_obj_set_style_text_decor'] = createExportWrapper('lv_obj_set_style_text_decor');
var _lv_obj_set_style_text_align = Module['_lv_obj_set_style_text_align'] = createExportWrapper('lv_obj_set_style_text_align');
var _lv_obj_set_style_radius = Module['_lv_obj_set_style_radius'] = createExportWrapper('lv_obj_set_style_radius');
var _lv_obj_set_style_clip_corner = Module['_lv_obj_set_style_clip_corner'] = createExportWrapper('lv_obj_set_style_clip_corner');
var _lv_obj_set_style_opa_layered = Module['_lv_obj_set_style_opa_layered'] = createExportWrapper('lv_obj_set_style_opa_layered');
var _lv_obj_set_style_color_filter_dsc = Module['_lv_obj_set_style_color_filter_dsc'] = createExportWrapper('lv_obj_set_style_color_filter_dsc');
var _lv_obj_set_style_color_filter_opa = Module['_lv_obj_set_style_color_filter_opa'] = createExportWrapper('lv_obj_set_style_color_filter_opa');
var _lv_obj_set_style_anim = Module['_lv_obj_set_style_anim'] = createExportWrapper('lv_obj_set_style_anim');
var _lv_obj_set_style_anim_time = Module['_lv_obj_set_style_anim_time'] = createExportWrapper('lv_obj_set_style_anim_time');
var _lv_obj_set_style_anim_speed = Module['_lv_obj_set_style_anim_speed'] = createExportWrapper('lv_obj_set_style_anim_speed');
var _lv_obj_set_style_transition = Module['_lv_obj_set_style_transition'] = createExportWrapper('lv_obj_set_style_transition');
var _lv_obj_set_style_blend_mode = Module['_lv_obj_set_style_blend_mode'] = createExportWrapper('lv_obj_set_style_blend_mode');
var _lv_obj_set_style_base_dir = Module['_lv_obj_set_style_base_dir'] = createExportWrapper('lv_obj_set_style_base_dir');
var _lv_obj_clean = Module['_lv_obj_clean'] = createExportWrapper('lv_obj_clean');
var _lv_obj_get_child = Module['_lv_obj_get_child'] = createExportWrapper('lv_obj_get_child');
var _lv_obj_del_delayed = Module['_lv_obj_del_delayed'] = createExportWrapper('lv_obj_del_delayed');
var _lv_obj_del_anim_ready_cb = Module['_lv_obj_del_anim_ready_cb'] = createExportWrapper('lv_obj_del_anim_ready_cb');
var _lv_obj_del_async = Module['_lv_obj_del_async'] = createExportWrapper('lv_obj_del_async');
var _lv_async_call = Module['_lv_async_call'] = createExportWrapper('lv_async_call');
var _lv_obj_get_index = Module['_lv_obj_get_index'] = createExportWrapper('lv_obj_get_index');
var _lv_obj_move_to_index = Module['_lv_obj_move_to_index'] = createExportWrapper('lv_obj_move_to_index');
var _lv_obj_swap = Module['_lv_obj_swap'] = createExportWrapper('lv_obj_swap');
var _lv_obj_tree_walk = Module['_lv_obj_tree_walk'] = createExportWrapper('lv_obj_tree_walk');
var _lv_refr_now = Module['_lv_refr_now'] = createExportWrapper('lv_refr_now');
var _lv_anim_refr_now = Module['_lv_anim_refr_now'] = createExportWrapper('lv_anim_refr_now');
var _lv_timer_pause = Module['_lv_timer_pause'] = createExportWrapper('lv_timer_pause');
var _lv_mem_buf_free_all = Module['_lv_mem_buf_free_all'] = createExportWrapper('lv_mem_buf_free_all');
var _lv_obj_redraw = Module['_lv_obj_redraw'] = createExportWrapper('lv_obj_redraw');
var _lv_draw_layer_create = Module['_lv_draw_layer_create'] = createExportWrapper('lv_draw_layer_create');
var _lv_draw_img_dsc_init = Module['_lv_draw_img_dsc_init'] = createExportWrapper('lv_draw_img_dsc_init');
var _lv_draw_layer_adjust = Module['_lv_draw_layer_adjust'] = createExportWrapper('lv_draw_layer_adjust');
var _lv_draw_layer_blend = Module['_lv_draw_layer_blend'] = createExportWrapper('lv_draw_layer_blend');
var _lv_draw_layer_destroy = Module['_lv_draw_layer_destroy'] = createExportWrapper('lv_draw_layer_destroy');
var _lv_disp_get_draw_buf = Module['_lv_disp_get_draw_buf'] = createExportWrapper('lv_disp_get_draw_buf');
var _lv_img_decoder_get_info = Module['_lv_img_decoder_get_info'] = createExportWrapper('lv_img_decoder_get_info');
var _lv_draw_img = Module['_lv_draw_img'] = createExportWrapper('lv_draw_img');
var _lv_theme_get_from_obj = Module['_lv_theme_get_from_obj'] = createExportWrapper('lv_theme_get_from_obj');
var _lv_theme_set_parent = Module['_lv_theme_set_parent'] = createExportWrapper('lv_theme_set_parent');
var _lv_theme_set_apply_cb = Module['_lv_theme_set_apply_cb'] = createExportWrapper('lv_theme_set_apply_cb');
var _lv_theme_get_font_small = Module['_lv_theme_get_font_small'] = createExportWrapper('lv_theme_get_font_small');
var _lv_theme_get_font_normal = Module['_lv_theme_get_font_normal'] = createExportWrapper('lv_theme_get_font_normal');
var _lv_theme_get_font_large = Module['_lv_theme_get_font_large'] = createExportWrapper('lv_theme_get_font_large');
var _lv_theme_get_color_primary = Module['_lv_theme_get_color_primary'] = createExportWrapper('lv_theme_get_color_primary');
var _lv_theme_get_color_secondary = Module['_lv_theme_get_color_secondary'] = createExportWrapper('lv_theme_get_color_secondary');
var _lv_draw_wait_for_finish = Module['_lv_draw_wait_for_finish'] = createExportWrapper('lv_draw_wait_for_finish');
var _lv_draw_arc_dsc_init = Module['_lv_draw_arc_dsc_init'] = createExportWrapper('lv_draw_arc_dsc_init');
var _lv_draw_arc = Module['_lv_draw_arc'] = createExportWrapper('lv_draw_arc');
var _lv_draw_arc_get_area = Module['_lv_draw_arc_get_area'] = createExportWrapper('lv_draw_arc_get_area');
var _lv_draw_label_dsc_init = Module['_lv_draw_label_dsc_init'] = createExportWrapper('lv_draw_label_dsc_init');
var _lv_draw_label = Module['_lv_draw_label'] = createExportWrapper('lv_draw_label');
var _lv_img_decoder_close = Module['_lv_img_decoder_close'] = createExportWrapper('lv_img_decoder_close');
var _lv_area_set_height = Module['_lv_area_set_height'] = createExportWrapper('lv_area_set_height');
var _lv_img_decoder_read_line = Module['_lv_img_decoder_read_line'] = createExportWrapper('lv_img_decoder_read_line');
var _lv_img_cf_get_px_size = Module['_lv_img_cf_get_px_size'] = createExportWrapper('lv_img_cf_get_px_size');
var _lv_img_cf_is_chroma_keyed = Module['_lv_img_cf_is_chroma_keyed'] = createExportWrapper('lv_img_cf_is_chroma_keyed');
var _lv_img_cf_has_alpha = Module['_lv_img_cf_has_alpha'] = createExportWrapper('lv_img_cf_has_alpha');
var _lv_draw_img_decoded = Module['_lv_draw_img_decoded'] = createExportWrapper('lv_draw_img_decoded');
var _lv_txt_get_size = Module['_lv_txt_get_size'] = createExportWrapper('lv_txt_get_size');
var _lv_txt_get_width = Module['_lv_txt_get_width'] = createExportWrapper('lv_txt_get_width');
var _lv_draw_line_dsc_init = Module['_lv_draw_line_dsc_init'] = createExportWrapper('lv_draw_line_dsc_init');
var _lv_font_get_glyph_width = Module['_lv_font_get_glyph_width'] = createExportWrapper('lv_font_get_glyph_width');
var _lv_draw_line = Module['_lv_draw_line'] = createExportWrapper('lv_draw_line');
var _lv_draw_letter = Module['_lv_draw_letter'] = createExportWrapper('lv_draw_letter');
var _lv_draw_mask_apply = Module['_lv_draw_mask_apply'] = createExportWrapper('lv_draw_mask_apply');
var _lv_draw_mask_apply_ids = Module['_lv_draw_mask_apply_ids'] = createExportWrapper('lv_draw_mask_apply_ids');
var _lv_draw_mask_remove_id = Module['_lv_draw_mask_remove_id'] = createExportWrapper('lv_draw_mask_remove_id');
var _lv_draw_mask_get_cnt = Module['_lv_draw_mask_get_cnt'] = createExportWrapper('lv_draw_mask_get_cnt');
var _lv_draw_mask_is_any = Module['_lv_draw_mask_is_any'] = createExportWrapper('lv_draw_mask_is_any');
var _lv_draw_mask_line_points_init = Module['_lv_draw_mask_line_points_init'] = createExportWrapper('lv_draw_mask_line_points_init');
var _lv_draw_mask_line_angle_init = Module['_lv_draw_mask_line_angle_init'] = createExportWrapper('lv_draw_mask_line_angle_init');
var _lv_trigo_sin = Module['_lv_trigo_sin'] = createExportWrapper('lv_trigo_sin');
var _lv_draw_mask_angle_init = Module['_lv_draw_mask_angle_init'] = createExportWrapper('lv_draw_mask_angle_init');
var _lv_draw_mask_fade_init = Module['_lv_draw_mask_fade_init'] = createExportWrapper('lv_draw_mask_fade_init');
var _lv_draw_mask_map_init = Module['_lv_draw_mask_map_init'] = createExportWrapper('lv_draw_mask_map_init');
var _lv_draw_mask_polygon_init = Module['_lv_draw_mask_polygon_init'] = createExportWrapper('lv_draw_mask_polygon_init');
var _lv_draw_transform = Module['_lv_draw_transform'] = createExportWrapper('lv_draw_transform');
var _lv_draw_polygon = Module['_lv_draw_polygon'] = createExportWrapper('lv_draw_polygon');
var _lv_draw_triangle = Module['_lv_draw_triangle'] = createExportWrapper('lv_draw_triangle');
var _lv_img_buf_get_px_color = Module['_lv_img_buf_get_px_color'] = createExportWrapper('lv_img_buf_get_px_color');
var _lv_img_buf_get_px_alpha = Module['_lv_img_buf_get_px_alpha'] = createExportWrapper('lv_img_buf_get_px_alpha');
var _lv_img_buf_set_px_alpha = Module['_lv_img_buf_set_px_alpha'] = createExportWrapper('lv_img_buf_set_px_alpha');
var _lv_img_buf_set_px_color = Module['_lv_img_buf_set_px_color'] = createExportWrapper('lv_img_buf_set_px_color');
var _lv_img_buf_set_palette = Module['_lv_img_buf_set_palette'] = createExportWrapper('lv_img_buf_set_palette');
var _lv_img_buf_alloc = Module['_lv_img_buf_alloc'] = createExportWrapper('lv_img_buf_alloc');
var _lv_img_buf_get_img_size = Module['_lv_img_buf_get_img_size'] = createExportWrapper('lv_img_buf_get_img_size');
var _lv_img_buf_free = Module['_lv_img_buf_free'] = createExportWrapper('lv_img_buf_free');
var _lv_img_decoder_open = Module['_lv_img_decoder_open'] = createExportWrapper('lv_img_decoder_open');
var _lv_img_cache_set_size = Module['_lv_img_cache_set_size'] = createExportWrapper('lv_img_cache_set_size');
var _lv_img_cache_invalidate_src = Module['_lv_img_cache_invalidate_src'] = createExportWrapper('lv_img_cache_invalidate_src');
var _lv_img_decoder_built_in_close = Module['_lv_img_decoder_built_in_close'] = createExportWrapper('lv_img_decoder_built_in_close');
var _lv_img_decoder_built_in_read_line = Module['_lv_img_decoder_built_in_read_line'] = createExportWrapper('lv_img_decoder_built_in_read_line');
var _lv_img_decoder_built_in_open = Module['_lv_img_decoder_built_in_open'] = createExportWrapper('lv_img_decoder_built_in_open');
var _lv_img_decoder_built_in_info = Module['_lv_img_decoder_built_in_info'] = createExportWrapper('lv_img_decoder_built_in_info');
var _lv_img_decoder_create = Module['_lv_img_decoder_create'] = createExportWrapper('lv_img_decoder_create');
var _lv_img_decoder_set_info_cb = Module['_lv_img_decoder_set_info_cb'] = createExportWrapper('lv_img_decoder_set_info_cb');
var _lv_fs_get_ext = Module['_lv_fs_get_ext'] = createExportWrapper('lv_fs_get_ext');
var _strcmp = Module['_strcmp'] = createExportWrapper('strcmp');
var _lv_fs_open = Module['_lv_fs_open'] = createExportWrapper('lv_fs_open');
var _lv_fs_read = Module['_lv_fs_read'] = createExportWrapper('lv_fs_read');
var _lv_fs_close = Module['_lv_fs_close'] = createExportWrapper('lv_fs_close');
var _lv_img_decoder_set_open_cb = Module['_lv_img_decoder_set_open_cb'] = createExportWrapper('lv_img_decoder_set_open_cb');
var _lv_fs_seek = Module['_lv_fs_seek'] = createExportWrapper('lv_fs_seek');
var _lv_img_decoder_set_read_line_cb = Module['_lv_img_decoder_set_read_line_cb'] = createExportWrapper('lv_img_decoder_set_read_line_cb');
var _lv_img_decoder_set_close_cb = Module['_lv_img_decoder_set_close_cb'] = createExportWrapper('lv_img_decoder_set_close_cb');
var _lv_img_decoder_delete = Module['_lv_img_decoder_delete'] = createExportWrapper('lv_img_decoder_delete');
var _lv_draw_sw_init_ctx = Module['_lv_draw_sw_init_ctx'] = createExportWrapper('lv_draw_sw_init_ctx');
var _lv_draw_sw_buffer_copy = Module['_lv_draw_sw_buffer_copy'] = createExportWrapper('lv_draw_sw_buffer_copy');
var _lv_draw_sw_wait_for_finish = Module['_lv_draw_sw_wait_for_finish'] = createExportWrapper('lv_draw_sw_wait_for_finish');
var _lv_draw_sw_deinit_ctx = Module['_lv_draw_sw_deinit_ctx'] = createExportWrapper('lv_draw_sw_deinit_ctx');
var _lv_draw_sw_arc = Module['_lv_draw_sw_arc'] = createExportWrapper('lv_draw_sw_arc');
var _lv_draw_sw_blend = Module['_lv_draw_sw_blend'] = createExportWrapper('lv_draw_sw_blend');
var _lv_draw_sw_blend_basic = Module['_lv_draw_sw_blend_basic'] = createExportWrapper('lv_draw_sw_blend_basic');
var _lv_gradient_free_cache = Module['_lv_gradient_free_cache'] = createExportWrapper('lv_gradient_free_cache');
var _lv_gradient_set_cache_size = Module['_lv_gradient_set_cache_size'] = createExportWrapper('lv_gradient_set_cache_size');
var _lv_gradient_get = Module['_lv_gradient_get'] = createExportWrapper('lv_gradient_get');
var _lv_gradient_calculate = Module['_lv_gradient_calculate'] = createExportWrapper('lv_gradient_calculate');
var _lv_gradient_cleanup = Module['_lv_gradient_cleanup'] = createExportWrapper('lv_gradient_cleanup');
var _lv_draw_sw_img_decoded = Module['_lv_draw_sw_img_decoded'] = createExportWrapper('lv_draw_sw_img_decoded');
var _lv_draw_sw_layer_create = Module['_lv_draw_sw_layer_create'] = createExportWrapper('lv_draw_sw_layer_create');
var _lv_draw_sw_layer_adjust = Module['_lv_draw_sw_layer_adjust'] = createExportWrapper('lv_draw_sw_layer_adjust');
var _lv_draw_sw_layer_blend = Module['_lv_draw_sw_layer_blend'] = createExportWrapper('lv_draw_sw_layer_blend');
var _lv_draw_sw_layer_destroy = Module['_lv_draw_sw_layer_destroy'] = createExportWrapper('lv_draw_sw_layer_destroy');
var _lv_draw_sw_letter = Module['_lv_draw_sw_letter'] = createExportWrapper('lv_draw_sw_letter');
var _lv_draw_sw_line = Module['_lv_draw_sw_line'] = createExportWrapper('lv_draw_sw_line');
var _lv_draw_sw_polygon = Module['_lv_draw_sw_polygon'] = createExportWrapper('lv_draw_sw_polygon');
var _lv_draw_sw_rect = Module['_lv_draw_sw_rect'] = createExportWrapper('lv_draw_sw_rect');
var _lv_draw_sw_bg = Module['_lv_draw_sw_bg'] = createExportWrapper('lv_draw_sw_bg');
var _lv_draw_sw_transform = Module['_lv_draw_sw_transform'] = createExportWrapper('lv_draw_sw_transform');
var _lv_flex_init = Module['_lv_flex_init'] = createExportWrapper('lv_flex_init');
var _lv_obj_set_flex_flow = Module['_lv_obj_set_flex_flow'] = createExportWrapper('lv_obj_set_flex_flow');
var _lv_obj_set_style_flex_flow = Module['_lv_obj_set_style_flex_flow'] = createExportWrapper('lv_obj_set_style_flex_flow');
var _lv_obj_set_flex_align = Module['_lv_obj_set_flex_align'] = createExportWrapper('lv_obj_set_flex_align');
var _lv_obj_set_style_flex_main_place = Module['_lv_obj_set_style_flex_main_place'] = createExportWrapper('lv_obj_set_style_flex_main_place');
var _lv_obj_set_style_flex_cross_place = Module['_lv_obj_set_style_flex_cross_place'] = createExportWrapper('lv_obj_set_style_flex_cross_place');
var _lv_obj_set_style_flex_track_place = Module['_lv_obj_set_style_flex_track_place'] = createExportWrapper('lv_obj_set_style_flex_track_place');
var _lv_obj_set_flex_grow = Module['_lv_obj_set_flex_grow'] = createExportWrapper('lv_obj_set_flex_grow');
var _lv_obj_set_style_flex_grow = Module['_lv_obj_set_style_flex_grow'] = createExportWrapper('lv_obj_set_style_flex_grow');
var _lv_style_set_flex_flow = Module['_lv_style_set_flex_flow'] = createExportWrapper('lv_style_set_flex_flow');
var _lv_style_set_flex_main_place = Module['_lv_style_set_flex_main_place'] = createExportWrapper('lv_style_set_flex_main_place');
var _lv_style_set_flex_cross_place = Module['_lv_style_set_flex_cross_place'] = createExportWrapper('lv_style_set_flex_cross_place');
var _lv_style_set_flex_track_place = Module['_lv_style_set_flex_track_place'] = createExportWrapper('lv_style_set_flex_track_place');
var _lv_style_set_flex_grow = Module['_lv_style_set_flex_grow'] = createExportWrapper('lv_style_set_flex_grow');
var _lv_grid_init = Module['_lv_grid_init'] = createExportWrapper('lv_grid_init');
var _lv_obj_set_grid_dsc_array = Module['_lv_obj_set_grid_dsc_array'] = createExportWrapper('lv_obj_set_grid_dsc_array');
var _lv_obj_set_style_grid_column_dsc_array = Module['_lv_obj_set_style_grid_column_dsc_array'] = createExportWrapper('lv_obj_set_style_grid_column_dsc_array');
var _lv_obj_set_style_grid_row_dsc_array = Module['_lv_obj_set_style_grid_row_dsc_array'] = createExportWrapper('lv_obj_set_style_grid_row_dsc_array');
var _lv_obj_set_grid_align = Module['_lv_obj_set_grid_align'] = createExportWrapper('lv_obj_set_grid_align');
var _lv_obj_set_style_grid_column_align = Module['_lv_obj_set_style_grid_column_align'] = createExportWrapper('lv_obj_set_style_grid_column_align');
var _lv_obj_set_style_grid_row_align = Module['_lv_obj_set_style_grid_row_align'] = createExportWrapper('lv_obj_set_style_grid_row_align');
var _lv_obj_set_grid_cell = Module['_lv_obj_set_grid_cell'] = createExportWrapper('lv_obj_set_grid_cell');
var _lv_obj_set_style_grid_cell_column_pos = Module['_lv_obj_set_style_grid_cell_column_pos'] = createExportWrapper('lv_obj_set_style_grid_cell_column_pos');
var _lv_obj_set_style_grid_cell_row_pos = Module['_lv_obj_set_style_grid_cell_row_pos'] = createExportWrapper('lv_obj_set_style_grid_cell_row_pos');
var _lv_obj_set_style_grid_cell_x_align = Module['_lv_obj_set_style_grid_cell_x_align'] = createExportWrapper('lv_obj_set_style_grid_cell_x_align');
var _lv_obj_set_style_grid_cell_column_span = Module['_lv_obj_set_style_grid_cell_column_span'] = createExportWrapper('lv_obj_set_style_grid_cell_column_span');
var _lv_obj_set_style_grid_cell_row_span = Module['_lv_obj_set_style_grid_cell_row_span'] = createExportWrapper('lv_obj_set_style_grid_cell_row_span');
var _lv_obj_set_style_grid_cell_y_align = Module['_lv_obj_set_style_grid_cell_y_align'] = createExportWrapper('lv_obj_set_style_grid_cell_y_align');
var _lv_style_set_grid_row_dsc_array = Module['_lv_style_set_grid_row_dsc_array'] = createExportWrapper('lv_style_set_grid_row_dsc_array');
var _lv_style_set_grid_column_dsc_array = Module['_lv_style_set_grid_column_dsc_array'] = createExportWrapper('lv_style_set_grid_column_dsc_array');
var _lv_style_set_grid_row_align = Module['_lv_style_set_grid_row_align'] = createExportWrapper('lv_style_set_grid_row_align');
var _lv_style_set_grid_column_align = Module['_lv_style_set_grid_column_align'] = createExportWrapper('lv_style_set_grid_column_align');
var _lv_style_set_grid_cell_column_pos = Module['_lv_style_set_grid_cell_column_pos'] = createExportWrapper('lv_style_set_grid_cell_column_pos');
var _lv_style_set_grid_cell_column_span = Module['_lv_style_set_grid_cell_column_span'] = createExportWrapper('lv_style_set_grid_cell_column_span');
var _lv_style_set_grid_cell_row_pos = Module['_lv_style_set_grid_cell_row_pos'] = createExportWrapper('lv_style_set_grid_cell_row_pos');
var _lv_style_set_grid_cell_row_span = Module['_lv_style_set_grid_cell_row_span'] = createExportWrapper('lv_style_set_grid_cell_row_span');
var _lv_style_set_grid_cell_x_align = Module['_lv_style_set_grid_cell_x_align'] = createExportWrapper('lv_style_set_grid_cell_x_align');
var _lv_style_set_grid_cell_y_align = Module['_lv_style_set_grid_cell_y_align'] = createExportWrapper('lv_style_set_grid_cell_y_align');
var _lv_bmp_init = Module['_lv_bmp_init'] = createExportWrapper('lv_bmp_init');
var _lv_fs_stdio_init = Module['_lv_fs_stdio_init'] = createExportWrapper('lv_fs_stdio_init');
var _lv_gif_create = Module['_lv_gif_create'] = createExportWrapper('lv_gif_create');
var _lv_gif_set_src = Module['_lv_gif_set_src'] = createExportWrapper('lv_gif_set_src');
var _lv_gif_restart = Module['_lv_gif_restart'] = createExportWrapper('lv_gif_restart');
var _lv_png_init = Module['_lv_png_init'] = createExportWrapper('lv_png_init');
var _lv_qrcode_create = Module['_lv_qrcode_create'] = createExportWrapper('lv_qrcode_create');
var _lv_qrcode_update = Module['_lv_qrcode_update'] = createExportWrapper('lv_qrcode_update');
var _lv_qrcode_delete = Module['_lv_qrcode_delete'] = createExportWrapper('lv_qrcode_delete');
var _lv_split_jpeg_init = Module['_lv_split_jpeg_init'] = createExportWrapper('lv_split_jpeg_init');
var _lv_tiny_ttf_create_file_ex = Module['_lv_tiny_ttf_create_file_ex'] = createExportWrapper('lv_tiny_ttf_create_file_ex');
var _lv_tiny_ttf_set_size = Module['_lv_tiny_ttf_set_size'] = createExportWrapper('lv_tiny_ttf_set_size');
var _lv_tiny_ttf_create_file = Module['_lv_tiny_ttf_create_file'] = createExportWrapper('lv_tiny_ttf_create_file');
var _lv_tiny_ttf_create_data_ex = Module['_lv_tiny_ttf_create_data_ex'] = createExportWrapper('lv_tiny_ttf_create_data_ex');
var _lv_tiny_ttf_create_data = Module['_lv_tiny_ttf_create_data'] = createExportWrapper('lv_tiny_ttf_create_data');
var _lv_tiny_ttf_destroy = Module['_lv_tiny_ttf_destroy'] = createExportWrapper('lv_tiny_ttf_destroy');
var _lv_style_register_prop = Module['_lv_style_register_prop'] = createExportWrapper('lv_style_register_prop');
var _lv_area_set_width = Module['_lv_area_set_width'] = createExportWrapper('lv_area_set_width');
var _lv_msg_init = Module['_lv_msg_init'] = createExportWrapper('lv_msg_init');
var _lv_snprintf = Module['_lv_snprintf'] = createExportWrapper('lv_snprintf');
var _lv_fs_tell = Module['_lv_fs_tell'] = createExportWrapper('lv_fs_tell');
var _lv_fs_write = Module['_lv_fs_write'] = createExportWrapper('lv_fs_write');
var _lv_fragment_create = Module['_lv_fragment_create'] = createExportWrapper('lv_fragment_create');
var _lv_fragment_del = Module['_lv_fragment_del'] = createExportWrapper('lv_fragment_del');
var _lv_fragment_del_obj = Module['_lv_fragment_del_obj'] = createExportWrapper('lv_fragment_del_obj');
var _lv_fragment_get_manager = Module['_lv_fragment_get_manager'] = createExportWrapper('lv_fragment_get_manager');
var _lv_fragment_get_container = Module['_lv_fragment_get_container'] = createExportWrapper('lv_fragment_get_container');
var _lv_fragment_get_parent = Module['_lv_fragment_get_parent'] = createExportWrapper('lv_fragment_get_parent');
var _lv_fragment_create_obj = Module['_lv_fragment_create_obj'] = createExportWrapper('lv_fragment_create_obj');
var _lv_fragment_recreate_obj = Module['_lv_fragment_recreate_obj'] = createExportWrapper('lv_fragment_recreate_obj');
var _lv_fragment_manager_create = Module['_lv_fragment_manager_create'] = createExportWrapper('lv_fragment_manager_create');
var _lv_fragment_manager_del = Module['_lv_fragment_manager_del'] = createExportWrapper('lv_fragment_manager_del');
var _lv_fragment_manager_create_obj = Module['_lv_fragment_manager_create_obj'] = createExportWrapper('lv_fragment_manager_create_obj');
var _lv_fragment_manager_del_obj = Module['_lv_fragment_manager_del_obj'] = createExportWrapper('lv_fragment_manager_del_obj');
var _lv_fragment_manager_add = Module['_lv_fragment_manager_add'] = createExportWrapper('lv_fragment_manager_add');
var _lv_fragment_manager_remove = Module['_lv_fragment_manager_remove'] = createExportWrapper('lv_fragment_manager_remove');
var _lv_fragment_manager_push = Module['_lv_fragment_manager_push'] = createExportWrapper('lv_fragment_manager_push');
var _lv_fragment_manager_pop = Module['_lv_fragment_manager_pop'] = createExportWrapper('lv_fragment_manager_pop');
var _lv_fragment_manager_get_top = Module['_lv_fragment_manager_get_top'] = createExportWrapper('lv_fragment_manager_get_top');
var _lv_fragment_manager_replace = Module['_lv_fragment_manager_replace'] = createExportWrapper('lv_fragment_manager_replace');
var _lv_fragment_manager_find_by_container = Module['_lv_fragment_manager_find_by_container'] = createExportWrapper('lv_fragment_manager_find_by_container');
var _lv_fragment_manager_send_event = Module['_lv_fragment_manager_send_event'] = createExportWrapper('lv_fragment_manager_send_event');
var _lv_fragment_manager_get_stack_size = Module['_lv_fragment_manager_get_stack_size'] = createExportWrapper('lv_fragment_manager_get_stack_size');
var _lv_fragment_manager_get_parent_fragment = Module['_lv_fragment_manager_get_parent_fragment'] = createExportWrapper('lv_fragment_manager_get_parent_fragment');
var _lv_gridnav_add = Module['_lv_gridnav_add'] = createExportWrapper('lv_gridnav_add');
var _lv_gridnav_remove = Module['_lv_gridnav_remove'] = createExportWrapper('lv_gridnav_remove');
var _lv_gridnav_set_focused = Module['_lv_gridnav_set_focused'] = createExportWrapper('lv_gridnav_set_focused');
var _lv_monkey_config_init = Module['_lv_monkey_config_init'] = createExportWrapper('lv_monkey_config_init');
var _lv_monkey_create = Module['_lv_monkey_create'] = createExportWrapper('lv_monkey_create');
var _lv_monkey_get_indev = Module['_lv_monkey_get_indev'] = createExportWrapper('lv_monkey_get_indev');
var _lv_monkey_set_enable = Module['_lv_monkey_set_enable'] = createExportWrapper('lv_monkey_set_enable');
var _lv_monkey_get_enable = Module['_lv_monkey_get_enable'] = createExportWrapper('lv_monkey_get_enable');
var _lv_monkey_set_user_data = Module['_lv_monkey_set_user_data'] = createExportWrapper('lv_monkey_set_user_data');
var _lv_monkey_get_user_data = Module['_lv_monkey_get_user_data'] = createExportWrapper('lv_monkey_get_user_data');
var _lv_monkey_del = Module['_lv_monkey_del'] = createExportWrapper('lv_monkey_del');
var _lv_msg_subsribe = Module['_lv_msg_subsribe'] = createExportWrapper('lv_msg_subsribe');
var _lv_msg_subsribe_obj = Module['_lv_msg_subsribe_obj'] = createExportWrapper('lv_msg_subsribe_obj');
var _lv_msg_unsubscribe = Module['_lv_msg_unsubscribe'] = createExportWrapper('lv_msg_unsubscribe');
var _lv_msg_unsubscribe_obj = Module['_lv_msg_unsubscribe_obj'] = createExportWrapper('lv_msg_unsubscribe_obj');
var _lv_msg_send = Module['_lv_msg_send'] = createExportWrapper('lv_msg_send');
var _lv_msg_get_id = Module['_lv_msg_get_id'] = createExportWrapper('lv_msg_get_id');
var _lv_msg_get_payload = Module['_lv_msg_get_payload'] = createExportWrapper('lv_msg_get_payload');
var _lv_msg_get_user_data = Module['_lv_msg_get_user_data'] = createExportWrapper('lv_msg_get_user_data');
var _lv_event_get_msg = Module['_lv_event_get_msg'] = createExportWrapper('lv_event_get_msg');
var _lv_snapshot_buf_size_needed = Module['_lv_snapshot_buf_size_needed'] = createExportWrapper('lv_snapshot_buf_size_needed');
var _lv_snapshot_take_to_buf = Module['_lv_snapshot_take_to_buf'] = createExportWrapper('lv_snapshot_take_to_buf');
var _lv_snapshot_take = Module['_lv_snapshot_take'] = createExportWrapper('lv_snapshot_take');
var _lv_snapshot_free = Module['_lv_snapshot_free'] = createExportWrapper('lv_snapshot_free');
var _lv_theme_basic_is_inited = Module['_lv_theme_basic_is_inited'] = createExportWrapper('lv_theme_basic_is_inited');
var _lv_theme_basic_init = Module['_lv_theme_basic_init'] = createExportWrapper('lv_theme_basic_init');
var _lv_theme_default_is_inited = Module['_lv_theme_default_is_inited'] = createExportWrapper('lv_theme_default_is_inited');
var _lv_palette_lighten = Module['_lv_palette_lighten'] = createExportWrapper('lv_palette_lighten');
var _lv_palette_darken = Module['_lv_palette_darken'] = createExportWrapper('lv_palette_darken');
var _lv_anim_path_linear = Module['_lv_anim_path_linear'] = createExportWrapper('lv_anim_path_linear');
var _lv_style_transition_dsc_init = Module['_lv_style_transition_dsc_init'] = createExportWrapper('lv_style_transition_dsc_init');
var _lv_style_set_transition = Module['_lv_style_set_transition'] = createExportWrapper('lv_style_set_transition');
var _lv_style_set_bg_color = Module['_lv_style_set_bg_color'] = createExportWrapper('lv_style_set_bg_color');
var _lv_style_set_radius = Module['_lv_style_set_radius'] = createExportWrapper('lv_style_set_radius');
var _lv_style_set_pad_left = Module['_lv_style_set_pad_left'] = createExportWrapper('lv_style_set_pad_left');
var _lv_style_set_pad_right = Module['_lv_style_set_pad_right'] = createExportWrapper('lv_style_set_pad_right');
var _lv_style_set_pad_top = Module['_lv_style_set_pad_top'] = createExportWrapper('lv_style_set_pad_top');
var _lv_style_set_pad_bottom = Module['_lv_style_set_pad_bottom'] = createExportWrapper('lv_style_set_pad_bottom');
var _lv_style_set_width = Module['_lv_style_set_width'] = createExportWrapper('lv_style_set_width');
var _lv_style_set_bg_opa = Module['_lv_style_set_bg_opa'] = createExportWrapper('lv_style_set_bg_opa');
var _lv_style_set_text_color = Module['_lv_style_set_text_color'] = createExportWrapper('lv_style_set_text_color');
var _lv_style_set_pad_row = Module['_lv_style_set_pad_row'] = createExportWrapper('lv_style_set_pad_row');
var _lv_style_set_pad_column = Module['_lv_style_set_pad_column'] = createExportWrapper('lv_style_set_pad_column');
var _lv_style_set_border_color = Module['_lv_style_set_border_color'] = createExportWrapper('lv_style_set_border_color');
var _lv_style_set_border_width = Module['_lv_style_set_border_width'] = createExportWrapper('lv_style_set_border_width');
var _lv_style_set_border_post = Module['_lv_style_set_border_post'] = createExportWrapper('lv_style_set_border_post');
var _lv_style_set_line_color = Module['_lv_style_set_line_color'] = createExportWrapper('lv_style_set_line_color');
var _lv_style_set_line_width = Module['_lv_style_set_line_width'] = createExportWrapper('lv_style_set_line_width');
var _lv_style_set_outline_color = Module['_lv_style_set_outline_color'] = createExportWrapper('lv_style_set_outline_color');
var _lv_style_set_outline_width = Module['_lv_style_set_outline_width'] = createExportWrapper('lv_style_set_outline_width');
var _lv_style_set_outline_pad = Module['_lv_style_set_outline_pad'] = createExportWrapper('lv_style_set_outline_pad');
var _lv_style_set_outline_opa = Module['_lv_style_set_outline_opa'] = createExportWrapper('lv_style_set_outline_opa');
var _lv_style_set_shadow_color = Module['_lv_style_set_shadow_color'] = createExportWrapper('lv_style_set_shadow_color');
var _lv_style_set_shadow_width = Module['_lv_style_set_shadow_width'] = createExportWrapper('lv_style_set_shadow_width');
var _lv_style_set_shadow_opa = Module['_lv_style_set_shadow_opa'] = createExportWrapper('lv_style_set_shadow_opa');
var _lv_style_set_shadow_ofs_y = Module['_lv_style_set_shadow_ofs_y'] = createExportWrapper('lv_style_set_shadow_ofs_y');
var _lv_style_set_color_filter_dsc = Module['_lv_style_set_color_filter_dsc'] = createExportWrapper('lv_style_set_color_filter_dsc');
var _lv_style_set_color_filter_opa = Module['_lv_style_set_color_filter_opa'] = createExportWrapper('lv_style_set_color_filter_opa');
var _lv_style_set_clip_corner = Module['_lv_style_set_clip_corner'] = createExportWrapper('lv_style_set_clip_corner');
var _lv_style_set_text_line_space = Module['_lv_style_set_text_line_space'] = createExportWrapper('lv_style_set_text_line_space');
var _lv_style_set_text_align = Module['_lv_style_set_text_align'] = createExportWrapper('lv_style_set_text_align');
var _lv_style_set_transform_width = Module['_lv_style_set_transform_width'] = createExportWrapper('lv_style_set_transform_width');
var _lv_style_set_transform_height = Module['_lv_style_set_transform_height'] = createExportWrapper('lv_style_set_transform_height');
var _lv_style_set_anim_time = Module['_lv_style_set_anim_time'] = createExportWrapper('lv_style_set_anim_time');
var _lv_style_set_arc_color = Module['_lv_style_set_arc_color'] = createExportWrapper('lv_style_set_arc_color');
var _lv_style_set_arc_width = Module['_lv_style_set_arc_width'] = createExportWrapper('lv_style_set_arc_width');
var _lv_style_set_arc_rounded = Module['_lv_style_set_arc_rounded'] = createExportWrapper('lv_style_set_arc_rounded');
var _lv_style_set_max_height = Module['_lv_style_set_max_height'] = createExportWrapper('lv_style_set_max_height');
var _lv_style_set_bg_img_src = Module['_lv_style_set_bg_img_src'] = createExportWrapper('lv_style_set_bg_img_src');
var _lv_style_set_text_font = Module['_lv_style_set_text_font'] = createExportWrapper('lv_style_set_text_font');
var _lv_style_set_height = Module['_lv_style_set_height'] = createExportWrapper('lv_style_set_height');
var _lv_style_set_border_side = Module['_lv_style_set_border_side'] = createExportWrapper('lv_style_set_border_side');
var _lv_style_set_border_opa = Module['_lv_style_set_border_opa'] = createExportWrapper('lv_style_set_border_opa');
var _lv_style_set_max_width = Module['_lv_style_set_max_width'] = createExportWrapper('lv_style_set_max_width');
var _lv_style_set_bg_grad_color = Module['_lv_style_set_bg_grad_color'] = createExportWrapper('lv_style_set_bg_grad_color');
var _lv_style_set_shadow_spread = Module['_lv_style_set_shadow_spread'] = createExportWrapper('lv_style_set_shadow_spread');
var _lv_theme_default_get = Module['_lv_theme_default_get'] = createExportWrapper('lv_theme_default_get');
var _lv_color_darken = Module['_lv_color_darken'] = createExportWrapper('lv_color_darken');
var _lv_theme_mono_is_inited = Module['_lv_theme_mono_is_inited'] = createExportWrapper('lv_theme_mono_is_inited');
var _lv_theme_mono_init = Module['_lv_theme_mono_init'] = createExportWrapper('lv_theme_mono_init');
var _lv_animimg_create = Module['_lv_animimg_create'] = createExportWrapper('lv_animimg_create');
var _lv_animimg_set_src = Module['_lv_animimg_set_src'] = createExportWrapper('lv_animimg_set_src');
var _lv_animimg_start = Module['_lv_animimg_start'] = createExportWrapper('lv_animimg_start');
var _lv_animimg_set_duration = Module['_lv_animimg_set_duration'] = createExportWrapper('lv_animimg_set_duration');
var _lv_animimg_set_repeat_count = Module['_lv_animimg_set_repeat_count'] = createExportWrapper('lv_animimg_set_repeat_count');
var _lv_calendar_set_showed_date = Module['_lv_calendar_set_showed_date'] = createExportWrapper('lv_calendar_set_showed_date');
var _lv_btnmatrix_create = Module['_lv_btnmatrix_create'] = createExportWrapper('lv_btnmatrix_create');
var _lv_btnmatrix_set_map = Module['_lv_btnmatrix_set_map'] = createExportWrapper('lv_btnmatrix_set_map');
var _lv_btnmatrix_set_btn_ctrl_all = Module['_lv_btnmatrix_set_btn_ctrl_all'] = createExportWrapper('lv_btnmatrix_set_btn_ctrl_all');
var _lv_calendar_set_day_names = Module['_lv_calendar_set_day_names'] = createExportWrapper('lv_calendar_set_day_names');
var _lv_calendar_set_today_date = Module['_lv_calendar_set_today_date'] = createExportWrapper('lv_calendar_set_today_date');
var _lv_btnmatrix_clear_btn_ctrl_all = Module['_lv_btnmatrix_clear_btn_ctrl_all'] = createExportWrapper('lv_btnmatrix_clear_btn_ctrl_all');
var _lv_btnmatrix_set_btn_ctrl = Module['_lv_btnmatrix_set_btn_ctrl'] = createExportWrapper('lv_btnmatrix_set_btn_ctrl');
var _lv_calendar_set_highlighted_dates = Module['_lv_calendar_set_highlighted_dates'] = createExportWrapper('lv_calendar_set_highlighted_dates');
var _lv_btnmatrix_get_selected_btn = Module['_lv_btnmatrix_get_selected_btn'] = createExportWrapper('lv_btnmatrix_get_selected_btn');
var _lv_btnmatrix_set_selected_btn = Module['_lv_btnmatrix_set_selected_btn'] = createExportWrapper('lv_btnmatrix_set_selected_btn');
var _lv_calendar_get_btnmatrix = Module['_lv_calendar_get_btnmatrix'] = createExportWrapper('lv_calendar_get_btnmatrix');
var _lv_calendar_get_today_date = Module['_lv_calendar_get_today_date'] = createExportWrapper('lv_calendar_get_today_date');
var _lv_calendar_get_showed_date = Module['_lv_calendar_get_showed_date'] = createExportWrapper('lv_calendar_get_showed_date');
var _lv_calendar_get_highlighted_dates = Module['_lv_calendar_get_highlighted_dates'] = createExportWrapper('lv_calendar_get_highlighted_dates');
var _lv_calendar_get_highlighted_dates_num = Module['_lv_calendar_get_highlighted_dates_num'] = createExportWrapper('lv_calendar_get_highlighted_dates_num');
var _lv_calendar_get_pressed_date = Module['_lv_calendar_get_pressed_date'] = createExportWrapper('lv_calendar_get_pressed_date');
var _lv_btnmatrix_get_btn_text = Module['_lv_btnmatrix_get_btn_text'] = createExportWrapper('lv_btnmatrix_get_btn_text');
var _lv_btnmatrix_has_btn_ctrl = Module['_lv_btnmatrix_has_btn_ctrl'] = createExportWrapper('lv_btnmatrix_has_btn_ctrl');
var _lv_calendar_header_arrow_create = Module['_lv_calendar_header_arrow_create'] = createExportWrapper('lv_calendar_header_arrow_create');
var _lv_label_set_long_mode = Module['_lv_label_set_long_mode'] = createExportWrapper('lv_label_set_long_mode');
var _lv_label_set_text_fmt = Module['_lv_label_set_text_fmt'] = createExportWrapper('lv_label_set_text_fmt');
var _lv_calendar_header_dropdown_create = Module['_lv_calendar_header_dropdown_create'] = createExportWrapper('lv_calendar_header_dropdown_create');
var _lv_dropdown_set_options = Module['_lv_dropdown_set_options'] = createExportWrapper('lv_dropdown_set_options');
var _lv_calendar_header_dropdown_set_year_list = Module['_lv_calendar_header_dropdown_set_year_list'] = createExportWrapper('lv_calendar_header_dropdown_set_year_list');
var _lv_dropdown_clear_options = Module['_lv_dropdown_clear_options'] = createExportWrapper('lv_dropdown_clear_options');
var _lv_dropdown_get_selected = Module['_lv_dropdown_get_selected'] = createExportWrapper('lv_dropdown_get_selected');
var _lv_dropdown_get_options = Module['_lv_dropdown_get_options'] = createExportWrapper('lv_dropdown_get_options');
var _lv_dropdown_set_selected = Module['_lv_dropdown_set_selected'] = createExportWrapper('lv_dropdown_set_selected');
var _lv_chart_get_point_pos_by_id = Module['_lv_chart_get_point_pos_by_id'] = createExportWrapper('lv_chart_get_point_pos_by_id');
var _lv_chart_set_type = Module['_lv_chart_set_type'] = createExportWrapper('lv_chart_set_type');
var _lv_chart_refresh = Module['_lv_chart_refresh'] = createExportWrapper('lv_chart_refresh');
var _lv_chart_set_point_count = Module['_lv_chart_set_point_count'] = createExportWrapper('lv_chart_set_point_count');
var _lv_chart_set_range = Module['_lv_chart_set_range'] = createExportWrapper('lv_chart_set_range');
var _lv_chart_set_update_mode = Module['_lv_chart_set_update_mode'] = createExportWrapper('lv_chart_set_update_mode');
var _lv_chart_set_div_line_count = Module['_lv_chart_set_div_line_count'] = createExportWrapper('lv_chart_set_div_line_count');
var _lv_chart_set_zoom_x = Module['_lv_chart_set_zoom_x'] = createExportWrapper('lv_chart_set_zoom_x');
var _lv_chart_set_zoom_y = Module['_lv_chart_set_zoom_y'] = createExportWrapper('lv_chart_set_zoom_y');
var _lv_chart_get_zoom_x = Module['_lv_chart_get_zoom_x'] = createExportWrapper('lv_chart_get_zoom_x');
var _lv_chart_get_zoom_y = Module['_lv_chart_get_zoom_y'] = createExportWrapper('lv_chart_get_zoom_y');
var _lv_chart_set_axis_tick = Module['_lv_chart_set_axis_tick'] = createExportWrapper('lv_chart_set_axis_tick');
var _lv_chart_get_type = Module['_lv_chart_get_type'] = createExportWrapper('lv_chart_get_type');
var _lv_chart_get_point_count = Module['_lv_chart_get_point_count'] = createExportWrapper('lv_chart_get_point_count');
var _lv_chart_get_x_start_point = Module['_lv_chart_get_x_start_point'] = createExportWrapper('lv_chart_get_x_start_point');
var _lv_map = Module['_lv_map'] = createExportWrapper('lv_map');
var _lv_chart_add_series = Module['_lv_chart_add_series'] = createExportWrapper('lv_chart_add_series');
var _lv_chart_remove_series = Module['_lv_chart_remove_series'] = createExportWrapper('lv_chart_remove_series');
var _lv_chart_hide_series = Module['_lv_chart_hide_series'] = createExportWrapper('lv_chart_hide_series');
var _lv_chart_set_series_color = Module['_lv_chart_set_series_color'] = createExportWrapper('lv_chart_set_series_color');
var _lv_chart_set_x_start_point = Module['_lv_chart_set_x_start_point'] = createExportWrapper('lv_chart_set_x_start_point');
var _lv_chart_get_series_next = Module['_lv_chart_get_series_next'] = createExportWrapper('lv_chart_get_series_next');
var _lv_chart_add_cursor = Module['_lv_chart_add_cursor'] = createExportWrapper('lv_chart_add_cursor');
var _lv_chart_set_cursor_pos = Module['_lv_chart_set_cursor_pos'] = createExportWrapper('lv_chart_set_cursor_pos');
var _lv_chart_set_cursor_point = Module['_lv_chart_set_cursor_point'] = createExportWrapper('lv_chart_set_cursor_point');
var _lv_chart_get_cursor_point = Module['_lv_chart_get_cursor_point'] = createExportWrapper('lv_chart_get_cursor_point');
var _lv_chart_set_all_value = Module['_lv_chart_set_all_value'] = createExportWrapper('lv_chart_set_all_value');
var _lv_chart_set_next_value = Module['_lv_chart_set_next_value'] = createExportWrapper('lv_chart_set_next_value');
var _lv_chart_set_next_value2 = Module['_lv_chart_set_next_value2'] = createExportWrapper('lv_chart_set_next_value2');
var _lv_chart_set_value_by_id = Module['_lv_chart_set_value_by_id'] = createExportWrapper('lv_chart_set_value_by_id');
var _lv_chart_set_value_by_id2 = Module['_lv_chart_set_value_by_id2'] = createExportWrapper('lv_chart_set_value_by_id2');
var _lv_chart_set_ext_y_array = Module['_lv_chart_set_ext_y_array'] = createExportWrapper('lv_chart_set_ext_y_array');
var _lv_chart_set_ext_x_array = Module['_lv_chart_set_ext_x_array'] = createExportWrapper('lv_chart_set_ext_x_array');
var _lv_chart_get_y_array = Module['_lv_chart_get_y_array'] = createExportWrapper('lv_chart_get_y_array');
var _lv_chart_get_x_array = Module['_lv_chart_get_x_array'] = createExportWrapper('lv_chart_get_x_array');
var _lv_chart_get_pressed_point = Module['_lv_chart_get_pressed_point'] = createExportWrapper('lv_chart_get_pressed_point');
var _lv_colorwheel_set_hsv = Module['_lv_colorwheel_set_hsv'] = createExportWrapper('lv_colorwheel_set_hsv');
var _lv_atan2 = Module['_lv_atan2'] = createExportWrapper('lv_atan2');
var _lv_color_hsv_to_rgb = Module['_lv_color_hsv_to_rgb'] = createExportWrapper('lv_color_hsv_to_rgb');
var _lv_colorwheel_set_rgb = Module['_lv_colorwheel_set_rgb'] = createExportWrapper('lv_colorwheel_set_rgb');
var _lv_color_rgb_to_hsv = Module['_lv_color_rgb_to_hsv'] = createExportWrapper('lv_color_rgb_to_hsv');
var _lv_colorwheel_set_mode = Module['_lv_colorwheel_set_mode'] = createExportWrapper('lv_colorwheel_set_mode');
var _lv_colorwheel_set_mode_fixed = Module['_lv_colorwheel_set_mode_fixed'] = createExportWrapper('lv_colorwheel_set_mode_fixed');
var _lv_colorwheel_get_hsv = Module['_lv_colorwheel_get_hsv'] = createExportWrapper('lv_colorwheel_get_hsv');
var _lv_colorwheel_get_rgb = Module['_lv_colorwheel_get_rgb'] = createExportWrapper('lv_colorwheel_get_rgb');
var _lv_colorwheel_get_color_mode = Module['_lv_colorwheel_get_color_mode'] = createExportWrapper('lv_colorwheel_get_color_mode');
var _lv_colorwheel_get_color_mode_fixed = Module['_lv_colorwheel_get_color_mode_fixed'] = createExportWrapper('lv_colorwheel_get_color_mode_fixed');
var _lv_imgbtn_set_src = Module['_lv_imgbtn_set_src'] = createExportWrapper('lv_imgbtn_set_src');
var _lv_imgbtn_set_state = Module['_lv_imgbtn_set_state'] = createExportWrapper('lv_imgbtn_set_state');
var _lv_imgbtn_get_src_left = Module['_lv_imgbtn_get_src_left'] = createExportWrapper('lv_imgbtn_get_src_left');
var _lv_imgbtn_get_src_middle = Module['_lv_imgbtn_get_src_middle'] = createExportWrapper('lv_imgbtn_get_src_middle');
var _lv_imgbtn_get_src_right = Module['_lv_imgbtn_get_src_right'] = createExportWrapper('lv_imgbtn_get_src_right');
var _lv_keyboard_def_event_cb = Module['_lv_keyboard_def_event_cb'] = createExportWrapper('lv_keyboard_def_event_cb');
var _lv_keyboard_set_textarea = Module['_lv_keyboard_set_textarea'] = createExportWrapper('lv_keyboard_set_textarea');
var _lv_keyboard_set_mode = Module['_lv_keyboard_set_mode'] = createExportWrapper('lv_keyboard_set_mode');
var _lv_keyboard_set_popovers = Module['_lv_keyboard_set_popovers'] = createExportWrapper('lv_keyboard_set_popovers');
var _lv_btnmatrix_set_ctrl_map = Module['_lv_btnmatrix_set_ctrl_map'] = createExportWrapper('lv_btnmatrix_set_ctrl_map');
var _lv_keyboard_set_map = Module['_lv_keyboard_set_map'] = createExportWrapper('lv_keyboard_set_map');
var _lv_keyboard_get_textarea = Module['_lv_keyboard_get_textarea'] = createExportWrapper('lv_keyboard_get_textarea');
var _lv_keyboard_get_mode = Module['_lv_keyboard_get_mode'] = createExportWrapper('lv_keyboard_get_mode');
var _lv_btnmatrix_get_popovers = Module['_lv_btnmatrix_get_popovers'] = createExportWrapper('lv_btnmatrix_get_popovers');
var _lv_textarea_add_char = Module['_lv_textarea_add_char'] = createExportWrapper('lv_textarea_add_char');
var _lv_textarea_get_one_line = Module['_lv_textarea_get_one_line'] = createExportWrapper('lv_textarea_get_one_line');
var _lv_textarea_cursor_left = Module['_lv_textarea_cursor_left'] = createExportWrapper('lv_textarea_cursor_left');
var _lv_textarea_cursor_right = Module['_lv_textarea_cursor_right'] = createExportWrapper('lv_textarea_cursor_right');
var _lv_textarea_del_char = Module['_lv_textarea_del_char'] = createExportWrapper('lv_textarea_del_char');
var _lv_textarea_get_cursor_pos = Module['_lv_textarea_get_cursor_pos'] = createExportWrapper('lv_textarea_get_cursor_pos');
var _lv_textarea_get_text = Module['_lv_textarea_get_text'] = createExportWrapper('lv_textarea_get_text');
var _lv_textarea_set_cursor_pos = Module['_lv_textarea_set_cursor_pos'] = createExportWrapper('lv_textarea_set_cursor_pos');
var _lv_textarea_add_text = Module['_lv_textarea_add_text'] = createExportWrapper('lv_textarea_add_text');
var _lv_led_create = Module['_lv_led_create'] = createExportWrapper('lv_led_create');
var _lv_led_set_color = Module['_lv_led_set_color'] = createExportWrapper('lv_led_set_color');
var _lv_led_set_brightness = Module['_lv_led_set_brightness'] = createExportWrapper('lv_led_set_brightness');
var _lv_led_on = Module['_lv_led_on'] = createExportWrapper('lv_led_on');
var _lv_led_off = Module['_lv_led_off'] = createExportWrapper('lv_led_off');
var _lv_led_toggle = Module['_lv_led_toggle'] = createExportWrapper('lv_led_toggle');
var _lv_led_get_brightness = Module['_lv_led_get_brightness'] = createExportWrapper('lv_led_get_brightness');
var _lv_list_create = Module['_lv_list_create'] = createExportWrapper('lv_list_create');
var _lv_list_add_text = Module['_lv_list_add_text'] = createExportWrapper('lv_list_add_text');
var _lv_label_set_text = Module['_lv_label_set_text'] = createExportWrapper('lv_label_set_text');
var _lv_list_add_btn = Module['_lv_list_add_btn'] = createExportWrapper('lv_list_add_btn');
var _lv_img_set_src = Module['_lv_img_set_src'] = createExportWrapper('lv_img_set_src');
var _lv_list_get_btn_text = Module['_lv_list_get_btn_text'] = createExportWrapper('lv_list_get_btn_text');
var _lv_label_get_text = Module['_lv_label_get_text'] = createExportWrapper('lv_label_get_text');
var _lv_menu_create = Module['_lv_menu_create'] = createExportWrapper('lv_menu_create');
var _lv_menu_page_create = Module['_lv_menu_page_create'] = createExportWrapper('lv_menu_page_create');
var _lv_menu_cont_create = Module['_lv_menu_cont_create'] = createExportWrapper('lv_menu_cont_create');
var _lv_menu_section_create = Module['_lv_menu_section_create'] = createExportWrapper('lv_menu_section_create');
var _lv_menu_separator_create = Module['_lv_menu_separator_create'] = createExportWrapper('lv_menu_separator_create');
var _lv_menu_set_page = Module['_lv_menu_set_page'] = createExportWrapper('lv_menu_set_page');
var _lv_menu_clear_history = Module['_lv_menu_clear_history'] = createExportWrapper('lv_menu_clear_history');
var _lv_menu_set_sidebar_page = Module['_lv_menu_set_sidebar_page'] = createExportWrapper('lv_menu_set_sidebar_page');
var _lv_menu_set_mode_header = Module['_lv_menu_set_mode_header'] = createExportWrapper('lv_menu_set_mode_header');
var _lv_menu_set_mode_root_back_btn = Module['_lv_menu_set_mode_root_back_btn'] = createExportWrapper('lv_menu_set_mode_root_back_btn');
var _lv_menu_set_load_page_event = Module['_lv_menu_set_load_page_event'] = createExportWrapper('lv_menu_set_load_page_event');
var _lv_menu_get_cur_main_page = Module['_lv_menu_get_cur_main_page'] = createExportWrapper('lv_menu_get_cur_main_page');
var _lv_menu_get_cur_sidebar_page = Module['_lv_menu_get_cur_sidebar_page'] = createExportWrapper('lv_menu_get_cur_sidebar_page');
var _lv_menu_get_main_header = Module['_lv_menu_get_main_header'] = createExportWrapper('lv_menu_get_main_header');
var _lv_menu_get_main_header_back_btn = Module['_lv_menu_get_main_header_back_btn'] = createExportWrapper('lv_menu_get_main_header_back_btn');
var _lv_menu_get_sidebar_header = Module['_lv_menu_get_sidebar_header'] = createExportWrapper('lv_menu_get_sidebar_header');
var _lv_menu_get_sidebar_header_back_btn = Module['_lv_menu_get_sidebar_header_back_btn'] = createExportWrapper('lv_menu_get_sidebar_header_back_btn');
var _lv_menu_back_btn_is_root = Module['_lv_menu_back_btn_is_root'] = createExportWrapper('lv_menu_back_btn_is_root');
var _lv_meter_add_scale = Module['_lv_meter_add_scale'] = createExportWrapper('lv_meter_add_scale');
var _lv_meter_set_scale_ticks = Module['_lv_meter_set_scale_ticks'] = createExportWrapper('lv_meter_set_scale_ticks');
var _lv_meter_set_scale_major_ticks = Module['_lv_meter_set_scale_major_ticks'] = createExportWrapper('lv_meter_set_scale_major_ticks');
var _lv_meter_set_scale_range = Module['_lv_meter_set_scale_range'] = createExportWrapper('lv_meter_set_scale_range');
var _lv_meter_add_needle_line = Module['_lv_meter_add_needle_line'] = createExportWrapper('lv_meter_add_needle_line');
var _lv_meter_add_needle_img = Module['_lv_meter_add_needle_img'] = createExportWrapper('lv_meter_add_needle_img');
var _lv_meter_add_arc = Module['_lv_meter_add_arc'] = createExportWrapper('lv_meter_add_arc');
var _lv_meter_add_scale_lines = Module['_lv_meter_add_scale_lines'] = createExportWrapper('lv_meter_add_scale_lines');
var _lv_meter_set_indicator_value = Module['_lv_meter_set_indicator_value'] = createExportWrapper('lv_meter_set_indicator_value');
var _lv_meter_set_indicator_start_value = Module['_lv_meter_set_indicator_start_value'] = createExportWrapper('lv_meter_set_indicator_start_value');
var _lv_meter_set_indicator_end_value = Module['_lv_meter_set_indicator_end_value'] = createExportWrapper('lv_meter_set_indicator_end_value');
var _lv_msgbox_create = Module['_lv_msgbox_create'] = createExportWrapper('lv_msgbox_create');
var _lv_msgbox_get_title = Module['_lv_msgbox_get_title'] = createExportWrapper('lv_msgbox_get_title');
var _lv_msgbox_get_close_btn = Module['_lv_msgbox_get_close_btn'] = createExportWrapper('lv_msgbox_get_close_btn');
var _lv_msgbox_get_text = Module['_lv_msgbox_get_text'] = createExportWrapper('lv_msgbox_get_text');
var _lv_msgbox_get_content = Module['_lv_msgbox_get_content'] = createExportWrapper('lv_msgbox_get_content');
var _lv_msgbox_get_btns = Module['_lv_msgbox_get_btns'] = createExportWrapper('lv_msgbox_get_btns');
var _lv_msgbox_get_active_btn = Module['_lv_msgbox_get_active_btn'] = createExportWrapper('lv_msgbox_get_active_btn');
var _lv_msgbox_get_active_btn_text = Module['_lv_msgbox_get_active_btn_text'] = createExportWrapper('lv_msgbox_get_active_btn_text');
var _lv_msgbox_close = Module['_lv_msgbox_close'] = createExportWrapper('lv_msgbox_close');
var _lv_msgbox_close_async = Module['_lv_msgbox_close_async'] = createExportWrapper('lv_msgbox_close_async');
var _lv_spangroup_get_expand_width = Module['_lv_spangroup_get_expand_width'] = createExportWrapper('lv_spangroup_get_expand_width');
var _lv_spangroup_get_max_line_h = Module['_lv_spangroup_get_max_line_h'] = createExportWrapper('lv_spangroup_get_max_line_h');
var _lv_spangroup_get_expand_height = Module['_lv_spangroup_get_expand_height'] = createExportWrapper('lv_spangroup_get_expand_height');
var _lv_spangroup_create = Module['_lv_spangroup_create'] = createExportWrapper('lv_spangroup_create');
var _lv_spangroup_new_span = Module['_lv_spangroup_new_span'] = createExportWrapper('lv_spangroup_new_span');
var _lv_spangroup_del_span = Module['_lv_spangroup_del_span'] = createExportWrapper('lv_spangroup_del_span');
var _lv_span_set_text = Module['_lv_span_set_text'] = createExportWrapper('lv_span_set_text');
var _lv_span_set_text_static = Module['_lv_span_set_text_static'] = createExportWrapper('lv_span_set_text_static');
var _lv_spangroup_set_align = Module['_lv_spangroup_set_align'] = createExportWrapper('lv_spangroup_set_align');
var _lv_spangroup_set_overflow = Module['_lv_spangroup_set_overflow'] = createExportWrapper('lv_spangroup_set_overflow');
var _lv_spangroup_set_indent = Module['_lv_spangroup_set_indent'] = createExportWrapper('lv_spangroup_set_indent');
var _lv_spangroup_set_mode = Module['_lv_spangroup_set_mode'] = createExportWrapper('lv_spangroup_set_mode');
var _lv_spangroup_refr_mode = Module['_lv_spangroup_refr_mode'] = createExportWrapper('lv_spangroup_refr_mode');
var _lv_spangroup_set_lines = Module['_lv_spangroup_set_lines'] = createExportWrapper('lv_spangroup_set_lines');
var _lv_spangroup_get_child = Module['_lv_spangroup_get_child'] = createExportWrapper('lv_spangroup_get_child');
var _lv_spangroup_get_child_cnt = Module['_lv_spangroup_get_child_cnt'] = createExportWrapper('lv_spangroup_get_child_cnt');
var _lv_spangroup_get_align = Module['_lv_spangroup_get_align'] = createExportWrapper('lv_spangroup_get_align');
var _lv_spangroup_get_overflow = Module['_lv_spangroup_get_overflow'] = createExportWrapper('lv_spangroup_get_overflow');
var _lv_spangroup_get_indent = Module['_lv_spangroup_get_indent'] = createExportWrapper('lv_spangroup_get_indent');
var _lv_spangroup_get_mode = Module['_lv_spangroup_get_mode'] = createExportWrapper('lv_spangroup_get_mode');
var _lv_spangroup_get_lines = Module['_lv_spangroup_get_lines'] = createExportWrapper('lv_spangroup_get_lines');
var _lv_textarea_set_one_line = Module['_lv_textarea_set_one_line'] = createExportWrapper('lv_textarea_set_one_line');
var _lv_textarea_set_cursor_click_pos = Module['_lv_textarea_set_cursor_click_pos'] = createExportWrapper('lv_textarea_set_cursor_click_pos');
var _lv_pow = Module['_lv_pow'] = createExportWrapper('lv_pow');
var _lv_spinbox_step_prev = Module['_lv_spinbox_step_prev'] = createExportWrapper('lv_spinbox_step_prev');
var _lv_spinbox_increment = Module['_lv_spinbox_increment'] = createExportWrapper('lv_spinbox_increment');
var _lv_spinbox_decrement = Module['_lv_spinbox_decrement'] = createExportWrapper('lv_spinbox_decrement');
var _lv_spinbox_create = Module['_lv_spinbox_create'] = createExportWrapper('lv_spinbox_create');
var _lv_spinbox_set_value = Module['_lv_spinbox_set_value'] = createExportWrapper('lv_spinbox_set_value');
var _lv_textarea_set_text = Module['_lv_textarea_set_text'] = createExportWrapper('lv_textarea_set_text');
var _lv_spinbox_set_rollover = Module['_lv_spinbox_set_rollover'] = createExportWrapper('lv_spinbox_set_rollover');
var _lv_spinbox_set_digit_format = Module['_lv_spinbox_set_digit_format'] = createExportWrapper('lv_spinbox_set_digit_format');
var _lv_spinbox_set_step = Module['_lv_spinbox_set_step'] = createExportWrapper('lv_spinbox_set_step');
var _lv_spinbox_set_range = Module['_lv_spinbox_set_range'] = createExportWrapper('lv_spinbox_set_range');
var _lv_spinbox_set_cursor_pos = Module['_lv_spinbox_set_cursor_pos'] = createExportWrapper('lv_spinbox_set_cursor_pos');
var _lv_spinbox_set_digit_step_direction = Module['_lv_spinbox_set_digit_step_direction'] = createExportWrapper('lv_spinbox_set_digit_step_direction');
var _lv_spinbox_get_value = Module['_lv_spinbox_get_value'] = createExportWrapper('lv_spinbox_get_value');
var _lv_spinbox_get_step = Module['_lv_spinbox_get_step'] = createExportWrapper('lv_spinbox_get_step');
var _lv_spinbox_step_next = Module['_lv_spinbox_step_next'] = createExportWrapper('lv_spinbox_step_next');
var _lv_spinbox_get_rollover = Module['_lv_spinbox_get_rollover'] = createExportWrapper('lv_spinbox_get_rollover');
var _lv_anim_path_ease_in_out = Module['_lv_anim_path_ease_in_out'] = createExportWrapper('lv_anim_path_ease_in_out');
var _lv_arc_set_bg_angles = Module['_lv_arc_set_bg_angles'] = createExportWrapper('lv_arc_set_bg_angles');
var _lv_arc_set_rotation = Module['_lv_arc_set_rotation'] = createExportWrapper('lv_arc_set_rotation');
var _lv_arc_set_end_angle = Module['_lv_arc_set_end_angle'] = createExportWrapper('lv_arc_set_end_angle');
var _lv_arc_set_start_angle = Module['_lv_arc_set_start_angle'] = createExportWrapper('lv_arc_set_start_angle');
var _lv_btnmatrix_set_one_checked = Module['_lv_btnmatrix_set_one_checked'] = createExportWrapper('lv_btnmatrix_set_one_checked');
var _lv_tabview_create = Module['_lv_tabview_create'] = createExportWrapper('lv_tabview_create');
var _lv_tabview_add_tab = Module['_lv_tabview_add_tab'] = createExportWrapper('lv_tabview_add_tab');
var _lv_tabview_get_content = Module['_lv_tabview_get_content'] = createExportWrapper('lv_tabview_get_content');
var _lv_tabview_get_tab_btns = Module['_lv_tabview_get_tab_btns'] = createExportWrapper('lv_tabview_get_tab_btns');
var _lv_tabview_rename_tab = Module['_lv_tabview_rename_tab'] = createExportWrapper('lv_tabview_rename_tab');
var _lv_tabview_get_tab_act = Module['_lv_tabview_get_tab_act'] = createExportWrapper('lv_tabview_get_tab_act');
var _lv_tileview_create = Module['_lv_tileview_create'] = createExportWrapper('lv_tileview_create');
var _lv_tileview_add_tile = Module['_lv_tileview_add_tile'] = createExportWrapper('lv_tileview_add_tile');
var _lv_obj_set_tile = Module['_lv_obj_set_tile'] = createExportWrapper('lv_obj_set_tile');
var _lv_obj_set_tile_id = Module['_lv_obj_set_tile_id'] = createExportWrapper('lv_obj_set_tile_id');
var _lv_tileview_get_tile_act = Module['_lv_tileview_get_tile_act'] = createExportWrapper('lv_tileview_get_tile_act');
var _lv_win_create = Module['_lv_win_create'] = createExportWrapper('lv_win_create');
var _lv_win_add_title = Module['_lv_win_add_title'] = createExportWrapper('lv_win_add_title');
var _lv_win_get_header = Module['_lv_win_get_header'] = createExportWrapper('lv_win_get_header');
var _lv_win_add_btn = Module['_lv_win_add_btn'] = createExportWrapper('lv_win_add_btn');
var _lv_win_get_content = Module['_lv_win_get_content'] = createExportWrapper('lv_win_get_content');
var _lv_font_get_glyph_bitmap = Module['_lv_font_get_glyph_bitmap'] = createExportWrapper('lv_font_get_glyph_bitmap');
var _lv_font_get_glyph_dsc = Module['_lv_font_get_glyph_dsc'] = createExportWrapper('lv_font_get_glyph_dsc');
var _lv_font_get_bitmap_fmt_txt = Module['_lv_font_get_bitmap_fmt_txt'] = createExportWrapper('lv_font_get_bitmap_fmt_txt');
var _lv_font_get_glyph_dsc_fmt_txt = Module['_lv_font_get_glyph_dsc_fmt_txt'] = createExportWrapper('lv_font_get_glyph_dsc_fmt_txt');
var _lv_area_move = Module['_lv_area_move'] = createExportWrapper('lv_area_move');
var _lv_color_fill = Module['_lv_color_fill'] = createExportWrapper('lv_color_fill');
var _lv_timer_create = Module['_lv_timer_create'] = createExportWrapper('lv_timer_create');
var _lv_timer_ready = Module['_lv_timer_ready'] = createExportWrapper('lv_timer_ready');
var _lv_disp_drv_update = Module['_lv_disp_drv_update'] = createExportWrapper('lv_disp_drv_update');
var _lv_disp_remove = Module['_lv_disp_remove'] = createExportWrapper('lv_disp_remove');
var _lv_timer_del = Module['_lv_timer_del'] = createExportWrapper('lv_timer_del');
var _lv_disp_get_physical_hor_res = Module['_lv_disp_get_physical_hor_res'] = createExportWrapper('lv_disp_get_physical_hor_res');
var _lv_disp_get_physical_ver_res = Module['_lv_disp_get_physical_ver_res'] = createExportWrapper('lv_disp_get_physical_ver_res');
var _lv_disp_get_offset_x = Module['_lv_disp_get_offset_x'] = createExportWrapper('lv_disp_get_offset_x');
var _lv_disp_get_offset_y = Module['_lv_disp_get_offset_y'] = createExportWrapper('lv_disp_get_offset_y');
var _lv_disp_get_antialiasing = Module['_lv_disp_get_antialiasing'] = createExportWrapper('lv_disp_get_antialiasing');
var _lv_disp_flush_is_last = Module['_lv_disp_flush_is_last'] = createExportWrapper('lv_disp_flush_is_last');
var _lv_disp_set_rotation = Module['_lv_disp_set_rotation'] = createExportWrapper('lv_disp_set_rotation');
var _lv_disp_get_rotation = Module['_lv_disp_get_rotation'] = createExportWrapper('lv_disp_get_rotation');
var _lv_disp_drv_use_generic_set_px_cb = Module['_lv_disp_drv_use_generic_set_px_cb'] = createExportWrapper('lv_disp_drv_use_generic_set_px_cb');
var _lv_indev_drv_update = Module['_lv_indev_drv_update'] = createExportWrapper('lv_indev_drv_update');
var _lv_indev_delete = Module['_lv_indev_delete'] = createExportWrapper('lv_indev_delete');
var _lv_anim_get_playtime = Module['_lv_anim_get_playtime'] = createExportWrapper('lv_anim_get_playtime');
var _lv_anim_del_all = Module['_lv_anim_del_all'] = createExportWrapper('lv_anim_del_all');
var _lv_anim_get_timer = Module['_lv_anim_get_timer'] = createExportWrapper('lv_anim_get_timer');
var _lv_anim_count_running = Module['_lv_anim_count_running'] = createExportWrapper('lv_anim_count_running');
var _lv_anim_path_ease_in = Module['_lv_anim_path_ease_in'] = createExportWrapper('lv_anim_path_ease_in');
var _lv_bezier3 = Module['_lv_bezier3'] = createExportWrapper('lv_bezier3');
var _lv_anim_path_overshoot = Module['_lv_anim_path_overshoot'] = createExportWrapper('lv_anim_path_overshoot');
var _lv_anim_path_bounce = Module['_lv_anim_path_bounce'] = createExportWrapper('lv_anim_path_bounce');
var _lv_anim_path_step = Module['_lv_anim_path_step'] = createExportWrapper('lv_anim_path_step');
var _lv_anim_timeline_create = Module['_lv_anim_timeline_create'] = createExportWrapper('lv_anim_timeline_create');
var _lv_anim_timeline_del = Module['_lv_anim_timeline_del'] = createExportWrapper('lv_anim_timeline_del');
var _lv_anim_timeline_stop = Module['_lv_anim_timeline_stop'] = createExportWrapper('lv_anim_timeline_stop');
var _lv_anim_timeline_add = Module['_lv_anim_timeline_add'] = createExportWrapper('lv_anim_timeline_add');
var _lv_anim_timeline_start = Module['_lv_anim_timeline_start'] = createExportWrapper('lv_anim_timeline_start');
var _lv_anim_timeline_get_playtime = Module['_lv_anim_timeline_get_playtime'] = createExportWrapper('lv_anim_timeline_get_playtime');
var _lv_anim_timeline_set_reverse = Module['_lv_anim_timeline_set_reverse'] = createExportWrapper('lv_anim_timeline_set_reverse');
var _lv_anim_timeline_set_progress = Module['_lv_anim_timeline_set_progress'] = createExportWrapper('lv_anim_timeline_set_progress');
var _lv_anim_timeline_get_reverse = Module['_lv_anim_timeline_get_reverse'] = createExportWrapper('lv_anim_timeline_get_reverse');
var _lv_area_align = Module['_lv_area_align'] = createExportWrapper('lv_area_align');
var _lv_timer_set_repeat_count = Module['_lv_timer_set_repeat_count'] = createExportWrapper('lv_timer_set_repeat_count');
var _lv_async_call_cancel = Module['_lv_async_call_cancel'] = createExportWrapper('lv_async_call_cancel');
var _lv_timer_get_next = Module['_lv_timer_get_next'] = createExportWrapper('lv_timer_get_next');
var _lv_color_lighten = Module['_lv_color_lighten'] = createExportWrapper('lv_color_lighten');
var _lv_color_change_lightness = Module['_lv_color_change_lightness'] = createExportWrapper('lv_color_change_lightness');
var _lv_color_to_hsv = Module['_lv_color_to_hsv'] = createExportWrapper('lv_color_to_hsv');
var _lv_fs_is_ready = Module['_lv_fs_is_ready'] = createExportWrapper('lv_fs_is_ready');
var _lv_fs_get_drv = Module['_lv_fs_get_drv'] = createExportWrapper('lv_fs_get_drv');
var _lv_fs_dir_open = Module['_lv_fs_dir_open'] = createExportWrapper('lv_fs_dir_open');
var _lv_fs_dir_read = Module['_lv_fs_dir_read'] = createExportWrapper('lv_fs_dir_read');
var _lv_fs_dir_close = Module['_lv_fs_dir_close'] = createExportWrapper('lv_fs_dir_close');
var _lv_fs_get_letters = Module['_lv_fs_get_letters'] = createExportWrapper('lv_fs_get_letters');
var _lv_fs_up = Module['_lv_fs_up'] = createExportWrapper('lv_fs_up');
var _lv_fs_get_last = Module['_lv_fs_get_last'] = createExportWrapper('lv_fs_get_last');
var _lv_log = Module['_lv_log'] = createExportWrapper('lv_log');
var _lv_lru_create = Module['_lv_lru_create'] = createExportWrapper('lv_lru_create');
var _lv_lru_del = Module['_lv_lru_del'] = createExportWrapper('lv_lru_del');
var _lv_lru_set = Module['_lv_lru_set'] = createExportWrapper('lv_lru_set');
var _lv_lru_remove_lru_item = Module['_lv_lru_remove_lru_item'] = createExportWrapper('lv_lru_remove_lru_item');
var _lv_lru_get = Module['_lv_lru_get'] = createExportWrapper('lv_lru_get');
var _lv_lru_remove = Module['_lv_lru_remove'] = createExportWrapper('lv_lru_remove');
var _lv_sqrt = Module['_lv_sqrt'] = createExportWrapper('lv_sqrt');
var _lv_rand = Module['_lv_rand'] = createExportWrapper('lv_rand');
var _lv_tlsf_create_with_pool = Module['_lv_tlsf_create_with_pool'] = createExportWrapper('lv_tlsf_create_with_pool');
var _lv_tlsf_destroy = Module['_lv_tlsf_destroy'] = createExportWrapper('lv_tlsf_destroy');
var _lv_tlsf_malloc = Module['_lv_tlsf_malloc'] = createExportWrapper('lv_tlsf_malloc');
var _lv_tlsf_free = Module['_lv_tlsf_free'] = createExportWrapper('lv_tlsf_free');
var _lv_tlsf_realloc = Module['_lv_tlsf_realloc'] = createExportWrapper('lv_tlsf_realloc');
var _lv_mem_test = Module['_lv_mem_test'] = createExportWrapper('lv_mem_test');
var _lv_tlsf_check = Module['_lv_tlsf_check'] = createExportWrapper('lv_tlsf_check');
var _lv_tlsf_get_pool = Module['_lv_tlsf_get_pool'] = createExportWrapper('lv_tlsf_get_pool');
var _lv_tlsf_check_pool = Module['_lv_tlsf_check_pool'] = createExportWrapper('lv_tlsf_check_pool');
var _lv_mem_monitor = Module['_lv_mem_monitor'] = createExportWrapper('lv_mem_monitor');
var _lv_tlsf_walk_pool = Module['_lv_tlsf_walk_pool'] = createExportWrapper('lv_tlsf_walk_pool');
var _lv_vsnprintf = Module['_lv_vsnprintf'] = createExportWrapper('lv_vsnprintf');
var _lv_style_get_num_custom_props = Module['_lv_style_get_num_custom_props'] = createExportWrapper('lv_style_get_num_custom_props');
var _lv_style_set_min_width = Module['_lv_style_set_min_width'] = createExportWrapper('lv_style_set_min_width');
var _lv_style_set_min_height = Module['_lv_style_set_min_height'] = createExportWrapper('lv_style_set_min_height');
var _lv_style_set_x = Module['_lv_style_set_x'] = createExportWrapper('lv_style_set_x');
var _lv_style_set_y = Module['_lv_style_set_y'] = createExportWrapper('lv_style_set_y');
var _lv_style_set_align = Module['_lv_style_set_align'] = createExportWrapper('lv_style_set_align');
var _lv_style_set_translate_x = Module['_lv_style_set_translate_x'] = createExportWrapper('lv_style_set_translate_x');
var _lv_style_set_translate_y = Module['_lv_style_set_translate_y'] = createExportWrapper('lv_style_set_translate_y');
var _lv_style_set_transform_zoom = Module['_lv_style_set_transform_zoom'] = createExportWrapper('lv_style_set_transform_zoom');
var _lv_style_set_transform_angle = Module['_lv_style_set_transform_angle'] = createExportWrapper('lv_style_set_transform_angle');
var _lv_style_set_transform_pivot_x = Module['_lv_style_set_transform_pivot_x'] = createExportWrapper('lv_style_set_transform_pivot_x');
var _lv_style_set_transform_pivot_y = Module['_lv_style_set_transform_pivot_y'] = createExportWrapper('lv_style_set_transform_pivot_y');
var _lv_style_set_bg_grad_dir = Module['_lv_style_set_bg_grad_dir'] = createExportWrapper('lv_style_set_bg_grad_dir');
var _lv_style_set_bg_main_stop = Module['_lv_style_set_bg_main_stop'] = createExportWrapper('lv_style_set_bg_main_stop');
var _lv_style_set_bg_grad_stop = Module['_lv_style_set_bg_grad_stop'] = createExportWrapper('lv_style_set_bg_grad_stop');
var _lv_style_set_bg_grad = Module['_lv_style_set_bg_grad'] = createExportWrapper('lv_style_set_bg_grad');
var _lv_style_set_bg_dither_mode = Module['_lv_style_set_bg_dither_mode'] = createExportWrapper('lv_style_set_bg_dither_mode');
var _lv_style_set_bg_img_opa = Module['_lv_style_set_bg_img_opa'] = createExportWrapper('lv_style_set_bg_img_opa');
var _lv_style_set_bg_img_recolor = Module['_lv_style_set_bg_img_recolor'] = createExportWrapper('lv_style_set_bg_img_recolor');
var _lv_style_set_bg_img_recolor_opa = Module['_lv_style_set_bg_img_recolor_opa'] = createExportWrapper('lv_style_set_bg_img_recolor_opa');
var _lv_style_set_bg_img_tiled = Module['_lv_style_set_bg_img_tiled'] = createExportWrapper('lv_style_set_bg_img_tiled');
var _lv_style_set_shadow_ofs_x = Module['_lv_style_set_shadow_ofs_x'] = createExportWrapper('lv_style_set_shadow_ofs_x');
var _lv_style_set_img_opa = Module['_lv_style_set_img_opa'] = createExportWrapper('lv_style_set_img_opa');
var _lv_style_set_img_recolor = Module['_lv_style_set_img_recolor'] = createExportWrapper('lv_style_set_img_recolor');
var _lv_style_set_img_recolor_opa = Module['_lv_style_set_img_recolor_opa'] = createExportWrapper('lv_style_set_img_recolor_opa');
var _lv_style_set_line_dash_width = Module['_lv_style_set_line_dash_width'] = createExportWrapper('lv_style_set_line_dash_width');
var _lv_style_set_line_dash_gap = Module['_lv_style_set_line_dash_gap'] = createExportWrapper('lv_style_set_line_dash_gap');
var _lv_style_set_line_rounded = Module['_lv_style_set_line_rounded'] = createExportWrapper('lv_style_set_line_rounded');
var _lv_style_set_line_opa = Module['_lv_style_set_line_opa'] = createExportWrapper('lv_style_set_line_opa');
var _lv_style_set_arc_opa = Module['_lv_style_set_arc_opa'] = createExportWrapper('lv_style_set_arc_opa');
var _lv_style_set_arc_img_src = Module['_lv_style_set_arc_img_src'] = createExportWrapper('lv_style_set_arc_img_src');
var _lv_style_set_text_opa = Module['_lv_style_set_text_opa'] = createExportWrapper('lv_style_set_text_opa');
var _lv_style_set_text_letter_space = Module['_lv_style_set_text_letter_space'] = createExportWrapper('lv_style_set_text_letter_space');
var _lv_style_set_text_decor = Module['_lv_style_set_text_decor'] = createExportWrapper('lv_style_set_text_decor');
var _lv_style_set_opa = Module['_lv_style_set_opa'] = createExportWrapper('lv_style_set_opa');
var _lv_style_set_opa_layered = Module['_lv_style_set_opa_layered'] = createExportWrapper('lv_style_set_opa_layered');
var _lv_style_set_anim = Module['_lv_style_set_anim'] = createExportWrapper('lv_style_set_anim');
var _lv_style_set_anim_speed = Module['_lv_style_set_anim_speed'] = createExportWrapper('lv_style_set_anim_speed');
var _lv_style_set_blend_mode = Module['_lv_style_set_blend_mode'] = createExportWrapper('lv_style_set_blend_mode');
var _lv_style_set_layout = Module['_lv_style_set_layout'] = createExportWrapper('lv_style_set_layout');
var _lv_style_set_base_dir = Module['_lv_style_set_base_dir'] = createExportWrapper('lv_style_set_base_dir');
var _lv_timer_enable = Module['_lv_timer_enable'] = createExportWrapper('lv_timer_enable');
var _lv_timer_create_basic = Module['_lv_timer_create_basic'] = createExportWrapper('lv_timer_create_basic');
var _lv_timer_set_cb = Module['_lv_timer_set_cb'] = createExportWrapper('lv_timer_set_cb');
var _lv_timer_set_period = Module['_lv_timer_set_period'] = createExportWrapper('lv_timer_set_period');
var _lv_timer_reset = Module['_lv_timer_reset'] = createExportWrapper('lv_timer_reset');
var _lv_timer_get_idle = Module['_lv_timer_get_idle'] = createExportWrapper('lv_timer_get_idle');
var _lv_tlsf_block_size = Module['_lv_tlsf_block_size'] = createExportWrapper('lv_tlsf_block_size');
var _lv_tlsf_size = Module['_lv_tlsf_size'] = createExportWrapper('lv_tlsf_size');
var _lv_tlsf_align_size = Module['_lv_tlsf_align_size'] = createExportWrapper('lv_tlsf_align_size');
var _lv_tlsf_block_size_min = Module['_lv_tlsf_block_size_min'] = createExportWrapper('lv_tlsf_block_size_min');
var _lv_tlsf_block_size_max = Module['_lv_tlsf_block_size_max'] = createExportWrapper('lv_tlsf_block_size_max');
var _lv_tlsf_pool_overhead = Module['_lv_tlsf_pool_overhead'] = createExportWrapper('lv_tlsf_pool_overhead');
var _lv_tlsf_alloc_overhead = Module['_lv_tlsf_alloc_overhead'] = createExportWrapper('lv_tlsf_alloc_overhead');
var _lv_tlsf_add_pool = Module['_lv_tlsf_add_pool'] = createExportWrapper('lv_tlsf_add_pool');
var _lv_tlsf_remove_pool = Module['_lv_tlsf_remove_pool'] = createExportWrapper('lv_tlsf_remove_pool');
var _lv_tlsf_create = Module['_lv_tlsf_create'] = createExportWrapper('lv_tlsf_create');
var _lv_tlsf_memalign = Module['_lv_tlsf_memalign'] = createExportWrapper('lv_tlsf_memalign');
var _lv_arc_set_value = Module['_lv_arc_set_value'] = createExportWrapper('lv_arc_set_value');
var _lv_arc_set_angles = Module['_lv_arc_set_angles'] = createExportWrapper('lv_arc_set_angles');
var _lv_arc_set_bg_start_angle = Module['_lv_arc_set_bg_start_angle'] = createExportWrapper('lv_arc_set_bg_start_angle');
var _lv_arc_set_bg_end_angle = Module['_lv_arc_set_bg_end_angle'] = createExportWrapper('lv_arc_set_bg_end_angle');
var _lv_arc_set_mode = Module['_lv_arc_set_mode'] = createExportWrapper('lv_arc_set_mode');
var _lv_arc_set_range = Module['_lv_arc_set_range'] = createExportWrapper('lv_arc_set_range');
var _lv_arc_set_change_rate = Module['_lv_arc_set_change_rate'] = createExportWrapper('lv_arc_set_change_rate');
var _lv_arc_get_angle_start = Module['_lv_arc_get_angle_start'] = createExportWrapper('lv_arc_get_angle_start');
var _lv_arc_get_angle_end = Module['_lv_arc_get_angle_end'] = createExportWrapper('lv_arc_get_angle_end');
var _lv_arc_get_bg_angle_start = Module['_lv_arc_get_bg_angle_start'] = createExportWrapper('lv_arc_get_bg_angle_start');
var _lv_arc_get_bg_angle_end = Module['_lv_arc_get_bg_angle_end'] = createExportWrapper('lv_arc_get_bg_angle_end');
var _lv_arc_get_value = Module['_lv_arc_get_value'] = createExportWrapper('lv_arc_get_value');
var _lv_arc_get_min_value = Module['_lv_arc_get_min_value'] = createExportWrapper('lv_arc_get_min_value');
var _lv_arc_get_max_value = Module['_lv_arc_get_max_value'] = createExportWrapper('lv_arc_get_max_value');
var _lv_arc_get_mode = Module['_lv_arc_get_mode'] = createExportWrapper('lv_arc_get_mode');
var _lv_arc_align_obj_to_angle = Module['_lv_arc_align_obj_to_angle'] = createExportWrapper('lv_arc_align_obj_to_angle');
var _lv_arc_rotate_obj_to_angle = Module['_lv_arc_rotate_obj_to_angle'] = createExportWrapper('lv_arc_rotate_obj_to_angle');
var _lv_bar_get_mode = Module['_lv_bar_get_mode'] = createExportWrapper('lv_bar_get_mode');
var _lv_bar_get_min_value = Module['_lv_bar_get_min_value'] = createExportWrapper('lv_bar_get_min_value');
var _lv_bar_get_max_value = Module['_lv_bar_get_max_value'] = createExportWrapper('lv_bar_get_max_value');
var _lv_btnmatrix_clear_btn_ctrl = Module['_lv_btnmatrix_clear_btn_ctrl'] = createExportWrapper('lv_btnmatrix_clear_btn_ctrl');
var _lv_btnmatrix_set_btn_width = Module['_lv_btnmatrix_set_btn_width'] = createExportWrapper('lv_btnmatrix_set_btn_width');
var _lv_btnmatrix_get_map = Module['_lv_btnmatrix_get_map'] = createExportWrapper('lv_btnmatrix_get_map');
var _lv_btnmatrix_get_one_checked = Module['_lv_btnmatrix_get_one_checked'] = createExportWrapper('lv_btnmatrix_get_one_checked');
var _lv_canvas_create = Module['_lv_canvas_create'] = createExportWrapper('lv_canvas_create');
var _lv_canvas_set_buffer = Module['_lv_canvas_set_buffer'] = createExportWrapper('lv_canvas_set_buffer');
var _lv_canvas_set_px_color = Module['_lv_canvas_set_px_color'] = createExportWrapper('lv_canvas_set_px_color');
var _lv_canvas_set_px_opa = Module['_lv_canvas_set_px_opa'] = createExportWrapper('lv_canvas_set_px_opa');
var _lv_canvas_set_palette = Module['_lv_canvas_set_palette'] = createExportWrapper('lv_canvas_set_palette');
var _lv_canvas_get_px = Module['_lv_canvas_get_px'] = createExportWrapper('lv_canvas_get_px');
var _lv_canvas_get_img = Module['_lv_canvas_get_img'] = createExportWrapper('lv_canvas_get_img');
var _lv_canvas_copy_buf = Module['_lv_canvas_copy_buf'] = createExportWrapper('lv_canvas_copy_buf');
var _lv_canvas_transform = Module['_lv_canvas_transform'] = createExportWrapper('lv_canvas_transform');
var _lv_canvas_blur_hor = Module['_lv_canvas_blur_hor'] = createExportWrapper('lv_canvas_blur_hor');
var _lv_canvas_blur_ver = Module['_lv_canvas_blur_ver'] = createExportWrapper('lv_canvas_blur_ver');
var _lv_canvas_fill_bg = Module['_lv_canvas_fill_bg'] = createExportWrapper('lv_canvas_fill_bg');
var _lv_canvas_draw_rect = Module['_lv_canvas_draw_rect'] = createExportWrapper('lv_canvas_draw_rect');
var _lv_canvas_draw_text = Module['_lv_canvas_draw_text'] = createExportWrapper('lv_canvas_draw_text');
var _lv_canvas_draw_img = Module['_lv_canvas_draw_img'] = createExportWrapper('lv_canvas_draw_img');
var _lv_canvas_draw_line = Module['_lv_canvas_draw_line'] = createExportWrapper('lv_canvas_draw_line');
var _lv_canvas_draw_polygon = Module['_lv_canvas_draw_polygon'] = createExportWrapper('lv_canvas_draw_polygon');
var _lv_canvas_draw_arc = Module['_lv_canvas_draw_arc'] = createExportWrapper('lv_canvas_draw_arc');
var _lv_checkbox_set_text = Module['_lv_checkbox_set_text'] = createExportWrapper('lv_checkbox_set_text');
var _lv_checkbox_set_text_static = Module['_lv_checkbox_set_text_static'] = createExportWrapper('lv_checkbox_set_text_static');
var _lv_checkbox_get_text = Module['_lv_checkbox_get_text'] = createExportWrapper('lv_checkbox_get_text');
var _lv_dropdown_set_options_static = Module['_lv_dropdown_set_options_static'] = createExportWrapper('lv_dropdown_set_options_static');
var _lv_dropdown_open = Module['_lv_dropdown_open'] = createExportWrapper('lv_dropdown_open');
var _lv_dropdown_close = Module['_lv_dropdown_close'] = createExportWrapper('lv_dropdown_close');
var _lv_dropdown_set_text = Module['_lv_dropdown_set_text'] = createExportWrapper('lv_dropdown_set_text');
var _lv_dropdown_add_option = Module['_lv_dropdown_add_option'] = createExportWrapper('lv_dropdown_add_option');
var _lv_dropdown_set_dir = Module['_lv_dropdown_set_dir'] = createExportWrapper('lv_dropdown_set_dir');
var _lv_dropdown_set_symbol = Module['_lv_dropdown_set_symbol'] = createExportWrapper('lv_dropdown_set_symbol');
var _lv_dropdown_set_selected_highlight = Module['_lv_dropdown_set_selected_highlight'] = createExportWrapper('lv_dropdown_set_selected_highlight');
var _lv_dropdown_get_list = Module['_lv_dropdown_get_list'] = createExportWrapper('lv_dropdown_get_list');
var _lv_dropdown_get_text = Module['_lv_dropdown_get_text'] = createExportWrapper('lv_dropdown_get_text');
var _lv_dropdown_get_option_cnt = Module['_lv_dropdown_get_option_cnt'] = createExportWrapper('lv_dropdown_get_option_cnt');
var _lv_dropdown_get_selected_str = Module['_lv_dropdown_get_selected_str'] = createExportWrapper('lv_dropdown_get_selected_str');
var _lv_dropdown_get_option_index = Module['_lv_dropdown_get_option_index'] = createExportWrapper('lv_dropdown_get_option_index');
var _lv_dropdown_get_symbol = Module['_lv_dropdown_get_symbol'] = createExportWrapper('lv_dropdown_get_symbol');
var _lv_dropdown_get_selected_highlight = Module['_lv_dropdown_get_selected_highlight'] = createExportWrapper('lv_dropdown_get_selected_highlight');
var _lv_dropdown_get_dir = Module['_lv_dropdown_get_dir'] = createExportWrapper('lv_dropdown_get_dir');
var _lv_label_set_text_static = Module['_lv_label_set_text_static'] = createExportWrapper('lv_label_set_text_static');
var _lv_dropdown_is_open = Module['_lv_dropdown_is_open'] = createExportWrapper('lv_dropdown_is_open');
var _lv_img_set_offset_x = Module['_lv_img_set_offset_x'] = createExportWrapper('lv_img_set_offset_x');
var _lv_img_set_offset_y = Module['_lv_img_set_offset_y'] = createExportWrapper('lv_img_set_offset_y');
var _lv_img_set_angle = Module['_lv_img_set_angle'] = createExportWrapper('lv_img_set_angle');
var _lv_img_set_pivot = Module['_lv_img_set_pivot'] = createExportWrapper('lv_img_set_pivot');
var _lv_img_set_zoom = Module['_lv_img_set_zoom'] = createExportWrapper('lv_img_set_zoom');
var _lv_img_set_antialias = Module['_lv_img_set_antialias'] = createExportWrapper('lv_img_set_antialias');
var _lv_img_set_size_mode = Module['_lv_img_set_size_mode'] = createExportWrapper('lv_img_set_size_mode');
var _lv_img_get_src = Module['_lv_img_get_src'] = createExportWrapper('lv_img_get_src');
var _lv_img_get_offset_x = Module['_lv_img_get_offset_x'] = createExportWrapper('lv_img_get_offset_x');
var _lv_img_get_offset_y = Module['_lv_img_get_offset_y'] = createExportWrapper('lv_img_get_offset_y');
var _lv_img_get_angle = Module['_lv_img_get_angle'] = createExportWrapper('lv_img_get_angle');
var _lv_img_get_pivot = Module['_lv_img_get_pivot'] = createExportWrapper('lv_img_get_pivot');
var _lv_img_get_zoom = Module['_lv_img_get_zoom'] = createExportWrapper('lv_img_get_zoom');
var _lv_img_get_antialias = Module['_lv_img_get_antialias'] = createExportWrapper('lv_img_get_antialias');
var _lv_img_get_size_mode = Module['_lv_img_get_size_mode'] = createExportWrapper('lv_img_get_size_mode');
var _lv_label_get_letter_on = Module['_lv_label_get_letter_on'] = createExportWrapper('lv_label_get_letter_on');
var _lv_label_set_recolor = Module['_lv_label_set_recolor'] = createExportWrapper('lv_label_set_recolor');
var _lv_label_set_text_sel_start = Module['_lv_label_set_text_sel_start'] = createExportWrapper('lv_label_set_text_sel_start');
var _lv_label_set_text_sel_end = Module['_lv_label_set_text_sel_end'] = createExportWrapper('lv_label_set_text_sel_end');
var _lv_label_get_long_mode = Module['_lv_label_get_long_mode'] = createExportWrapper('lv_label_get_long_mode');
var _lv_label_get_recolor = Module['_lv_label_get_recolor'] = createExportWrapper('lv_label_get_recolor');
var _lv_label_get_letter_pos = Module['_lv_label_get_letter_pos'] = createExportWrapper('lv_label_get_letter_pos');
var _lv_label_is_char_under_pos = Module['_lv_label_is_char_under_pos'] = createExportWrapper('lv_label_is_char_under_pos');
var _lv_label_get_text_selection_start = Module['_lv_label_get_text_selection_start'] = createExportWrapper('lv_label_get_text_selection_start');
var _lv_label_get_text_selection_end = Module['_lv_label_get_text_selection_end'] = createExportWrapper('lv_label_get_text_selection_end');
var _lv_label_ins_text = Module['_lv_label_ins_text'] = createExportWrapper('lv_label_ins_text');
var _lv_label_cut_text = Module['_lv_label_cut_text'] = createExportWrapper('lv_label_cut_text');
var _lv_line_create = Module['_lv_line_create'] = createExportWrapper('lv_line_create');
var _lv_line_set_y_invert = Module['_lv_line_set_y_invert'] = createExportWrapper('lv_line_set_y_invert');
var _lv_line_get_y_invert = Module['_lv_line_get_y_invert'] = createExportWrapper('lv_line_get_y_invert');
var _lv_roller_set_options = Module['_lv_roller_set_options'] = createExportWrapper('lv_roller_set_options');
var _lv_roller_set_selected = Module['_lv_roller_set_selected'] = createExportWrapper('lv_roller_set_selected');
var _lv_roller_set_visible_row_count = Module['_lv_roller_set_visible_row_count'] = createExportWrapper('lv_roller_set_visible_row_count');
var _lv_roller_get_selected = Module['_lv_roller_get_selected'] = createExportWrapper('lv_roller_get_selected');
var _lv_roller_get_selected_str = Module['_lv_roller_get_selected_str'] = createExportWrapper('lv_roller_get_selected_str');
var _lv_roller_get_options = Module['_lv_roller_get_options'] = createExportWrapper('lv_roller_get_options');
var _lv_roller_get_option_cnt = Module['_lv_roller_get_option_cnt'] = createExportWrapper('lv_roller_get_option_cnt');
var _lv_slider_is_dragged = Module['_lv_slider_is_dragged'] = createExportWrapper('lv_slider_is_dragged');
var _lv_table_create = Module['_lv_table_create'] = createExportWrapper('lv_table_create');
var _lv_table_set_cell_value = Module['_lv_table_set_cell_value'] = createExportWrapper('lv_table_set_cell_value');
var _lv_table_set_col_cnt = Module['_lv_table_set_col_cnt'] = createExportWrapper('lv_table_set_col_cnt');
var _lv_table_set_row_cnt = Module['_lv_table_set_row_cnt'] = createExportWrapper('lv_table_set_row_cnt');
var _lv_table_set_cell_value_fmt = Module['_lv_table_set_cell_value_fmt'] = createExportWrapper('lv_table_set_cell_value_fmt');
var _lv_table_set_col_width = Module['_lv_table_set_col_width'] = createExportWrapper('lv_table_set_col_width');
var _lv_table_add_cell_ctrl = Module['_lv_table_add_cell_ctrl'] = createExportWrapper('lv_table_add_cell_ctrl');
var _lv_table_clear_cell_ctrl = Module['_lv_table_clear_cell_ctrl'] = createExportWrapper('lv_table_clear_cell_ctrl');
var _lv_table_set_cell_user_data = Module['_lv_table_set_cell_user_data'] = createExportWrapper('lv_table_set_cell_user_data');
var _lv_table_get_cell_value = Module['_lv_table_get_cell_value'] = createExportWrapper('lv_table_get_cell_value');
var _lv_table_get_row_cnt = Module['_lv_table_get_row_cnt'] = createExportWrapper('lv_table_get_row_cnt');
var _lv_table_get_col_cnt = Module['_lv_table_get_col_cnt'] = createExportWrapper('lv_table_get_col_cnt');
var _lv_table_get_col_width = Module['_lv_table_get_col_width'] = createExportWrapper('lv_table_get_col_width');
var _lv_table_has_cell_ctrl = Module['_lv_table_has_cell_ctrl'] = createExportWrapper('lv_table_has_cell_ctrl');
var _lv_table_get_selected_cell = Module['_lv_table_get_selected_cell'] = createExportWrapper('lv_table_get_selected_cell');
var _lv_table_get_cell_user_data = Module['_lv_table_get_cell_user_data'] = createExportWrapper('lv_table_get_cell_user_data');
var _lv_textarea_cursor_up = Module['_lv_textarea_cursor_up'] = createExportWrapper('lv_textarea_cursor_up');
var _lv_textarea_cursor_down = Module['_lv_textarea_cursor_down'] = createExportWrapper('lv_textarea_cursor_down');
var _lv_textarea_del_char_forward = Module['_lv_textarea_del_char_forward'] = createExportWrapper('lv_textarea_del_char_forward');
var _lv_textarea_clear_selection = Module['_lv_textarea_clear_selection'] = createExportWrapper('lv_textarea_clear_selection');
var _lv_textarea_get_accepted_chars = Module['_lv_textarea_get_accepted_chars'] = createExportWrapper('lv_textarea_get_accepted_chars');
var _lv_textarea_get_max_length = Module['_lv_textarea_get_max_length'] = createExportWrapper('lv_textarea_get_max_length');
var _lv_textarea_set_placeholder_text = Module['_lv_textarea_set_placeholder_text'] = createExportWrapper('lv_textarea_set_placeholder_text');
var _lv_textarea_set_password_mode = Module['_lv_textarea_set_password_mode'] = createExportWrapper('lv_textarea_set_password_mode');
var _lv_textarea_set_password_bullet = Module['_lv_textarea_set_password_bullet'] = createExportWrapper('lv_textarea_set_password_bullet');
var _lv_textarea_set_accepted_chars = Module['_lv_textarea_set_accepted_chars'] = createExportWrapper('lv_textarea_set_accepted_chars');
var _lv_textarea_set_max_length = Module['_lv_textarea_set_max_length'] = createExportWrapper('lv_textarea_set_max_length');
var _lv_textarea_set_insert_replace = Module['_lv_textarea_set_insert_replace'] = createExportWrapper('lv_textarea_set_insert_replace');
var _lv_textarea_set_text_selection = Module['_lv_textarea_set_text_selection'] = createExportWrapper('lv_textarea_set_text_selection');
var _lv_textarea_set_password_show_time = Module['_lv_textarea_set_password_show_time'] = createExportWrapper('lv_textarea_set_password_show_time');
var _lv_textarea_set_align = Module['_lv_textarea_set_align'] = createExportWrapper('lv_textarea_set_align');
var _lv_textarea_get_label = Module['_lv_textarea_get_label'] = createExportWrapper('lv_textarea_get_label');
var _lv_textarea_get_placeholder_text = Module['_lv_textarea_get_placeholder_text'] = createExportWrapper('lv_textarea_get_placeholder_text');
var _lv_textarea_get_cursor_click_pos = Module['_lv_textarea_get_cursor_click_pos'] = createExportWrapper('lv_textarea_get_cursor_click_pos');
var _lv_textarea_get_password_mode = Module['_lv_textarea_get_password_mode'] = createExportWrapper('lv_textarea_get_password_mode');
var _lv_textarea_get_password_bullet = Module['_lv_textarea_get_password_bullet'] = createExportWrapper('lv_textarea_get_password_bullet');
var _lv_textarea_text_is_selected = Module['_lv_textarea_text_is_selected'] = createExportWrapper('lv_textarea_text_is_selected');
var _lv_textarea_get_text_selection = Module['_lv_textarea_get_text_selection'] = createExportWrapper('lv_textarea_get_text_selection');
var _lv_textarea_get_password_show_time = Module['_lv_textarea_get_password_show_time'] = createExportWrapper('lv_textarea_get_password_show_time');
var _onMqttEvent = Module['_onMqttEvent'] = createExportWrapper('onMqttEvent');
var __evalIntegerProperty = Module['__evalIntegerProperty'] = createExportWrapper('_evalIntegerProperty');
var __evalUnsignedIntegerProperty = Module['__evalUnsignedIntegerProperty'] = createExportWrapper('_evalUnsignedIntegerProperty');
var __evalStringArrayPropertyAndJoin = Module['__evalStringArrayPropertyAndJoin'] = createExportWrapper('_evalStringArrayPropertyAndJoin');
var __assignStringProperty = Module['__assignStringProperty'] = createExportWrapper('_assignStringProperty');
var __assignIntegerProperty = Module['__assignIntegerProperty'] = createExportWrapper('_assignIntegerProperty');
var _compareRollerOptions = Module['_compareRollerOptions'] = createExportWrapper('compareRollerOptions');
var _free = Module['_free'] = createExportWrapper('free');
var ___errno_location = createExportWrapper('__errno_location');
var _fflush = Module['_fflush'] = createExportWrapper('fflush');
var _emscripten_stack_init = () => (_emscripten_stack_init = wasmExports['emscripten_stack_init'])();
var _emscripten_stack_get_free = () => (_emscripten_stack_get_free = wasmExports['emscripten_stack_get_free'])();
var _emscripten_stack_get_base = () => (_emscripten_stack_get_base = wasmExports['emscripten_stack_get_base'])();
var _emscripten_stack_get_end = () => (_emscripten_stack_get_end = wasmExports['emscripten_stack_get_end'])();
var stackSave = createExportWrapper('stackSave');
var stackRestore = createExportWrapper('stackRestore');
var stackAlloc = createExportWrapper('stackAlloc');
var _emscripten_stack_get_current = () => (_emscripten_stack_get_current = wasmExports['emscripten_stack_get_current'])();
var ___cxa_demangle = createExportWrapper('__cxa_demangle');
var ___cxa_is_pointer_type = createExportWrapper('__cxa_is_pointer_type');
var dynCall_jiji = Module['dynCall_jiji'] = createExportWrapper('dynCall_jiji');


// include: postamble.js
// === Auto-generated postamble setup entry stuff ===

Module['UTF8ToString'] = UTF8ToString;
Module['AsciiToString'] = AsciiToString;
Module['allocateUTF8'] = allocateUTF8;
var missingLibrarySymbols = [
  'writeI53ToI64',
  'writeI53ToI64Clamped',
  'writeI53ToI64Signaling',
  'writeI53ToU64Clamped',
  'writeI53ToU64Signaling',
  'readI53FromI64',
  'readI53FromU64',
  'convertI32PairToI53',
  'convertU32PairToI53',
  'isLeapYear',
  'ydayFromDate',
  'arraySum',
  'addDays',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'getHostByName',
  'getCallstack',
  'emscriptenLog',
  'convertPCtoSourceLocation',
  'runMainThreadEmAsm',
  'jstoi_q',
  'jstoi_s',
  'getExecutableName',
  'listenOnce',
  'autoResumeAudioContext',
  'dynCallLegacy',
  'getDynCaller',
  'dynCall',
  'handleException',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'callUserCallback',
  'maybeExit',
  'asmjsMangle',
  'handleAllocatorInit',
  'HandleAllocator',
  'getNativeTypeSize',
  'STACK_SIZE',
  'STACK_ALIGN',
  'POINTER_SIZE',
  'ASSERTIONS',
  'getCFunc',
  'ccall',
  'cwrap',
  'uleb128Encode',
  'sigToWasmTypes',
  'generateFuncType',
  'convertJsFunctionToWasm',
  'getEmptyTableSlot',
  'updateTableMap',
  'getFunctionAddress',
  'addFunction',
  'removeFunction',
  'reallyNegative',
  'unSign',
  'strLen',
  'reSign',
  'formatString',
  'intArrayToString',
  'stringToAscii',
  'UTF16ToString',
  'stringToUTF16',
  'lengthBytesUTF16',
  'UTF32ToString',
  'stringToUTF32',
  'lengthBytesUTF32',
  'writeArrayToMemory',
  'registerKeyEventCallback',
  'findEventTarget',
  'findCanvasEventTarget',
  'getBoundingClientRect',
  'fillMouseEventData',
  'registerMouseEventCallback',
  'registerWheelEventCallback',
  'registerUiEventCallback',
  'registerFocusEventCallback',
  'fillDeviceOrientationEventData',
  'registerDeviceOrientationEventCallback',
  'fillDeviceMotionEventData',
  'registerDeviceMotionEventCallback',
  'screenOrientation',
  'fillOrientationChangeEventData',
  'registerOrientationChangeEventCallback',
  'fillFullscreenChangeEventData',
  'registerFullscreenChangeEventCallback',
  'JSEvents_requestFullscreen',
  'JSEvents_resizeCanvasForFullscreen',
  'registerRestoreOldStyle',
  'hideEverythingExceptGivenElement',
  'restoreHiddenElements',
  'setLetterbox',
  'softFullscreenResizeWebGLRenderTarget',
  'doRequestFullscreen',
  'fillPointerlockChangeEventData',
  'registerPointerlockChangeEventCallback',
  'registerPointerlockErrorEventCallback',
  'requestPointerLock',
  'fillVisibilityChangeEventData',
  'registerVisibilityChangeEventCallback',
  'registerTouchEventCallback',
  'fillGamepadEventData',
  'registerGamepadEventCallback',
  'registerBeforeUnloadEventCallback',
  'fillBatteryEventData',
  'battery',
  'registerBatteryEventCallback',
  'setCanvasElementSize',
  'getCanvasElementSize',
  'getEnvStrings',
  'checkWasiClock',
  'wasiRightsToMuslOFlags',
  'wasiOFlagsToMuslOFlags',
  'createDyncallWrapper',
  'safeSetTimeout',
  'setImmediateWrapped',
  'clearImmediateWrapped',
  'polyfillSetImmediate',
  'getPromise',
  'makePromise',
  'idsToPromises',
  'makePromiseCallback',
  'findMatchingCatch',
  'setMainLoop',
  'getSocketFromFD',
  'getSocketAddress',
  'FS_unlink',
  'FS_mkdirTree',
  '_setNetworkCallback',
  'heapObjectForWebGLType',
  'heapAccessShiftForWebGLHeap',
  'webgl_enable_ANGLE_instanced_arrays',
  'webgl_enable_OES_vertex_array_object',
  'webgl_enable_WEBGL_draw_buffers',
  'webgl_enable_WEBGL_multi_draw',
  'emscriptenWebGLGet',
  'computeUnpackAlignedImageSize',
  'colorChannelsInGlTextureFormat',
  'emscriptenWebGLGetTexPixelData',
  '__glGenObject',
  'emscriptenWebGLGetUniform',
  'webglGetUniformLocation',
  'webglPrepareUniformLocationsBeforeFirstUse',
  'webglGetLeftBracePos',
  'emscriptenWebGLGetVertexAttrib',
  '__glGetActiveAttribOrUniform',
  'writeGLArray',
  'registerWebGlEventCallback',
  'runAndAbortIfError',
  'SDL_unicode',
  'SDL_ttfContext',
  'SDL_audio',
  'ALLOC_NORMAL',
  'ALLOC_STACK',
  'allocate',
  'writeStringToMemory',
  'writeAsciiToMemory',
];
missingLibrarySymbols.forEach(missingLibrarySymbol)

var unexportedSymbols = [
  'run',
  'addOnPreRun',
  'addOnInit',
  'addOnPreMain',
  'addOnExit',
  'addOnPostRun',
  'addRunDependency',
  'removeRunDependency',
  'FS_createFolder',
  'FS_createPath',
  'FS_createLazyFile',
  'FS_createLink',
  'FS_createDevice',
  'FS_readFile',
  'out',
  'err',
  'callMain',
  'abort',
  'wasmMemory',
  'wasmExports',
  'stackAlloc',
  'stackSave',
  'stackRestore',
  'getTempRet0',
  'setTempRet0',
  'writeStackCookie',
  'checkStackCookie',
  'convertI32PairToI53Checked',
  'ptrToString',
  'zeroMemory',
  'exitJS',
  'getHeapMax',
  'growMemory',
  'ENV',
  'MONTH_DAYS_REGULAR',
  'MONTH_DAYS_LEAP',
  'MONTH_DAYS_REGULAR_CUMULATIVE',
  'MONTH_DAYS_LEAP_CUMULATIVE',
  'ERRNO_CODES',
  'ERRNO_MESSAGES',
  'setErrNo',
  'DNS',
  'Protocols',
  'Sockets',
  'initRandomFill',
  'randomFill',
  'timers',
  'warnOnce',
  'UNWIND_CACHE',
  'readEmAsmArgsArray',
  'readEmAsmArgs',
  'runEmAsmFunction',
  'keepRuntimeAlive',
  'asyncLoad',
  'alignMemory',
  'mmapAlloc',
  'wasmTable',
  'noExitRuntime',
  'freeTableIndexes',
  'functionsInTableMap',
  'setValue',
  'getValue',
  'PATH',
  'PATH_FS',
  'UTF8Decoder',
  'UTF8ArrayToString',
  'stringToUTF8Array',
  'stringToUTF8',
  'lengthBytesUTF8',
  'intArrayFromString',
  'UTF16Decoder',
  'stringToNewUTF8',
  'stringToUTF8OnStack',
  'JSEvents',
  'specialHTMLTargets',
  'currentFullscreenStrategy',
  'restoreOldWindowedStyle',
  'demangle',
  'demangleAll',
  'jsStackTrace',
  'stackTrace',
  'ExitStatus',
  'doReadv',
  'doWritev',
  'promiseMap',
  'uncaughtExceptionCount',
  'exceptionLast',
  'exceptionCaught',
  'ExceptionInfo',
  'Browser',
  'wget',
  'SYSCALLS',
  'preloadPlugins',
  'FS_createPreloadedFile',
  'FS_modeStringToFlags',
  'FS_getMode',
  'FS_stdin_getChar_buffer',
  'FS_stdin_getChar',
  'FS',
  'FS_createDataFile',
  'MEMFS',
  'TTY',
  'PIPEFS',
  'SOCKFS',
  'tempFixedLengthArray',
  'miniTempWebGLFloatBuffers',
  'miniTempWebGLIntBuffers',
  'GL',
  'emscripten_webgl_power_preferences',
  'AL',
  'GLUT',
  'EGL',
  'GLEW',
  'IDBStore',
  'SDL',
  'SDL_gfx',
  'allocateUTF8OnStack',
];
unexportedSymbols.forEach(unexportedRuntimeSymbol);



var calledRun;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  _emscripten_stack_init();
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie();
}

function run() {

  if (runDependencies > 0) {
    return;
  }

    stackCheckInit();

  preRun();

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = (x) => {
    has = true;
  }
  try { // it doesn't matter if it fails
    _fflush(0);
    // also flush in the JS FS layer
    ['stdout', 'stderr'].forEach(function(name) {
      var info = FS.analyzePath('/dev/' + name);
      if (!info) return;
      var stream = info.object;
      var rdev = stream.rdev;
      var tty = TTY.ttys[rdev];
      if (tty && tty.output && tty.output.length) {
        has = true;
      }
    });
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.');
  }
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

run();


// end include: postamble.js
// include: /mnt/c/work/eez/studio/wasm/lvgl-runtime/common/post.js
}

// end include: /mnt/c/work/eez/studio/wasm/lvgl-runtime/common/post.js
