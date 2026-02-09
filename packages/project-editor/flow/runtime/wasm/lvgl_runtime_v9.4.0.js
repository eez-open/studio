// include: shell.js
// include: minimum_runtime_check.js
(function() {
  // "30.0.0" -> 300000
  function humanReadableVersionToPacked(str) {
    str = str.split('-')[0]; // Remove any trailing part from e.g. "12.53.3-alpha"
    var vers = str.split('.').slice(0, 3);
    while(vers.length < 3) vers.push('00');
    vers = vers.map((n, i, arr) => n.padStart(2, '0'));
    return vers.join('');
  }
  // 300000 -> "30.0.0"
  var packedVersionToHumanReadable = n => [n / 10000 | 0, (n / 100 | 0) % 100, n % 100].join('.');

  var TARGET_NOT_SUPPORTED = 2147483647;

  // Note: We use a typeof check here instead of optional chaining using
  // globalThis because older browsers might not have globalThis defined.
  var currentNodeVersion = typeof process !== 'undefined' && process.versions?.node ? humanReadableVersionToPacked(process.versions.node) : TARGET_NOT_SUPPORTED;
  if (currentNodeVersion < 160000) {
    throw new Error(`This emscripten-generated code requires node v${ packedVersionToHumanReadable(160000) } (detected v${packedVersionToHumanReadable(currentNodeVersion)})`);
  }

  var userAgent = typeof navigator !== 'undefined' && navigator.userAgent;
  if (!userAgent) {
    return;
  }

  var currentSafariVersion = userAgent.includes("Safari/") && userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/) ? humanReadableVersionToPacked(userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentSafariVersion < 150000) {
    throw new Error(`This emscripten-generated code requires Safari v${ packedVersionToHumanReadable(150000) } (detected v${currentSafariVersion})`);
  }

  var currentFirefoxVersion = userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/) ? parseFloat(userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentFirefoxVersion < 79) {
    throw new Error(`This emscripten-generated code requires Firefox v79 (detected v${currentFirefoxVersion})`);
  }

  var currentChromeVersion = userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/) ? parseFloat(userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentChromeVersion < 85) {
    throw new Error(`This emscripten-generated code requires Chrome v85 (detected v${currentChromeVersion})`);
  }
})();

// end include: minimum_runtime_check.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
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

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = !!globalThis.window;
var ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope;
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != 'renderer';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// include: /home/mvladic/studio-wasm-libs/lvgl-runtime/v9.4.0/../common/pre.js
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

    Module.locateFile = function (path, scriptDirectory) {
        if (scriptDirectory) return scriptDirectory + path;
        return __dirname + "/" + path;
    };

    runWasmModule(Module);

    return Module;
}

function runWasmModule(Module) {

// end include: /home/mvladic/studio-wasm-libs/lvgl-runtime/v9.4.0/../common/pre.js


var arguments_ = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};

// In MODULARIZE mode _scriptName needs to be captured already at the very top of the page immediately when the page is parsed, so it is generated there
// before the page load. In non-MODULARIZE modes generate it here.
var _scriptName = globalThis.document?.currentScript?.src;

if (typeof __filename != 'undefined') { // Node
  _scriptName = __filename;
} else
if (ENVIRONMENT_IS_WORKER) {
  _scriptName = self.location.href;
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
var readAsync, readBinary;

if (ENVIRONMENT_IS_NODE) {
  const isNode = globalThis.process?.versions?.node && globalThis.process?.type != 'renderer';
  if (!isNode) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require('fs');

  scriptDirectory = __dirname + '/';

// include: node_shell_read.js
readBinary = (filename) => {
  // We need to re-wrap `file://` strings to URLs.
  filename = isFileURI(filename) ? new URL(filename) : filename;
  var ret = fs.readFileSync(filename);
  assert(Buffer.isBuffer(ret));
  return ret;
};

readAsync = async (filename, binary = true) => {
  // See the comment in the `readBinary` function.
  filename = isFileURI(filename) ? new URL(filename) : filename;
  var ret = fs.readFileSync(filename, binary ? undefined : 'utf8');
  assert(binary ? Buffer.isBuffer(ret) : typeof ret == 'string');
  return ret;
};
// end include: node_shell_read.js
  if (process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, '/');
  }

  arguments_ = process.argv.slice(2);

  // MODULARIZE will export the module in the proper place outside, we don't need to export here
  if (typeof module != 'undefined') {
    module['exports'] = Module;
  }

  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };

} else
if (ENVIRONMENT_IS_SHELL) {

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  try {
    scriptDirectory = new URL('.', _scriptName).href; // includes trailing slash
  } catch {
    // Must be a `blob:` or `data:` URL (e.g. `blob:http://site.com/etc/etc`), we cannot
    // infer anything from them.
  }

  if (!(globalThis.window || globalThis.WorkerGlobalScope)) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  {
// include: web_or_worker_shell_read.js
if (ENVIRONMENT_IS_WORKER) {
    readBinary = (url) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
    };
  }

  readAsync = async (url) => {
    // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
    // See https://github.com/github/fetch/pull/92#issuecomment-140665932
    // Cordova or Electron apps are typically loaded from a file:// url.
    // So use XHR on webview if URL is a file URL.
    if (isFileURI(url)) {
      return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            resolve(xhr.response);
            return;
          }
          reject(xhr.status);
        };
        xhr.onerror = reject;
        xhr.send(null);
      });
    }
    var response = await fetch(url, { credentials: 'same-origin' });
    if (response.ok) {
      return response.arrayBuffer();
    }
    throw new Error(response.status + ' : ' + response.url);
  };
// end include: web_or_worker_shell_read.js
  }
} else
{
  throw new Error('environment detection error');
}

var out = console.log.bind(console);
var err = console.error.bind(console);

var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var FETCHFS = 'FETCHFS is no longer included by default; build with -lfetchfs.js';
var ICASEFS = 'ICASEFS is no longer included by default; build with -licasefs.js';
var JSFILEFS = 'JSFILEFS is no longer included by default; build with -ljsfilefs.js';
var OPFS = 'OPFS is no longer included by default; build with -lopfs.js';

var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';

// perform assertions in shell.js after we set up out() and err(), as otherwise
// if an assertion fails it cannot print the message

assert(!ENVIRONMENT_IS_SHELL, 'shell environment detected but not enabled at build time.  Add `shell` to `-sENVIRONMENT` to enable.');

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

if (!globalThis.WebAssembly) {
  err('no native wasm support detected');
}

// Wasm globals

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

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */
var isFileURI = (filename) => filename.startsWith('file://');

// include: runtime_common.js
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
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
// include: runtime_debug.js
var runtimeDebug = true; // Switch to false at runtime to disable logging at the right times

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(...args) {
  if (!runtimeDebug && typeof runtimeDebug != 'undefined') return;
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn(...args);
}

// Endianness check
(() => {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) abort('Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)');
})();

function consumedModuleProp(prop) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      set() {
        abort(`Attempt to set \`Module.${prop}\` after it has already been processed.  This can happen, for example, when code is injected via '--post-js' rather than '--pre-js'`);

      }
    });
  }
}

function makeInvalidEarlyAccess(name) {
  return () => assert(false, `call to '${name}' via reference taken before Wasm module initialization`);

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
         name === 'FS_preloadFile' ||
         name === 'FS_unlink' ||
         name === 'addRunDependency' ||
         // The old FS has some functionality that WasmFS lacks.
         name === 'FS_createLazyFile' ||
         name === 'FS_createDevice' ||
         name === 'removeRunDependency';
}

/**
 * Intercept access to a symbols in the global symbol.  This enables us to give
 * informative warnings/errors when folks attempt to use symbols they did not
 * include in their build, or no symbols that no longer exist.
 *
 * We don't define this in MODULARIZE mode since in that mode emscripten symbols
 * are never placed in the global scope.
 */
function hookGlobalSymbolAccess(sym, func) {
  if (!Object.getOwnPropertyDescriptor(globalThis, sym)) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        func();
        return undefined;
      }
    });
  }
}

function missingGlobal(sym, msg) {
  hookGlobalSymbolAccess(sym, () => {
    warnOnce(`\`${sym}\` is no longer defined by emscripten. ${msg}`);
  });
}

missingGlobal('buffer', 'Please use HEAP8.buffer or wasmMemory.buffer');
missingGlobal('asm', 'Please use wasmExports instead');

function missingLibrarySymbol(sym) {
  hookGlobalSymbolAccess(sym, () => {
    // Can't `abort()` here because it would break code that does runtime
    // checks.  e.g. `if (typeof SDL === 'undefined')`.
    var msg = `\`${sym}\` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line`;
    // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
    // library.js, which means $name for a JS name with no prefix, or name
    // for a JS name like _name.
    var librarySymbol = sym;
    if (!librarySymbol.startsWith('_')) {
      librarySymbol = '$' + sym;
    }
    msg += ` (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='${librarySymbol}')`;
    if (isExportedByForceFilesystem(sym)) {
      msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
    }
    warnOnce(msg);
  });

  // Any symbol that is not included from the JS library is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`;
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        abort(msg);
      },
    });
  }
}

// end include: runtime_debug.js
// Memory management
var
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

// BigInt64Array type is not correctly defined in closure
var
/** not-@type {!BigInt64Array} */
  HEAP64,
/* BigUint64Array type is not correctly defined in closure
/** not-@type {!BigUint64Array} */
  HEAPU64;

var runtimeInitialized = false;



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
  HEAP64 = new BigInt64Array(b);
  HEAPU64 = new BigUint64Array(b);
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// end include: runtime_common.js
assert(globalThis.Int32Array && globalThis.Float64Array && Int32Array.prototype.subarray && Int32Array.prototype.set,
       'JS engine does not provide full typed array support');

function preRun() {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  consumedModuleProp('preRun');
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns);
  // End ATPRERUNS hooks
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  checkStackCookie();

  // Begin ATINITS hooks
  if (!Module['noFSInit'] && !FS.initialized) FS.init();
TTY.init();
  // End ATINITS hooks

  wasmExports['__wasm_call_ctors']();

  // Begin ATPOSTCTORS hooks
  FS.ignorePermissions = false;
  // End ATPOSTCTORS hooks
}

function postRun() {
  checkStackCookie();
   // PThreads reuse the runtime from the main thread.

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  consumedModuleProp('postRun');

  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns);
  // End ATPOSTRUNS hooks
}

/** @param {string|number=} what */
function abort(what) {
  Module['onAbort']?.(what);

  what = 'Aborted(' + what + ')';
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.

  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

function createExportWrapper(name, nargs) {
  return (...args) => {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    var f = wasmExports[name];
    assert(f, `exported native function \`${name}\` not found`);
    // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
    assert(args.length <= nargs, `native function \`${name}\` called with ${args.length} args but expects ${nargs}`);
    return f(...args);
  };
}

var wasmBinaryFile;

function findWasmBinary() {
  return locateFile('lvgl_runtime_v9.4.0.wasm');
}

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  // Throwing a plain string here, even though it not normally adviables since
  // this gets turning into an `abort` in instantiateArrayBuffer.
  throw 'both async and sync fetching of the wasm failed';
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {
      // Fall back to getBinarySync below;
    }
  }

  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);

    // Warn on some common problems.
    if (isFileURI(binaryFile)) {
      err(`warning: Loading from a file URI (${binaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary
      // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
      && !isFileURI(binaryFile)
      // Avoid instantiateStreaming() on Node.js environment for now, as while
      // Node.js v18.1.0 implements it, it does not have a full fetch()
      // implementation yet.
      //
      // Reference:
      //   https://github.com/emscripten-core/emscripten/pull/16917
      && !ENVIRONMENT_IS_NODE
     ) {
    try {
      var response = fetch(binaryFile, { credentials: 'same-origin' });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err('falling back to ArrayBuffer instantiation');
      // fall back of instantiateArrayBuffer below
    };
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // prepare imports
  var imports = {
    'env': wasmImports,
    'wasi_snapshot_preview1': wasmImports,
  };
  return imports;
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    wasmExports = instance.exports;

    assignWasmExports(wasmExports);

    updateMemoryViews();

    removeRunDependency('wasm-instantiate');
    return wasmExports;
  }
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
    return receiveInstance(result['instance']);
  }

  var info = getWasmImports();

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module['instantiateWasm']) {
    return new Promise((resolve, reject) => {
      try {
        Module['instantiateWasm'](info, (inst, mod) => {
          resolve(receiveInstance(inst, mod));
        });
      } catch(e) {
        err(`Module.instantiateWasm callback failed with error: ${e}`);
        reject(e);
      }
    });
  }

  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

// end include: preamble.js

// Begin JS library code


  class ExitStatus {
      name = 'ExitStatus';
      constructor(status) {
        this.message = `Program terminated with exit(${status})`;
        this.status = status;
      }
    }

  var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        // Pass the module as the first argument.
        callbacks.shift()(Module);
      }
    };
  var onPostRuns = [];
  var addOnPostRun = (cb) => onPostRuns.push(cb);

  var onPreRuns = [];
  var addOnPreRun = (cb) => onPreRuns.push(cb);

  var runDependencies = 0;
  
  
  var dependenciesFulfilled = null;
  
  var runDependencyTracking = {
  };
  
  var runDependencyWatcher = null;
  var removeRunDependency = (id) => {
      runDependencies--;
  
      Module['monitorRunDependencies']?.(runDependencies);
  
      assert(id, 'removeRunDependency requires an ID');
      assert(runDependencyTracking[id]);
      delete runDependencyTracking[id];
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
    };
  
  
  var addRunDependency = (id) => {
      runDependencies++;
  
      Module['monitorRunDependencies']?.(runDependencies);
  
      assert(id, 'addRunDependency requires an ID')
      assert(!runDependencyTracking[id]);
      runDependencyTracking[id] = 1;
      if (runDependencyWatcher === null && globalThis.setInterval) {
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
        // Prevent this timer from keeping the runtime alive if nothing
        // else is.
        runDependencyWatcher.unref?.()
      }
    };


  
    /**
     * @param {number} ptr
     * @param {string} type
     */
  function getValue(ptr, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': return HEAP8[ptr];
      case 'i8': return HEAP8[ptr];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP64[((ptr)>>3)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      case '*': return HEAPU32[((ptr)>>2)];
      default: abort(`invalid type for getValue: ${type}`);
    }
  }

  var noExitRuntime = true;

  var ptrToString = (ptr) => {
      assert(typeof ptr === 'number', `ptrToString expects a number, got ${typeof ptr}`);
      // Convert to 32-bit unsigned value
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
      case 'i1': HEAP8[ptr] = value; break;
      case 'i8': HEAP8[ptr] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': HEAP64[((ptr)>>3)] = BigInt(value); break;
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      case '*': HEAPU32[((ptr)>>2)] = value; break;
      default: abort(`invalid type for setValue: ${type}`);
    }
  }

  var stackRestore = (val) => __emscripten_stack_restore(val);

  var stackSave = () => _emscripten_stack_get_current();

  var warnOnce = (text) => {
      warnOnce.shown ||= {};
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text;
        err(text);
      }
    };

  

  var UTF8Decoder = globalThis.TextDecoder && new TextDecoder();
  
  var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
      var maxIdx = idx + maxBytesToRead;
      if (ignoreNul) return maxIdx;
      // TextDecoder needs to know the byte length in advance, it doesn't stop on
      // null terminator by itself.
      // As a tiny code save trick, compare idx against maxIdx using a negation,
      // so that maxBytesToRead=undefined/NaN means Infinity.
      while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
      return idx;
    };
  
  
    /**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number=} idx
     * @param {number=} maxBytesToRead
     * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
     * @return {string}
     */
  var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  
      var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  
      // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      }
      var str = '';
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
     *   string will cut short at that byte index.
     * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
     * @return {string}
     */
  var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
      assert(typeof ptr == 'number', `UTF8ToString expects a number (got ${typeof ptr})`);
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : '';
    };
  var ___assert_fail = (condition, filename, line, func) =>
      abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);

  class ExceptionInfo {
      // excPtr - Thrown object pointer to wrap. Metadata pointer is calculated from it.
      constructor(excPtr) {
        this.excPtr = excPtr;
        this.ptr = excPtr - 24;
      }
  
      set_type(type) {
        HEAPU32[(((this.ptr)+(4))>>2)] = type;
      }
  
      get_type() {
        return HEAPU32[(((this.ptr)+(4))>>2)];
      }
  
      set_destructor(destructor) {
        HEAPU32[(((this.ptr)+(8))>>2)] = destructor;
      }
  
      get_destructor() {
        return HEAPU32[(((this.ptr)+(8))>>2)];
      }
  
      set_caught(caught) {
        caught = caught ? 1 : 0;
        HEAP8[(this.ptr)+(12)] = caught;
      }
  
      get_caught() {
        return HEAP8[(this.ptr)+(12)] != 0;
      }
  
      set_rethrown(rethrown) {
        rethrown = rethrown ? 1 : 0;
        HEAP8[(this.ptr)+(13)] = rethrown;
      }
  
      get_rethrown() {
        return HEAP8[(this.ptr)+(13)] != 0;
      }
  
      // Initialize native structure fields. Should be called once after allocated.
      init(type, destructor) {
        this.set_adjusted_ptr(0);
        this.set_type(type);
        this.set_destructor(destructor);
      }
  
      set_adjusted_ptr(adjustedPtr) {
        HEAPU32[(((this.ptr)+(16))>>2)] = adjustedPtr;
      }
  
      get_adjusted_ptr() {
        return HEAPU32[(((this.ptr)+(16))>>2)];
      }
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

  var syscallGetVarargI = () => {
      assert(SYSCALLS.varargs != undefined);
      // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
      var ret = HEAP32[((+SYSCALLS.varargs)>>2)];
      SYSCALLS.varargs += 4;
      return ret;
    };
  var syscallGetVarargP = syscallGetVarargI;
  
  
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
            trailingSlash = path.slice(-1) === '/';
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
          dir = dir.slice(0, -1);
        }
        return root + dir;
      },
  basename:(path) => path && path.match(/([^\/]+|\/)\/*$/)[1],
  join:(...paths) => PATH.normalize(paths.join('/')),
  join2:(l, r) => PATH.normalize(l + '/' + r),
  };
  
  var initRandomFill = () => {
      // This block is not needed on v19+ since crypto.getRandomValues is builtin
      if (ENVIRONMENT_IS_NODE) {
        var nodeCrypto = require('crypto');
        return (view) => nodeCrypto.randomFillSync(view);
      }
  
      return (view) => crypto.getRandomValues(view);
    };
  var randomFill = (view) => {
      // Lazily init on the first invocation.
      (randomFill = initRandomFill())(view);
    };
  
  
  
  var PATH_FS = {
  resolve:(...args) => {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? args[i] : FS.cwd();
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
        from = PATH_FS.resolve(from).slice(1);
        to = PATH_FS.resolve(to).slice(1);
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
      assert(typeof str === 'string', `stringToUTF8Array expects a string (got ${typeof str})`);
      // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
      // undefined and false each don't write out any bytes.
      if (!(maxBytesToWrite > 0))
        return 0;
  
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
      for (var i = 0; i < str.length; ++i) {
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
        // and https://www.ietf.org/rfc/rfc2279.txt
        // and https://tools.ietf.org/html/rfc3629
        var u = str.codePointAt(i);
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
          // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
          // We need to manually skip over the second code unit for correct iteration.
          i++;
        }
      }
      // Null-terminate the pointer to the buffer.
      heap[outIdx] = 0;
      return outIdx - startIdx;
    };
  /** @type {function(string, boolean=, number=)} */
  var intArrayFromString = (stringy, dontAddNull, length) => {
      var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
      var u8array = new Array(len);
      var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
      if (dontAddNull) u8array.length = numBytesWritten;
      return u8array;
    };
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
            bytesRead = fs.readSync(fd, buf, 0, BUFSIZE);
          } catch(e) {
            // Cross-platform differences: on Windows, reading EOF throws an
            // exception, but on other OSes, reading EOF returns 0. Uniformize
            // behavior by treating the EOF exception to return 0.
            if (e.toString().includes('EOF')) bytesRead = 0;
            else throw e;
          }
  
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString('utf-8');
          }
        } else
        if (globalThis.window?.prompt) {
          // Browser.
          result = window.prompt('Input: ');  // returns null on cancel
          if (result !== null) {
            result += '\n';
          }
        } else
        {}
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
            stream.node.atime = Date.now();
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
            stream.node.mtime = stream.node.ctime = Date.now();
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
            out(UTF8ArrayToString(tty.output));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },
  fsync(tty) {
          if (tty.output?.length > 0) {
            out(UTF8ArrayToString(tty.output));
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
            err(UTF8ArrayToString(tty.output));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
  fsync(tty) {
          if (tty.output?.length > 0) {
            err(UTF8ArrayToString(tty.output));
            tty.output = [];
          }
        },
  },
  };
  
  
  var zeroMemory = (ptr, size) => HEAPU8.fill(0, ptr, ptr + size);
  
  var alignMemory = (size, alignment) => {
      assert(alignment, "alignment argument is required");
      return Math.ceil(size / alignment) * alignment;
    };
  var mmapAlloc = (size) => {
      size = alignMemory(size, 65536);
      var ptr = _emscripten_builtin_memalign(65536, size);
      if (ptr) zeroMemory(ptr, size);
      return ptr;
    };
  var MEMFS = {
  ops_table:null,
  mount(mount) {
        return MEMFS.createNode(null, '/', 16895, 0);
      },
  createNode(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(63);
        }
        MEMFS.ops_table ||= {
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
        node.atime = node.mtime = node.ctime = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
          parent.atime = parent.mtime = parent.ctime = node.atime;
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
          attr.atime = new Date(node.atime);
          attr.mtime = new Date(node.mtime);
          attr.ctime = new Date(node.ctime);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },
  setattr(node, attr) {
          for (const key of ["mode", "atime", "mtime", "ctime"]) {
            if (attr[key] != null) {
              node[key] = attr[key];
            }
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },
  lookup(parent, name) {
          throw new FS.ErrnoError(44);
        },
  mknod(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },
  rename(old_node, new_dir, new_name) {
          var new_node;
          try {
            new_node = FS.lookupNode(new_dir, new_name);
          } catch (e) {}
          if (new_node) {
            if (FS.isDir(old_node.mode)) {
              // if we're overwriting a directory at new_name, make sure it's empty.
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
            FS.hashRemoveNode(new_node);
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          new_dir.contents[new_name] = old_node;
          old_node.name = new_name;
          new_dir.ctime = new_dir.mtime = old_node.parent.ctime = old_node.parent.mtime = Date.now();
        },
  unlink(parent, name) {
          delete parent.contents[name];
          parent.ctime = parent.mtime = Date.now();
        },
  rmdir(parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
          parent.ctime = parent.mtime = Date.now();
        },
  readdir(node) {
          return ['.', '..', ...Object.keys(node.contents)];
        },
  symlink(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 0o777 | 40960, 0);
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
          node.mtime = node.ctime = Date.now();
  
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
  mmap(stream, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if (!(flags & 2) && contents && contents.buffer === HEAP8.buffer) {
            // We can't emulate MAP_SHARED when the file is not backed by the
            // buffer we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            allocated = true;
            ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            if (contents) {
              // Try to avoid unnecessary slices.
              if (position > 0 || position + length < contents.length) {
                if (contents.subarray) {
                  contents = contents.subarray(position, position + length);
                } else {
                  contents = Array.prototype.slice.call(contents, position, position + length);
                }
              }
              HEAP8.set(contents, ptr);
            }
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
  
  
  
  
  var strError = (errno) => UTF8ToString(_strerror(errno));
  
  var ERRNO_CODES = {
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
    };
  
  var asyncLoad = async (url) => {
      var arrayBuffer = await readAsync(url);
      assert(arrayBuffer, `Loading data file "${url}" failed (no arrayBuffer).`);
      return new Uint8Array(arrayBuffer);
    };
  
  
  var FS_createDataFile = (...args) => FS.createDataFile(...args);
  
  var getUniqueRunDependency = (id) => {
      var orig = id;
      while (1) {
        if (!runDependencyTracking[id]) return id;
        id = orig + Math.random();
      }
    };
  
  
  
  var preloadPlugins = [];
  var FS_handledByPreloadPlugin = async (byteArray, fullname) => {
      // Ensure plugins are ready.
      if (typeof Browser != 'undefined') Browser.init();
  
      for (var plugin of preloadPlugins) {
        if (plugin['canHandle'](fullname)) {
          assert(plugin['handle'].constructor.name === 'AsyncFunction', 'Filesystem plugin handlers must be async functions (See #24914)')
          return plugin['handle'](byteArray, fullname);
        }
      }
      // In no plugin handled this file then return the original/unmodified
      // byteArray.
      return byteArray;
    };
  var FS_preloadFile = async (parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish) => {
      // TODO we should allow people to just pass in a complete filename instead
      // of parent and name being that we just join them anyways
      var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
      var dep = getUniqueRunDependency(`cp ${fullname}`); // might have several active requests for the same fullname
      addRunDependency(dep);
  
      try {
        var byteArray = url;
        if (typeof url == 'string') {
          byteArray = await asyncLoad(url);
        }
  
        byteArray = await FS_handledByPreloadPlugin(byteArray, fullname);
        preFinish?.();
        if (!dontCreateFile) {
          FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
        }
      } finally {
        removeRunDependency(dep);
      }
    };
  var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
      FS_preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish).then(onload).catch(onerror);
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
  filesystems:null,
  syncFSRequests:0,
  readFiles:{
  },
  ErrnoError:class extends Error {
        name = 'ErrnoError';
        // We set the `name` property to be able to identify `FS.ErrnoError`
        // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
        // - when using PROXYFS, an error can come from an underlying FS
        // as different FS objects have their own FS.ErrnoError each,
        // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
        // we'll use the reliable test `err.name == "ErrnoError"` instead
        constructor(errno) {
          super(runtimeInitialized ? strError(errno) : '');
          this.errno = errno;
          for (var key in ERRNO_CODES) {
            if (ERRNO_CODES[key] === errno) {
              this.code = key;
              break;
            }
          }
        }
      },
  FSStream:class {
        shared = {};
        get object() {
          return this.node;
        }
        set object(val) {
          this.node = val;
        }
        get isRead() {
          return (this.flags & 2097155) !== 1;
        }
        get isWrite() {
          return (this.flags & 2097155) !== 0;
        }
        get isAppend() {
          return (this.flags & 1024);
        }
        get flags() {
          return this.shared.flags;
        }
        set flags(val) {
          this.shared.flags = val;
        }
        get position() {
          return this.shared.position;
        }
        set position(val) {
          this.shared.position = val;
        }
      },
  FSNode:class {
        node_ops = {};
        stream_ops = {};
        readMode = 292 | 73;
        writeMode = 146;
        mounted = null;
        constructor(parent, name, mode, rdev) {
          if (!parent) {
            parent = this;  // root node sets parent to itself
          }
          this.parent = parent;
          this.mount = parent.mount;
          this.id = FS.nextInode++;
          this.name = name;
          this.mode = mode;
          this.rdev = rdev;
          this.atime = this.mtime = this.ctime = Date.now();
        }
        get read() {
          return (this.mode & this.readMode) === this.readMode;
        }
        set read(val) {
          val ? this.mode |= this.readMode : this.mode &= ~this.readMode;
        }
        get write() {
          return (this.mode & this.writeMode) === this.writeMode;
        }
        set write(val) {
          val ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
        }
        get isFolder() {
          return FS.isDir(this.mode);
        }
        get isDevice() {
          return FS.isChrdev(this.mode);
        }
      },
  lookupPath(path, opts = {}) {
        if (!path) {
          throw new FS.ErrnoError(44);
        }
        opts.follow_mount ??= true
  
        if (!PATH.isAbs(path)) {
          path = FS.cwd() + '/' + path;
        }
  
        // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
        linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
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
  
            if (parts[i] === '.') {
              continue;
            }
  
            if (parts[i] === '..') {
              current_path = PATH.dirname(current_path);
              if (FS.isRoot(current)) {
                path = current_path + '/' + parts.slice(i + 1).join('/');
                // We're making progress here, don't let many consecutive ..'s
                // lead to ELOOP
                nlinks--;
                continue linkloop;
              } else {
                current = current.parent;
              }
              continue;
            }
  
            current_path = PATH.join2(current_path, parts[i]);
            try {
              current = FS.lookupNode(current, parts[i]);
            } catch (e) {
              // if noent_okay is true, suppress a ENOENT in the last component
              // and return an object with an undefined node. This is needed for
              // resolving symlinks in the path when creating a file.
              if ((e?.errno === 44) && islast && opts.noent_okay) {
                return { path: current_path };
              }
              throw e;
            }
  
            // jump to the mount's root node if this is a mountpoint
            if (FS.isMountpoint(current) && (!islast || opts.follow_mount)) {
              current = current.mounted.root;
            }
  
            // by default, lookupPath will not follow a symlink if it is the final path component.
            // setting opts.follow = true will override this behavior.
            if (FS.isLink(current.mode) && (!islast || opts.follow)) {
              if (!current.node_ops.readlink) {
                throw new FS.ErrnoError(52);
              }
              var link = current.node_ops.readlink(current);
              if (!PATH.isAbs(link)) {
                link = PATH.dirname(current_path) + '/' + link;
              }
              path = link + '/' + parts.slice(i + 1).join('/');
              continue linkloop;
            }
          }
          return { path: current_path, node: current };
        }
        throw new FS.ErrnoError(32);
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
          throw new FS.ErrnoError(errCode);
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
        if (!FS.isDir(dir.mode)) return 54;
        var errCode = FS.nodePermissions(dir, 'x');
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },
  mayCreate(dir, name) {
        if (!FS.isDir(dir.mode)) {
          return 54;
        }
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
          if (FS.flagsToPermissionString(flags) !== 'r' // opening for write
              || (flags & (512 | 64))) { // TODO: check for O_SEARCH? (== search for dir only)
            return 31;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },
  checkOpExists(op, err) {
        if (!op) {
          throw new FS.ErrnoError(err);
        }
        return op;
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
        assert(fd >= -1);
  
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
  dupStream(origStream, fd = -1) {
        var stream = FS.createStream(origStream, fd);
        stream.stream_ops?.dup?.(stream);
        return stream;
      },
  doSetAttr(stream, node, attr) {
        var setattr = stream?.stream_ops.setattr;
        var arg = setattr ? stream : node;
        setattr ??= node.node_ops.setattr;
        FS.checkOpExists(setattr, 63)
        setattr(arg, attr);
      },
  chrdev_stream_ops:{
  open(stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          stream.stream_ops.open?.(stream);
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
  
          check.push(...m.mounts);
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
        for (var mount of mounts) {
          if (mount.type.syncfs) {
            mount.type.syncfs(mount, populate, done);
          } else {
            done(null);
          }
        }
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
  
        for (var [hash, current] of Object.entries(FS.nameTable)) {
          while (current) {
            var next = current.name_next;
  
            if (mounts.includes(current.mount)) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        }
  
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
        if (!name) {
          throw new FS.ErrnoError(28);
        }
        if (name === '.' || name === '..') {
          throw new FS.ErrnoError(20);
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
  statfs(path) {
        return FS.statfsNode(FS.lookupPath(path, {follow: true}).node);
      },
  statfsStream(stream) {
        // We keep a separate statfsStream function because noderawfs overrides
        // it. In noderawfs, stream.node is sometimes null. Instead, we need to
        // look at stream.path.
        return FS.statfsNode(stream.node);
      },
  statfsNode(node) {
        // NOTE: None of the defaults here are true. We're just returning safe and
        //       sane values. Currently nodefs and rawfs replace these defaults,
        //       other file systems leave them alone.
        var rtn = {
          bsize: 4096,
          frsize: 4096,
          blocks: 1e6,
          bfree: 5e5,
          bavail: 5e5,
          files: FS.nextInode,
          ffree: FS.nextInode - 1,
          fsid: 42,
          flags: 2,
          namelen: 255,
        };
  
        if (node.node_ops.statfs) {
          Object.assign(rtn, node.node_ops.statfs(node.mount.opts.root));
        }
        return rtn;
      },
  create(path, mode = 0o666) {
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },
  mkdir(path, mode = 0o777) {
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },
  mkdirTree(path, mode) {
        var dirs = path.split('/');
        var d = '';
        for (var dir of dirs) {
          if (!dir) continue;
          if (d || PATH.isAbs(path)) d += '/';
          d += dir;
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
          mode = 0o666;
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
  
        // let the errors from non existent directories percolate up
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
          // update old node (we do this here to avoid each backend
          // needing to)
          old_node.parent = new_dir;
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
        var readdir = FS.checkOpExists(node.node_ops.readdir, 54);
        return readdir(node);
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
        return link.node_ops.readlink(link);
      },
  stat(path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        var getattr = FS.checkOpExists(node.node_ops.getattr, 63);
        return getattr(node);
      },
  fstat(fd) {
        var stream = FS.getStreamChecked(fd);
        var node = stream.node;
        var getattr = stream.stream_ops.getattr;
        var arg = getattr ? stream : node;
        getattr ??= node.node_ops.getattr;
        FS.checkOpExists(getattr, 63)
        return getattr(arg);
      },
  lstat(path) {
        return FS.stat(path, true);
      },
  doChmod(stream, node, mode, dontFollow) {
        FS.doSetAttr(stream, node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          ctime: Date.now(),
          dontFollow
        });
      },
  chmod(path, mode, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        FS.doChmod(null, node, mode, dontFollow);
      },
  lchmod(path, mode) {
        FS.chmod(path, mode, true);
      },
  fchmod(fd, mode) {
        var stream = FS.getStreamChecked(fd);
        FS.doChmod(stream, stream.node, mode, false);
      },
  doChown(stream, node, dontFollow) {
        FS.doSetAttr(stream, node, {
          timestamp: Date.now(),
          dontFollow
          // we ignore the uid / gid for now
        });
      },
  chown(path, uid, gid, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        FS.doChown(null, node, dontFollow);
      },
  lchown(path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },
  fchown(fd, uid, gid) {
        var stream = FS.getStreamChecked(fd);
        FS.doChown(stream, stream.node, false);
      },
  doTruncate(stream, node, len) {
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
        FS.doSetAttr(stream, node, {
          size: len,
          timestamp: Date.now()
        });
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
        FS.doTruncate(null, node, len);
      },
  ftruncate(fd, len) {
        var stream = FS.getStreamChecked(fd);
        if (len < 0 || (stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }
        FS.doTruncate(stream, stream.node, len);
      },
  utime(path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
        setattr(node, {
          atime: atime,
          mtime: mtime
        });
      },
  open(path, flags, mode = 0o666) {
        if (path === "") {
          throw new FS.ErrnoError(44);
        }
        flags = typeof flags == 'string' ? FS_modeStringToFlags(flags) : flags;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        var isDirPath;
        if (typeof path == 'object') {
          node = path;
        } else {
          isDirPath = path.endsWith("/");
          // noent_okay makes it so that if the final component of the path
          // doesn't exist, lookupPath returns `node: undefined`. `path` will be
          // updated to point to the target of all symlinks.
          var lookup = FS.lookupPath(path, {
            follow: !(flags & 131072),
            noent_okay: true
          });
          node = lookup.node;
          path = lookup.path;
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(20);
            }
          } else if (isDirPath) {
            throw new FS.ErrnoError(31);
          } else {
            // node doesn't exist, try to create it
            // Ignore the permission bits here to ensure we can `open` this new
            // file below. We use chmod below the apply the permissions once the
            // file is open.
            node = FS.mknod(path, mode | 0o777, 0);
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
        if (created) {
          FS.chmod(node, mode & 0o777);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
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
        if (!length) {
          throw new FS.ErrnoError(28);
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
          abort(`Invalid encoding type "${opts.encoding}"`);
        }
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          buf = UTF8ArrayToString(buf);
        }
        FS.close(stream);
        return buf;
      },
  writeFile(path, data, opts = {}) {
        opts.flags = opts.flags || 577;
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data == 'string') {
          data = new Uint8Array(intArrayFromString(data, true));
        }
        if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        } else {
          abort('Unsupported data type');
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
          llseek: () => 0,
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
            randomFill(randomBuffer);
            randomLeft = randomBuffer.byteLength;
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
            var node = FS.createNode(proc_self, 'fd', 16895, 73);
            node.stream_ops = {
              llseek: MEMFS.stream_ops.llseek,
            };
            node.node_ops = {
              lookup(parent, name) {
                var fd = +name;
                var stream = FS.getStreamChecked(fd);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: () => stream.path },
                  id: fd + 1,
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              },
              readdir() {
                return Array.from(FS.streams.entries())
                  .filter(([k, v]) => v)
                  .map(([k, v]) => k.toString());
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },
  createStandardStreams(input, output, error) {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (input) {
          FS.createDevice('/dev', 'stdin', input);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (output) {
          FS.createDevice('/dev', 'stdout', null, output);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (error) {
          FS.createDevice('/dev', 'stderr', null, error);
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
  staticInit() {
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
        assert(!FS.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.initialized = true;
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        input ??= Module['stdin'];
        output ??= Module['stdout'];
        error ??= Module['stderr'];
  
        FS.createStandardStreams(input, output, error);
      },
  quit() {
        FS.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        _fflush(0);
        // close all of our streams
        for (var stream of FS.streams) {
          if (stream) {
            FS.close(stream);
          }
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
            if (e.errno != 20) throw e;
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
      },
  createDevice(parent, name, input, output) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(!!input, !!output);
        FS.createDevice.major ??= 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open(stream) {
            stream.seekable = false;
          },
          close(stream) {
            // flush any pending line data
            if (output?.buffer?.length) {
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
              stream.node.atime = Date.now();
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
              stream.node.mtime = stream.node.ctime = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },
  forceLoadFile(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        if (globalThis.XMLHttpRequest) {
          abort("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else { // Command-line.
          try {
            obj.contents = readBinary(obj.url);
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        }
      },
  createLazyFile(parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array).
        // Actual getting is abstracted away for eventual reuse.
        class LazyUint8Array {
          lengthKnown = false;
          chunks = []; // Loaded chunks. Index is the chunk number
          get(idx) {
            if (idx > this.length-1 || idx < 0) {
              return undefined;
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = (idx / this.chunkSize)|0;
            return this.getter(chunkNum)[chunkOffset];
          }
          setDataGetter(getter) {
            this.getter = getter;
          }
          cacheLength() {
            // Find length
            var xhr = new XMLHttpRequest();
            xhr.open('HEAD', url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) abort("Couldn't load " + url + ". Status: " + xhr.status);
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
            var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
            var chunkSize = 1024*1024; // Chunk size in bytes
  
            if (!hasByteServing) chunkSize = datalength;
  
            // Function to get a range from the remote URL.
            var doXHR = (from, to) => {
              if (from > to) abort("invalid range (" + from + ", " + to + ") or no bytes requested!");
              if (to > datalength-1) abort("only " + datalength + " bytes available! programmer error!");
  
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
              if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) abort("Couldn't load " + url + ". Status: " + xhr.status);
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
              if (typeof lazyArray.chunks[chunkNum] == 'undefined') abort('doXHR failed!');
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
          }
          get length() {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._length;
          }
          get chunkSize() {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._chunkSize;
          }
        }
  
        if (globalThis.XMLHttpRequest) {
          if (!ENVIRONMENT_IS_WORKER) abort('Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc');
          var lazyArray = new LazyUint8Array();
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
            get: function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        for (const [key, fn] of Object.entries(node.stream_ops)) {
          stream_ops[key] = (...args) => {
            FS.forceLoadFile(node);
            return fn(...args);
          };
        }
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
        return dir + '/' + path;
      },
  writeStat(buf, stat) {
        HEAPU32[((buf)>>2)] = stat.dev;
        HEAPU32[(((buf)+(4))>>2)] = stat.mode;
        HEAPU32[(((buf)+(8))>>2)] = stat.nlink;
        HEAPU32[(((buf)+(12))>>2)] = stat.uid;
        HEAPU32[(((buf)+(16))>>2)] = stat.gid;
        HEAPU32[(((buf)+(20))>>2)] = stat.rdev;
        HEAP64[(((buf)+(24))>>3)] = BigInt(stat.size);
        HEAP32[(((buf)+(32))>>2)] = 4096;
        HEAP32[(((buf)+(36))>>2)] = stat.blocks;
        var atime = stat.atime.getTime();
        var mtime = stat.mtime.getTime();
        var ctime = stat.ctime.getTime();
        HEAP64[(((buf)+(40))>>3)] = BigInt(Math.floor(atime / 1000));
        HEAPU32[(((buf)+(48))>>2)] = (atime % 1000) * 1000 * 1000;
        HEAP64[(((buf)+(56))>>3)] = BigInt(Math.floor(mtime / 1000));
        HEAPU32[(((buf)+(64))>>2)] = (mtime % 1000) * 1000 * 1000;
        HEAP64[(((buf)+(72))>>3)] = BigInt(Math.floor(ctime / 1000));
        HEAPU32[(((buf)+(80))>>2)] = (ctime % 1000) * 1000 * 1000;
        HEAP64[(((buf)+(88))>>3)] = BigInt(stat.ino);
        return 0;
      },
  writeStatFs(buf, stats) {
        HEAPU32[(((buf)+(4))>>2)] = stats.bsize;
        HEAPU32[(((buf)+(60))>>2)] = stats.bsize;
        HEAP64[(((buf)+(8))>>3)] = BigInt(stats.blocks);
        HEAP64[(((buf)+(16))>>3)] = BigInt(stats.bfree);
        HEAP64[(((buf)+(24))>>3)] = BigInt(stats.bavail);
        HEAP64[(((buf)+(32))>>3)] = BigInt(stats.files);
        HEAP64[(((buf)+(40))>>3)] = BigInt(stats.ffree);
        HEAPU32[(((buf)+(48))>>2)] = stats.fsid;
        HEAPU32[(((buf)+(64))>>2)] = stats.flags;  // ST_NOSUID
        HEAPU32[(((buf)+(56))>>2)] = stats.namelen;
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
  getStreamFromFD(fd) {
        var stream = FS.getStreamChecked(fd);
        return stream;
      },
  varargs:undefined,
  getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
  };
  function ___syscall_fcntl64(fd, cmd, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (cmd) {
        case 0: {
          var arg = syscallGetVarargI();
          if (arg < 0) {
            return -28;
          }
          while (FS.streams[arg]) {
            arg++;
          }
          var newStream;
          newStream = FS.dupStream(stream, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = syscallGetVarargI();
          stream.flags |= arg;
          return 0;
        }
        case 12: {
          var arg = syscallGetVarargP();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)] = 2;
          return 0;
        }
        case 13:
        case 14:
          // Pretend that the locking is successful. These are process-level locks,
          // and Emscripten programs are a single process. If we supported linking a
          // filesystem between programs, we'd need to do more here.
          // See https://github.com/emscripten-core/emscripten/issues/23697
          return 0;
      }
      return -28;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_fstat64(fd, buf) {
  try {
  
      return SYSCALLS.writeStat(buf, FS.fstat(fd));
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };
  
  function ___syscall_getdents64(fd, dirp, count) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd)
      stream.getdents ||= FS.readdir(stream.path);
  
      var struct_size = 280;
      var pos = 0;
      var off = FS.llseek(stream, 0, 1);
  
      var startIdx = Math.floor(off / struct_size);
      var endIdx = Math.min(stream.getdents.length, startIdx + Math.floor(count/struct_size))
      for (var idx = startIdx; idx < endIdx; idx++) {
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
          var child;
          try {
            child = FS.lookupNode(stream.node, name);
          } catch (e) {
            // If the entry is not a directory, file, or symlink, nodefs
            // lookupNode will raise EINVAL. Skip these and continue.
            if (e?.errno === 28) {
              continue;
            }
            throw e;
          }
          id = child.id;
          type = FS.isChrdev(child.mode) ? 2 :  // DT_CHR, character device.
                 FS.isDir(child.mode) ? 4 :     // DT_DIR, directory.
                 FS.isLink(child.mode) ? 10 :   // DT_LNK, symbolic link.
                 8;                             // DT_REG, regular file.
        }
        assert(id);
        HEAP64[((dirp + pos)>>3)] = BigInt(id);
        HEAP64[(((dirp + pos)+(8))>>3)] = BigInt((idx + 1) * struct_size);
        HEAP16[(((dirp + pos)+(16))>>1)] = 280;
        HEAP8[(dirp + pos)+(18)] = type;
        stringToUTF8(name, dirp + pos + 19, 256);
        pos += struct_size;
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
            var argp = syscallGetVarargP();
            HEAP32[((argp)>>2)] = termios.c_iflag || 0;
            HEAP32[(((argp)+(4))>>2)] = termios.c_oflag || 0;
            HEAP32[(((argp)+(8))>>2)] = termios.c_cflag || 0;
            HEAP32[(((argp)+(12))>>2)] = termios.c_lflag || 0;
            for (var i = 0; i < 32; i++) {
              HEAP8[(argp + i)+(17)] = termios.c_cc[i] || 0;
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
            var argp = syscallGetVarargP();
            var c_iflag = HEAP32[((argp)>>2)];
            var c_oflag = HEAP32[(((argp)+(4))>>2)];
            var c_cflag = HEAP32[(((argp)+(8))>>2)];
            var c_lflag = HEAP32[(((argp)+(12))>>2)];
            var c_cc = []
            for (var i = 0; i < 32; i++) {
              c_cc.push(HEAP8[(argp + i)+(17)]);
            }
            return stream.tty.ops.ioctl_tcsets(stream.tty, op, { c_iflag, c_oflag, c_cflag, c_lflag, c_cc });
          }
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -59;
          var argp = syscallGetVarargP();
          HEAP32[((argp)>>2)] = 0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -59;
          return -28; // not supported
        }
        case 21537:
        case 21531: {
          var argp = syscallGetVarargP();
          return FS.ioctl(stream, op, argp);
        }
        case 21523: {
          // TODO: in theory we should write to the winsize struct that gets
          // passed in, but for now musl doesn't read anything on it
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tiocgwinsz) {
            var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
            var argp = syscallGetVarargP();
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

  function ___syscall_lstat64(path, buf) {
  try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.writeStat(buf, FS.lstat(path));
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_newfstatat(dirfd, path, buf, flags) {
  try {
  
      path = SYSCALLS.getStr(path);
      var nofollow = flags & 256;
      var allowEmpty = flags & 4096;
      flags = flags & (~6400);
      assert(!flags, `unknown flags in __syscall_newfstatat: ${flags}`);
      path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
      return SYSCALLS.writeStat(buf, nofollow ? FS.lstat(path) : FS.stat(path));
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
      var mode = varargs ? syscallGetVarargI() : 0;
      return FS.open(path, flags, mode).fd;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  function ___syscall_stat64(path, buf) {
  try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.writeStat(buf, FS.stat(path));
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }

  var __abort_js = () =>
      abort('native code called abort()');

  var __emscripten_throw_longjmp = () => {
      throw Infinity;
    };

  
  
  
  
  
  var INT53_MAX = 9007199254740992;
  
  var INT53_MIN = -9007199254740992;
  var bigintToI53Checked = (num) => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);
  function __mmap_js(len, prot, flags, fd, offset, allocated, addr) {
    offset = bigintToI53Checked(offset);
  
  
  try {
  
      // musl's mmap doesn't allow values over a certain limit
      // see OFF_MASK in mmap.c.
      assert(!isNaN(offset));
      var stream = SYSCALLS.getStreamFromFD(fd);
      var res = FS.mmap(stream, len, offset, prot, flags);
      var ptr = res.ptr;
      HEAP32[((allocated)>>2)] = res.allocated;
      HEAPU32[((addr)>>2)] = ptr;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  ;
  }

  
  function __munmap_js(addr, len, prot, flags, fd, offset) {
    offset = bigintToI53Checked(offset);
  
  
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      if (prot & 2) {
        SYSCALLS.doMsync(addr, stream, len, flags, offset);
      }
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  ;
  }

  var _emscripten_get_now = () => performance.now();
  
  var _emscripten_date_now = () => Date.now();
  
  var nowIsMonotonic = 1;
  
  var checkWasiClock = (clock_id) => clock_id >= 0 && clock_id <= 3;
  
  function _clock_time_get(clk_id, ignored_precision, ptime) {
    ignored_precision = bigintToI53Checked(ignored_precision);
  
  
      if (!checkWasiClock(clk_id)) {
        return 28;
      }
      var now;
      // all wasi clocks but realtime are monotonic
      if (clk_id === 0) {
        now = _emscripten_date_now();
      } else if (nowIsMonotonic) {
        now = _emscripten_get_now();
      } else {
        return 52;
      }
      // "now" is in ms, and wasi times are in ns.
      var nsec = Math.round(now * 1000 * 1000);
      HEAP64[((ptime)>>3)] = BigInt(nsec);
      return 0;
    ;
  }

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
        // In WASM_BIGINT mode we support passing i64 values as bigint.
        validChars.push('j');
        assert(validChars.includes(chr), `Invalid character ${ch}("${chr}") in readEmAsmArgs! Use only [${validChars}], and do not specify "v" for void return argument.`);
        // Floats are always passed as doubles, so all types except for 'i'
        // are 8 bytes and require alignment.
        var wide = (ch != 105);
        wide &= (ch != 112);
        buf += wide && (buf % 8) ? 4 : 0;
        readEmAsmArgsArray.push(
          // Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
          ch == 112 ? HEAPU32[((buf)>>2)] :
          ch == 106 ? HEAP64[((buf)>>3)] :
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
      return ASM_CONSTS[code](...args);
    };
  var _emscripten_asm_const_int = (code, sigPtr, argbuf) => {
      return runEmAsmFunction(code, sigPtr, argbuf);
    };

  
  var runtimeKeepaliveCounter = 0;
  var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
  var _proc_exit = (code) => {
      EXITSTATUS = code;
      if (!keepRuntimeAlive()) {
        Module['onExit']?.(code);
        ABORT = true;
      }
      quit_(code, new ExitStatus(code));
    };
  
  
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


  var getHeapMax = () =>
      // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
      // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
      // for any code that deals with heap sizes, which would require special
      // casing all heap size related code to treat 0 specially.
      2147483648;
  
  
  var growMemory = (size) => {
      var oldHeapSize = wasmMemory.buffer.byteLength;
      var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow(pages); // .grow() takes a delta compared to the previous size
        updateMemoryViews();
        return 1 /*success*/;
      } catch(e) {
        err(`growMemory: Attempted to grow heap from ${oldHeapSize} bytes to ${size} bytes, but got error: ${e}`);
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
  
      // Loop through potential heap size increases. If we attempt a too eager
      // reservation that fails, cut down on the attempted size and reserve a
      // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
        var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
  
        var replacement = growMemory(newSize);
        if (replacement) {
  
          return true;
        }
      }
      err(`Failed to grow the heap from ${oldSize} bytes to ${newSize} bytes, not enough memory!`);
      return false;
    };

  var ENV = {
  };
  
  var getExecutableName = () => thisProgram || './this.program';
  var getEnvStrings = () => {
      if (!getEnvStrings.strings) {
        // Default values.
        // Browser language detection #8751
        var lang = ((typeof navigator == 'object' && navigator.language) || 'C').replace('-', '_') + '.UTF-8';
        var env = {
          'USER': 'web_user',
          'LOGNAME': 'web_user',
          'PATH': '/',
          'PWD': '/',
          'HOME': '/home/web_user',
          'LANG': lang,
          '_': getExecutableName()
        };
        // Apply the user-provided values, if any.
        for (var x in ENV) {
          // x is a key in ENV; if ENV[x] is undefined, that means it was
          // explicitly set to be so. We allow user code to do that to
          // force variables with default values to remain unset.
          if (ENV[x] === undefined) delete env[x];
          else env[x] = ENV[x];
        }
        var strings = [];
        for (var x in env) {
          strings.push(`${x}=${env[x]}`);
        }
        getEnvStrings.strings = strings;
      }
      return getEnvStrings.strings;
    };
  
  var _environ_get = (__environ, environ_buf) => {
      var bufSize = 0;
      var envp = 0;
      for (var string of getEnvStrings()) {
        var ptr = environ_buf + bufSize;
        HEAPU32[(((__environ)+(envp))>>2)] = ptr;
        bufSize += stringToUTF8(string, ptr, Infinity) + 1;
        envp += 4;
      }
      return 0;
    };

  
  var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
      var strings = getEnvStrings();
      HEAPU32[((penviron_count)>>2)] = strings.length;
      var bufSize = 0;
      for (var string of strings) {
        bufSize += lengthBytesUTF8(string) + 1;
      }
      HEAPU32[((penviron_buf_size)>>2)] = bufSize;
      return 0;
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
        if (typeof offset != 'undefined') {
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

  
  function _fd_seek(fd, offset, whence, newOffset) {
    offset = bigintToI53Checked(offset);
  
  
  try {
  
      if (isNaN(offset)) return 61;
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.llseek(stream, offset, whence);
      HEAP64[((newOffset)>>3)] = BigInt(stream.position);
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
        if (curr < len) {
          // No more space to write.
          break;
        }
        if (typeof offset != 'undefined') {
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

  var wasmTableMirror = [];
  
  
  var getWasmTableEntry = (funcPtr) => {
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        /** @suppress {checkTypes} */
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
      }
      /** @suppress {checkTypes} */
      assert(wasmTable.get(funcPtr) == func, 'JavaScript-side Wasm function table mirror is out of date!');
      return func;
    };

  
  
  var stringToNewUTF8 = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = _malloc(size);
      if (ret) stringToUTF8(str, ret, size);
      return ret;
    };

  var AsciiToString = (ptr) => {
      var str = '';
      while (1) {
        var ch = HEAPU8[ptr++];
        if (!ch) return str;
        str += String.fromCharCode(ch);
      }
    };



  var handleException = (e) => {
      // Certain exception types we do not treat as errors since they are used for
      // internal control flow.
      // 1. ExitStatus, which is thrown by exit()
      // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
      //    that wish to return to JS event loop.
      if (e instanceof ExitStatus || e == 'unwind') {
        return EXITSTATUS;
      }
      checkStackCookie();
      if (e instanceof WebAssembly.RuntimeError) {
        if (_emscripten_stack_get_current() <= 0) {
          err('Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 65536)');
        }
      }
      quit_(1, e);
    };
  
  
  
  var maybeExit = () => {
      if (!keepRuntimeAlive()) {
        try {
          _exit(EXITSTATUS);
        } catch (e) {
          handleException(e);
        }
      }
    };
  var callUserCallback = (func) => {
      if (ABORT) {
        err('user callback triggered after runtime exited or application aborted.  Ignoring.');
        return;
      }
      try {
        func();
        maybeExit();
      } catch (e) {
        handleException(e);
      }
    };
  
  function getFullscreenElement() {
      return document.fullscreenElement || document.mozFullScreenElement ||
             document.webkitFullscreenElement || document.webkitCurrentFullScreenElement ||
             document.msFullscreenElement;
    }
  
  /** @param {number=} timeout */
  var safeSetTimeout = (func, timeout) => {
      
      return setTimeout(() => {
        
        callUserCallback(func);
      }, timeout);
    };
  
  
  
  var Browser = {
  useWebGL:false,
  isFullscreen:false,
  pointerLock:false,
  moduleContextCreatedCallbacks:[],
  workers:[],
  preloadedImages:{
  },
  preloadedAudios:{
  },
  getCanvas:() => Module['canvas'],
  init() {
        if (Browser.initted) return;
        Browser.initted = true;
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module['noImageDecoding'] && /\.(jpg|jpeg|png|bmp|webp)$/i.test(name);
        };
        imagePlugin['handle'] = async function imagePlugin_handle(byteArray, name) {
          var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
          if (b.size !== byteArray.length) { // Safari bug #118630
            // Safari's Blob can only take an ArrayBuffer
            b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
          }
          var url = URL.createObjectURL(b);
          return new Promise((resolve, reject) => {
            var img = new Image();
            img.onload = () => {
              assert(img.complete, `Image ${name} could not be decoded`);
              var canvas = /** @type {!HTMLCanvasElement} */ (document.createElement('canvas'));
              canvas.width = img.width;
              canvas.height = img.height;
              var ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              Browser.preloadedImages[name] = canvas;
              URL.revokeObjectURL(url);
              resolve(byteArray);
            };
            img.onerror = (event) => {
              err(`Image ${url} could not be decoded`);
              reject();
            };
            img.src = url;
          });
        };
        preloadPlugins.push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module['noAudioDecoding'] && name.slice(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = async function audioPlugin_handle(byteArray, name) {
          return new Promise((resolve, reject) => {
            var done = false;
            function finish(audio) {
              if (done) return;
              done = true;
              Browser.preloadedAudios[name] = audio;
              resolve(byteArray);
            }
            var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            var url = URL.createObjectURL(b); // XXX we never revoke this!
            var audio = new Audio();
            audio.addEventListener('canplaythrough', () => finish(audio), false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              err(`warning: browser could not fully decode audio ${name}, trying slower base64 approach`);
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.slice(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            safeSetTimeout(() => {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          });
        };
        preloadPlugins.push(audioPlugin);
  
        // Canvas event setup
  
        function pointerLockChange() {
          var canvas = Browser.getCanvas();
          Browser.pointerLock = document.pointerLockElement === canvas;
        }
        var canvas = Browser.getCanvas();
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", (ev) => {
              if (!Browser.pointerLock && Browser.getCanvas().requestPointerLock) {
                Browser.getCanvas().requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },
  createContext(/** @type {HTMLCanvasElement} */ canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module['ctx'] && canvas == Browser.getCanvas()) return Module['ctx']; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false,
            majorVersion: 1,
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          // This check of existence of GL is here to satisfy Closure compiler, which yells if variable GL is referenced below but GL object is not
          // actually compiled in because application is not doing any GL operations. TODO: Ideally if GL is not being used, this function
          // Browser.createContext() should not even be emitted.
          if (typeof GL != 'undefined') {
            contextHandle = GL.createContext(canvas, contextAttributes);
            if (contextHandle) {
              ctx = GL.getContext(contextHandle).GLctx;
            }
          }
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx == 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
          Module['ctx'] = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Browser.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach((callback) => callback());
          Browser.init();
        }
        return ctx;
      },
  fullscreenHandlersInstalled:false,
  lockPointer:undefined,
  resizeCanvas:undefined,
  requestFullscreen(lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        if (typeof Browser.lockPointer == 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas == 'undefined') Browser.resizeCanvas = false;
  
        var canvas = Browser.getCanvas();
        function fullscreenChange() {
          Browser.isFullscreen = false;
          var canvasContainer = canvas.parentNode;
          if (getFullscreenElement() === canvasContainer) {
            canvas.exitFullscreen = Browser.exitFullscreen;
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullscreen = true;
            if (Browser.resizeCanvas) {
              Browser.setFullscreenCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          } else {
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
  
            if (Browser.resizeCanvas) {
              Browser.setWindowedCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          }
          Module['onFullScreen']?.(Browser.isFullscreen);
          Module['onFullscreen']?.(Browser.isFullscreen);
        }
  
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullscreenChange, false);
          document.addEventListener('mozfullscreenchange', fullscreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullscreenChange, false);
          document.addEventListener('MSFullscreenChange', fullscreenChange, false);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
  
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullscreen = canvasContainer['requestFullscreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullscreen'] ? () => canvasContainer['webkitRequestFullscreen'](Element['ALLOW_KEYBOARD_INPUT']) : null) ||
                                           (canvasContainer['webkitRequestFullScreen'] ? () => canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) : null);
  
        canvasContainer.requestFullscreen();
      },
  requestFullScreen() {
        abort('Module.requestFullScreen has been replaced by Module.requestFullscreen (without a capital S)');
      },
  exitFullscreen() {
        // This is workaround for chrome. Trying to exit from fullscreen
        // not in fullscreen state will cause "TypeError: Document not active"
        // in chrome. See https://github.com/emscripten-core/emscripten/pull/8236
        if (!Browser.isFullscreen) {
          return false;
        }
  
        var CFS = document['exitFullscreen'] ||
                  document['cancelFullScreen'] ||
                  document['mozCancelFullScreen'] ||
                  document['msExitFullscreen'] ||
                  document['webkitCancelFullScreen'] ||
            (() => {});
        CFS.apply(document, []);
        return true;
      },
  safeSetTimeout(func, timeout) {
        // Legacy function, this is used by the SDL2 port so we need to keep it
        // around at least until that is updated.
        // See https://github.com/libsdl-org/SDL/pull/6304
        return safeSetTimeout(func, timeout);
      },
  getMimetype(name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.slice(name.lastIndexOf('.')+1)];
      },
  getUserMedia(func) {
        window.getUserMedia ||= navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        window.getUserMedia(func);
      },
  getMovementX(event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },
  getMovementY(event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },
  getMouseWheelDelta(event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll':
            // 3 lines make up a step
            delta = event.detail / 3;
            break;
          case 'mousewheel':
            // 120 units make up a step
            delta = event.wheelDelta / 120;
            break;
          case 'wheel':
            delta = event.deltaY
            switch (event.deltaMode) {
              case 0:
                // DOM_DELTA_PIXEL: 100 pixels make up a step
                delta /= 100;
                break;
              case 1:
                // DOM_DELTA_LINE: 3 lines make up a step
                delta /= 3;
                break;
              case 2:
                // DOM_DELTA_PAGE: A page makes up 80 steps
                delta *= 80;
                break;
              default:
                abort('unrecognized mouse wheel delta mode: ' + event.deltaMode);
            }
            break;
          default:
            abort('unrecognized mouse wheel event: ' + event.type);
        }
        return delta;
      },
  mouseX:0,
  mouseY:0,
  mouseMovementX:0,
  mouseMovementY:0,
  touches:{
  },
  lastTouches:{
  },
  calculateMouseCoords(pageX, pageY) {
        // Calculate the movement based on the changes
        // in the coordinates.
        var canvas = Browser.getCanvas();
        var rect = canvas.getBoundingClientRect();
  
        // Neither .scrollX or .pageXOffset are defined in a spec, but
        // we prefer .scrollX because it is currently in a spec draft.
        // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
        var scrollX = ((typeof window.scrollX != 'undefined') ? window.scrollX : window.pageXOffset);
        var scrollY = ((typeof window.scrollY != 'undefined') ? window.scrollY : window.pageYOffset);
        // If this assert lands, it's likely because the browser doesn't support scrollX or pageXOffset
        // and we have no viable fallback.
        assert((typeof scrollX != 'undefined') && (typeof scrollY != 'undefined'), 'Unable to retrieve scroll position, mouse positions likely broken.');
        var adjustedX = pageX - (scrollX + rect.left);
        var adjustedY = pageY - (scrollY + rect.top);
  
        // the canvas might be CSS-scaled compared to its backbuffer;
        // SDL-using content will want mouse coordinates in terms
        // of backbuffer units.
        adjustedX = adjustedX * (canvas.width / rect.width);
        adjustedY = adjustedY * (canvas.height / rect.height);
  
        return { x: adjustedX, y: adjustedY };
      },
  setMouseCoords(pageX, pageY) {
        const {x, y} = Browser.calculateMouseCoords(pageX, pageY);
        Browser.mouseMovementX = x - Browser.mouseX;
        Browser.mouseMovementY = y - Browser.mouseY;
        Browser.mouseX = x;
        Browser.mouseY = y;
      },
  calculateMouseEvent(event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
  
          // add the mouse delta to the current absolute mouse position
          Browser.mouseX += Browser.mouseMovementX;
          Browser.mouseY += Browser.mouseMovementY;
        } else {
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var coords = Browser.calculateMouseCoords(touch.pageX, touch.pageY);
  
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier];
              last ||= coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            }
            return;
          }
  
          Browser.setMouseCoords(event.pageX, event.pageY);
        }
      },
  resizeListeners:[],
  updateResizeListeners() {
        var canvas = Browser.getCanvas();
        Browser.resizeListeners.forEach((listener) => listener(canvas.width, canvas.height));
      },
  setCanvasSize(width, height, noUpdates) {
        var canvas = Browser.getCanvas();
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },
  windowedWidth:0,
  windowedHeight:0,
  setFullscreenCanvasSize() {
        // check if SDL is available
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)] = flags;
        }
        Browser.updateCanvasDimensions(Browser.getCanvas());
        Browser.updateResizeListeners();
      },
  setWindowedCanvasSize() {
        // check if SDL is available
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)] = flags;
        }
        Browser.updateCanvasDimensions(Browser.getCanvas());
        Browser.updateResizeListeners();
      },
  updateCanvasDimensions(canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if ((getFullscreenElement() === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },
  };
  var requestFullscreen = Browser.requestFullscreen;

  FS.createPreloadedFile = FS_createPreloadedFile;
  FS.preloadFile = FS_preloadFile;
  FS.staticInit();;
// End JS library code

// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.

{

  // Begin ATMODULES hooks
  if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];
if (Module['preloadPlugins']) preloadPlugins = Module['preloadPlugins'];
if (Module['print']) out = Module['print'];
if (Module['printErr']) err = Module['printErr'];
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
  // End ATMODULES hooks

  checkIncomingModuleAPI();

  if (Module['arguments']) arguments_ = Module['arguments'];
  if (Module['thisProgram']) thisProgram = Module['thisProgram'];

  // Assertions on removed incoming Module JS APIs.
  assert(typeof Module['memoryInitializerPrefixURL'] == 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['pthreadMainPrefixURL'] == 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['cdInitializerPrefixURL'] == 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['filePackagePrefixURL'] == 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['read'] == 'undefined', 'Module.read option was removed');
  assert(typeof Module['readAsync'] == 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
  assert(typeof Module['readBinary'] == 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
  assert(typeof Module['setWindowTitle'] == 'undefined', 'Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)');
  assert(typeof Module['TOTAL_MEMORY'] == 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');
  assert(typeof Module['ENVIRONMENT'] == 'undefined', 'Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)');
  assert(typeof Module['STACK_SIZE'] == 'undefined', 'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time')
  // If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
  assert(typeof Module['wasmMemory'] == 'undefined', 'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally');
  assert(typeof Module['INITIAL_MEMORY'] == 'undefined', 'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically');

  if (Module['preInit']) {
    if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
    while (Module['preInit'].length > 0) {
      Module['preInit'].shift()();
    }
  }
  consumedModuleProp('preInit');
}

// Begin runtime exports
  Module['UTF8ToString'] = UTF8ToString;
  Module['AsciiToString'] = AsciiToString;
  Module['stringToNewUTF8'] = stringToNewUTF8;
  Module['requestFullscreen'] = requestFullscreen;
  Module['FS'] = FS;
  var missingLibrarySymbols = [
  'writeI53ToI64',
  'writeI53ToI64Clamped',
  'writeI53ToI64Signaling',
  'writeI53ToU64Clamped',
  'writeI53ToU64Signaling',
  'readI53FromI64',
  'readI53FromU64',
  'convertI32PairToI53',
  'convertI32PairToI53Checked',
  'convertU32PairToI53',
  'stackAlloc',
  'getTempRet0',
  'setTempRet0',
  'createNamedFunction',
  'withStackSave',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'runMainThreadEmAsm',
  'jstoi_q',
  'autoResumeAudioContext',
  'getDynCaller',
  'dynCall',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'asmjsMangle',
  'HandleAllocator',
  'addOnInit',
  'addOnPostCtor',
  'addOnPreMain',
  'addOnExit',
  'STACK_SIZE',
  'STACK_ALIGN',
  'POINTER_SIZE',
  'ASSERTIONS',
  'ccall',
  'cwrap',
  'convertJsFunctionToWasm',
  'getEmptyTableSlot',
  'updateTableMap',
  'getFunctionAddress',
  'addFunction',
  'removeFunction',
  'intArrayToString',
  'stringToAscii',
  'UTF16ToString',
  'stringToUTF16',
  'lengthBytesUTF16',
  'UTF32ToString',
  'stringToUTF32',
  'lengthBytesUTF32',
  'stringToUTF8OnStack',
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
  'registerBatteryEventCallback',
  'setCanvasElementSize',
  'getCanvasElementSize',
  'jsStackTrace',
  'getCallstack',
  'convertPCtoSourceLocation',
  'wasiRightsToMuslOFlags',
  'wasiOFlagsToMuslOFlags',
  'setImmediateWrapped',
  'safeRequestAnimationFrame',
  'clearImmediateWrapped',
  'registerPostMainLoop',
  'registerPreMainLoop',
  'getPromise',
  'makePromise',
  'idsToPromises',
  'makePromiseCallback',
  'findMatchingCatch',
  'Browser_asyncPrepareDataCounter',
  'isLeapYear',
  'ydayFromDate',
  'arraySum',
  'addDays',
  'getSocketFromFD',
  'getSocketAddress',
  'FS_mkdirTree',
  '_setNetworkCallback',
  'heapObjectForWebGLType',
  'toTypedArrayIndex',
  'webgl_enable_ANGLE_instanced_arrays',
  'webgl_enable_OES_vertex_array_object',
  'webgl_enable_WEBGL_draw_buffers',
  'webgl_enable_WEBGL_multi_draw',
  'webgl_enable_EXT_polygon_offset_clamp',
  'webgl_enable_EXT_clip_control',
  'webgl_enable_WEBGL_polygon_mode',
  'emscriptenWebGLGet',
  'computeUnpackAlignedImageSize',
  'colorChannelsInGlTextureFormat',
  'emscriptenWebGLGetTexPixelData',
  'emscriptenWebGLGetUniform',
  'webglGetUniformLocation',
  'webglPrepareUniformLocationsBeforeFirstUse',
  'webglGetLeftBracePos',
  'emscriptenWebGLGetVertexAttrib',
  '__glGetActiveAttribOrUniform',
  'writeGLArray',
  'registerWebGlEventCallback',
  'runAndAbortIfError',
  'ALLOC_NORMAL',
  'ALLOC_STACK',
  'allocate',
  'writeStringToMemory',
  'writeAsciiToMemory',
  'allocateUTF8',
  'allocateUTF8OnStack',
  'demangle',
  'stackTrace',
  'getNativeTypeSize',
];
missingLibrarySymbols.forEach(missingLibrarySymbol)

  var unexportedSymbols = [
  'run',
  'out',
  'err',
  'callMain',
  'abort',
  'wasmExports',
  'HEAP64',
  'HEAPU64',
  'writeStackCookie',
  'checkStackCookie',
  'INT53_MAX',
  'INT53_MIN',
  'bigintToI53Checked',
  'stackSave',
  'stackRestore',
  'ptrToString',
  'zeroMemory',
  'exitJS',
  'getHeapMax',
  'growMemory',
  'ENV',
  'ERRNO_CODES',
  'strError',
  'DNS',
  'Protocols',
  'Sockets',
  'timers',
  'warnOnce',
  'readEmAsmArgsArray',
  'readEmAsmArgs',
  'runEmAsmFunction',
  'getExecutableName',
  'handleException',
  'keepRuntimeAlive',
  'callUserCallback',
  'maybeExit',
  'asyncLoad',
  'alignMemory',
  'mmapAlloc',
  'wasmTable',
  'wasmMemory',
  'getUniqueRunDependency',
  'noExitRuntime',
  'addRunDependency',
  'removeRunDependency',
  'addOnPreRun',
  'addOnPostRun',
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
  'JSEvents',
  'specialHTMLTargets',
  'currentFullscreenStrategy',
  'restoreOldWindowedStyle',
  'UNWIND_CACHE',
  'ExitStatus',
  'getEnvStrings',
  'checkWasiClock',
  'doReadv',
  'doWritev',
  'initRandomFill',
  'randomFill',
  'safeSetTimeout',
  'emSetImmediate',
  'emClearImmediate_deps',
  'emClearImmediate',
  'promiseMap',
  'uncaughtExceptionCount',
  'exceptionLast',
  'exceptionCaught',
  'ExceptionInfo',
  'Browser',
  'requestFullScreen',
  'setCanvasSize',
  'getUserMedia',
  'createContext',
  'getPreloadedImageData__data',
  'wget',
  'MONTH_DAYS_REGULAR',
  'MONTH_DAYS_LEAP',
  'MONTH_DAYS_REGULAR_CUMULATIVE',
  'MONTH_DAYS_LEAP_CUMULATIVE',
  'SYSCALLS',
  'preloadPlugins',
  'FS_createPreloadedFile',
  'FS_preloadFile',
  'FS_modeStringToFlags',
  'FS_getMode',
  'FS_stdin_getChar_buffer',
  'FS_stdin_getChar',
  'FS_unlink',
  'FS_createPath',
  'FS_createDevice',
  'FS_readFile',
  'FS_root',
  'FS_mounts',
  'FS_devices',
  'FS_streams',
  'FS_nextInode',
  'FS_nameTable',
  'FS_currentPath',
  'FS_initialized',
  'FS_ignorePermissions',
  'FS_filesystems',
  'FS_syncFSRequests',
  'FS_readFiles',
  'FS_lookupPath',
  'FS_getPath',
  'FS_hashName',
  'FS_hashAddNode',
  'FS_hashRemoveNode',
  'FS_lookupNode',
  'FS_createNode',
  'FS_destroyNode',
  'FS_isRoot',
  'FS_isMountpoint',
  'FS_isFile',
  'FS_isDir',
  'FS_isLink',
  'FS_isChrdev',
  'FS_isBlkdev',
  'FS_isFIFO',
  'FS_isSocket',
  'FS_flagsToPermissionString',
  'FS_nodePermissions',
  'FS_mayLookup',
  'FS_mayCreate',
  'FS_mayDelete',
  'FS_mayOpen',
  'FS_checkOpExists',
  'FS_nextfd',
  'FS_getStreamChecked',
  'FS_getStream',
  'FS_createStream',
  'FS_closeStream',
  'FS_dupStream',
  'FS_doSetAttr',
  'FS_chrdev_stream_ops',
  'FS_major',
  'FS_minor',
  'FS_makedev',
  'FS_registerDevice',
  'FS_getDevice',
  'FS_getMounts',
  'FS_syncfs',
  'FS_mount',
  'FS_unmount',
  'FS_lookup',
  'FS_mknod',
  'FS_statfs',
  'FS_statfsStream',
  'FS_statfsNode',
  'FS_create',
  'FS_mkdir',
  'FS_mkdev',
  'FS_symlink',
  'FS_rename',
  'FS_rmdir',
  'FS_readdir',
  'FS_readlink',
  'FS_stat',
  'FS_fstat',
  'FS_lstat',
  'FS_doChmod',
  'FS_chmod',
  'FS_lchmod',
  'FS_fchmod',
  'FS_doChown',
  'FS_chown',
  'FS_lchown',
  'FS_fchown',
  'FS_doTruncate',
  'FS_truncate',
  'FS_ftruncate',
  'FS_utime',
  'FS_open',
  'FS_close',
  'FS_isClosed',
  'FS_llseek',
  'FS_read',
  'FS_write',
  'FS_mmap',
  'FS_msync',
  'FS_ioctl',
  'FS_writeFile',
  'FS_cwd',
  'FS_chdir',
  'FS_createDefaultDirectories',
  'FS_createDefaultDevices',
  'FS_createSpecialDirectories',
  'FS_createStandardStreams',
  'FS_staticInit',
  'FS_init',
  'FS_quit',
  'FS_findObject',
  'FS_analyzePath',
  'FS_createFile',
  'FS_createDataFile',
  'FS_forceLoadFile',
  'FS_createLazyFile',
  'FS_absolutePath',
  'FS_createFolder',
  'FS_createLink',
  'FS_joinPath',
  'FS_mmapAlloc',
  'FS_standardizePath',
  'MEMFS',
  'TTY',
  'PIPEFS',
  'SOCKFS',
  'tempFixedLengthArray',
  'miniTempWebGLFloatBuffers',
  'miniTempWebGLIntBuffers',
  'GL',
  'AL',
  'GLUT',
  'EGL',
  'GLEW',
  'IDBStore',
  'SDL',
  'SDL_gfx',
  'print',
  'printErr',
  'jstoi_s',
];
unexportedSymbols.forEach(unexportedRuntimeSymbol);

  // End runtime exports
  // Begin JS library exports
  // End JS library exports

// end include: postlibrary.js

function checkIncomingModuleAPI() {
  ignoredModuleProp('fetchSettings');
}
var ASM_CONSTS = {
  1204312: ($0) => { startToDebuggerMessage($0); },  
 1204344: ($0, $1, $2) => { writeDebuggerBuffer($0, new Uint8Array(Module.HEAPU8.buffer, $1, $2)); },  
 1204419: ($0, $1, $2) => { writeDebuggerBuffer($0, new Uint8Array(Module.HEAPU8.buffer, $1, $2)); },  
 1204494: ($0) => { finishToDebuggerMessage($0); },  
 1204527: ($0, $1) => { lvglCreateScreen($0, $1); },  
 1204557: ($0, $1) => { lvglDeleteScreen($0, $1); },  
 1204587: ($0) => { lvglScreenTick($0); },  
 1204611: ($0, $1, $2, $3) => { lvglOnEventHandler($0, $1, $2, $3); },  
 1204651: ($0, $1) => { return getLvglScreenByName($0, UTF8ToString($1)); },  
 1204705: ($0, $1) => { return getLvglObjectByName($0, UTF8ToString($1)); },  
 1204759: ($0, $1) => { return getLvglGroupByName($0, UTF8ToString($1)); },  
 1204812: ($0, $1) => { return getLvglStyleByName($0, UTF8ToString($1)); },  
 1204865: ($0, $1) => { return getLvglImageByName($0, UTF8ToString($1)); },  
 1204918: ($0, $1) => { return getLvglFontByName($0, UTF8ToString($1)); },  
 1204970: ($0, $1) => { return getLvglObjectNameFromIndex($0, $1); },  
 1205017: ($0, $1, $2) => { lvglObjAddStyle($0, $1, $2); },  
 1205050: ($0, $1, $2) => { lvglObjRemoveStyle($0, $1, $2); },  
 1205086: ($0, $1) => { lvglSetColorTheme($0, UTF8ToString($1)); },  
 1205131: ($0, $1, $2, $3, $4, $5) => { return eez_mqtt_init($0, UTF8ToString($1), UTF8ToString($2), $3, UTF8ToString($4), UTF8ToString($5)); },  
 1205237: ($0, $1) => { return eez_mqtt_deinit($0, $1); },  
 1205273: ($0, $1) => { return eez_mqtt_connect($0, $1); },  
 1205310: ($0, $1) => { return eez_mqtt_disconnect($0, $1); },  
 1205350: ($0, $1, $2) => { return eez_mqtt_subscribe($0, $1, UTF8ToString($2)); },  
 1205407: ($0, $1, $2) => { return eez_mqtt_unsubscribe($0, $1, UTF8ToString($2)); },  
 1205466: ($0, $1, $2, $3) => { return eez_mqtt_publish($0, $1, UTF8ToString($2), UTF8ToString($3)); }
};

// Imports from the Wasm binary.
var _lv_display_flush_ready = Module['_lv_display_flush_ready'] = makeInvalidEarlyAccess('_lv_display_flush_ready');
var _lv_area_get_width = Module['_lv_area_get_width'] = makeInvalidEarlyAccess('_lv_area_get_width');
var _lv_malloc = Module['_lv_malloc'] = makeInvalidEarlyAccess('_lv_malloc');
var _lv_free = Module['_lv_free'] = makeInvalidEarlyAccess('_lv_free');
var _lvglSetEncoderGroup = Module['_lvglSetEncoderGroup'] = makeInvalidEarlyAccess('_lvglSetEncoderGroup');
var _lv_indev_set_group = Module['_lv_indev_set_group'] = makeInvalidEarlyAccess('_lv_indev_set_group');
var _lvglSetKeyboardGroup = Module['_lvglSetKeyboardGroup'] = makeInvalidEarlyAccess('_lvglSetKeyboardGroup');
var _hal_init = Module['_hal_init'] = makeInvalidEarlyAccess('_hal_init');
var _malloc = Module['_malloc'] = makeInvalidEarlyAccess('_malloc');
var _lv_display_create = Module['_lv_display_create'] = makeInvalidEarlyAccess('_lv_display_create');
var _lv_display_set_flush_cb = Module['_lv_display_set_flush_cb'] = makeInvalidEarlyAccess('_lv_display_set_flush_cb');
var _lv_display_set_buffers = Module['_lv_display_set_buffers'] = makeInvalidEarlyAccess('_lv_display_set_buffers');
var _lv_indev_create = Module['_lv_indev_create'] = makeInvalidEarlyAccess('_lv_indev_create');
var _lv_indev_set_type = Module['_lv_indev_set_type'] = makeInvalidEarlyAccess('_lv_indev_set_type');
var _lv_indev_set_read_cb = Module['_lv_indev_set_read_cb'] = makeInvalidEarlyAccess('_lv_indev_set_read_cb');
var _lv_fs_drv_init = Module['_lv_fs_drv_init'] = makeInvalidEarlyAccess('_lv_fs_drv_init');
var _lv_fs_drv_register = Module['_lv_fs_drv_register'] = makeInvalidEarlyAccess('_lv_fs_drv_register');
var _init = Module['_init'] = makeInvalidEarlyAccess('_init');
var _lv_init = Module['_lv_init'] = makeInvalidEarlyAccess('_lv_init');
var _lv_display_get_default = Module['_lv_display_get_default'] = makeInvalidEarlyAccess('_lv_display_get_default');
var _lv_palette_main = Module['_lv_palette_main'] = makeInvalidEarlyAccess('_lv_palette_main');
var _lv_theme_default_init = Module['_lv_theme_default_init'] = makeInvalidEarlyAccess('_lv_theme_default_init');
var _lv_display_set_theme = Module['_lv_display_set_theme'] = makeInvalidEarlyAccess('_lv_display_set_theme');
var _mainLoop = Module['_mainLoop'] = makeInvalidEarlyAccess('_mainLoop');
var _lv_tick_inc = Module['_lv_tick_inc'] = makeInvalidEarlyAccess('_lv_tick_inc');
var _lv_timer_handler = Module['_lv_timer_handler'] = makeInvalidEarlyAccess('_lv_timer_handler');
var _getSyncedBuffer = Module['_getSyncedBuffer'] = makeInvalidEarlyAccess('_getSyncedBuffer');
var _isRTL = Module['_isRTL'] = makeInvalidEarlyAccess('_isRTL');
var _onPointerEvent = Module['_onPointerEvent'] = makeInvalidEarlyAccess('_onPointerEvent');
var _onMouseWheelEvent = Module['_onMouseWheelEvent'] = makeInvalidEarlyAccess('_onMouseWheelEvent');
var _onKeyPressed = Module['_onKeyPressed'] = makeInvalidEarlyAccess('_onKeyPressed');
var _lv_spinner_create = Module['_lv_spinner_create'] = makeInvalidEarlyAccess('_lv_spinner_create');
var _lv_qrcode_create = Module['_lv_qrcode_create'] = makeInvalidEarlyAccess('_lv_qrcode_create');
var _lv_obj_has_flag = Module['_lv_obj_has_flag'] = makeInvalidEarlyAccess('_lv_obj_has_flag');
var _lv_obj_delete = Module['_lv_obj_delete'] = makeInvalidEarlyAccess('_lv_obj_delete');
var _getStudioSymbols = Module['_getStudioSymbols'] = makeInvalidEarlyAccess('_getStudioSymbols');
var _lv_color_hex = Module['_lv_color_hex'] = makeInvalidEarlyAccess('_lv_color_hex');
var _lv_style_init = Module['_lv_style_init'] = makeInvalidEarlyAccess('_lv_style_init');
var _lv_animimg_set_duration = Module['_lv_animimg_set_duration'] = makeInvalidEarlyAccess('_lv_animimg_set_duration');
var _lv_animimg_set_repeat_count = Module['_lv_animimg_set_repeat_count'] = makeInvalidEarlyAccess('_lv_animimg_set_repeat_count');
var _lv_animimg_set_src = Module['_lv_animimg_set_src'] = makeInvalidEarlyAccess('_lv_animimg_set_src');
var _lv_animimg_start = Module['_lv_animimg_start'] = makeInvalidEarlyAccess('_lv_animimg_start');
var _lv_arc_set_bg_end_angle = Module['_lv_arc_set_bg_end_angle'] = makeInvalidEarlyAccess('_lv_arc_set_bg_end_angle');
var _lv_arc_set_bg_start_angle = Module['_lv_arc_set_bg_start_angle'] = makeInvalidEarlyAccess('_lv_arc_set_bg_start_angle');
var _lv_arc_set_mode = Module['_lv_arc_set_mode'] = makeInvalidEarlyAccess('_lv_arc_set_mode');
var _lv_arc_set_range = Module['_lv_arc_set_range'] = makeInvalidEarlyAccess('_lv_arc_set_range');
var _lv_arc_set_rotation = Module['_lv_arc_set_rotation'] = makeInvalidEarlyAccess('_lv_arc_set_rotation');
var _lv_arc_set_value = Module['_lv_arc_set_value'] = makeInvalidEarlyAccess('_lv_arc_set_value');
var _lv_bar_set_mode = Module['_lv_bar_set_mode'] = makeInvalidEarlyAccess('_lv_bar_set_mode');
var _lv_bar_set_range = Module['_lv_bar_set_range'] = makeInvalidEarlyAccess('_lv_bar_set_range');
var _lv_bar_set_start_value = Module['_lv_bar_set_start_value'] = makeInvalidEarlyAccess('_lv_bar_set_start_value');
var _lv_bar_set_value = Module['_lv_bar_set_value'] = makeInvalidEarlyAccess('_lv_bar_set_value');
var _lv_buttonmatrix_set_map = Module['_lv_buttonmatrix_set_map'] = makeInvalidEarlyAccess('_lv_buttonmatrix_set_map');
var _lv_buttonmatrix_set_ctrl_map = Module['_lv_buttonmatrix_set_ctrl_map'] = makeInvalidEarlyAccess('_lv_buttonmatrix_set_ctrl_map');
var _lv_buttonmatrix_set_one_checked = Module['_lv_buttonmatrix_set_one_checked'] = makeInvalidEarlyAccess('_lv_buttonmatrix_set_one_checked');
var _lv_dropdown_set_dir = Module['_lv_dropdown_set_dir'] = makeInvalidEarlyAccess('_lv_dropdown_set_dir');
var _lv_dropdown_set_options = Module['_lv_dropdown_set_options'] = makeInvalidEarlyAccess('_lv_dropdown_set_options');
var _lv_dropdown_set_selected = Module['_lv_dropdown_set_selected'] = makeInvalidEarlyAccess('_lv_dropdown_set_selected');
var _lv_dropdown_set_symbol = Module['_lv_dropdown_set_symbol'] = makeInvalidEarlyAccess('_lv_dropdown_set_symbol');
var _lv_event_get_code = Module['_lv_event_get_code'] = makeInvalidEarlyAccess('_lv_event_get_code');
var _lv_event_get_user_data = Module['_lv_event_get_user_data'] = makeInvalidEarlyAccess('_lv_event_get_user_data');
var _lv_label_set_text = Module['_lv_label_set_text'] = makeInvalidEarlyAccess('_lv_label_set_text');
var _lv_label_set_long_mode = Module['_lv_label_set_long_mode'] = makeInvalidEarlyAccess('_lv_label_set_long_mode');
var _lv_color_to_32 = Module['_lv_color_to_32'] = makeInvalidEarlyAccess('_lv_color_to_32');
var _lv_led_set_brightness = Module['_lv_led_set_brightness'] = makeInvalidEarlyAccess('_lv_led_set_brightness');
var _lv_led_get_brightness = Module['_lv_led_get_brightness'] = makeInvalidEarlyAccess('_lv_led_get_brightness');
var _lv_led_set_color = Module['_lv_led_set_color'] = makeInvalidEarlyAccess('_lv_led_set_color');
var _lv_obj_get_state = Module['_lv_obj_get_state'] = makeInvalidEarlyAccess('_lv_obj_get_state');
var _lv_obj_set_pos = Module['_lv_obj_set_pos'] = makeInvalidEarlyAccess('_lv_obj_set_pos');
var _lv_obj_set_size = Module['_lv_obj_set_size'] = makeInvalidEarlyAccess('_lv_obj_set_size');
var _lv_obj_update_layout = Module['_lv_obj_update_layout'] = makeInvalidEarlyAccess('_lv_obj_update_layout');
var _lv_qrcode_set_size = Module['_lv_qrcode_set_size'] = makeInvalidEarlyAccess('_lv_qrcode_set_size');
var _lv_spinbox_set_range = Module['_lv_spinbox_set_range'] = makeInvalidEarlyAccess('_lv_spinbox_set_range');
var _lv_spinbox_set_step = Module['_lv_spinbox_set_step'] = makeInvalidEarlyAccess('_lv_spinbox_set_step');
var _lv_spinbox_set_digit_format = Module['_lv_spinbox_set_digit_format'] = makeInvalidEarlyAccess('_lv_spinbox_set_digit_format');
var _lv_spinbox_set_rollover = Module['_lv_spinbox_set_rollover'] = makeInvalidEarlyAccess('_lv_spinbox_set_rollover');
var _lv_spinbox_set_value = Module['_lv_spinbox_set_value'] = makeInvalidEarlyAccess('_lv_spinbox_set_value');
var _lv_tabview_set_tab_bar_size = Module['_lv_tabview_set_tab_bar_size'] = makeInvalidEarlyAccess('_lv_tabview_set_tab_bar_size');
var _lv_textarea_set_one_line = Module['_lv_textarea_set_one_line'] = makeInvalidEarlyAccess('_lv_textarea_set_one_line');
var _lv_textarea_set_password_mode = Module['_lv_textarea_set_password_mode'] = makeInvalidEarlyAccess('_lv_textarea_set_password_mode');
var _lv_textarea_set_placeholder_text = Module['_lv_textarea_set_placeholder_text'] = makeInvalidEarlyAccess('_lv_textarea_set_placeholder_text');
var _lv_textarea_set_accepted_chars = Module['_lv_textarea_set_accepted_chars'] = makeInvalidEarlyAccess('_lv_textarea_set_accepted_chars');
var _lv_textarea_set_max_length = Module['_lv_textarea_set_max_length'] = makeInvalidEarlyAccess('_lv_textarea_set_max_length');
var _lv_textarea_set_text = Module['_lv_textarea_set_text'] = makeInvalidEarlyAccess('_lv_textarea_set_text');
var _lv_roller_set_options = Module['_lv_roller_set_options'] = makeInvalidEarlyAccess('_lv_roller_set_options');
var _lv_roller_set_selected = Module['_lv_roller_set_selected'] = makeInvalidEarlyAccess('_lv_roller_set_selected');
var _lv_roller_get_option_count = Module['_lv_roller_get_option_count'] = makeInvalidEarlyAccess('_lv_roller_get_option_count');
var _lv_slider_set_mode = Module['_lv_slider_set_mode'] = makeInvalidEarlyAccess('_lv_slider_set_mode');
var _lv_slider_set_range = Module['_lv_slider_set_range'] = makeInvalidEarlyAccess('_lv_slider_set_range');
var _lv_slider_set_start_value = Module['_lv_slider_set_start_value'] = makeInvalidEarlyAccess('_lv_slider_set_start_value');
var _lv_slider_set_value = Module['_lv_slider_set_value'] = makeInvalidEarlyAccess('_lv_slider_set_value');
var _lv_arc_get_max_value = Module['_lv_arc_get_max_value'] = makeInvalidEarlyAccess('_lv_arc_get_max_value');
var _lv_arc_get_min_value = Module['_lv_arc_get_min_value'] = makeInvalidEarlyAccess('_lv_arc_get_min_value');
var _lv_arc_get_value = Module['_lv_arc_get_value'] = makeInvalidEarlyAccess('_lv_arc_get_value');
var _lv_bar_get_start_value = Module['_lv_bar_get_start_value'] = makeInvalidEarlyAccess('_lv_bar_get_start_value');
var _lv_bar_get_value = Module['_lv_bar_get_value'] = makeInvalidEarlyAccess('_lv_bar_get_value');
var _lv_dropdown_get_options = Module['_lv_dropdown_get_options'] = makeInvalidEarlyAccess('_lv_dropdown_get_options');
var _lv_dropdown_get_selected = Module['_lv_dropdown_get_selected'] = makeInvalidEarlyAccess('_lv_dropdown_get_selected');
var _lv_event_get_draw_task = Module['_lv_event_get_draw_task'] = makeInvalidEarlyAccess('_lv_event_get_draw_task');
var _lv_label_get_text = Module['_lv_label_get_text'] = makeInvalidEarlyAccess('_lv_label_get_text');
var _lv_roller_get_options = Module['_lv_roller_get_options'] = makeInvalidEarlyAccess('_lv_roller_get_options');
var _lv_roller_get_selected = Module['_lv_roller_get_selected'] = makeInvalidEarlyAccess('_lv_roller_get_selected');
var _lv_slider_get_max_value = Module['_lv_slider_get_max_value'] = makeInvalidEarlyAccess('_lv_slider_get_max_value');
var _lv_slider_get_min_value = Module['_lv_slider_get_min_value'] = makeInvalidEarlyAccess('_lv_slider_get_min_value');
var _lv_slider_get_left_value = Module['_lv_slider_get_left_value'] = makeInvalidEarlyAccess('_lv_slider_get_left_value');
var _lv_spinbox_get_step = Module['_lv_spinbox_get_step'] = makeInvalidEarlyAccess('_lv_spinbox_get_step');
var _lv_spinbox_get_value = Module['_lv_spinbox_get_value'] = makeInvalidEarlyAccess('_lv_spinbox_get_value');
var _lv_textarea_get_max_length = Module['_lv_textarea_get_max_length'] = makeInvalidEarlyAccess('_lv_textarea_get_max_length');
var _lv_textarea_get_text = Module['_lv_textarea_get_text'] = makeInvalidEarlyAccess('_lv_textarea_get_text');
var _lv_obj_get_parent = Module['_lv_obj_get_parent'] = makeInvalidEarlyAccess('_lv_obj_get_parent');
var _to_lvgl_color = Module['_to_lvgl_color'] = makeInvalidEarlyAccess('_to_lvgl_color');
var _lv_obj_add_event_cb = Module['_lv_obj_add_event_cb'] = makeInvalidEarlyAccess('_lv_obj_add_event_cb');
var _lv_obj_add_flag = Module['_lv_obj_add_flag'] = makeInvalidEarlyAccess('_lv_obj_add_flag');
var _lv_obj_add_state = Module['_lv_obj_add_state'] = makeInvalidEarlyAccess('_lv_obj_add_state');
var _lv_obj_remove_flag = Module['_lv_obj_remove_flag'] = makeInvalidEarlyAccess('_lv_obj_remove_flag');
var _lv_obj_remove_state = Module['_lv_obj_remove_state'] = makeInvalidEarlyAccess('_lv_obj_remove_state');
var _lv_obj_has_state = Module['_lv_obj_has_state'] = makeInvalidEarlyAccess('_lv_obj_has_state');
var _lv_obj_remove_style = Module['_lv_obj_remove_style'] = makeInvalidEarlyAccess('_lv_obj_remove_style');
var _lv_obj_set_scroll_dir = Module['_lv_obj_set_scroll_dir'] = makeInvalidEarlyAccess('_lv_obj_set_scroll_dir');
var _lv_obj_set_scroll_snap_x = Module['_lv_obj_set_scroll_snap_x'] = makeInvalidEarlyAccess('_lv_obj_set_scroll_snap_x');
var _lv_obj_set_scroll_snap_y = Module['_lv_obj_set_scroll_snap_y'] = makeInvalidEarlyAccess('_lv_obj_set_scroll_snap_y');
var _lv_obj_set_scrollbar_mode = Module['_lv_obj_set_scrollbar_mode'] = makeInvalidEarlyAccess('_lv_obj_set_scrollbar_mode');
var _lv_event_get_target = Module['_lv_event_get_target'] = makeInvalidEarlyAccess('_lv_event_get_target');
var _lv_buttonmatrix_create = Module['_lv_buttonmatrix_create'] = makeInvalidEarlyAccess('_lv_buttonmatrix_create');
var _lv_button_create = Module['_lv_button_create'] = makeInvalidEarlyAccess('_lv_button_create');
var _lv_animimg_create = Module['_lv_animimg_create'] = makeInvalidEarlyAccess('_lv_animimg_create');
var _lv_arc_create = Module['_lv_arc_create'] = makeInvalidEarlyAccess('_lv_arc_create');
var _lv_bar_create = Module['_lv_bar_create'] = makeInvalidEarlyAccess('_lv_bar_create');
var _lv_calendar_create = Module['_lv_calendar_create'] = makeInvalidEarlyAccess('_lv_calendar_create');
var _lv_calendar_add_header_arrow = Module['_lv_calendar_add_header_arrow'] = makeInvalidEarlyAccess('_lv_calendar_add_header_arrow');
var _lv_calendar_set_month_shown = Module['_lv_calendar_set_month_shown'] = makeInvalidEarlyAccess('_lv_calendar_set_month_shown');
var _lv_calendar_set_today_date = Module['_lv_calendar_set_today_date'] = makeInvalidEarlyAccess('_lv_calendar_set_today_date');
var _lv_canvas_create = Module['_lv_canvas_create'] = makeInvalidEarlyAccess('_lv_canvas_create');
var _lv_chart_create = Module['_lv_chart_create'] = makeInvalidEarlyAccess('_lv_chart_create');
var _lv_checkbox_create = Module['_lv_checkbox_create'] = makeInvalidEarlyAccess('_lv_checkbox_create');
var _lv_checkbox_set_text = Module['_lv_checkbox_set_text'] = makeInvalidEarlyAccess('_lv_checkbox_set_text');
var _lv_label_create = Module['_lv_label_create'] = makeInvalidEarlyAccess('_lv_label_create');
var _lv_keyboard_create = Module['_lv_keyboard_create'] = makeInvalidEarlyAccess('_lv_keyboard_create');
var _lv_led_create = Module['_lv_led_create'] = makeInvalidEarlyAccess('_lv_led_create');
var _lv_line_create = Module['_lv_line_create'] = makeInvalidEarlyAccess('_lv_line_create');
var _lv_line_set_points = Module['_lv_line_set_points'] = makeInvalidEarlyAccess('_lv_line_set_points');
var _lv_line_set_y_invert = Module['_lv_line_set_y_invert'] = makeInvalidEarlyAccess('_lv_line_set_y_invert');
var _lv_list_create = Module['_lv_list_create'] = makeInvalidEarlyAccess('_lv_list_create');
var _lv_menu_create = Module['_lv_menu_create'] = makeInvalidEarlyAccess('_lv_menu_create');
var _lv_msgbox_create = Module['_lv_msgbox_create'] = makeInvalidEarlyAccess('_lv_msgbox_create');
var _lv_obj_create = Module['_lv_obj_create'] = makeInvalidEarlyAccess('_lv_obj_create');
var _lv_obj_add_style = Module['_lv_obj_add_style'] = makeInvalidEarlyAccess('_lv_obj_add_style');
var _lv_obj_get_style_prop = Module['_lv_obj_get_style_prop'] = makeInvalidEarlyAccess('_lv_obj_get_style_prop');
var _lv_obj_set_local_style_prop = Module['_lv_obj_set_local_style_prop'] = makeInvalidEarlyAccess('_lv_obj_set_local_style_prop');
var _lv_obj_set_style_bg_color = Module['_lv_obj_set_style_bg_color'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_color');
var _lv_obj_set_style_border_width = Module['_lv_obj_set_style_border_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_border_width');
var _lv_spangroup_create = Module['_lv_spangroup_create'] = makeInvalidEarlyAccess('_lv_spangroup_create');
var _lv_table_create = Module['_lv_table_create'] = makeInvalidEarlyAccess('_lv_table_create');
var _lv_tabview_create = Module['_lv_tabview_create'] = makeInvalidEarlyAccess('_lv_tabview_create');
var _lv_tabview_set_active = Module['_lv_tabview_set_active'] = makeInvalidEarlyAccess('_lv_tabview_set_active');
var _lv_tabview_set_tab_bar_position = Module['_lv_tabview_set_tab_bar_position'] = makeInvalidEarlyAccess('_lv_tabview_set_tab_bar_position');
var _lv_tileview_create = Module['_lv_tileview_create'] = makeInvalidEarlyAccess('_lv_tileview_create');
var _lv_win_create = Module['_lv_win_create'] = makeInvalidEarlyAccess('_lv_win_create');
var _lv_dropdown_create = Module['_lv_dropdown_create'] = makeInvalidEarlyAccess('_lv_dropdown_create');
var _lv_image_create = Module['_lv_image_create'] = makeInvalidEarlyAccess('_lv_image_create');
var _lv_image_set_inner_align = Module['_lv_image_set_inner_align'] = makeInvalidEarlyAccess('_lv_image_set_inner_align');
var _lv_image_set_pivot = Module['_lv_image_set_pivot'] = makeInvalidEarlyAccess('_lv_image_set_pivot');
var _lv_image_set_rotation = Module['_lv_image_set_rotation'] = makeInvalidEarlyAccess('_lv_image_set_rotation');
var _lv_image_set_scale = Module['_lv_image_set_scale'] = makeInvalidEarlyAccess('_lv_image_set_scale');
var _lv_image_set_src = Module['_lv_image_set_src'] = makeInvalidEarlyAccess('_lv_image_set_src');
var _lv_imagebutton_create = Module['_lv_imagebutton_create'] = makeInvalidEarlyAccess('_lv_imagebutton_create');
var _lv_imagebutton_set_src = Module['_lv_imagebutton_set_src'] = makeInvalidEarlyAccess('_lv_imagebutton_set_src');
var _lv_keyboard_set_mode = Module['_lv_keyboard_set_mode'] = makeInvalidEarlyAccess('_lv_keyboard_set_mode');
var _lv_keyboard_set_textarea = Module['_lv_keyboard_set_textarea'] = makeInvalidEarlyAccess('_lv_keyboard_set_textarea');
var _lv_qrcode_set_dark_color = Module['_lv_qrcode_set_dark_color'] = makeInvalidEarlyAccess('_lv_qrcode_set_dark_color');
var _lv_qrcode_set_light_color = Module['_lv_qrcode_set_light_color'] = makeInvalidEarlyAccess('_lv_qrcode_set_light_color');
var _lv_qrcode_update = Module['_lv_qrcode_update'] = makeInvalidEarlyAccess('_lv_qrcode_update');
var _lv_roller_create = Module['_lv_roller_create'] = makeInvalidEarlyAccess('_lv_roller_create');
var _lv_scale_create = Module['_lv_scale_create'] = makeInvalidEarlyAccess('_lv_scale_create');
var _lv_scale_set_label_show = Module['_lv_scale_set_label_show'] = makeInvalidEarlyAccess('_lv_scale_set_label_show');
var _lv_scale_set_major_tick_every = Module['_lv_scale_set_major_tick_every'] = makeInvalidEarlyAccess('_lv_scale_set_major_tick_every');
var _lv_scale_set_mode = Module['_lv_scale_set_mode'] = makeInvalidEarlyAccess('_lv_scale_set_mode');
var _lv_scale_set_range = Module['_lv_scale_set_range'] = makeInvalidEarlyAccess('_lv_scale_set_range');
var _lv_scale_set_total_tick_count = Module['_lv_scale_set_total_tick_count'] = makeInvalidEarlyAccess('_lv_scale_set_total_tick_count');
var _lv_slider_create = Module['_lv_slider_create'] = makeInvalidEarlyAccess('_lv_slider_create');
var _lv_spinbox_create = Module['_lv_spinbox_create'] = makeInvalidEarlyAccess('_lv_spinbox_create');
var _lv_spinner_set_anim_params = Module['_lv_spinner_set_anim_params'] = makeInvalidEarlyAccess('_lv_spinner_set_anim_params');
var _lv_dropdown_get_list = Module['_lv_dropdown_get_list'] = makeInvalidEarlyAccess('_lv_dropdown_get_list');
var _lv_tabview_add_tab = Module['_lv_tabview_add_tab'] = makeInvalidEarlyAccess('_lv_tabview_add_tab');
var _lv_switch_create = Module['_lv_switch_create'] = makeInvalidEarlyAccess('_lv_switch_create');
var _lv_textarea_create = Module['_lv_textarea_create'] = makeInvalidEarlyAccess('_lv_textarea_create');
var _stopScript = Module['_stopScript'] = makeInvalidEarlyAccess('_stopScript');
var _onMessageFromDebugger = Module['_onMessageFromDebugger'] = makeInvalidEarlyAccess('_onMessageFromDebugger');
var _lvglGetFlowState = Module['_lvglGetFlowState'] = makeInvalidEarlyAccess('_lvglGetFlowState');
var _setDebuggerMessageSubsciptionFilter = Module['_setDebuggerMessageSubsciptionFilter'] = makeInvalidEarlyAccess('_setDebuggerMessageSubsciptionFilter');
var _setObjectIndex = Module['_setObjectIndex'] = makeInvalidEarlyAccess('_setObjectIndex');
var _getLvglObjectFromIndex = Module['_getLvglObjectFromIndex'] = makeInvalidEarlyAccess('_getLvglObjectFromIndex');
var _lv_group_remove_all_objs = Module['_lv_group_remove_all_objs'] = makeInvalidEarlyAccess('_lv_group_remove_all_objs');
var _lv_group_add_obj = Module['_lv_group_add_obj'] = makeInvalidEarlyAccess('_lv_group_add_obj');
var _lvglCreateGroup = Module['_lvglCreateGroup'] = makeInvalidEarlyAccess('_lvglCreateGroup');
var _lv_group_create = Module['_lv_group_create'] = makeInvalidEarlyAccess('_lv_group_create');
var _lvglAddScreenLoadedEventHandler = Module['_lvglAddScreenLoadedEventHandler'] = makeInvalidEarlyAccess('_lvglAddScreenLoadedEventHandler');
var _lvglGroupAddObject = Module['_lvglGroupAddObject'] = makeInvalidEarlyAccess('_lvglGroupAddObject');
var _lvglGroupRemoveObjectsForScreen = Module['_lvglGroupRemoveObjectsForScreen'] = makeInvalidEarlyAccess('_lvglGroupRemoveObjectsForScreen');
var _lvglAddEventHandler = Module['_lvglAddEventHandler'] = makeInvalidEarlyAccess('_lvglAddEventHandler');
var _lvglSetEventUserData = Module['_lvglSetEventUserData'] = makeInvalidEarlyAccess('_lvglSetEventUserData');
var _lvglCreateScreen = Module['_lvglCreateScreen'] = makeInvalidEarlyAccess('_lvglCreateScreen');
var _lvglCreateUserWidget = Module['_lvglCreateUserWidget'] = makeInvalidEarlyAccess('_lvglCreateUserWidget');
var _lvglScreenLoad = Module['_lvglScreenLoad'] = makeInvalidEarlyAccess('_lvglScreenLoad');
var _lv_screen_load_anim = Module['_lv_screen_load_anim'] = makeInvalidEarlyAccess('_lv_screen_load_anim');
var _lvglDeleteObject = Module['_lvglDeleteObject'] = makeInvalidEarlyAccess('_lvglDeleteObject');
var _lv_screen_active = Module['_lv_screen_active'] = makeInvalidEarlyAccess('_lv_screen_active');
var _lv_screen_load = Module['_lv_screen_load'] = makeInvalidEarlyAccess('_lv_screen_load');
var _lvglDeleteObjectIndex = Module['_lvglDeleteObjectIndex'] = makeInvalidEarlyAccess('_lvglDeleteObjectIndex');
var _lvglDeletePageFlowState = Module['_lvglDeletePageFlowState'] = makeInvalidEarlyAccess('_lvglDeletePageFlowState');
var _lvglObjGetStylePropColor = Module['_lvglObjGetStylePropColor'] = makeInvalidEarlyAccess('_lvglObjGetStylePropColor');
var _lvglObjGetStylePropNum = Module['_lvglObjGetStylePropNum'] = makeInvalidEarlyAccess('_lvglObjGetStylePropNum');
var _lvglObjSetLocalStylePropColor = Module['_lvglObjSetLocalStylePropColor'] = makeInvalidEarlyAccess('_lvglObjSetLocalStylePropColor');
var _lvglObjSetLocalStylePropNum = Module['_lvglObjSetLocalStylePropNum'] = makeInvalidEarlyAccess('_lvglObjSetLocalStylePropNum');
var _lvglObjSetLocalStylePropPtr = Module['_lvglObjSetLocalStylePropPtr'] = makeInvalidEarlyAccess('_lvglObjSetLocalStylePropPtr');
var _lvglGetBuiltinFontPtr = Module['_lvglGetBuiltinFontPtr'] = makeInvalidEarlyAccess('_lvglGetBuiltinFontPtr');
var _strcmp = Module['_strcmp'] = makeInvalidEarlyAccess('_strcmp');
var _lvglObjGetStylePropBuiltInFont = Module['_lvglObjGetStylePropBuiltInFont'] = makeInvalidEarlyAccess('_lvglObjGetStylePropBuiltInFont');
var _lvglObjGetStylePropFontAddr = Module['_lvglObjGetStylePropFontAddr'] = makeInvalidEarlyAccess('_lvglObjGetStylePropFontAddr');
var _lvglObjSetLocalStylePropBuiltInFont = Module['_lvglObjSetLocalStylePropBuiltInFont'] = makeInvalidEarlyAccess('_lvglObjSetLocalStylePropBuiltInFont');
var _lvglSetObjStylePropBuiltInFont = Module['_lvglSetObjStylePropBuiltInFont'] = makeInvalidEarlyAccess('_lvglSetObjStylePropBuiltInFont');
var _lv_style_set_prop = Module['_lv_style_set_prop'] = makeInvalidEarlyAccess('_lv_style_set_prop');
var _lvglSetObjStylePropPtr = Module['_lvglSetObjStylePropPtr'] = makeInvalidEarlyAccess('_lvglSetObjStylePropPtr');
var _lvglStyleCreate = Module['_lvglStyleCreate'] = makeInvalidEarlyAccess('_lvglStyleCreate');
var _lvglStyleSetPropColor = Module['_lvglStyleSetPropColor'] = makeInvalidEarlyAccess('_lvglStyleSetPropColor');
var _lvglSetStylePropBuiltInFont = Module['_lvglSetStylePropBuiltInFont'] = makeInvalidEarlyAccess('_lvglSetStylePropBuiltInFont');
var _lvglSetStylePropPtr = Module['_lvglSetStylePropPtr'] = makeInvalidEarlyAccess('_lvglSetStylePropPtr');
var _lvglSetStylePropNum = Module['_lvglSetStylePropNum'] = makeInvalidEarlyAccess('_lvglSetStylePropNum');
var _lvglStyleDelete = Module['_lvglStyleDelete'] = makeInvalidEarlyAccess('_lvglStyleDelete');
var _lvglObjAddStyle = Module['_lvglObjAddStyle'] = makeInvalidEarlyAccess('_lvglObjAddStyle');
var _lvglObjRemoveStyle = Module['_lvglObjRemoveStyle'] = makeInvalidEarlyAccess('_lvglObjRemoveStyle');
var _lvglGetObjRelX = Module['_lvglGetObjRelX'] = makeInvalidEarlyAccess('_lvglGetObjRelX');
var _lvglGetObjRelY = Module['_lvglGetObjRelY'] = makeInvalidEarlyAccess('_lvglGetObjRelY');
var _lvglGetObjWidth = Module['_lvglGetObjWidth'] = makeInvalidEarlyAccess('_lvglGetObjWidth');
var _lv_obj_get_width = Module['_lv_obj_get_width'] = makeInvalidEarlyAccess('_lv_obj_get_width');
var _lvglGetObjHeight = Module['_lvglGetObjHeight'] = makeInvalidEarlyAccess('_lvglGetObjHeight');
var _lv_obj_get_height = Module['_lv_obj_get_height'] = makeInvalidEarlyAccess('_lv_obj_get_height');
var _lvglLoadFont = Module['_lvglLoadFont'] = makeInvalidEarlyAccess('_lvglLoadFont');
var _lv_binfont_create = Module['_lv_binfont_create'] = makeInvalidEarlyAccess('_lv_binfont_create');
var _lvglFreeFont = Module['_lvglFreeFont'] = makeInvalidEarlyAccess('_lvglFreeFont');
var _lv_binfont_destroy = Module['_lv_binfont_destroy'] = makeInvalidEarlyAccess('_lv_binfont_destroy');
var _lvglLedGetColor = Module['_lvglLedGetColor'] = makeInvalidEarlyAccess('_lvglLedGetColor');
var _lv_color_to_u32 = Module['_lv_color_to_u32'] = makeInvalidEarlyAccess('_lv_color_to_u32');
var _lvglMeterIndicatorNeedleLineSetColor = Module['_lvglMeterIndicatorNeedleLineSetColor'] = makeInvalidEarlyAccess('_lvglMeterIndicatorNeedleLineSetColor');
var _lvglMeterIndicatorScaleLinesSetColorStart = Module['_lvglMeterIndicatorScaleLinesSetColorStart'] = makeInvalidEarlyAccess('_lvglMeterIndicatorScaleLinesSetColorStart');
var _lvglMeterIndicatorScaleLinesSetColorEnd = Module['_lvglMeterIndicatorScaleLinesSetColorEnd'] = makeInvalidEarlyAccess('_lvglMeterIndicatorScaleLinesSetColorEnd');
var _lvglMeterIndicatorArcSetColor = Module['_lvglMeterIndicatorArcSetColor'] = makeInvalidEarlyAccess('_lvglMeterIndicatorArcSetColor');
var _lvglMeterScaleSetMinorTickColor = Module['_lvglMeterScaleSetMinorTickColor'] = makeInvalidEarlyAccess('_lvglMeterScaleSetMinorTickColor');
var _lvglMeterScaleSetMajorTickColor = Module['_lvglMeterScaleSetMajorTickColor'] = makeInvalidEarlyAccess('_lvglMeterScaleSetMajorTickColor');
var _lvglGetIndicator_start_value = Module['_lvglGetIndicator_start_value'] = makeInvalidEarlyAccess('_lvglGetIndicator_start_value');
var _lvglGetIndicator_end_value = Module['_lvglGetIndicator_end_value'] = makeInvalidEarlyAccess('_lvglGetIndicator_end_value');
var _lvglAddTimelineKeyframe = Module['_lvglAddTimelineKeyframe'] = makeInvalidEarlyAccess('_lvglAddTimelineKeyframe');
var _lvglSetTimelinePosition = Module['_lvglSetTimelinePosition'] = makeInvalidEarlyAccess('_lvglSetTimelinePosition');
var _lvglClearTimeline = Module['_lvglClearTimeline'] = makeInvalidEarlyAccess('_lvglClearTimeline');
var _lvglLineSetPoints = Module['_lvglLineSetPoints'] = makeInvalidEarlyAccess('_lvglLineSetPoints');
var _lvglScrollTo = Module['_lvglScrollTo'] = makeInvalidEarlyAccess('_lvglScrollTo');
var _lv_obj_scroll_to = Module['_lv_obj_scroll_to'] = makeInvalidEarlyAccess('_lv_obj_scroll_to');
var _lvglGetScrollX = Module['_lvglGetScrollX'] = makeInvalidEarlyAccess('_lvglGetScrollX');
var _lv_obj_get_scroll_x = Module['_lv_obj_get_scroll_x'] = makeInvalidEarlyAccess('_lv_obj_get_scroll_x');
var _lvglGetScrollY = Module['_lvglGetScrollY'] = makeInvalidEarlyAccess('_lvglGetScrollY');
var _lv_obj_get_scroll_y = Module['_lv_obj_get_scroll_y'] = makeInvalidEarlyAccess('_lv_obj_get_scroll_y');
var _lvglObjInvalidate = Module['_lvglObjInvalidate'] = makeInvalidEarlyAccess('_lvglObjInvalidate');
var _lv_obj_invalidate = Module['_lv_obj_invalidate'] = makeInvalidEarlyAccess('_lv_obj_invalidate');
var _lvglDeleteScreenOnUnload = Module['_lvglDeleteScreenOnUnload'] = makeInvalidEarlyAccess('_lvglDeleteScreenOnUnload');
var _lvglGetTabName = Module['_lvglGetTabName'] = makeInvalidEarlyAccess('_lvglGetTabName');
var _lv_tabview_get_tab_bar = Module['_lv_tabview_get_tab_bar'] = makeInvalidEarlyAccess('_lv_tabview_get_tab_bar');
var _lv_obj_get_child_by_type = Module['_lv_obj_get_child_by_type'] = makeInvalidEarlyAccess('_lv_obj_get_child_by_type');
var _lvglCreateFreeTypeFont = Module['_lvglCreateFreeTypeFont'] = makeInvalidEarlyAccess('_lvglCreateFreeTypeFont');
var _lv_log_add = Module['_lv_log_add'] = makeInvalidEarlyAccess('_lv_log_add');
var _lvglCreateAnim = Module['_lvglCreateAnim'] = makeInvalidEarlyAccess('_lvglCreateAnim');
var _lv_anim_init = Module['_lv_anim_init'] = makeInvalidEarlyAccess('_lv_anim_init');
var _lv_anim_set_delay = Module['_lv_anim_set_delay'] = makeInvalidEarlyAccess('_lv_anim_set_delay');
var _lv_anim_set_repeat_delay = Module['_lv_anim_set_repeat_delay'] = makeInvalidEarlyAccess('_lv_anim_set_repeat_delay');
var _lv_anim_set_repeat_count = Module['_lv_anim_set_repeat_count'] = makeInvalidEarlyAccess('_lv_anim_set_repeat_count');
var _lv_group_init = Module['_lv_group_init'] = makeInvalidEarlyAccess('_lv_group_init');
var _lv_group_deinit = Module['_lv_group_deinit'] = makeInvalidEarlyAccess('_lv_group_deinit');
var _lv_ll_init = Module['_lv_ll_init'] = makeInvalidEarlyAccess('_lv_ll_init');
var _lv_ll_clear = Module['_lv_ll_clear'] = makeInvalidEarlyAccess('_lv_ll_clear');
var _lv_ll_ins_head = Module['_lv_ll_ins_head'] = makeInvalidEarlyAccess('_lv_ll_ins_head');
var _lv_group_delete = Module['_lv_group_delete'] = makeInvalidEarlyAccess('_lv_group_delete');
var _lv_indev_get_next = Module['_lv_indev_get_next'] = makeInvalidEarlyAccess('_lv_indev_get_next');
var _lv_indev_get_type = Module['_lv_indev_get_type'] = makeInvalidEarlyAccess('_lv_indev_get_type');
var _lv_indev_get_group = Module['_lv_indev_get_group'] = makeInvalidEarlyAccess('_lv_indev_get_group');
var _lv_obj_send_event = Module['_lv_obj_send_event'] = makeInvalidEarlyAccess('_lv_obj_send_event');
var _lv_ll_get_head = Module['_lv_ll_get_head'] = makeInvalidEarlyAccess('_lv_ll_get_head');
var _lv_ll_get_next = Module['_lv_ll_get_next'] = makeInvalidEarlyAccess('_lv_ll_get_next');
var _lv_ll_remove = Module['_lv_ll_remove'] = makeInvalidEarlyAccess('_lv_ll_remove');
var _lv_group_get_default = Module['_lv_group_get_default'] = makeInvalidEarlyAccess('_lv_group_get_default');
var _lv_group_set_default = Module['_lv_group_set_default'] = makeInvalidEarlyAccess('_lv_group_set_default');
var _lv_group_remove_obj = Module['_lv_group_remove_obj'] = makeInvalidEarlyAccess('_lv_group_remove_obj');
var _lv_obj_allocate_spec_attr = Module['_lv_obj_allocate_spec_attr'] = makeInvalidEarlyAccess('_lv_obj_allocate_spec_attr');
var _lv_ll_ins_tail = Module['_lv_ll_ins_tail'] = makeInvalidEarlyAccess('_lv_ll_ins_tail');
var _lv_ll_get_tail = Module['_lv_ll_get_tail'] = makeInvalidEarlyAccess('_lv_ll_get_tail');
var _lv_ll_get_prev = Module['_lv_ll_get_prev'] = makeInvalidEarlyAccess('_lv_ll_get_prev');
var _lv_obj_get_group = Module['_lv_obj_get_group'] = makeInvalidEarlyAccess('_lv_obj_get_group');
var _lv_group_swap_obj = Module['_lv_group_swap_obj'] = makeInvalidEarlyAccess('_lv_group_swap_obj');
var _lv_group_focus_obj = Module['_lv_group_focus_obj'] = makeInvalidEarlyAccess('_lv_group_focus_obj');
var _lv_group_get_focused = Module['_lv_group_get_focused'] = makeInvalidEarlyAccess('_lv_group_get_focused');
var _lv_group_set_editing = Module['_lv_group_set_editing'] = makeInvalidEarlyAccess('_lv_group_set_editing');
var _lv_group_focus_next = Module['_lv_group_focus_next'] = makeInvalidEarlyAccess('_lv_group_focus_next');
var _lv_group_focus_prev = Module['_lv_group_focus_prev'] = makeInvalidEarlyAccess('_lv_group_focus_prev');
var _lv_group_focus_freeze = Module['_lv_group_focus_freeze'] = makeInvalidEarlyAccess('_lv_group_focus_freeze');
var _lv_group_send_data = Module['_lv_group_send_data'] = makeInvalidEarlyAccess('_lv_group_send_data');
var _lv_group_set_focus_cb = Module['_lv_group_set_focus_cb'] = makeInvalidEarlyAccess('_lv_group_set_focus_cb');
var _lv_group_set_edge_cb = Module['_lv_group_set_edge_cb'] = makeInvalidEarlyAccess('_lv_group_set_edge_cb');
var _lv_group_set_refocus_policy = Module['_lv_group_set_refocus_policy'] = makeInvalidEarlyAccess('_lv_group_set_refocus_policy');
var _lv_group_set_wrap = Module['_lv_group_set_wrap'] = makeInvalidEarlyAccess('_lv_group_set_wrap');
var _lv_group_get_focus_cb = Module['_lv_group_get_focus_cb'] = makeInvalidEarlyAccess('_lv_group_get_focus_cb');
var _lv_group_get_edge_cb = Module['_lv_group_get_edge_cb'] = makeInvalidEarlyAccess('_lv_group_get_edge_cb');
var _lv_group_get_editing = Module['_lv_group_get_editing'] = makeInvalidEarlyAccess('_lv_group_get_editing');
var _lv_group_get_wrap = Module['_lv_group_get_wrap'] = makeInvalidEarlyAccess('_lv_group_get_wrap');
var _lv_group_get_obj_count = Module['_lv_group_get_obj_count'] = makeInvalidEarlyAccess('_lv_group_get_obj_count');
var _lv_ll_get_len = Module['_lv_ll_get_len'] = makeInvalidEarlyAccess('_lv_ll_get_len');
var _lv_group_get_obj_by_index = Module['_lv_group_get_obj_by_index'] = makeInvalidEarlyAccess('_lv_group_get_obj_by_index');
var _lv_group_get_count = Module['_lv_group_get_count'] = makeInvalidEarlyAccess('_lv_group_get_count');
var _lv_group_by_index = Module['_lv_group_by_index'] = makeInvalidEarlyAccess('_lv_group_by_index');
var _lv_obj_get_scroll_left = Module['_lv_obj_get_scroll_left'] = makeInvalidEarlyAccess('_lv_obj_get_scroll_left');
var _lv_obj_get_scroll_top = Module['_lv_obj_get_scroll_top'] = makeInvalidEarlyAccess('_lv_obj_get_scroll_top');
var _lv_event_mark_deleted = Module['_lv_event_mark_deleted'] = makeInvalidEarlyAccess('_lv_event_mark_deleted');
var _lv_obj_enable_style_refresh = Module['_lv_obj_enable_style_refresh'] = makeInvalidEarlyAccess('_lv_obj_enable_style_refresh');
var _lv_obj_remove_style_all = Module['_lv_obj_remove_style_all'] = makeInvalidEarlyAccess('_lv_obj_remove_style_all');
var _lv_anim_delete = Module['_lv_anim_delete'] = makeInvalidEarlyAccess('_lv_anim_delete');
var _lv_event_remove_all = Module['_lv_event_remove_all'] = makeInvalidEarlyAccess('_lv_event_remove_all');
var _lv_event_get_current_target = Module['_lv_event_get_current_target'] = makeInvalidEarlyAccess('_lv_event_get_current_target');
var _lv_event_get_param = Module['_lv_event_get_param'] = makeInvalidEarlyAccess('_lv_event_get_param');
var _lv_indev_get_scroll_obj = Module['_lv_indev_get_scroll_obj'] = makeInvalidEarlyAccess('_lv_indev_get_scroll_obj');
var _lv_obj_get_child_count = Module['_lv_obj_get_child_count'] = makeInvalidEarlyAccess('_lv_obj_get_child_count');
var _lv_obj_mark_layout_as_dirty = Module['_lv_obj_mark_layout_as_dirty'] = makeInvalidEarlyAccess('_lv_obj_mark_layout_as_dirty');
var _lv_event_get_key = Module['_lv_event_get_key'] = makeInvalidEarlyAccess('_lv_event_get_key');
var _lv_obj_is_editable = Module['_lv_obj_is_editable'] = makeInvalidEarlyAccess('_lv_obj_is_editable');
var _lv_obj_get_scroll_right = Module['_lv_obj_get_scroll_right'] = makeInvalidEarlyAccess('_lv_obj_get_scroll_right');
var _lv_obj_scroll_to_y = Module['_lv_obj_scroll_to_y'] = makeInvalidEarlyAccess('_lv_obj_scroll_to_y');
var _lv_obj_get_scroll_dir = Module['_lv_obj_get_scroll_dir'] = makeInvalidEarlyAccess('_lv_obj_get_scroll_dir');
var _lv_obj_scroll_to_x = Module['_lv_obj_scroll_to_x'] = makeInvalidEarlyAccess('_lv_obj_scroll_to_x');
var _lv_obj_scroll_to_view_recursive = Module['_lv_obj_scroll_to_view_recursive'] = makeInvalidEarlyAccess('_lv_obj_scroll_to_view_recursive');
var _lv_indev_active = Module['_lv_indev_active'] = makeInvalidEarlyAccess('_lv_indev_active');
var _lv_event_get_indev = Module['_lv_event_get_indev'] = makeInvalidEarlyAccess('_lv_event_get_indev');
var _lv_obj_get_scrollbar_mode = Module['_lv_obj_get_scrollbar_mode'] = makeInvalidEarlyAccess('_lv_obj_get_scrollbar_mode');
var _lv_obj_get_scrollbar_area = Module['_lv_obj_get_scrollbar_area'] = makeInvalidEarlyAccess('_lv_obj_get_scrollbar_area');
var _lv_obj_invalidate_area = Module['_lv_obj_invalidate_area'] = makeInvalidEarlyAccess('_lv_obj_invalidate_area');
var _lv_obj_calculate_ext_draw_size = Module['_lv_obj_calculate_ext_draw_size'] = makeInvalidEarlyAccess('_lv_obj_calculate_ext_draw_size');
var _lv_event_set_ext_draw_size = Module['_lv_event_set_ext_draw_size'] = makeInvalidEarlyAccess('_lv_event_set_ext_draw_size');
var _lv_area_increase = Module['_lv_area_increase'] = makeInvalidEarlyAccess('_lv_area_increase');
var _lv_area_is_in = Module['_lv_area_is_in'] = makeInvalidEarlyAccess('_lv_area_is_in');
var _lv_event_get_layer = Module['_lv_event_get_layer'] = makeInvalidEarlyAccess('_lv_event_get_layer');
var _lv_draw_rect_dsc_init = Module['_lv_draw_rect_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_rect_dsc_init');
var _lv_obj_init_draw_rect_dsc = Module['_lv_obj_init_draw_rect_dsc'] = makeInvalidEarlyAccess('_lv_obj_init_draw_rect_dsc');
var _lv_draw_rect = Module['_lv_draw_rect'] = makeInvalidEarlyAccess('_lv_draw_rect');
var _lv_area_get_size = Module['_lv_area_get_size'] = makeInvalidEarlyAccess('_lv_area_get_size');
var _lv_obj_get_style_opa_recursive = Module['_lv_obj_get_style_opa_recursive'] = makeInvalidEarlyAccess('_lv_obj_get_style_opa_recursive');
var _lv_obj_class_create_obj = Module['_lv_obj_class_create_obj'] = makeInvalidEarlyAccess('_lv_obj_class_create_obj');
var _lv_obj_class_init_obj = Module['_lv_obj_class_init_obj'] = makeInvalidEarlyAccess('_lv_obj_class_init_obj');
var _lv_obj_is_layout_positioned = Module['_lv_obj_is_layout_positioned'] = makeInvalidEarlyAccess('_lv_obj_is_layout_positioned');
var _lv_obj_has_flag_any = Module['_lv_obj_has_flag_any'] = makeInvalidEarlyAccess('_lv_obj_has_flag_any');
var _lv_obj_set_flag = Module['_lv_obj_set_flag'] = makeInvalidEarlyAccess('_lv_obj_set_flag');
var _lv_obj_get_child = Module['_lv_obj_get_child'] = makeInvalidEarlyAccess('_lv_obj_get_child');
var _lv_obj_style_state_compare = Module['_lv_obj_style_state_compare'] = makeInvalidEarlyAccess('_lv_obj_style_state_compare');
var _lv_obj_update_layer_type = Module['_lv_obj_update_layer_type'] = makeInvalidEarlyAccess('_lv_obj_update_layer_type');
var _lv_malloc_zeroed = Module['_lv_malloc_zeroed'] = makeInvalidEarlyAccess('_lv_malloc_zeroed');
var _lv_obj_style_create_transition = Module['_lv_obj_style_create_transition'] = makeInvalidEarlyAccess('_lv_obj_style_create_transition');
var _lv_obj_refresh_style = Module['_lv_obj_refresh_style'] = makeInvalidEarlyAccess('_lv_obj_refresh_style');
var _lv_obj_refresh_ext_draw_size = Module['_lv_obj_refresh_ext_draw_size'] = makeInvalidEarlyAccess('_lv_obj_refresh_ext_draw_size');
var _lv_obj_set_state = Module['_lv_obj_set_state'] = makeInvalidEarlyAccess('_lv_obj_set_state');
var _lv_obj_check_type = Module['_lv_obj_check_type'] = makeInvalidEarlyAccess('_lv_obj_check_type');
var _lv_obj_has_class = Module['_lv_obj_has_class'] = makeInvalidEarlyAccess('_lv_obj_has_class');
var _lv_obj_get_class = Module['_lv_obj_get_class'] = makeInvalidEarlyAccess('_lv_obj_get_class');
var _lv_obj_is_valid = Module['_lv_obj_is_valid'] = makeInvalidEarlyAccess('_lv_obj_is_valid');
var _lv_display_get_next = Module['_lv_display_get_next'] = makeInvalidEarlyAccess('_lv_display_get_next');
var _lv_obj_null_on_delete = Module['_lv_obj_null_on_delete'] = makeInvalidEarlyAccess('_lv_obj_null_on_delete');
var _lv_obj_add_screen_load_event = Module['_lv_obj_add_screen_load_event'] = makeInvalidEarlyAccess('_lv_obj_add_screen_load_event');
var _lv_memset = Module['_lv_memset'] = makeInvalidEarlyAccess('_lv_memset');
var _lv_event_free_user_data_cb = Module['_lv_event_free_user_data_cb'] = makeInvalidEarlyAccess('_lv_event_free_user_data_cb');
var _lv_obj_add_screen_create_event = Module['_lv_obj_add_screen_create_event'] = makeInvalidEarlyAccess('_lv_obj_add_screen_create_event');
var _lv_obj_add_play_timeline_event = Module['_lv_obj_add_play_timeline_event'] = makeInvalidEarlyAccess('_lv_obj_add_play_timeline_event');
var _lv_anim_timeline_get_progress = Module['_lv_anim_timeline_get_progress'] = makeInvalidEarlyAccess('_lv_anim_timeline_get_progress');
var _lv_anim_timeline_set_progress = Module['_lv_anim_timeline_set_progress'] = makeInvalidEarlyAccess('_lv_anim_timeline_set_progress');
var _lv_anim_timeline_set_delay = Module['_lv_anim_timeline_set_delay'] = makeInvalidEarlyAccess('_lv_anim_timeline_set_delay');
var _lv_anim_timeline_set_reverse = Module['_lv_anim_timeline_set_reverse'] = makeInvalidEarlyAccess('_lv_anim_timeline_set_reverse');
var _lv_anim_timeline_start = Module['_lv_anim_timeline_start'] = makeInvalidEarlyAccess('_lv_anim_timeline_start');
var _lv_obj_set_user_data = Module['_lv_obj_set_user_data'] = makeInvalidEarlyAccess('_lv_obj_set_user_data');
var _lv_obj_get_user_data = Module['_lv_obj_get_user_data'] = makeInvalidEarlyAccess('_lv_obj_get_user_data');
var _lv_event_get_target_obj = Module['_lv_event_get_target_obj'] = makeInvalidEarlyAccess('_lv_event_get_target_obj');
var _lv_realloc = Module['_lv_realloc'] = makeInvalidEarlyAccess('_lv_realloc');
var _lv_display_get_horizontal_resolution = Module['_lv_display_get_horizontal_resolution'] = makeInvalidEarlyAccess('_lv_display_get_horizontal_resolution');
var _lv_display_get_vertical_resolution = Module['_lv_display_get_vertical_resolution'] = makeInvalidEarlyAccess('_lv_display_get_vertical_resolution');
var _lv_theme_apply = Module['_lv_theme_apply'] = makeInvalidEarlyAccess('_lv_theme_apply');
var _lv_obj_refresh_self_size = Module['_lv_obj_refresh_self_size'] = makeInvalidEarlyAccess('_lv_obj_refresh_self_size');
var _lv_obj_is_group_def = Module['_lv_obj_is_group_def'] = makeInvalidEarlyAccess('_lv_obj_is_group_def');
var _lv_obj_destruct = Module['_lv_obj_destruct'] = makeInvalidEarlyAccess('_lv_obj_destruct');
var _lv_obj_style_apply_color_filter = Module['_lv_obj_style_apply_color_filter'] = makeInvalidEarlyAccess('_lv_obj_style_apply_color_filter');
var _lv_obj_style_apply_recolor = Module['_lv_obj_style_apply_recolor'] = makeInvalidEarlyAccess('_lv_obj_style_apply_recolor');
var _lv_obj_get_style_recolor_recursive = Module['_lv_obj_get_style_recolor_recursive'] = makeInvalidEarlyAccess('_lv_obj_get_style_recolor_recursive');
var _lv_color_make = Module['_lv_color_make'] = makeInvalidEarlyAccess('_lv_color_make');
var _lv_color_mix = Module['_lv_color_mix'] = makeInvalidEarlyAccess('_lv_color_mix');
var _lv_memcpy = Module['_lv_memcpy'] = makeInvalidEarlyAccess('_lv_memcpy');
var _lv_image_src_get_type = Module['_lv_image_src_get_type'] = makeInvalidEarlyAccess('_lv_image_src_get_type');
var _lv_color_over32 = Module['_lv_color_over32'] = makeInvalidEarlyAccess('_lv_color_over32');
var _lv_obj_init_draw_label_dsc = Module['_lv_obj_init_draw_label_dsc'] = makeInvalidEarlyAccess('_lv_obj_init_draw_label_dsc');
var _lv_obj_init_draw_image_dsc = Module['_lv_obj_init_draw_image_dsc'] = makeInvalidEarlyAccess('_lv_obj_init_draw_image_dsc');
var _lv_area_get_height = Module['_lv_area_get_height'] = makeInvalidEarlyAccess('_lv_area_get_height');
var _lv_obj_init_draw_line_dsc = Module['_lv_obj_init_draw_line_dsc'] = makeInvalidEarlyAccess('_lv_obj_init_draw_line_dsc');
var _lv_obj_init_draw_arc_dsc = Module['_lv_obj_init_draw_arc_dsc'] = makeInvalidEarlyAccess('_lv_obj_init_draw_arc_dsc');
var _lv_obj_get_ext_draw_size = Module['_lv_obj_get_ext_draw_size'] = makeInvalidEarlyAccess('_lv_obj_get_ext_draw_size');
var _lv_obj_get_layer_type = Module['_lv_obj_get_layer_type'] = makeInvalidEarlyAccess('_lv_obj_get_layer_type');
var _lv_event_push = Module['_lv_event_push'] = makeInvalidEarlyAccess('_lv_event_push');
var _lv_event_pop = Module['_lv_event_pop'] = makeInvalidEarlyAccess('_lv_event_pop');
var _lv_event_send = Module['_lv_event_send'] = makeInvalidEarlyAccess('_lv_event_send');
var _lv_obj_event_base = Module['_lv_obj_event_base'] = makeInvalidEarlyAccess('_lv_obj_event_base');
var _lv_event_add = Module['_lv_event_add'] = makeInvalidEarlyAccess('_lv_event_add');
var _lv_obj_get_event_count = Module['_lv_obj_get_event_count'] = makeInvalidEarlyAccess('_lv_obj_get_event_count');
var _lv_event_get_count = Module['_lv_event_get_count'] = makeInvalidEarlyAccess('_lv_event_get_count');
var _lv_obj_get_event_dsc = Module['_lv_obj_get_event_dsc'] = makeInvalidEarlyAccess('_lv_obj_get_event_dsc');
var _lv_event_get_dsc = Module['_lv_event_get_dsc'] = makeInvalidEarlyAccess('_lv_event_get_dsc');
var _lv_obj_remove_event = Module['_lv_obj_remove_event'] = makeInvalidEarlyAccess('_lv_obj_remove_event');
var _lv_event_remove = Module['_lv_event_remove'] = makeInvalidEarlyAccess('_lv_event_remove');
var _lv_obj_remove_event_dsc = Module['_lv_obj_remove_event_dsc'] = makeInvalidEarlyAccess('_lv_obj_remove_event_dsc');
var _lv_event_remove_dsc = Module['_lv_event_remove_dsc'] = makeInvalidEarlyAccess('_lv_event_remove_dsc');
var _lv_obj_remove_event_cb = Module['_lv_obj_remove_event_cb'] = makeInvalidEarlyAccess('_lv_obj_remove_event_cb');
var _lv_obj_remove_event_cb_with_user_data = Module['_lv_obj_remove_event_cb_with_user_data'] = makeInvalidEarlyAccess('_lv_obj_remove_event_cb_with_user_data');
var _lv_event_get_current_target_obj = Module['_lv_event_get_current_target_obj'] = makeInvalidEarlyAccess('_lv_event_get_current_target_obj');
var _lv_event_get_old_size = Module['_lv_event_get_old_size'] = makeInvalidEarlyAccess('_lv_event_get_old_size');
var _lv_event_get_rotary_diff = Module['_lv_event_get_rotary_diff'] = makeInvalidEarlyAccess('_lv_event_get_rotary_diff');
var _lv_event_get_scroll_anim = Module['_lv_event_get_scroll_anim'] = makeInvalidEarlyAccess('_lv_event_get_scroll_anim');
var _lv_event_get_self_size_info = Module['_lv_event_get_self_size_info'] = makeInvalidEarlyAccess('_lv_event_get_self_size_info');
var _lv_event_get_hit_test_info = Module['_lv_event_get_hit_test_info'] = makeInvalidEarlyAccess('_lv_event_get_hit_test_info');
var _lv_event_get_cover_area = Module['_lv_event_get_cover_area'] = makeInvalidEarlyAccess('_lv_event_get_cover_area');
var _lv_event_set_cover_res = Module['_lv_event_set_cover_res'] = makeInvalidEarlyAccess('_lv_event_set_cover_res');
var _lv_obj_get_local_style_prop = Module['_lv_obj_get_local_style_prop'] = makeInvalidEarlyAccess('_lv_obj_get_local_style_prop');
var _lv_obj_set_style_x = Module['_lv_obj_set_style_x'] = makeInvalidEarlyAccess('_lv_obj_set_style_x');
var _lv_obj_set_style_y = Module['_lv_obj_set_style_y'] = makeInvalidEarlyAccess('_lv_obj_set_style_y');
var _lv_obj_set_x = Module['_lv_obj_set_x'] = makeInvalidEarlyAccess('_lv_obj_set_x');
var _lv_obj_set_y = Module['_lv_obj_set_y'] = makeInvalidEarlyAccess('_lv_obj_set_y');
var _lv_obj_refr_size = Module['_lv_obj_refr_size'] = makeInvalidEarlyAccess('_lv_obj_refr_size');
var _lv_obj_get_content_coords = Module['_lv_obj_get_content_coords'] = makeInvalidEarlyAccess('_lv_obj_get_content_coords');
var _lv_obj_scrollbar_invalidate = Module['_lv_obj_scrollbar_invalidate'] = makeInvalidEarlyAccess('_lv_obj_scrollbar_invalidate');
var _lv_obj_get_content_width = Module['_lv_obj_get_content_width'] = makeInvalidEarlyAccess('_lv_obj_get_content_width');
var _lv_obj_get_content_height = Module['_lv_obj_get_content_height'] = makeInvalidEarlyAccess('_lv_obj_get_content_height');
var _lv_obj_get_coords = Module['_lv_obj_get_coords'] = makeInvalidEarlyAccess('_lv_obj_get_coords');
var _lv_obj_set_style_width = Module['_lv_obj_set_style_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_width');
var _lv_obj_set_style_height = Module['_lv_obj_set_style_height'] = makeInvalidEarlyAccess('_lv_obj_set_style_height');
var _lv_obj_set_width = Module['_lv_obj_set_width'] = makeInvalidEarlyAccess('_lv_obj_set_width');
var _lv_obj_set_height = Module['_lv_obj_set_height'] = makeInvalidEarlyAccess('_lv_obj_set_height');
var _lv_obj_set_content_width = Module['_lv_obj_set_content_width'] = makeInvalidEarlyAccess('_lv_obj_set_content_width');
var _lv_obj_set_content_height = Module['_lv_obj_set_content_height'] = makeInvalidEarlyAccess('_lv_obj_set_content_height');
var _lv_obj_set_layout = Module['_lv_obj_set_layout'] = makeInvalidEarlyAccess('_lv_obj_set_layout');
var _lv_obj_set_style_layout = Module['_lv_obj_set_style_layout'] = makeInvalidEarlyAccess('_lv_obj_set_style_layout');
var _lv_obj_get_screen = Module['_lv_obj_get_screen'] = makeInvalidEarlyAccess('_lv_obj_get_screen');
var _lv_obj_get_display = Module['_lv_obj_get_display'] = makeInvalidEarlyAccess('_lv_obj_get_display');
var _lv_display_send_event = Module['_lv_display_send_event'] = makeInvalidEarlyAccess('_lv_display_send_event');
var _lv_obj_refr_pos = Module['_lv_obj_refr_pos'] = makeInvalidEarlyAccess('_lv_obj_refr_pos');
var _lv_layout_apply = Module['_lv_layout_apply'] = makeInvalidEarlyAccess('_lv_layout_apply');
var _lv_obj_readjust_scroll = Module['_lv_obj_readjust_scroll'] = makeInvalidEarlyAccess('_lv_obj_readjust_scroll');
var _lv_obj_set_align = Module['_lv_obj_set_align'] = makeInvalidEarlyAccess('_lv_obj_set_align');
var _lv_obj_set_style_align = Module['_lv_obj_set_style_align'] = makeInvalidEarlyAccess('_lv_obj_set_style_align');
var _lv_obj_align = Module['_lv_obj_align'] = makeInvalidEarlyAccess('_lv_obj_align');
var _lv_obj_align_to = Module['_lv_obj_align_to'] = makeInvalidEarlyAccess('_lv_obj_align_to');
var _lv_obj_get_x = Module['_lv_obj_get_x'] = makeInvalidEarlyAccess('_lv_obj_get_x');
var _lv_obj_get_x2 = Module['_lv_obj_get_x2'] = makeInvalidEarlyAccess('_lv_obj_get_x2');
var _lv_obj_get_y = Module['_lv_obj_get_y'] = makeInvalidEarlyAccess('_lv_obj_get_y');
var _lv_obj_get_y2 = Module['_lv_obj_get_y2'] = makeInvalidEarlyAccess('_lv_obj_get_y2');
var _lv_obj_get_x_aligned = Module['_lv_obj_get_x_aligned'] = makeInvalidEarlyAccess('_lv_obj_get_x_aligned');
var _lv_obj_get_y_aligned = Module['_lv_obj_get_y_aligned'] = makeInvalidEarlyAccess('_lv_obj_get_y_aligned');
var _lv_obj_get_self_width = Module['_lv_obj_get_self_width'] = makeInvalidEarlyAccess('_lv_obj_get_self_width');
var _lv_obj_get_self_height = Module['_lv_obj_get_self_height'] = makeInvalidEarlyAccess('_lv_obj_get_self_height');
var _lv_obj_move_to = Module['_lv_obj_move_to'] = makeInvalidEarlyAccess('_lv_obj_move_to');
var _lv_obj_move_children_by = Module['_lv_obj_move_children_by'] = makeInvalidEarlyAccess('_lv_obj_move_children_by');
var _lv_obj_transform_point = Module['_lv_obj_transform_point'] = makeInvalidEarlyAccess('_lv_obj_transform_point');
var _lv_obj_transform_point_array = Module['_lv_obj_transform_point_array'] = makeInvalidEarlyAccess('_lv_obj_transform_point_array');
var _lv_point_array_transform = Module['_lv_point_array_transform'] = makeInvalidEarlyAccess('_lv_point_array_transform');
var _lv_obj_get_transformed_area = Module['_lv_obj_get_transformed_area'] = makeInvalidEarlyAccess('_lv_obj_get_transformed_area');
var _lv_display_is_invalidation_enabled = Module['_lv_display_is_invalidation_enabled'] = makeInvalidEarlyAccess('_lv_display_is_invalidation_enabled');
var _lv_obj_area_is_visible = Module['_lv_obj_area_is_visible'] = makeInvalidEarlyAccess('_lv_obj_area_is_visible');
var _lv_inv_area = Module['_lv_inv_area'] = makeInvalidEarlyAccess('_lv_inv_area');
var _lv_display_get_screen_active = Module['_lv_display_get_screen_active'] = makeInvalidEarlyAccess('_lv_display_get_screen_active');
var _lv_display_get_screen_prev = Module['_lv_display_get_screen_prev'] = makeInvalidEarlyAccess('_lv_display_get_screen_prev');
var _lv_display_get_layer_bottom = Module['_lv_display_get_layer_bottom'] = makeInvalidEarlyAccess('_lv_display_get_layer_bottom');
var _lv_display_get_layer_top = Module['_lv_display_get_layer_top'] = makeInvalidEarlyAccess('_lv_display_get_layer_top');
var _lv_display_get_layer_sys = Module['_lv_display_get_layer_sys'] = makeInvalidEarlyAccess('_lv_display_get_layer_sys');
var _lv_area_intersect = Module['_lv_area_intersect'] = makeInvalidEarlyAccess('_lv_area_intersect');
var _lv_obj_is_visible = Module['_lv_obj_is_visible'] = makeInvalidEarlyAccess('_lv_obj_is_visible');
var _lv_obj_set_ext_click_area = Module['_lv_obj_set_ext_click_area'] = makeInvalidEarlyAccess('_lv_obj_set_ext_click_area');
var _lv_obj_get_click_area = Module['_lv_obj_get_click_area'] = makeInvalidEarlyAccess('_lv_obj_get_click_area');
var _lv_obj_hit_test = Module['_lv_obj_hit_test'] = makeInvalidEarlyAccess('_lv_obj_hit_test');
var _lv_area_is_point_on = Module['_lv_area_is_point_on'] = makeInvalidEarlyAccess('_lv_area_is_point_on');
var _lv_clamp_width = Module['_lv_clamp_width'] = makeInvalidEarlyAccess('_lv_clamp_width');
var _lv_clamp_height = Module['_lv_clamp_height'] = makeInvalidEarlyAccess('_lv_clamp_height');
var _lv_obj_center = Module['_lv_obj_center'] = makeInvalidEarlyAccess('_lv_obj_center');
var _lv_obj_set_transform = Module['_lv_obj_set_transform'] = makeInvalidEarlyAccess('_lv_obj_set_transform');
var _lv_obj_reset_transform = Module['_lv_obj_reset_transform'] = makeInvalidEarlyAccess('_lv_obj_reset_transform');
var _lv_obj_get_transform = Module['_lv_obj_get_transform'] = makeInvalidEarlyAccess('_lv_obj_get_transform');
var _lv_obj_get_scroll_snap_x = Module['_lv_obj_get_scroll_snap_x'] = makeInvalidEarlyAccess('_lv_obj_get_scroll_snap_x');
var _lv_obj_get_scroll_snap_y = Module['_lv_obj_get_scroll_snap_y'] = makeInvalidEarlyAccess('_lv_obj_get_scroll_snap_y');
var _lv_obj_get_scroll_bottom = Module['_lv_obj_get_scroll_bottom'] = makeInvalidEarlyAccess('_lv_obj_get_scroll_bottom');
var _lv_obj_get_scroll_end = Module['_lv_obj_get_scroll_end'] = makeInvalidEarlyAccess('_lv_obj_get_scroll_end');
var _lv_anim_get = Module['_lv_anim_get'] = makeInvalidEarlyAccess('_lv_anim_get');
var _lv_obj_scroll_by_bounded = Module['_lv_obj_scroll_by_bounded'] = makeInvalidEarlyAccess('_lv_obj_scroll_by_bounded');
var _lv_obj_scroll_by = Module['_lv_obj_scroll_by'] = makeInvalidEarlyAccess('_lv_obj_scroll_by');
var _lv_anim_set_var = Module['_lv_anim_set_var'] = makeInvalidEarlyAccess('_lv_anim_set_var');
var _lv_anim_set_deleted_cb = Module['_lv_anim_set_deleted_cb'] = makeInvalidEarlyAccess('_lv_anim_set_deleted_cb');
var _lv_anim_speed_clamped = Module['_lv_anim_speed_clamped'] = makeInvalidEarlyAccess('_lv_anim_speed_clamped');
var _lv_anim_set_duration = Module['_lv_anim_set_duration'] = makeInvalidEarlyAccess('_lv_anim_set_duration');
var _lv_anim_set_values = Module['_lv_anim_set_values'] = makeInvalidEarlyAccess('_lv_anim_set_values');
var _lv_anim_set_exec_cb = Module['_lv_anim_set_exec_cb'] = makeInvalidEarlyAccess('_lv_anim_set_exec_cb');
var _lv_anim_path_ease_out = Module['_lv_anim_path_ease_out'] = makeInvalidEarlyAccess('_lv_anim_path_ease_out');
var _lv_anim_set_path_cb = Module['_lv_anim_set_path_cb'] = makeInvalidEarlyAccess('_lv_anim_set_path_cb');
var _lv_anim_start = Module['_lv_anim_start'] = makeInvalidEarlyAccess('_lv_anim_start');
var _lv_obj_scroll_by_raw = Module['_lv_obj_scroll_by_raw'] = makeInvalidEarlyAccess('_lv_obj_scroll_by_raw');
var _lv_obj_scroll_to_view = Module['_lv_obj_scroll_to_view'] = makeInvalidEarlyAccess('_lv_obj_scroll_to_view');
var _lv_obj_is_scrolling = Module['_lv_obj_is_scrolling'] = makeInvalidEarlyAccess('_lv_obj_is_scrolling');
var _lv_obj_stop_scroll_anim = Module['_lv_obj_stop_scroll_anim'] = makeInvalidEarlyAccess('_lv_obj_stop_scroll_anim');
var _lv_obj_update_snap = Module['_lv_obj_update_snap'] = makeInvalidEarlyAccess('_lv_obj_update_snap');
var _lv_indev_scroll_get_snap_dist = Module['_lv_indev_scroll_get_snap_dist'] = makeInvalidEarlyAccess('_lv_indev_scroll_get_snap_dist');
var _lv_area_set = Module['_lv_area_set'] = makeInvalidEarlyAccess('_lv_area_set');
var _lv_indev_get_scroll_dir = Module['_lv_indev_get_scroll_dir'] = makeInvalidEarlyAccess('_lv_indev_get_scroll_dir');
var _lv_display_get_dpi = Module['_lv_display_get_dpi'] = makeInvalidEarlyAccess('_lv_display_get_dpi');
var _lv_obj_style_init = Module['_lv_obj_style_init'] = makeInvalidEarlyAccess('_lv_obj_style_init');
var _lv_obj_style_deinit = Module['_lv_obj_style_deinit'] = makeInvalidEarlyAccess('_lv_obj_style_deinit');
var _lv_style_prop_lookup_flags = Module['_lv_style_prop_lookup_flags'] = makeInvalidEarlyAccess('_lv_style_prop_lookup_flags');
var _lv_style_remove_prop = Module['_lv_style_remove_prop'] = makeInvalidEarlyAccess('_lv_style_remove_prop');
var _lv_style_reset = Module['_lv_style_reset'] = makeInvalidEarlyAccess('_lv_style_reset');
var _lv_style_prop_get_default = Module['_lv_style_prop_get_default'] = makeInvalidEarlyAccess('_lv_style_prop_get_default');
var _lv_obj_replace_style = Module['_lv_obj_replace_style'] = makeInvalidEarlyAccess('_lv_obj_replace_style');
var _lv_obj_report_style_change = Module['_lv_obj_report_style_change'] = makeInvalidEarlyAccess('_lv_obj_report_style_change');
var _lv_obj_style_set_disabled = Module['_lv_obj_style_set_disabled'] = makeInvalidEarlyAccess('_lv_obj_style_set_disabled');
var _lv_obj_style_get_disabled = Module['_lv_obj_style_get_disabled'] = makeInvalidEarlyAccess('_lv_obj_style_get_disabled');
var _lv_obj_has_style_prop = Module['_lv_obj_has_style_prop'] = makeInvalidEarlyAccess('_lv_obj_has_style_prop');
var _lv_style_get_prop = Module['_lv_style_get_prop'] = makeInvalidEarlyAccess('_lv_style_get_prop');
var _lv_obj_remove_local_style_prop = Module['_lv_obj_remove_local_style_prop'] = makeInvalidEarlyAccess('_lv_obj_remove_local_style_prop');
var _lv_color_eq = Module['_lv_color_eq'] = makeInvalidEarlyAccess('_lv_color_eq');
var _lv_anim_set_start_cb = Module['_lv_anim_set_start_cb'] = makeInvalidEarlyAccess('_lv_anim_set_start_cb');
var _lv_anim_set_completed_cb = Module['_lv_anim_set_completed_cb'] = makeInvalidEarlyAccess('_lv_anim_set_completed_cb');
var _lv_anim_set_early_apply = Module['_lv_anim_set_early_apply'] = makeInvalidEarlyAccess('_lv_anim_set_early_apply');
var _lv_anim_set_user_data = Module['_lv_anim_set_user_data'] = makeInvalidEarlyAccess('_lv_anim_set_user_data');
var _lv_style_is_empty = Module['_lv_style_is_empty'] = makeInvalidEarlyAccess('_lv_style_is_empty');
var _lv_obj_fade_in = Module['_lv_obj_fade_in'] = makeInvalidEarlyAccess('_lv_obj_fade_in');
var _lv_obj_set_style_opa = Module['_lv_obj_set_style_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_opa');
var _lv_obj_fade_out = Module['_lv_obj_fade_out'] = makeInvalidEarlyAccess('_lv_obj_fade_out');
var _lv_obj_calculate_style_text_align = Module['_lv_obj_calculate_style_text_align'] = makeInvalidEarlyAccess('_lv_obj_calculate_style_text_align');
var _lv_bidi_calculate_align = Module['_lv_bidi_calculate_align'] = makeInvalidEarlyAccess('_lv_bidi_calculate_align');
var _lv_obj_set_style_min_width = Module['_lv_obj_set_style_min_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_min_width');
var _lv_obj_set_style_max_width = Module['_lv_obj_set_style_max_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_max_width');
var _lv_obj_set_style_min_height = Module['_lv_obj_set_style_min_height'] = makeInvalidEarlyAccess('_lv_obj_set_style_min_height');
var _lv_obj_set_style_max_height = Module['_lv_obj_set_style_max_height'] = makeInvalidEarlyAccess('_lv_obj_set_style_max_height');
var _lv_obj_set_style_length = Module['_lv_obj_set_style_length'] = makeInvalidEarlyAccess('_lv_obj_set_style_length');
var _lv_obj_set_style_transform_width = Module['_lv_obj_set_style_transform_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_transform_width');
var _lv_obj_set_style_transform_height = Module['_lv_obj_set_style_transform_height'] = makeInvalidEarlyAccess('_lv_obj_set_style_transform_height');
var _lv_obj_set_style_translate_x = Module['_lv_obj_set_style_translate_x'] = makeInvalidEarlyAccess('_lv_obj_set_style_translate_x');
var _lv_obj_set_style_translate_y = Module['_lv_obj_set_style_translate_y'] = makeInvalidEarlyAccess('_lv_obj_set_style_translate_y');
var _lv_obj_set_style_translate_radial = Module['_lv_obj_set_style_translate_radial'] = makeInvalidEarlyAccess('_lv_obj_set_style_translate_radial');
var _lv_obj_set_style_transform_scale_x = Module['_lv_obj_set_style_transform_scale_x'] = makeInvalidEarlyAccess('_lv_obj_set_style_transform_scale_x');
var _lv_obj_set_style_transform_scale_y = Module['_lv_obj_set_style_transform_scale_y'] = makeInvalidEarlyAccess('_lv_obj_set_style_transform_scale_y');
var _lv_obj_set_style_transform_rotation = Module['_lv_obj_set_style_transform_rotation'] = makeInvalidEarlyAccess('_lv_obj_set_style_transform_rotation');
var _lv_obj_set_style_transform_pivot_x = Module['_lv_obj_set_style_transform_pivot_x'] = makeInvalidEarlyAccess('_lv_obj_set_style_transform_pivot_x');
var _lv_obj_set_style_transform_pivot_y = Module['_lv_obj_set_style_transform_pivot_y'] = makeInvalidEarlyAccess('_lv_obj_set_style_transform_pivot_y');
var _lv_obj_set_style_transform_skew_x = Module['_lv_obj_set_style_transform_skew_x'] = makeInvalidEarlyAccess('_lv_obj_set_style_transform_skew_x');
var _lv_obj_set_style_transform_skew_y = Module['_lv_obj_set_style_transform_skew_y'] = makeInvalidEarlyAccess('_lv_obj_set_style_transform_skew_y');
var _lv_obj_set_style_pad_top = Module['_lv_obj_set_style_pad_top'] = makeInvalidEarlyAccess('_lv_obj_set_style_pad_top');
var _lv_obj_set_style_pad_bottom = Module['_lv_obj_set_style_pad_bottom'] = makeInvalidEarlyAccess('_lv_obj_set_style_pad_bottom');
var _lv_obj_set_style_pad_left = Module['_lv_obj_set_style_pad_left'] = makeInvalidEarlyAccess('_lv_obj_set_style_pad_left');
var _lv_obj_set_style_pad_right = Module['_lv_obj_set_style_pad_right'] = makeInvalidEarlyAccess('_lv_obj_set_style_pad_right');
var _lv_obj_set_style_pad_row = Module['_lv_obj_set_style_pad_row'] = makeInvalidEarlyAccess('_lv_obj_set_style_pad_row');
var _lv_obj_set_style_pad_column = Module['_lv_obj_set_style_pad_column'] = makeInvalidEarlyAccess('_lv_obj_set_style_pad_column');
var _lv_obj_set_style_pad_radial = Module['_lv_obj_set_style_pad_radial'] = makeInvalidEarlyAccess('_lv_obj_set_style_pad_radial');
var _lv_obj_set_style_margin_top = Module['_lv_obj_set_style_margin_top'] = makeInvalidEarlyAccess('_lv_obj_set_style_margin_top');
var _lv_obj_set_style_margin_bottom = Module['_lv_obj_set_style_margin_bottom'] = makeInvalidEarlyAccess('_lv_obj_set_style_margin_bottom');
var _lv_obj_set_style_margin_left = Module['_lv_obj_set_style_margin_left'] = makeInvalidEarlyAccess('_lv_obj_set_style_margin_left');
var _lv_obj_set_style_margin_right = Module['_lv_obj_set_style_margin_right'] = makeInvalidEarlyAccess('_lv_obj_set_style_margin_right');
var _lv_obj_set_style_bg_opa = Module['_lv_obj_set_style_bg_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_opa');
var _lv_obj_set_style_bg_grad_color = Module['_lv_obj_set_style_bg_grad_color'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_grad_color');
var _lv_obj_set_style_bg_grad_dir = Module['_lv_obj_set_style_bg_grad_dir'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_grad_dir');
var _lv_obj_set_style_bg_main_stop = Module['_lv_obj_set_style_bg_main_stop'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_main_stop');
var _lv_obj_set_style_bg_grad_stop = Module['_lv_obj_set_style_bg_grad_stop'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_grad_stop');
var _lv_obj_set_style_bg_main_opa = Module['_lv_obj_set_style_bg_main_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_main_opa');
var _lv_obj_set_style_bg_grad_opa = Module['_lv_obj_set_style_bg_grad_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_grad_opa');
var _lv_obj_set_style_bg_grad = Module['_lv_obj_set_style_bg_grad'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_grad');
var _lv_obj_set_style_bg_image_src = Module['_lv_obj_set_style_bg_image_src'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_image_src');
var _lv_obj_set_style_bg_image_opa = Module['_lv_obj_set_style_bg_image_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_image_opa');
var _lv_obj_set_style_bg_image_recolor = Module['_lv_obj_set_style_bg_image_recolor'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_image_recolor');
var _lv_obj_set_style_bg_image_recolor_opa = Module['_lv_obj_set_style_bg_image_recolor_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_image_recolor_opa');
var _lv_obj_set_style_bg_image_tiled = Module['_lv_obj_set_style_bg_image_tiled'] = makeInvalidEarlyAccess('_lv_obj_set_style_bg_image_tiled');
var _lv_obj_set_style_border_color = Module['_lv_obj_set_style_border_color'] = makeInvalidEarlyAccess('_lv_obj_set_style_border_color');
var _lv_obj_set_style_border_opa = Module['_lv_obj_set_style_border_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_border_opa');
var _lv_obj_set_style_border_side = Module['_lv_obj_set_style_border_side'] = makeInvalidEarlyAccess('_lv_obj_set_style_border_side');
var _lv_obj_set_style_border_post = Module['_lv_obj_set_style_border_post'] = makeInvalidEarlyAccess('_lv_obj_set_style_border_post');
var _lv_obj_set_style_outline_width = Module['_lv_obj_set_style_outline_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_outline_width');
var _lv_obj_set_style_outline_color = Module['_lv_obj_set_style_outline_color'] = makeInvalidEarlyAccess('_lv_obj_set_style_outline_color');
var _lv_obj_set_style_outline_opa = Module['_lv_obj_set_style_outline_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_outline_opa');
var _lv_obj_set_style_outline_pad = Module['_lv_obj_set_style_outline_pad'] = makeInvalidEarlyAccess('_lv_obj_set_style_outline_pad');
var _lv_obj_set_style_shadow_width = Module['_lv_obj_set_style_shadow_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_shadow_width');
var _lv_obj_set_style_shadow_offset_x = Module['_lv_obj_set_style_shadow_offset_x'] = makeInvalidEarlyAccess('_lv_obj_set_style_shadow_offset_x');
var _lv_obj_set_style_shadow_offset_y = Module['_lv_obj_set_style_shadow_offset_y'] = makeInvalidEarlyAccess('_lv_obj_set_style_shadow_offset_y');
var _lv_obj_set_style_shadow_spread = Module['_lv_obj_set_style_shadow_spread'] = makeInvalidEarlyAccess('_lv_obj_set_style_shadow_spread');
var _lv_obj_set_style_shadow_color = Module['_lv_obj_set_style_shadow_color'] = makeInvalidEarlyAccess('_lv_obj_set_style_shadow_color');
var _lv_obj_set_style_shadow_opa = Module['_lv_obj_set_style_shadow_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_shadow_opa');
var _lv_obj_set_style_image_opa = Module['_lv_obj_set_style_image_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_image_opa');
var _lv_obj_set_style_image_recolor = Module['_lv_obj_set_style_image_recolor'] = makeInvalidEarlyAccess('_lv_obj_set_style_image_recolor');
var _lv_obj_set_style_image_recolor_opa = Module['_lv_obj_set_style_image_recolor_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_image_recolor_opa');
var _lv_obj_set_style_image_colorkey = Module['_lv_obj_set_style_image_colorkey'] = makeInvalidEarlyAccess('_lv_obj_set_style_image_colorkey');
var _lv_obj_set_style_line_width = Module['_lv_obj_set_style_line_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_line_width');
var _lv_obj_set_style_line_dash_width = Module['_lv_obj_set_style_line_dash_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_line_dash_width');
var _lv_obj_set_style_line_dash_gap = Module['_lv_obj_set_style_line_dash_gap'] = makeInvalidEarlyAccess('_lv_obj_set_style_line_dash_gap');
var _lv_obj_set_style_line_rounded = Module['_lv_obj_set_style_line_rounded'] = makeInvalidEarlyAccess('_lv_obj_set_style_line_rounded');
var _lv_obj_set_style_line_color = Module['_lv_obj_set_style_line_color'] = makeInvalidEarlyAccess('_lv_obj_set_style_line_color');
var _lv_obj_set_style_line_opa = Module['_lv_obj_set_style_line_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_line_opa');
var _lv_obj_set_style_arc_width = Module['_lv_obj_set_style_arc_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_arc_width');
var _lv_obj_set_style_arc_rounded = Module['_lv_obj_set_style_arc_rounded'] = makeInvalidEarlyAccess('_lv_obj_set_style_arc_rounded');
var _lv_obj_set_style_arc_color = Module['_lv_obj_set_style_arc_color'] = makeInvalidEarlyAccess('_lv_obj_set_style_arc_color');
var _lv_obj_set_style_arc_opa = Module['_lv_obj_set_style_arc_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_arc_opa');
var _lv_obj_set_style_arc_image_src = Module['_lv_obj_set_style_arc_image_src'] = makeInvalidEarlyAccess('_lv_obj_set_style_arc_image_src');
var _lv_obj_set_style_text_color = Module['_lv_obj_set_style_text_color'] = makeInvalidEarlyAccess('_lv_obj_set_style_text_color');
var _lv_obj_set_style_text_opa = Module['_lv_obj_set_style_text_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_text_opa');
var _lv_obj_set_style_text_font = Module['_lv_obj_set_style_text_font'] = makeInvalidEarlyAccess('_lv_obj_set_style_text_font');
var _lv_obj_set_style_text_letter_space = Module['_lv_obj_set_style_text_letter_space'] = makeInvalidEarlyAccess('_lv_obj_set_style_text_letter_space');
var _lv_obj_set_style_text_line_space = Module['_lv_obj_set_style_text_line_space'] = makeInvalidEarlyAccess('_lv_obj_set_style_text_line_space');
var _lv_obj_set_style_text_decor = Module['_lv_obj_set_style_text_decor'] = makeInvalidEarlyAccess('_lv_obj_set_style_text_decor');
var _lv_obj_set_style_text_align = Module['_lv_obj_set_style_text_align'] = makeInvalidEarlyAccess('_lv_obj_set_style_text_align');
var _lv_obj_set_style_text_outline_stroke_color = Module['_lv_obj_set_style_text_outline_stroke_color'] = makeInvalidEarlyAccess('_lv_obj_set_style_text_outline_stroke_color');
var _lv_obj_set_style_text_outline_stroke_width = Module['_lv_obj_set_style_text_outline_stroke_width'] = makeInvalidEarlyAccess('_lv_obj_set_style_text_outline_stroke_width');
var _lv_obj_set_style_text_outline_stroke_opa = Module['_lv_obj_set_style_text_outline_stroke_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_text_outline_stroke_opa');
var _lv_obj_set_style_radius = Module['_lv_obj_set_style_radius'] = makeInvalidEarlyAccess('_lv_obj_set_style_radius');
var _lv_obj_set_style_radial_offset = Module['_lv_obj_set_style_radial_offset'] = makeInvalidEarlyAccess('_lv_obj_set_style_radial_offset');
var _lv_obj_set_style_clip_corner = Module['_lv_obj_set_style_clip_corner'] = makeInvalidEarlyAccess('_lv_obj_set_style_clip_corner');
var _lv_obj_set_style_opa_layered = Module['_lv_obj_set_style_opa_layered'] = makeInvalidEarlyAccess('_lv_obj_set_style_opa_layered');
var _lv_obj_set_style_color_filter_dsc = Module['_lv_obj_set_style_color_filter_dsc'] = makeInvalidEarlyAccess('_lv_obj_set_style_color_filter_dsc');
var _lv_obj_set_style_color_filter_opa = Module['_lv_obj_set_style_color_filter_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_color_filter_opa');
var _lv_obj_set_style_recolor = Module['_lv_obj_set_style_recolor'] = makeInvalidEarlyAccess('_lv_obj_set_style_recolor');
var _lv_obj_set_style_recolor_opa = Module['_lv_obj_set_style_recolor_opa'] = makeInvalidEarlyAccess('_lv_obj_set_style_recolor_opa');
var _lv_obj_set_style_anim = Module['_lv_obj_set_style_anim'] = makeInvalidEarlyAccess('_lv_obj_set_style_anim');
var _lv_obj_set_style_anim_duration = Module['_lv_obj_set_style_anim_duration'] = makeInvalidEarlyAccess('_lv_obj_set_style_anim_duration');
var _lv_obj_set_style_transition = Module['_lv_obj_set_style_transition'] = makeInvalidEarlyAccess('_lv_obj_set_style_transition');
var _lv_obj_set_style_blend_mode = Module['_lv_obj_set_style_blend_mode'] = makeInvalidEarlyAccess('_lv_obj_set_style_blend_mode');
var _lv_obj_set_style_base_dir = Module['_lv_obj_set_style_base_dir'] = makeInvalidEarlyAccess('_lv_obj_set_style_base_dir');
var _lv_obj_set_style_bitmap_mask_src = Module['_lv_obj_set_style_bitmap_mask_src'] = makeInvalidEarlyAccess('_lv_obj_set_style_bitmap_mask_src');
var _lv_obj_set_style_rotary_sensitivity = Module['_lv_obj_set_style_rotary_sensitivity'] = makeInvalidEarlyAccess('_lv_obj_set_style_rotary_sensitivity');
var _lv_obj_set_style_flex_flow = Module['_lv_obj_set_style_flex_flow'] = makeInvalidEarlyAccess('_lv_obj_set_style_flex_flow');
var _lv_obj_set_style_flex_main_place = Module['_lv_obj_set_style_flex_main_place'] = makeInvalidEarlyAccess('_lv_obj_set_style_flex_main_place');
var _lv_obj_set_style_flex_cross_place = Module['_lv_obj_set_style_flex_cross_place'] = makeInvalidEarlyAccess('_lv_obj_set_style_flex_cross_place');
var _lv_obj_set_style_flex_track_place = Module['_lv_obj_set_style_flex_track_place'] = makeInvalidEarlyAccess('_lv_obj_set_style_flex_track_place');
var _lv_obj_set_style_flex_grow = Module['_lv_obj_set_style_flex_grow'] = makeInvalidEarlyAccess('_lv_obj_set_style_flex_grow');
var _lv_obj_set_style_grid_column_dsc_array = Module['_lv_obj_set_style_grid_column_dsc_array'] = makeInvalidEarlyAccess('_lv_obj_set_style_grid_column_dsc_array');
var _lv_obj_set_style_grid_column_align = Module['_lv_obj_set_style_grid_column_align'] = makeInvalidEarlyAccess('_lv_obj_set_style_grid_column_align');
var _lv_obj_set_style_grid_row_dsc_array = Module['_lv_obj_set_style_grid_row_dsc_array'] = makeInvalidEarlyAccess('_lv_obj_set_style_grid_row_dsc_array');
var _lv_obj_set_style_grid_row_align = Module['_lv_obj_set_style_grid_row_align'] = makeInvalidEarlyAccess('_lv_obj_set_style_grid_row_align');
var _lv_obj_set_style_grid_cell_column_pos = Module['_lv_obj_set_style_grid_cell_column_pos'] = makeInvalidEarlyAccess('_lv_obj_set_style_grid_cell_column_pos');
var _lv_obj_set_style_grid_cell_x_align = Module['_lv_obj_set_style_grid_cell_x_align'] = makeInvalidEarlyAccess('_lv_obj_set_style_grid_cell_x_align');
var _lv_obj_set_style_grid_cell_column_span = Module['_lv_obj_set_style_grid_cell_column_span'] = makeInvalidEarlyAccess('_lv_obj_set_style_grid_cell_column_span');
var _lv_obj_set_style_grid_cell_row_pos = Module['_lv_obj_set_style_grid_cell_row_pos'] = makeInvalidEarlyAccess('_lv_obj_set_style_grid_cell_row_pos');
var _lv_obj_set_style_grid_cell_y_align = Module['_lv_obj_set_style_grid_cell_y_align'] = makeInvalidEarlyAccess('_lv_obj_set_style_grid_cell_y_align');
var _lv_obj_set_style_grid_cell_row_span = Module['_lv_obj_set_style_grid_cell_row_span'] = makeInvalidEarlyAccess('_lv_obj_set_style_grid_cell_row_span');
var _lv_indev_get_state = Module['_lv_indev_get_state'] = makeInvalidEarlyAccess('_lv_indev_get_state');
var _lv_indev_wait_release = Module['_lv_indev_wait_release'] = makeInvalidEarlyAccess('_lv_indev_wait_release');
var _lv_indev_reset = Module['_lv_indev_reset'] = makeInvalidEarlyAccess('_lv_indev_reset');
var _lv_indev_get_active_obj = Module['_lv_indev_get_active_obj'] = makeInvalidEarlyAccess('_lv_indev_get_active_obj');
var _lv_async_call_cancel = Module['_lv_async_call_cancel'] = makeInvalidEarlyAccess('_lv_async_call_cancel');
var _lv_obj_clean = Module['_lv_obj_clean'] = makeInvalidEarlyAccess('_lv_obj_clean');
var _lv_obj_delete_delayed = Module['_lv_obj_delete_delayed'] = makeInvalidEarlyAccess('_lv_obj_delete_delayed');
var _lv_obj_delete_anim_completed_cb = Module['_lv_obj_delete_anim_completed_cb'] = makeInvalidEarlyAccess('_lv_obj_delete_anim_completed_cb');
var _lv_obj_delete_async = Module['_lv_obj_delete_async'] = makeInvalidEarlyAccess('_lv_obj_delete_async');
var _lv_async_call = Module['_lv_async_call'] = makeInvalidEarlyAccess('_lv_async_call');
var _lv_obj_set_parent = Module['_lv_obj_set_parent'] = makeInvalidEarlyAccess('_lv_obj_set_parent');
var _lv_obj_get_index = Module['_lv_obj_get_index'] = makeInvalidEarlyAccess('_lv_obj_get_index');
var _lv_obj_move_to_index = Module['_lv_obj_move_to_index'] = makeInvalidEarlyAccess('_lv_obj_move_to_index');
var _lv_obj_swap = Module['_lv_obj_swap'] = makeInvalidEarlyAccess('_lv_obj_swap');
var _lv_obj_get_sibling = Module['_lv_obj_get_sibling'] = makeInvalidEarlyAccess('_lv_obj_get_sibling');
var _lv_obj_get_sibling_by_type = Module['_lv_obj_get_sibling_by_type'] = makeInvalidEarlyAccess('_lv_obj_get_sibling_by_type');
var _lv_obj_get_index_by_type = Module['_lv_obj_get_index_by_type'] = makeInvalidEarlyAccess('_lv_obj_get_index_by_type');
var _lv_obj_get_child_count_by_type = Module['_lv_obj_get_child_count_by_type'] = makeInvalidEarlyAccess('_lv_obj_get_child_count_by_type');
var _lv_obj_tree_walk = Module['_lv_obj_tree_walk'] = makeInvalidEarlyAccess('_lv_obj_tree_walk');
var _lv_obj_dump_tree = Module['_lv_obj_dump_tree'] = makeInvalidEarlyAccess('_lv_obj_dump_tree');
var _lv_refr_init = Module['_lv_refr_init'] = makeInvalidEarlyAccess('_lv_refr_init');
var _lv_refr_deinit = Module['_lv_refr_deinit'] = makeInvalidEarlyAccess('_lv_refr_deinit');
var _lv_refr_now = Module['_lv_refr_now'] = makeInvalidEarlyAccess('_lv_refr_now');
var _lv_display_refr_timer = Module['_lv_display_refr_timer'] = makeInvalidEarlyAccess('_lv_display_refr_timer');
var _lv_obj_redraw = Module['_lv_obj_redraw'] = makeInvalidEarlyAccess('_lv_obj_redraw');
var _lv_obj_refr = Module['_lv_obj_refr'] = makeInvalidEarlyAccess('_lv_obj_refr');
var _lv_anim_refr_now = Module['_lv_anim_refr_now'] = makeInvalidEarlyAccess('_lv_anim_refr_now');
var _lv_timer_pause = Module['_lv_timer_pause'] = makeInvalidEarlyAccess('_lv_timer_pause');
var _lv_area_is_on = Module['_lv_area_is_on'] = makeInvalidEarlyAccess('_lv_area_is_on');
var _lv_area_join = Module['_lv_area_join'] = makeInvalidEarlyAccess('_lv_area_join');
var _lv_display_is_double_buffered = Module['_lv_display_is_double_buffered'] = makeInvalidEarlyAccess('_lv_display_is_double_buffered');
var _lv_ll_is_empty = Module['_lv_ll_is_empty'] = makeInvalidEarlyAccess('_lv_ll_is_empty');
var _lv_area_diff = Module['_lv_area_diff'] = makeInvalidEarlyAccess('_lv_area_diff');
var _lv_ll_ins_prev = Module['_lv_ll_ins_prev'] = makeInvalidEarlyAccess('_lv_ll_ins_prev');
var _lv_draw_buf_copy = Module['_lv_draw_buf_copy'] = makeInvalidEarlyAccess('_lv_draw_buf_copy');
var _lv_draw_buf_width_to_stride = Module['_lv_draw_buf_width_to_stride'] = makeInvalidEarlyAccess('_lv_draw_buf_width_to_stride');
var _lv_draw_sw_mask_cleanup = Module['_lv_draw_sw_mask_cleanup'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_cleanup');
var _lv_draw_mask_rect_dsc_init = Module['_lv_draw_mask_rect_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_mask_rect_dsc_init');
var _lv_draw_image_dsc_init = Module['_lv_draw_image_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_image_dsc_init');
var _lv_draw_layer_create = Module['_lv_draw_layer_create'] = makeInvalidEarlyAccess('_lv_draw_layer_create');
var _lv_draw_mask_rect = Module['_lv_draw_mask_rect'] = makeInvalidEarlyAccess('_lv_draw_mask_rect');
var _lv_draw_layer = Module['_lv_draw_layer'] = makeInvalidEarlyAccess('_lv_draw_layer');
var _lv_color_format_get_size = Module['_lv_color_format_get_size'] = makeInvalidEarlyAccess('_lv_color_format_get_size');
var _lv_refr_get_disp_refreshing = Module['_lv_refr_get_disp_refreshing'] = makeInvalidEarlyAccess('_lv_refr_get_disp_refreshing');
var _lv_refr_set_disp_refreshing = Module['_lv_refr_set_disp_refreshing'] = makeInvalidEarlyAccess('_lv_refr_set_disp_refreshing');
var _lv_refr_get_top_obj = Module['_lv_refr_get_top_obj'] = makeInvalidEarlyAccess('_lv_refr_get_top_obj');
var _lv_draw_buf_reshape = Module['_lv_draw_buf_reshape'] = makeInvalidEarlyAccess('_lv_draw_buf_reshape');
var _lv_display_get_matrix_rotation = Module['_lv_display_get_matrix_rotation'] = makeInvalidEarlyAccess('_lv_display_get_matrix_rotation');
var _lv_display_get_original_horizontal_resolution = Module['_lv_display_get_original_horizontal_resolution'] = makeInvalidEarlyAccess('_lv_display_get_original_horizontal_resolution');
var _lv_display_get_original_vertical_resolution = Module['_lv_display_get_original_vertical_resolution'] = makeInvalidEarlyAccess('_lv_display_get_original_vertical_resolution');
var _lv_draw_layer_init = Module['_lv_draw_layer_init'] = makeInvalidEarlyAccess('_lv_draw_layer_init');
var _lv_draw_dispatch_wait_for_request = Module['_lv_draw_dispatch_wait_for_request'] = makeInvalidEarlyAccess('_lv_draw_dispatch_wait_for_request');
var _lv_draw_dispatch = Module['_lv_draw_dispatch'] = makeInvalidEarlyAccess('_lv_draw_dispatch');
var _lv_layer_reset = Module['_lv_layer_reset'] = makeInvalidEarlyAccess('_lv_layer_reset');
var _lv_color_format_has_alpha = Module['_lv_color_format_has_alpha'] = makeInvalidEarlyAccess('_lv_color_format_has_alpha');
var _lv_area_move = Module['_lv_area_move'] = makeInvalidEarlyAccess('_lv_area_move');
var _lv_draw_buf_clear = Module['_lv_draw_buf_clear'] = makeInvalidEarlyAccess('_lv_draw_buf_clear');
var _lv_layer_init = Module['_lv_layer_init'] = makeInvalidEarlyAccess('_lv_layer_init');
var _lv_tick_get = Module['_lv_tick_get'] = makeInvalidEarlyAccess('_lv_tick_get');
var _lv_timer_create = Module['_lv_timer_create'] = makeInvalidEarlyAccess('_lv_timer_create');
var _lv_theme_default_is_inited = Module['_lv_theme_default_is_inited'] = makeInvalidEarlyAccess('_lv_theme_default_is_inited');
var _lv_theme_default_get = Module['_lv_theme_default_get'] = makeInvalidEarlyAccess('_lv_theme_default_get');
var _lv_timer_ready = Module['_lv_timer_ready'] = makeInvalidEarlyAccess('_lv_timer_ready');
var _lv_display_add_event_cb = Module['_lv_display_add_event_cb'] = makeInvalidEarlyAccess('_lv_display_add_event_cb');
var _lv_timer_resume = Module['_lv_timer_resume'] = makeInvalidEarlyAccess('_lv_timer_resume');
var _lv_display_delete = Module['_lv_display_delete'] = makeInvalidEarlyAccess('_lv_display_delete');
var _lv_event_push_and_send = Module['_lv_event_push_and_send'] = makeInvalidEarlyAccess('_lv_event_push_and_send');
var _lv_indev_get_display = Module['_lv_indev_get_display'] = makeInvalidEarlyAccess('_lv_indev_get_display');
var _lv_indev_set_display = Module['_lv_indev_set_display'] = makeInvalidEarlyAccess('_lv_indev_set_display');
var _lv_timer_delete = Module['_lv_timer_delete'] = makeInvalidEarlyAccess('_lv_timer_delete');
var _lv_display_set_default = Module['_lv_display_set_default'] = makeInvalidEarlyAccess('_lv_display_set_default');
var _lv_display_set_resolution = Module['_lv_display_set_resolution'] = makeInvalidEarlyAccess('_lv_display_set_resolution');
var _lv_area_set_width = Module['_lv_area_set_width'] = makeInvalidEarlyAccess('_lv_area_set_width');
var _lv_area_set_height = Module['_lv_area_set_height'] = makeInvalidEarlyAccess('_lv_area_set_height');
var _lv_display_set_physical_resolution = Module['_lv_display_set_physical_resolution'] = makeInvalidEarlyAccess('_lv_display_set_physical_resolution');
var _lv_display_set_offset = Module['_lv_display_set_offset'] = makeInvalidEarlyAccess('_lv_display_set_offset');
var _lv_display_set_dpi = Module['_lv_display_set_dpi'] = makeInvalidEarlyAccess('_lv_display_set_dpi');
var _lv_display_get_physical_horizontal_resolution = Module['_lv_display_get_physical_horizontal_resolution'] = makeInvalidEarlyAccess('_lv_display_get_physical_horizontal_resolution');
var _lv_display_get_physical_vertical_resolution = Module['_lv_display_get_physical_vertical_resolution'] = makeInvalidEarlyAccess('_lv_display_get_physical_vertical_resolution');
var _lv_display_get_offset_x = Module['_lv_display_get_offset_x'] = makeInvalidEarlyAccess('_lv_display_get_offset_x');
var _lv_display_get_offset_y = Module['_lv_display_get_offset_y'] = makeInvalidEarlyAccess('_lv_display_get_offset_y');
var _lv_display_set_draw_buffers = Module['_lv_display_set_draw_buffers'] = makeInvalidEarlyAccess('_lv_display_set_draw_buffers');
var _lv_display_set_3rd_draw_buffer = Module['_lv_display_set_3rd_draw_buffer'] = makeInvalidEarlyAccess('_lv_display_set_3rd_draw_buffer');
var _lv_draw_buf_align = Module['_lv_draw_buf_align'] = makeInvalidEarlyAccess('_lv_draw_buf_align');
var _lv_draw_buf_init = Module['_lv_draw_buf_init'] = makeInvalidEarlyAccess('_lv_draw_buf_init');
var _lv_display_get_color_format = Module['_lv_display_get_color_format'] = makeInvalidEarlyAccess('_lv_display_get_color_format');
var _lv_display_set_render_mode = Module['_lv_display_set_render_mode'] = makeInvalidEarlyAccess('_lv_display_set_render_mode');
var _lv_display_set_buffers_with_stride = Module['_lv_display_set_buffers_with_stride'] = makeInvalidEarlyAccess('_lv_display_set_buffers_with_stride');
var _lv_display_set_flush_wait_cb = Module['_lv_display_set_flush_wait_cb'] = makeInvalidEarlyAccess('_lv_display_set_flush_wait_cb');
var _lv_display_set_color_format = Module['_lv_display_set_color_format'] = makeInvalidEarlyAccess('_lv_display_set_color_format');
var _lv_display_set_tile_cnt = Module['_lv_display_set_tile_cnt'] = makeInvalidEarlyAccess('_lv_display_set_tile_cnt');
var _lv_display_get_tile_cnt = Module['_lv_display_get_tile_cnt'] = makeInvalidEarlyAccess('_lv_display_get_tile_cnt');
var _lv_display_set_antialiasing = Module['_lv_display_set_antialiasing'] = makeInvalidEarlyAccess('_lv_display_set_antialiasing');
var _lv_display_get_antialiasing = Module['_lv_display_get_antialiasing'] = makeInvalidEarlyAccess('_lv_display_get_antialiasing');
var _lv_display_flush_is_last = Module['_lv_display_flush_is_last'] = makeInvalidEarlyAccess('_lv_display_flush_is_last');
var _lv_display_get_screen_loading = Module['_lv_display_get_screen_loading'] = makeInvalidEarlyAccess('_lv_display_get_screen_loading');
var _lv_display_get_event_count = Module['_lv_display_get_event_count'] = makeInvalidEarlyAccess('_lv_display_get_event_count');
var _lv_display_get_event_dsc = Module['_lv_display_get_event_dsc'] = makeInvalidEarlyAccess('_lv_display_get_event_dsc');
var _lv_display_delete_event = Module['_lv_display_delete_event'] = makeInvalidEarlyAccess('_lv_display_delete_event');
var _lv_display_remove_event_cb_with_user_data = Module['_lv_display_remove_event_cb_with_user_data'] = makeInvalidEarlyAccess('_lv_display_remove_event_cb_with_user_data');
var _lv_event_get_invalidated_area = Module['_lv_event_get_invalidated_area'] = makeInvalidEarlyAccess('_lv_event_get_invalidated_area');
var _lv_display_set_rotation = Module['_lv_display_set_rotation'] = makeInvalidEarlyAccess('_lv_display_set_rotation');
var _lv_display_get_rotation = Module['_lv_display_get_rotation'] = makeInvalidEarlyAccess('_lv_display_get_rotation');
var _lv_display_set_matrix_rotation = Module['_lv_display_set_matrix_rotation'] = makeInvalidEarlyAccess('_lv_display_set_matrix_rotation');
var _lv_display_get_theme = Module['_lv_display_get_theme'] = makeInvalidEarlyAccess('_lv_display_get_theme');
var _lv_display_get_inactive_time = Module['_lv_display_get_inactive_time'] = makeInvalidEarlyAccess('_lv_display_get_inactive_time');
var _lv_tick_elaps = Module['_lv_tick_elaps'] = makeInvalidEarlyAccess('_lv_tick_elaps');
var _lv_display_trigger_activity = Module['_lv_display_trigger_activity'] = makeInvalidEarlyAccess('_lv_display_trigger_activity');
var _lv_display_enable_invalidation = Module['_lv_display_enable_invalidation'] = makeInvalidEarlyAccess('_lv_display_enable_invalidation');
var _lv_display_get_refr_timer = Module['_lv_display_get_refr_timer'] = makeInvalidEarlyAccess('_lv_display_get_refr_timer');
var _lv_display_delete_refr_timer = Module['_lv_display_delete_refr_timer'] = makeInvalidEarlyAccess('_lv_display_delete_refr_timer');
var _lv_display_send_vsync_event = Module['_lv_display_send_vsync_event'] = makeInvalidEarlyAccess('_lv_display_send_vsync_event');
var _lv_display_register_vsync_event = Module['_lv_display_register_vsync_event'] = makeInvalidEarlyAccess('_lv_display_register_vsync_event');
var _lv_display_unregister_vsync_event = Module['_lv_display_unregister_vsync_event'] = makeInvalidEarlyAccess('_lv_display_unregister_vsync_event');
var _lv_display_set_user_data = Module['_lv_display_set_user_data'] = makeInvalidEarlyAccess('_lv_display_set_user_data');
var _lv_display_set_driver_data = Module['_lv_display_set_driver_data'] = makeInvalidEarlyAccess('_lv_display_set_driver_data');
var _lv_display_get_user_data = Module['_lv_display_get_user_data'] = makeInvalidEarlyAccess('_lv_display_get_user_data');
var _lv_display_get_driver_data = Module['_lv_display_get_driver_data'] = makeInvalidEarlyAccess('_lv_display_get_driver_data');
var _lv_display_get_buf_active = Module['_lv_display_get_buf_active'] = makeInvalidEarlyAccess('_lv_display_get_buf_active');
var _lv_display_rotate_area = Module['_lv_display_rotate_area'] = makeInvalidEarlyAccess('_lv_display_rotate_area');
var _lv_display_get_draw_buf_size = Module['_lv_display_get_draw_buf_size'] = makeInvalidEarlyAccess('_lv_display_get_draw_buf_size');
var _lv_display_get_invalidated_draw_buf_size = Module['_lv_display_get_invalidated_draw_buf_size'] = makeInvalidEarlyAccess('_lv_display_get_invalidated_draw_buf_size');
var _lv_layer_top = Module['_lv_layer_top'] = makeInvalidEarlyAccess('_lv_layer_top');
var _lv_layer_sys = Module['_lv_layer_sys'] = makeInvalidEarlyAccess('_lv_layer_sys');
var _lv_layer_bottom = Module['_lv_layer_bottom'] = makeInvalidEarlyAccess('_lv_layer_bottom');
var _lv_dpx = Module['_lv_dpx'] = makeInvalidEarlyAccess('_lv_dpx');
var _lv_display_dpx = Module['_lv_display_dpx'] = makeInvalidEarlyAccess('_lv_display_dpx');
var _lv_draw_buf_convert_premultiply = Module['_lv_draw_buf_convert_premultiply'] = makeInvalidEarlyAccess('_lv_draw_buf_convert_premultiply');
var _lv_draw_init = Module['_lv_draw_init'] = makeInvalidEarlyAccess('_lv_draw_init');
var _lv_draw_deinit = Module['_lv_draw_deinit'] = makeInvalidEarlyAccess('_lv_draw_deinit');
var _lv_draw_create_unit = Module['_lv_draw_create_unit'] = makeInvalidEarlyAccess('_lv_draw_create_unit');
var _lv_draw_add_task = Module['_lv_draw_add_task'] = makeInvalidEarlyAccess('_lv_draw_add_task');
var _lv_draw_finalize_task_creation = Module['_lv_draw_finalize_task_creation'] = makeInvalidEarlyAccess('_lv_draw_finalize_task_creation');
var _lv_draw_dispatch_layer = Module['_lv_draw_dispatch_layer'] = makeInvalidEarlyAccess('_lv_draw_dispatch_layer');
var _lv_draw_wait_for_finish = Module['_lv_draw_wait_for_finish'] = makeInvalidEarlyAccess('_lv_draw_wait_for_finish');
var _lv_draw_buf_destroy = Module['_lv_draw_buf_destroy'] = makeInvalidEarlyAccess('_lv_draw_buf_destroy');
var _lv_draw_task_get_label_dsc = Module['_lv_draw_task_get_label_dsc'] = makeInvalidEarlyAccess('_lv_draw_task_get_label_dsc');
var _lv_draw_dispatch_request = Module['_lv_draw_dispatch_request'] = makeInvalidEarlyAccess('_lv_draw_dispatch_request');
var _lv_draw_get_unit_count = Module['_lv_draw_get_unit_count'] = makeInvalidEarlyAccess('_lv_draw_get_unit_count');
var _lv_draw_get_available_task = Module['_lv_draw_get_available_task'] = makeInvalidEarlyAccess('_lv_draw_get_available_task');
var _lv_draw_get_next_available_task = Module['_lv_draw_get_next_available_task'] = makeInvalidEarlyAccess('_lv_draw_get_next_available_task');
var _lv_draw_get_dependent_count = Module['_lv_draw_get_dependent_count'] = makeInvalidEarlyAccess('_lv_draw_get_dependent_count');
var _lv_draw_unit_send_event = Module['_lv_draw_unit_send_event'] = makeInvalidEarlyAccess('_lv_draw_unit_send_event');
var _lv_strcmp = Module['_lv_strcmp'] = makeInvalidEarlyAccess('_lv_strcmp');
var _lv_color32_make = Module['_lv_color32_make'] = makeInvalidEarlyAccess('_lv_color32_make');
var _lv_draw_layer_alloc_buf = Module['_lv_draw_layer_alloc_buf'] = makeInvalidEarlyAccess('_lv_draw_layer_alloc_buf');
var _lv_draw_buf_create = Module['_lv_draw_buf_create'] = makeInvalidEarlyAccess('_lv_draw_buf_create');
var _lv_draw_layer_go_to_xy = Module['_lv_draw_layer_go_to_xy'] = makeInvalidEarlyAccess('_lv_draw_layer_go_to_xy');
var _lv_draw_buf_goto_xy = Module['_lv_draw_buf_goto_xy'] = makeInvalidEarlyAccess('_lv_draw_buf_goto_xy');
var _lv_draw_task_get_type = Module['_lv_draw_task_get_type'] = makeInvalidEarlyAccess('_lv_draw_task_get_type');
var _lv_draw_task_get_draw_dsc = Module['_lv_draw_task_get_draw_dsc'] = makeInvalidEarlyAccess('_lv_draw_task_get_draw_dsc');
var _lv_draw_task_get_area = Module['_lv_draw_task_get_area'] = makeInvalidEarlyAccess('_lv_draw_task_get_area');
var _lv_draw_arc_dsc_init = Module['_lv_draw_arc_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_arc_dsc_init');
var _lv_draw_task_get_arc_dsc = Module['_lv_draw_task_get_arc_dsc'] = makeInvalidEarlyAccess('_lv_draw_task_get_arc_dsc');
var _lv_draw_arc = Module['_lv_draw_arc'] = makeInvalidEarlyAccess('_lv_draw_arc');
var _lv_draw_arc_get_area = Module['_lv_draw_arc_get_area'] = makeInvalidEarlyAccess('_lv_draw_arc_get_area');
var _lv_draw_buf_init_handlers = Module['_lv_draw_buf_init_handlers'] = makeInvalidEarlyAccess('_lv_draw_buf_init_handlers');
var _lv_draw_buf_init_with_default_handlers = Module['_lv_draw_buf_init_with_default_handlers'] = makeInvalidEarlyAccess('_lv_draw_buf_init_with_default_handlers');
var _lv_draw_buf_handlers_init = Module['_lv_draw_buf_handlers_init'] = makeInvalidEarlyAccess('_lv_draw_buf_handlers_init');
var _lv_draw_buf_get_handlers = Module['_lv_draw_buf_get_handlers'] = makeInvalidEarlyAccess('_lv_draw_buf_get_handlers');
var _lv_draw_buf_get_font_handlers = Module['_lv_draw_buf_get_font_handlers'] = makeInvalidEarlyAccess('_lv_draw_buf_get_font_handlers');
var _lv_draw_buf_get_image_handlers = Module['_lv_draw_buf_get_image_handlers'] = makeInvalidEarlyAccess('_lv_draw_buf_get_image_handlers');
var _lv_color_format_get_bpp = Module['_lv_color_format_get_bpp'] = makeInvalidEarlyAccess('_lv_color_format_get_bpp');
var _lv_draw_buf_width_to_stride_ex = Module['_lv_draw_buf_width_to_stride_ex'] = makeInvalidEarlyAccess('_lv_draw_buf_width_to_stride_ex');
var _lv_draw_buf_align_ex = Module['_lv_draw_buf_align_ex'] = makeInvalidEarlyAccess('_lv_draw_buf_align_ex');
var _lv_draw_buf_invalidate_cache = Module['_lv_draw_buf_invalidate_cache'] = makeInvalidEarlyAccess('_lv_draw_buf_invalidate_cache');
var _lv_draw_buf_flush_cache = Module['_lv_draw_buf_flush_cache'] = makeInvalidEarlyAccess('_lv_draw_buf_flush_cache');
var _lv_draw_buf_create_ex = Module['_lv_draw_buf_create_ex'] = makeInvalidEarlyAccess('_lv_draw_buf_create_ex');
var _lv_draw_buf_dup = Module['_lv_draw_buf_dup'] = makeInvalidEarlyAccess('_lv_draw_buf_dup');
var _lv_draw_buf_dup_ex = Module['_lv_draw_buf_dup_ex'] = makeInvalidEarlyAccess('_lv_draw_buf_dup_ex');
var _lv_draw_buf_adjust_stride = Module['_lv_draw_buf_adjust_stride'] = makeInvalidEarlyAccess('_lv_draw_buf_adjust_stride');
var _lv_memmove = Module['_lv_memmove'] = makeInvalidEarlyAccess('_lv_memmove');
var _lv_draw_buf_has_flag = Module['_lv_draw_buf_has_flag'] = makeInvalidEarlyAccess('_lv_draw_buf_has_flag');
var _lv_draw_buf_premultiply = Module['_lv_draw_buf_premultiply'] = makeInvalidEarlyAccess('_lv_draw_buf_premultiply');
var _lv_color_premultiply = Module['_lv_color_premultiply'] = makeInvalidEarlyAccess('_lv_color_premultiply');
var _lv_color16_premultiply = Module['_lv_color16_premultiply'] = makeInvalidEarlyAccess('_lv_color16_premultiply');
var _lv_draw_buf_set_palette = Module['_lv_draw_buf_set_palette'] = makeInvalidEarlyAccess('_lv_draw_buf_set_palette');
var _lv_draw_buf_set_flag = Module['_lv_draw_buf_set_flag'] = makeInvalidEarlyAccess('_lv_draw_buf_set_flag');
var _lv_draw_buf_clear_flag = Module['_lv_draw_buf_clear_flag'] = makeInvalidEarlyAccess('_lv_draw_buf_clear_flag');
var _lv_draw_buf_from_image = Module['_lv_draw_buf_from_image'] = makeInvalidEarlyAccess('_lv_draw_buf_from_image');
var _lv_draw_buf_to_image = Module['_lv_draw_buf_to_image'] = makeInvalidEarlyAccess('_lv_draw_buf_to_image');
var _lv_image_buf_set_palette = Module['_lv_image_buf_set_palette'] = makeInvalidEarlyAccess('_lv_image_buf_set_palette');
var _lv_image_buf_free = Module['_lv_image_buf_free'] = makeInvalidEarlyAccess('_lv_image_buf_free');
var _lv_color_black = Module['_lv_color_black'] = makeInvalidEarlyAccess('_lv_color_black');
var _lv_draw_task_get_image_dsc = Module['_lv_draw_task_get_image_dsc'] = makeInvalidEarlyAccess('_lv_draw_task_get_image_dsc');
var _lv_image_buf_get_transformed_area = Module['_lv_image_buf_get_transformed_area'] = makeInvalidEarlyAccess('_lv_image_buf_get_transformed_area');
var _lv_point_transform = Module['_lv_point_transform'] = makeInvalidEarlyAccess('_lv_point_transform');
var _lv_draw_image = Module['_lv_draw_image'] = makeInvalidEarlyAccess('_lv_draw_image');
var _lv_image_decoder_get_info = Module['_lv_image_decoder_get_info'] = makeInvalidEarlyAccess('_lv_image_decoder_get_info');
var _lv_image_decoder_open = Module['_lv_image_decoder_open'] = makeInvalidEarlyAccess('_lv_image_decoder_open');
var _lv_image_decoder_close = Module['_lv_image_decoder_close'] = makeInvalidEarlyAccess('_lv_image_decoder_close');
var _lv_draw_image_normal_helper = Module['_lv_draw_image_normal_helper'] = makeInvalidEarlyAccess('_lv_draw_image_normal_helper');
var _lv_image_decoder_get_area = Module['_lv_image_decoder_get_area'] = makeInvalidEarlyAccess('_lv_image_decoder_get_area');
var _lv_draw_image_tiled_helper = Module['_lv_draw_image_tiled_helper'] = makeInvalidEarlyAccess('_lv_draw_image_tiled_helper');
var _lv_draw_letter_dsc_init = Module['_lv_draw_letter_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_letter_dsc_init');
var _lv_draw_label_dsc_init = Module['_lv_draw_label_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_label_dsc_init');
var _lv_draw_glyph_dsc_init = Module['_lv_draw_glyph_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_glyph_dsc_init');
var _lv_draw_label = Module['_lv_draw_label'] = makeInvalidEarlyAccess('_lv_draw_label');
var _lv_strndup = Module['_lv_strndup'] = makeInvalidEarlyAccess('_lv_strndup');
var _lv_draw_character = Module['_lv_draw_character'] = makeInvalidEarlyAccess('_lv_draw_character');
var _lv_font_get_glyph_dsc = Module['_lv_font_get_glyph_dsc'] = makeInvalidEarlyAccess('_lv_font_get_glyph_dsc');
var _lv_font_get_line_height = Module['_lv_font_get_line_height'] = makeInvalidEarlyAccess('_lv_font_get_line_height');
var _lv_draw_letter = Module['_lv_draw_letter'] = makeInvalidEarlyAccess('_lv_draw_letter');
var _lv_draw_label_iterate_characters = Module['_lv_draw_label_iterate_characters'] = makeInvalidEarlyAccess('_lv_draw_label_iterate_characters');
var _lv_text_get_size_attributes = Module['_lv_text_get_size_attributes'] = makeInvalidEarlyAccess('_lv_text_get_size_attributes');
var _lv_point_set = Module['_lv_point_set'] = makeInvalidEarlyAccess('_lv_point_set');
var _lv_text_get_next_line = Module['_lv_text_get_next_line'] = makeInvalidEarlyAccess('_lv_text_get_next_line');
var _lv_text_get_width = Module['_lv_text_get_width'] = makeInvalidEarlyAccess('_lv_text_get_width');
var _lv_draw_fill_dsc_init = Module['_lv_draw_fill_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_fill_dsc_init');
var _lv_bidi_process_paragraph = Module['_lv_bidi_process_paragraph'] = makeInvalidEarlyAccess('_lv_bidi_process_paragraph');
var _lv_bidi_get_logical_pos = Module['_lv_bidi_get_logical_pos'] = makeInvalidEarlyAccess('_lv_bidi_get_logical_pos');
var _lv_text_encoded_letter_next_2 = Module['_lv_text_encoded_letter_next_2'] = makeInvalidEarlyAccess('_lv_text_encoded_letter_next_2');
var _lv_draw_unit_draw_letter = Module['_lv_draw_unit_draw_letter'] = makeInvalidEarlyAccess('_lv_draw_unit_draw_letter');
var _lv_area_is_out = Module['_lv_area_is_out'] = makeInvalidEarlyAccess('_lv_area_is_out');
var _lv_font_get_glyph_bitmap = Module['_lv_font_get_glyph_bitmap'] = makeInvalidEarlyAccess('_lv_font_get_glyph_bitmap');
var _lv_font_glyph_release_draw_data = Module['_lv_font_glyph_release_draw_data'] = makeInvalidEarlyAccess('_lv_font_glyph_release_draw_data');
var _lv_draw_line_dsc_init = Module['_lv_draw_line_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_line_dsc_init');
var _lv_draw_task_get_line_dsc = Module['_lv_draw_task_get_line_dsc'] = makeInvalidEarlyAccess('_lv_draw_task_get_line_dsc');
var _lv_draw_line = Module['_lv_draw_line'] = makeInvalidEarlyAccess('_lv_draw_line');
var _lv_draw_task_get_mask_rect_dsc = Module['_lv_draw_task_get_mask_rect_dsc'] = makeInvalidEarlyAccess('_lv_draw_task_get_mask_rect_dsc');
var _lv_color_white = Module['_lv_color_white'] = makeInvalidEarlyAccess('_lv_color_white');
var _lv_draw_task_get_fill_dsc = Module['_lv_draw_task_get_fill_dsc'] = makeInvalidEarlyAccess('_lv_draw_task_get_fill_dsc');
var _lv_draw_fill = Module['_lv_draw_fill'] = makeInvalidEarlyAccess('_lv_draw_fill');
var _lv_draw_border_dsc_init = Module['_lv_draw_border_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_border_dsc_init');
var _lv_draw_task_get_border_dsc = Module['_lv_draw_task_get_border_dsc'] = makeInvalidEarlyAccess('_lv_draw_task_get_border_dsc');
var _lv_draw_border = Module['_lv_draw_border'] = makeInvalidEarlyAccess('_lv_draw_border');
var _lv_draw_box_shadow_dsc_init = Module['_lv_draw_box_shadow_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_box_shadow_dsc_init');
var _lv_draw_task_get_box_shadow_dsc = Module['_lv_draw_task_get_box_shadow_dsc'] = makeInvalidEarlyAccess('_lv_draw_task_get_box_shadow_dsc');
var _lv_draw_box_shadow = Module['_lv_draw_box_shadow'] = makeInvalidEarlyAccess('_lv_draw_box_shadow');
var _lv_area_align = Module['_lv_area_align'] = makeInvalidEarlyAccess('_lv_area_align');
var _lv_draw_triangle_dsc_init = Module['_lv_draw_triangle_dsc_init'] = makeInvalidEarlyAccess('_lv_draw_triangle_dsc_init');
var _lv_draw_task_get_triangle_dsc = Module['_lv_draw_task_get_triangle_dsc'] = makeInvalidEarlyAccess('_lv_draw_task_get_triangle_dsc');
var _lv_draw_triangle = Module['_lv_draw_triangle'] = makeInvalidEarlyAccess('_lv_draw_triangle');
var _lv_image_decoder_init = Module['_lv_image_decoder_init'] = makeInvalidEarlyAccess('_lv_image_decoder_init');
var _lv_image_decoder_deinit = Module['_lv_image_decoder_deinit'] = makeInvalidEarlyAccess('_lv_image_decoder_deinit');
var _lv_image_cache_init = Module['_lv_image_cache_init'] = makeInvalidEarlyAccess('_lv_image_cache_init');
var _lv_image_header_cache_init = Module['_lv_image_header_cache_init'] = makeInvalidEarlyAccess('_lv_image_header_cache_init');
var _lv_cache_destroy = Module['_lv_cache_destroy'] = makeInvalidEarlyAccess('_lv_cache_destroy');
var _lv_image_header_cache_is_enabled = Module['_lv_image_header_cache_is_enabled'] = makeInvalidEarlyAccess('_lv_image_header_cache_is_enabled');
var _lv_cache_acquire = Module['_lv_cache_acquire'] = makeInvalidEarlyAccess('_lv_cache_acquire');
var _lv_cache_entry_get_data = Module['_lv_cache_entry_get_data'] = makeInvalidEarlyAccess('_lv_cache_entry_get_data');
var _lv_cache_release = Module['_lv_cache_release'] = makeInvalidEarlyAccess('_lv_cache_release');
var _lv_fs_open = Module['_lv_fs_open'] = makeInvalidEarlyAccess('_lv_fs_open');
var _lv_fs_seek = Module['_lv_fs_seek'] = makeInvalidEarlyAccess('_lv_fs_seek');
var _lv_fs_close = Module['_lv_fs_close'] = makeInvalidEarlyAccess('_lv_fs_close');
var _lv_strdup = Module['_lv_strdup'] = makeInvalidEarlyAccess('_lv_strdup');
var _lv_cache_add = Module['_lv_cache_add'] = makeInvalidEarlyAccess('_lv_cache_add');
var _lv_image_cache_is_enabled = Module['_lv_image_cache_is_enabled'] = makeInvalidEarlyAccess('_lv_image_cache_is_enabled');
var _lv_image_decoder_create = Module['_lv_image_decoder_create'] = makeInvalidEarlyAccess('_lv_image_decoder_create');
var _lv_image_decoder_delete = Module['_lv_image_decoder_delete'] = makeInvalidEarlyAccess('_lv_image_decoder_delete');
var _lv_image_decoder_get_next = Module['_lv_image_decoder_get_next'] = makeInvalidEarlyAccess('_lv_image_decoder_get_next');
var _lv_image_decoder_set_info_cb = Module['_lv_image_decoder_set_info_cb'] = makeInvalidEarlyAccess('_lv_image_decoder_set_info_cb');
var _lv_image_decoder_set_open_cb = Module['_lv_image_decoder_set_open_cb'] = makeInvalidEarlyAccess('_lv_image_decoder_set_open_cb');
var _lv_image_decoder_set_get_area_cb = Module['_lv_image_decoder_set_get_area_cb'] = makeInvalidEarlyAccess('_lv_image_decoder_set_get_area_cb');
var _lv_image_decoder_set_close_cb = Module['_lv_image_decoder_set_close_cb'] = makeInvalidEarlyAccess('_lv_image_decoder_set_close_cb');
var _lv_image_decoder_add_to_cache = Module['_lv_image_decoder_add_to_cache'] = makeInvalidEarlyAccess('_lv_image_decoder_add_to_cache');
var _lv_image_decoder_post_process = Module['_lv_image_decoder_post_process'] = makeInvalidEarlyAccess('_lv_image_decoder_post_process');
var _lv_draw_sw_blend = Module['_lv_draw_sw_blend'] = makeInvalidEarlyAccess('_lv_draw_sw_blend');
var _lv_draw_sw_blend_color_to_al88 = Module['_lv_draw_sw_blend_color_to_al88'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_color_to_al88');
var _lv_draw_sw_blend_image_to_al88 = Module['_lv_draw_sw_blend_image_to_al88'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_image_to_al88');
var _lv_draw_sw_blend_color_to_argb8888 = Module['_lv_draw_sw_blend_color_to_argb8888'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_color_to_argb8888');
var _lv_draw_sw_blend_image_to_argb8888 = Module['_lv_draw_sw_blend_image_to_argb8888'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_image_to_argb8888');
var _lv_draw_sw_blend_color_to_argb8888_premultiplied = Module['_lv_draw_sw_blend_color_to_argb8888_premultiplied'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_color_to_argb8888_premultiplied');
var _lv_draw_sw_blend_image_to_argb8888_premultiplied = Module['_lv_draw_sw_blend_image_to_argb8888_premultiplied'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_image_to_argb8888_premultiplied');
var _lv_draw_sw_blend_color_to_i1 = Module['_lv_draw_sw_blend_color_to_i1'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_color_to_i1');
var _lv_draw_sw_blend_image_to_i1 = Module['_lv_draw_sw_blend_image_to_i1'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_image_to_i1');
var _lv_draw_sw_blend_color_to_l8 = Module['_lv_draw_sw_blend_color_to_l8'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_color_to_l8');
var _lv_draw_sw_blend_image_to_l8 = Module['_lv_draw_sw_blend_image_to_l8'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_image_to_l8');
var _lv_draw_sw_blend_color_to_rgb565 = Module['_lv_draw_sw_blend_color_to_rgb565'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_color_to_rgb565');
var _lv_draw_sw_blend_image_to_rgb565 = Module['_lv_draw_sw_blend_image_to_rgb565'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_image_to_rgb565');
var _lv_draw_sw_blend_color_to_rgb565_swapped = Module['_lv_draw_sw_blend_color_to_rgb565_swapped'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_color_to_rgb565_swapped');
var _lv_draw_sw_blend_image_to_rgb565_swapped = Module['_lv_draw_sw_blend_image_to_rgb565_swapped'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_image_to_rgb565_swapped');
var _lv_draw_sw_blend_color_to_rgb888 = Module['_lv_draw_sw_blend_color_to_rgb888'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_color_to_rgb888');
var _lv_draw_sw_blend_image_to_rgb888 = Module['_lv_draw_sw_blend_image_to_rgb888'] = makeInvalidEarlyAccess('_lv_draw_sw_blend_image_to_rgb888');
var _lv_draw_sw_init = Module['_lv_draw_sw_init'] = makeInvalidEarlyAccess('_lv_draw_sw_init');
var _lv_draw_sw_deinit = Module['_lv_draw_sw_deinit'] = makeInvalidEarlyAccess('_lv_draw_sw_deinit');
var _lv_draw_sw_register_blend_handler = Module['_lv_draw_sw_register_blend_handler'] = makeInvalidEarlyAccess('_lv_draw_sw_register_blend_handler');
var _lv_draw_sw_unregister_blend_handler = Module['_lv_draw_sw_unregister_blend_handler'] = makeInvalidEarlyAccess('_lv_draw_sw_unregister_blend_handler');
var _lv_draw_sw_get_blend_handler = Module['_lv_draw_sw_get_blend_handler'] = makeInvalidEarlyAccess('_lv_draw_sw_get_blend_handler');
var _lv_draw_sw_arc = Module['_lv_draw_sw_arc'] = makeInvalidEarlyAccess('_lv_draw_sw_arc');
var _lv_draw_sw_border = Module['_lv_draw_sw_border'] = makeInvalidEarlyAccess('_lv_draw_sw_border');
var _lv_draw_sw_box_shadow = Module['_lv_draw_sw_box_shadow'] = makeInvalidEarlyAccess('_lv_draw_sw_box_shadow');
var _lv_draw_sw_fill = Module['_lv_draw_sw_fill'] = makeInvalidEarlyAccess('_lv_draw_sw_fill');
var _lv_draw_sw_grad_get = Module['_lv_draw_sw_grad_get'] = makeInvalidEarlyAccess('_lv_draw_sw_grad_get');
var _lv_draw_sw_grad_color_calculate = Module['_lv_draw_sw_grad_color_calculate'] = makeInvalidEarlyAccess('_lv_draw_sw_grad_color_calculate');
var _lv_draw_sw_grad_cleanup = Module['_lv_draw_sw_grad_cleanup'] = makeInvalidEarlyAccess('_lv_draw_sw_grad_cleanup');
var _lv_draw_sw_layer = Module['_lv_draw_sw_layer'] = makeInvalidEarlyAccess('_lv_draw_sw_layer');
var _lv_draw_sw_image = Module['_lv_draw_sw_image'] = makeInvalidEarlyAccess('_lv_draw_sw_image');
var _lv_draw_sw_letter = Module['_lv_draw_sw_letter'] = makeInvalidEarlyAccess('_lv_draw_sw_letter');
var _lv_draw_sw_label = Module['_lv_draw_sw_label'] = makeInvalidEarlyAccess('_lv_draw_sw_label');
var _lv_draw_sw_line = Module['_lv_draw_sw_line'] = makeInvalidEarlyAccess('_lv_draw_sw_line');
var _lv_draw_sw_mask_init = Module['_lv_draw_sw_mask_init'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_init');
var _lv_draw_sw_mask_deinit = Module['_lv_draw_sw_mask_deinit'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_deinit');
var _lv_draw_sw_mask_apply = Module['_lv_draw_sw_mask_apply'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_apply');
var _lv_draw_sw_mask_free_param = Module['_lv_draw_sw_mask_free_param'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_free_param');
var _lv_draw_sw_mask_line_points_init = Module['_lv_draw_sw_mask_line_points_init'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_line_points_init');
var _lv_draw_sw_mask_line_angle_init = Module['_lv_draw_sw_mask_line_angle_init'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_line_angle_init');
var _lv_trigo_sin = Module['_lv_trigo_sin'] = makeInvalidEarlyAccess('_lv_trigo_sin');
var _lv_draw_sw_mask_angle_init = Module['_lv_draw_sw_mask_angle_init'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_angle_init');
var _lv_draw_sw_mask_radius_init = Module['_lv_draw_sw_mask_radius_init'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_radius_init');
var _lv_draw_sw_mask_fade_init = Module['_lv_draw_sw_mask_fade_init'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_fade_init');
var _lv_draw_sw_mask_map_init = Module['_lv_draw_sw_mask_map_init'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_map_init');
var _lv_draw_sw_mask_rect = Module['_lv_draw_sw_mask_rect'] = makeInvalidEarlyAccess('_lv_draw_sw_mask_rect');
var _lv_draw_sw_transform = Module['_lv_draw_sw_transform'] = makeInvalidEarlyAccess('_lv_draw_sw_transform');
var _lv_draw_sw_triangle = Module['_lv_draw_sw_triangle'] = makeInvalidEarlyAccess('_lv_draw_sw_triangle');
var _lv_draw_sw_i1_to_argb8888 = Module['_lv_draw_sw_i1_to_argb8888'] = makeInvalidEarlyAccess('_lv_draw_sw_i1_to_argb8888');
var _lv_draw_sw_rgb565_swap = Module['_lv_draw_sw_rgb565_swap'] = makeInvalidEarlyAccess('_lv_draw_sw_rgb565_swap');
var _lv_draw_sw_i1_invert = Module['_lv_draw_sw_i1_invert'] = makeInvalidEarlyAccess('_lv_draw_sw_i1_invert');
var _lv_draw_sw_i1_convert_to_vtiled = Module['_lv_draw_sw_i1_convert_to_vtiled'] = makeInvalidEarlyAccess('_lv_draw_sw_i1_convert_to_vtiled');
var _lv_draw_sw_rotate = Module['_lv_draw_sw_rotate'] = makeInvalidEarlyAccess('_lv_draw_sw_rotate');
var _lv_fs_read = Module['_lv_fs_read'] = makeInvalidEarlyAccess('_lv_fs_read');
var _lv_font_get_bitmap_fmt_txt = Module['_lv_font_get_bitmap_fmt_txt'] = makeInvalidEarlyAccess('_lv_font_get_bitmap_fmt_txt');
var _lv_font_get_glyph_dsc_fmt_txt = Module['_lv_font_get_glyph_dsc_fmt_txt'] = makeInvalidEarlyAccess('_lv_font_get_glyph_dsc_fmt_txt');
var _lv_memcmp = Module['_lv_memcmp'] = makeInvalidEarlyAccess('_lv_memcmp');
var _lv_font_get_glyph_static_bitmap = Module['_lv_font_get_glyph_static_bitmap'] = makeInvalidEarlyAccess('_lv_font_get_glyph_static_bitmap');
var _lv_font_get_glyph_width = Module['_lv_font_get_glyph_width'] = makeInvalidEarlyAccess('_lv_font_get_glyph_width');
var _lv_font_set_kerning = Module['_lv_font_set_kerning'] = makeInvalidEarlyAccess('_lv_font_set_kerning');
var _lv_font_get_default = Module['_lv_font_get_default'] = makeInvalidEarlyAccess('_lv_font_get_default');
var _lv_font_info_is_equal = Module['_lv_font_info_is_equal'] = makeInvalidEarlyAccess('_lv_font_info_is_equal');
var _lv_font_has_static_bitmap = Module['_lv_font_has_static_bitmap'] = makeInvalidEarlyAccess('_lv_font_has_static_bitmap');
var _lv_utils_bsearch = Module['_lv_utils_bsearch'] = makeInvalidEarlyAccess('_lv_utils_bsearch');
var _lv_indev_read_timer_cb = Module['_lv_indev_read_timer_cb'] = makeInvalidEarlyAccess('_lv_indev_read_timer_cb');
var _lv_indev_read = Module['_lv_indev_read'] = makeInvalidEarlyAccess('_lv_indev_read');
var _lv_indev_delete = Module['_lv_indev_delete'] = makeInvalidEarlyAccess('_lv_indev_delete');
var _lv_indev_send_event = Module['_lv_indev_send_event'] = makeInvalidEarlyAccess('_lv_indev_send_event');
var _lv_indev_find_scroll_obj = Module['_lv_indev_find_scroll_obj'] = makeInvalidEarlyAccess('_lv_indev_find_scroll_obj');
var _lv_indev_scroll_handler = Module['_lv_indev_scroll_handler'] = makeInvalidEarlyAccess('_lv_indev_scroll_handler');
var _lv_tick_diff = Module['_lv_tick_diff'] = makeInvalidEarlyAccess('_lv_tick_diff');
var _lv_indev_enable = Module['_lv_indev_enable'] = makeInvalidEarlyAccess('_lv_indev_enable');
var _lv_indev_set_user_data = Module['_lv_indev_set_user_data'] = makeInvalidEarlyAccess('_lv_indev_set_user_data');
var _lv_indev_set_driver_data = Module['_lv_indev_set_driver_data'] = makeInvalidEarlyAccess('_lv_indev_set_driver_data');
var _lv_indev_get_read_cb = Module['_lv_indev_get_read_cb'] = makeInvalidEarlyAccess('_lv_indev_get_read_cb');
var _lv_indev_set_long_press_time = Module['_lv_indev_set_long_press_time'] = makeInvalidEarlyAccess('_lv_indev_set_long_press_time');
var _lv_indev_set_long_press_repeat_time = Module['_lv_indev_set_long_press_repeat_time'] = makeInvalidEarlyAccess('_lv_indev_set_long_press_repeat_time');
var _lv_indev_set_scroll_limit = Module['_lv_indev_set_scroll_limit'] = makeInvalidEarlyAccess('_lv_indev_set_scroll_limit');
var _lv_indev_set_scroll_throw = Module['_lv_indev_set_scroll_throw'] = makeInvalidEarlyAccess('_lv_indev_set_scroll_throw');
var _lv_indev_get_user_data = Module['_lv_indev_get_user_data'] = makeInvalidEarlyAccess('_lv_indev_get_user_data');
var _lv_indev_get_driver_data = Module['_lv_indev_get_driver_data'] = makeInvalidEarlyAccess('_lv_indev_get_driver_data');
var _lv_indev_get_press_moved = Module['_lv_indev_get_press_moved'] = makeInvalidEarlyAccess('_lv_indev_get_press_moved');
var _lv_indev_stop_processing = Module['_lv_indev_stop_processing'] = makeInvalidEarlyAccess('_lv_indev_stop_processing');
var _lv_indev_reset_long_press = Module['_lv_indev_reset_long_press'] = makeInvalidEarlyAccess('_lv_indev_reset_long_press');
var _lv_indev_set_cursor = Module['_lv_indev_set_cursor'] = makeInvalidEarlyAccess('_lv_indev_set_cursor');
var _lv_indev_set_button_points = Module['_lv_indev_set_button_points'] = makeInvalidEarlyAccess('_lv_indev_set_button_points');
var _lv_indev_get_point = Module['_lv_indev_get_point'] = makeInvalidEarlyAccess('_lv_indev_get_point');
var _lv_indev_get_gesture_dir = Module['_lv_indev_get_gesture_dir'] = makeInvalidEarlyAccess('_lv_indev_get_gesture_dir');
var _lv_indev_get_key = Module['_lv_indev_get_key'] = makeInvalidEarlyAccess('_lv_indev_get_key');
var _lv_indev_get_short_click_streak = Module['_lv_indev_get_short_click_streak'] = makeInvalidEarlyAccess('_lv_indev_get_short_click_streak');
var _lv_indev_get_vect = Module['_lv_indev_get_vect'] = makeInvalidEarlyAccess('_lv_indev_get_vect');
var _lv_indev_get_cursor = Module['_lv_indev_get_cursor'] = makeInvalidEarlyAccess('_lv_indev_get_cursor');
var _lv_indev_get_read_timer = Module['_lv_indev_get_read_timer'] = makeInvalidEarlyAccess('_lv_indev_get_read_timer');
var _lv_indev_get_mode = Module['_lv_indev_get_mode'] = makeInvalidEarlyAccess('_lv_indev_get_mode');
var _lv_indev_set_mode = Module['_lv_indev_set_mode'] = makeInvalidEarlyAccess('_lv_indev_set_mode');
var _lv_timer_set_cb = Module['_lv_timer_set_cb'] = makeInvalidEarlyAccess('_lv_timer_set_cb');
var _lv_indev_search_obj = Module['_lv_indev_search_obj'] = makeInvalidEarlyAccess('_lv_indev_search_obj');
var _lv_indev_add_event_cb = Module['_lv_indev_add_event_cb'] = makeInvalidEarlyAccess('_lv_indev_add_event_cb');
var _lv_indev_get_event_count = Module['_lv_indev_get_event_count'] = makeInvalidEarlyAccess('_lv_indev_get_event_count');
var _lv_indev_get_event_dsc = Module['_lv_indev_get_event_dsc'] = makeInvalidEarlyAccess('_lv_indev_get_event_dsc');
var _lv_indev_remove_event = Module['_lv_indev_remove_event'] = makeInvalidEarlyAccess('_lv_indev_remove_event');
var _lv_indev_remove_event_cb_with_user_data = Module['_lv_indev_remove_event_cb_with_user_data'] = makeInvalidEarlyAccess('_lv_indev_remove_event_cb_with_user_data');
var _lv_indev_scroll_throw_handler = Module['_lv_indev_scroll_throw_handler'] = makeInvalidEarlyAccess('_lv_indev_scroll_throw_handler');
var _lv_timer_get_paused = Module['_lv_timer_get_paused'] = makeInvalidEarlyAccess('_lv_timer_get_paused');
var _lv_indev_scroll_throw_predict = Module['_lv_indev_scroll_throw_predict'] = makeInvalidEarlyAccess('_lv_indev_scroll_throw_predict');
var _lv_flex_init = Module['_lv_flex_init'] = makeInvalidEarlyAccess('_lv_flex_init');
var _lv_obj_set_flex_flow = Module['_lv_obj_set_flex_flow'] = makeInvalidEarlyAccess('_lv_obj_set_flex_flow');
var _lv_obj_set_flex_align = Module['_lv_obj_set_flex_align'] = makeInvalidEarlyAccess('_lv_obj_set_flex_align');
var _lv_obj_set_flex_grow = Module['_lv_obj_set_flex_grow'] = makeInvalidEarlyAccess('_lv_obj_set_flex_grow');
var _lv_grid_init = Module['_lv_grid_init'] = makeInvalidEarlyAccess('_lv_grid_init');
var _lv_obj_set_grid_dsc_array = Module['_lv_obj_set_grid_dsc_array'] = makeInvalidEarlyAccess('_lv_obj_set_grid_dsc_array');
var _lv_obj_set_grid_align = Module['_lv_obj_set_grid_align'] = makeInvalidEarlyAccess('_lv_obj_set_grid_align');
var _lv_obj_set_grid_cell = Module['_lv_obj_set_grid_cell'] = makeInvalidEarlyAccess('_lv_obj_set_grid_cell');
var _lv_grid_fr = Module['_lv_grid_fr'] = makeInvalidEarlyAccess('_lv_grid_fr');
var _lv_layout_init = Module['_lv_layout_init'] = makeInvalidEarlyAccess('_lv_layout_init');
var _lv_layout_deinit = Module['_lv_layout_deinit'] = makeInvalidEarlyAccess('_lv_layout_deinit');
var _lv_layout_register = Module['_lv_layout_register'] = makeInvalidEarlyAccess('_lv_layout_register');
var _lv_bin_decoder_init = Module['_lv_bin_decoder_init'] = makeInvalidEarlyAccess('_lv_bin_decoder_init');
var _lv_bin_decoder_info = Module['_lv_bin_decoder_info'] = makeInvalidEarlyAccess('_lv_bin_decoder_info');
var _lv_bin_decoder_open = Module['_lv_bin_decoder_open'] = makeInvalidEarlyAccess('_lv_bin_decoder_open');
var _lv_bin_decoder_get_area = Module['_lv_bin_decoder_get_area'] = makeInvalidEarlyAccess('_lv_bin_decoder_get_area');
var _lv_bin_decoder_close = Module['_lv_bin_decoder_close'] = makeInvalidEarlyAccess('_lv_bin_decoder_close');
var _free = Module['_free'] = makeInvalidEarlyAccess('_free');
var _strncmp = Module['_strncmp'] = makeInvalidEarlyAccess('_strncmp');
var _lv_cache_create = Module['_lv_cache_create'] = makeInvalidEarlyAccess('_lv_cache_create');
var _lv_cache_set_name = Module['_lv_cache_set_name'] = makeInvalidEarlyAccess('_lv_cache_set_name');
var _lv_strlen = Module['_lv_strlen'] = makeInvalidEarlyAccess('_lv_strlen');
var _lv_cache_acquire_or_create = Module['_lv_cache_acquire_or_create'] = makeInvalidEarlyAccess('_lv_cache_acquire_or_create');
var _lv_cache_entry_get_ref = Module['_lv_cache_entry_get_ref'] = makeInvalidEarlyAccess('_lv_cache_entry_get_ref');
var _lv_cache_drop = Module['_lv_cache_drop'] = makeInvalidEarlyAccess('_lv_cache_drop');
var _lv_fs_stdio_init = Module['_lv_fs_stdio_init'] = makeInvalidEarlyAccess('_lv_fs_stdio_init');
var _lv_canvas_get_draw_buf = Module['_lv_canvas_get_draw_buf'] = makeInvalidEarlyAccess('_lv_canvas_get_draw_buf');
var _lv_image_cache_drop = Module['_lv_image_cache_drop'] = makeInvalidEarlyAccess('_lv_image_cache_drop');
var _lv_canvas_set_draw_buf = Module['_lv_canvas_set_draw_buf'] = makeInvalidEarlyAccess('_lv_canvas_set_draw_buf');
var _lv_canvas_set_palette = Module['_lv_canvas_set_palette'] = makeInvalidEarlyAccess('_lv_canvas_set_palette');
var _lv_canvas_set_px = Module['_lv_canvas_set_px'] = makeInvalidEarlyAccess('_lv_canvas_set_px');
var _lv_qrcode_set_data = Module['_lv_qrcode_set_data'] = makeInvalidEarlyAccess('_lv_qrcode_set_data');
var _lv_qrcode_set_quiet_zone = Module['_lv_qrcode_set_quiet_zone'] = makeInvalidEarlyAccess('_lv_qrcode_set_quiet_zone');
var _lv_is_initialized = Module['_lv_is_initialized'] = makeInvalidEarlyAccess('_lv_is_initialized');
var _lv_rand_set_seed = Module['_lv_rand_set_seed'] = makeInvalidEarlyAccess('_lv_rand_set_seed');
var _lv_mem_init = Module['_lv_mem_init'] = makeInvalidEarlyAccess('_lv_mem_init');
var _lv_span_stack_init = Module['_lv_span_stack_init'] = makeInvalidEarlyAccess('_lv_span_stack_init');
var _lv_os_init = Module['_lv_os_init'] = makeInvalidEarlyAccess('_lv_os_init');
var _lv_timer_core_init = Module['_lv_timer_core_init'] = makeInvalidEarlyAccess('_lv_timer_core_init');
var _lv_fs_init = Module['_lv_fs_init'] = makeInvalidEarlyAccess('_lv_fs_init');
var _lv_anim_core_init = Module['_lv_anim_core_init'] = makeInvalidEarlyAccess('_lv_anim_core_init');
var _lv_color_to_u16 = Module['_lv_color_to_u16'] = makeInvalidEarlyAccess('_lv_color_to_u16');
var _lv_color_16_16_mix = Module['_lv_color_16_16_mix'] = makeInvalidEarlyAccess('_lv_color_16_16_mix');
var _lv_color_mix32 = Module['_lv_color_mix32'] = makeInvalidEarlyAccess('_lv_color_mix32');
var _lv_color32_eq = Module['_lv_color32_eq'] = makeInvalidEarlyAccess('_lv_color32_eq');
var _lv_color_mix32_premultiplied = Module['_lv_color_mix32_premultiplied'] = makeInvalidEarlyAccess('_lv_color_mix32_premultiplied');
var _lv_color_luminance = Module['_lv_color_luminance'] = makeInvalidEarlyAccess('_lv_color_luminance');
var _lv_color32_luminance = Module['_lv_color32_luminance'] = makeInvalidEarlyAccess('_lv_color32_luminance');
var _lv_color16_luminance = Module['_lv_color16_luminance'] = makeInvalidEarlyAccess('_lv_color16_luminance');
var _lv_color24_luminance = Module['_lv_color24_luminance'] = makeInvalidEarlyAccess('_lv_color24_luminance');
var _lv_trigo_cos = Module['_lv_trigo_cos'] = makeInvalidEarlyAccess('_lv_trigo_cos');
var _lv_point_from_precise = Module['_lv_point_from_precise'] = makeInvalidEarlyAccess('_lv_point_from_precise');
var _lv_point_swap = Module['_lv_point_swap'] = makeInvalidEarlyAccess('_lv_point_swap');
var _lv_fs_get_ext = Module['_lv_fs_get_ext'] = makeInvalidEarlyAccess('_lv_fs_get_ext');
var _lv_snprintf = Module['_lv_snprintf'] = makeInvalidEarlyAccess('_lv_snprintf');
var _lv_strlcpy = Module['_lv_strlcpy'] = makeInvalidEarlyAccess('_lv_strlcpy');
var _lv_ll_clear_custom = Module['_lv_ll_clear_custom'] = makeInvalidEarlyAccess('_lv_ll_clear_custom');
var _lv_span_stack_deinit = Module['_lv_span_stack_deinit'] = makeInvalidEarlyAccess('_lv_span_stack_deinit');
var _lv_theme_default_deinit = Module['_lv_theme_default_deinit'] = makeInvalidEarlyAccess('_lv_theme_default_deinit');
var _lv_theme_simple_deinit = Module['_lv_theme_simple_deinit'] = makeInvalidEarlyAccess('_lv_theme_simple_deinit');
var _lv_theme_mono_deinit = Module['_lv_theme_mono_deinit'] = makeInvalidEarlyAccess('_lv_theme_mono_deinit');
var _lv_anim_core_deinit = Module['_lv_anim_core_deinit'] = makeInvalidEarlyAccess('_lv_anim_core_deinit');
var _lv_timer_core_deinit = Module['_lv_timer_core_deinit'] = makeInvalidEarlyAccess('_lv_timer_core_deinit');
var _lv_fs_deinit = Module['_lv_fs_deinit'] = makeInvalidEarlyAccess('_lv_fs_deinit');
var _lv_mem_deinit = Module['_lv_mem_deinit'] = makeInvalidEarlyAccess('_lv_mem_deinit');
var _lv_log_register_print_cb = Module['_lv_log_register_print_cb'] = makeInvalidEarlyAccess('_lv_log_register_print_cb');
var _lv_cache_entry_get_size = Module['_lv_cache_entry_get_size'] = makeInvalidEarlyAccess('_lv_cache_entry_get_size');
var _lv_rb_init = Module['_lv_rb_init'] = makeInvalidEarlyAccess('_lv_rb_init');
var _lv_cache_entry_get_entry = Module['_lv_cache_entry_get_entry'] = makeInvalidEarlyAccess('_lv_cache_entry_get_entry');
var _lv_rb_find = Module['_lv_rb_find'] = makeInvalidEarlyAccess('_lv_rb_find');
var _lv_ll_move_before = Module['_lv_ll_move_before'] = makeInvalidEarlyAccess('_lv_ll_move_before');
var _lv_rb_insert = Module['_lv_rb_insert'] = makeInvalidEarlyAccess('_lv_rb_insert');
var _lv_rb_drop_node = Module['_lv_rb_drop_node'] = makeInvalidEarlyAccess('_lv_rb_drop_node');
var _lv_cache_entry_init = Module['_lv_cache_entry_init'] = makeInvalidEarlyAccess('_lv_cache_entry_init');
var _lv_rb_remove_node = Module['_lv_rb_remove_node'] = makeInvalidEarlyAccess('_lv_rb_remove_node');
var _lv_cache_entry_delete = Module['_lv_cache_entry_delete'] = makeInvalidEarlyAccess('_lv_cache_entry_delete');
var _lv_rb_destroy = Module['_lv_rb_destroy'] = makeInvalidEarlyAccess('_lv_rb_destroy');
var _lv_iter_create = Module['_lv_iter_create'] = makeInvalidEarlyAccess('_lv_iter_create');
var _lv_image_cache_resize = Module['_lv_image_cache_resize'] = makeInvalidEarlyAccess('_lv_image_cache_resize');
var _lv_cache_set_max_size = Module['_lv_cache_set_max_size'] = makeInvalidEarlyAccess('_lv_cache_set_max_size');
var _lv_cache_reserve = Module['_lv_cache_reserve'] = makeInvalidEarlyAccess('_lv_cache_reserve');
var _lv_image_header_cache_drop = Module['_lv_image_header_cache_drop'] = makeInvalidEarlyAccess('_lv_image_header_cache_drop');
var _lv_cache_drop_all = Module['_lv_cache_drop_all'] = makeInvalidEarlyAccess('_lv_cache_drop_all');
var _lv_cache_is_enabled = Module['_lv_cache_is_enabled'] = makeInvalidEarlyAccess('_lv_cache_is_enabled');
var _lv_image_cache_iter_create = Module['_lv_image_cache_iter_create'] = makeInvalidEarlyAccess('_lv_image_cache_iter_create');
var _lv_cache_iter_create = Module['_lv_cache_iter_create'] = makeInvalidEarlyAccess('_lv_cache_iter_create');
var _lv_image_cache_dump = Module['_lv_image_cache_dump'] = makeInvalidEarlyAccess('_lv_image_cache_dump');
var _lv_iter_inspect = Module['_lv_iter_inspect'] = makeInvalidEarlyAccess('_lv_iter_inspect');
var _lv_image_header_cache_resize = Module['_lv_image_header_cache_resize'] = makeInvalidEarlyAccess('_lv_image_header_cache_resize');
var _lv_image_header_cache_iter_create = Module['_lv_image_header_cache_iter_create'] = makeInvalidEarlyAccess('_lv_image_header_cache_iter_create');
var _lv_image_header_cache_dump = Module['_lv_image_header_cache_dump'] = makeInvalidEarlyAccess('_lv_image_header_cache_dump');
var _lv_cache_entry_acquire_data = Module['_lv_cache_entry_acquire_data'] = makeInvalidEarlyAccess('_lv_cache_entry_acquire_data');
var _lv_cache_entry_release_data = Module['_lv_cache_entry_release_data'] = makeInvalidEarlyAccess('_lv_cache_entry_release_data');
var _lv_cache_entry_is_invalid = Module['_lv_cache_entry_is_invalid'] = makeInvalidEarlyAccess('_lv_cache_entry_is_invalid');
var _lv_cache_entry_set_flag = Module['_lv_cache_entry_set_flag'] = makeInvalidEarlyAccess('_lv_cache_entry_set_flag');
var _lv_cache_evict_one = Module['_lv_cache_evict_one'] = makeInvalidEarlyAccess('_lv_cache_evict_one');
var _lv_cache_get_max_size = Module['_lv_cache_get_max_size'] = makeInvalidEarlyAccess('_lv_cache_get_max_size');
var _lv_cache_get_size = Module['_lv_cache_get_size'] = makeInvalidEarlyAccess('_lv_cache_get_size');
var _lv_cache_get_free_size = Module['_lv_cache_get_free_size'] = makeInvalidEarlyAccess('_lv_cache_get_free_size');
var _lv_cache_set_compare_cb = Module['_lv_cache_set_compare_cb'] = makeInvalidEarlyAccess('_lv_cache_set_compare_cb');
var _lv_cache_set_create_cb = Module['_lv_cache_set_create_cb'] = makeInvalidEarlyAccess('_lv_cache_set_create_cb');
var _lv_cache_set_free_cb = Module['_lv_cache_set_free_cb'] = makeInvalidEarlyAccess('_lv_cache_set_free_cb');
var _lv_cache_get_name = Module['_lv_cache_get_name'] = makeInvalidEarlyAccess('_lv_cache_get_name');
var _lv_cache_entry_reset_ref = Module['_lv_cache_entry_reset_ref'] = makeInvalidEarlyAccess('_lv_cache_entry_reset_ref');
var _lv_cache_entry_inc_ref = Module['_lv_cache_entry_inc_ref'] = makeInvalidEarlyAccess('_lv_cache_entry_inc_ref');
var _lv_cache_entry_dec_ref = Module['_lv_cache_entry_dec_ref'] = makeInvalidEarlyAccess('_lv_cache_entry_dec_ref');
var _lv_cache_entry_get_node_size = Module['_lv_cache_entry_get_node_size'] = makeInvalidEarlyAccess('_lv_cache_entry_get_node_size');
var _lv_cache_entry_set_node_size = Module['_lv_cache_entry_set_node_size'] = makeInvalidEarlyAccess('_lv_cache_entry_set_node_size');
var _lv_cache_entry_set_cache = Module['_lv_cache_entry_set_cache'] = makeInvalidEarlyAccess('_lv_cache_entry_set_cache');
var _lv_cache_entry_get_cache = Module['_lv_cache_entry_get_cache'] = makeInvalidEarlyAccess('_lv_cache_entry_get_cache');
var _lv_cache_entry_alloc = Module['_lv_cache_entry_alloc'] = makeInvalidEarlyAccess('_lv_cache_entry_alloc');
var _lv_cache_entry_remove_flag = Module['_lv_cache_entry_remove_flag'] = makeInvalidEarlyAccess('_lv_cache_entry_remove_flag');
var _lv_cache_entry_has_flag = Module['_lv_cache_entry_has_flag'] = makeInvalidEarlyAccess('_lv_cache_entry_has_flag');
var _lv_anim_delete_all = Module['_lv_anim_delete_all'] = makeInvalidEarlyAccess('_lv_anim_delete_all');
var _lv_anim_enable_vsync_mode = Module['_lv_anim_enable_vsync_mode'] = makeInvalidEarlyAccess('_lv_anim_enable_vsync_mode');
var _lv_anim_path_linear = Module['_lv_anim_path_linear'] = makeInvalidEarlyAccess('_lv_anim_path_linear');
var _lv_map = Module['_lv_map'] = makeInvalidEarlyAccess('_lv_map');
var _lv_anim_get_playtime = Module['_lv_anim_get_playtime'] = makeInvalidEarlyAccess('_lv_anim_get_playtime');
var _lv_anim_get_timer = Module['_lv_anim_get_timer'] = makeInvalidEarlyAccess('_lv_anim_get_timer');
var _lv_anim_count_running = Module['_lv_anim_count_running'] = makeInvalidEarlyAccess('_lv_anim_count_running');
var _lv_anim_speed = Module['_lv_anim_speed'] = makeInvalidEarlyAccess('_lv_anim_speed');
var _lv_anim_speed_to_time = Module['_lv_anim_speed_to_time'] = makeInvalidEarlyAccess('_lv_anim_speed_to_time');
var _lv_anim_path_ease_in = Module['_lv_anim_path_ease_in'] = makeInvalidEarlyAccess('_lv_anim_path_ease_in');
var _lv_cubic_bezier = Module['_lv_cubic_bezier'] = makeInvalidEarlyAccess('_lv_cubic_bezier');
var _lv_anim_path_ease_in_out = Module['_lv_anim_path_ease_in_out'] = makeInvalidEarlyAccess('_lv_anim_path_ease_in_out');
var _lv_anim_path_overshoot = Module['_lv_anim_path_overshoot'] = makeInvalidEarlyAccess('_lv_anim_path_overshoot');
var _lv_anim_path_bounce = Module['_lv_anim_path_bounce'] = makeInvalidEarlyAccess('_lv_anim_path_bounce');
var _lv_bezier3 = Module['_lv_bezier3'] = makeInvalidEarlyAccess('_lv_bezier3');
var _lv_anim_path_step = Module['_lv_anim_path_step'] = makeInvalidEarlyAccess('_lv_anim_path_step');
var _lv_anim_path_custom_bezier3 = Module['_lv_anim_path_custom_bezier3'] = makeInvalidEarlyAccess('_lv_anim_path_custom_bezier3');
var _lv_anim_set_custom_exec_cb = Module['_lv_anim_set_custom_exec_cb'] = makeInvalidEarlyAccess('_lv_anim_set_custom_exec_cb');
var _lv_anim_set_get_value_cb = Module['_lv_anim_set_get_value_cb'] = makeInvalidEarlyAccess('_lv_anim_set_get_value_cb');
var _lv_anim_set_reverse_duration = Module['_lv_anim_set_reverse_duration'] = makeInvalidEarlyAccess('_lv_anim_set_reverse_duration');
var _lv_anim_set_reverse_time = Module['_lv_anim_set_reverse_time'] = makeInvalidEarlyAccess('_lv_anim_set_reverse_time');
var _lv_anim_set_reverse_delay = Module['_lv_anim_set_reverse_delay'] = makeInvalidEarlyAccess('_lv_anim_set_reverse_delay');
var _lv_anim_set_bezier3_param = Module['_lv_anim_set_bezier3_param'] = makeInvalidEarlyAccess('_lv_anim_set_bezier3_param');
var _lv_anim_get_delay = Module['_lv_anim_get_delay'] = makeInvalidEarlyAccess('_lv_anim_get_delay');
var _lv_anim_get_time = Module['_lv_anim_get_time'] = makeInvalidEarlyAccess('_lv_anim_get_time');
var _lv_anim_get_repeat_count = Module['_lv_anim_get_repeat_count'] = makeInvalidEarlyAccess('_lv_anim_get_repeat_count');
var _lv_anim_get_user_data = Module['_lv_anim_get_user_data'] = makeInvalidEarlyAccess('_lv_anim_get_user_data');
var _lv_anim_custom_delete = Module['_lv_anim_custom_delete'] = makeInvalidEarlyAccess('_lv_anim_custom_delete');
var _lv_anim_custom_get = Module['_lv_anim_custom_get'] = makeInvalidEarlyAccess('_lv_anim_custom_get');
var _lv_anim_resolve_speed = Module['_lv_anim_resolve_speed'] = makeInvalidEarlyAccess('_lv_anim_resolve_speed');
var _lv_anim_is_paused = Module['_lv_anim_is_paused'] = makeInvalidEarlyAccess('_lv_anim_is_paused');
var _lv_anim_pause = Module['_lv_anim_pause'] = makeInvalidEarlyAccess('_lv_anim_pause');
var _lv_anim_pause_for = Module['_lv_anim_pause_for'] = makeInvalidEarlyAccess('_lv_anim_pause_for');
var _lv_anim_resume = Module['_lv_anim_resume'] = makeInvalidEarlyAccess('_lv_anim_resume');
var _lv_anim_timeline_create = Module['_lv_anim_timeline_create'] = makeInvalidEarlyAccess('_lv_anim_timeline_create');
var _lv_anim_timeline_delete = Module['_lv_anim_timeline_delete'] = makeInvalidEarlyAccess('_lv_anim_timeline_delete');
var _lv_anim_timeline_pause = Module['_lv_anim_timeline_pause'] = makeInvalidEarlyAccess('_lv_anim_timeline_pause');
var _lv_anim_timeline_add = Module['_lv_anim_timeline_add'] = makeInvalidEarlyAccess('_lv_anim_timeline_add');
var _lv_anim_timeline_get_playtime = Module['_lv_anim_timeline_get_playtime'] = makeInvalidEarlyAccess('_lv_anim_timeline_get_playtime');
var _lv_anim_timeline_set_repeat_count = Module['_lv_anim_timeline_set_repeat_count'] = makeInvalidEarlyAccess('_lv_anim_timeline_set_repeat_count');
var _lv_anim_timeline_set_repeat_delay = Module['_lv_anim_timeline_set_repeat_delay'] = makeInvalidEarlyAccess('_lv_anim_timeline_set_repeat_delay');
var _lv_anim_timeline_set_user_data = Module['_lv_anim_timeline_set_user_data'] = makeInvalidEarlyAccess('_lv_anim_timeline_set_user_data');
var _lv_anim_timeline_get_reverse = Module['_lv_anim_timeline_get_reverse'] = makeInvalidEarlyAccess('_lv_anim_timeline_get_reverse');
var _lv_anim_timeline_get_delay = Module['_lv_anim_timeline_get_delay'] = makeInvalidEarlyAccess('_lv_anim_timeline_get_delay');
var _lv_anim_timeline_get_repeat_count = Module['_lv_anim_timeline_get_repeat_count'] = makeInvalidEarlyAccess('_lv_anim_timeline_get_repeat_count');
var _lv_anim_timeline_get_repeat_delay = Module['_lv_anim_timeline_get_repeat_delay'] = makeInvalidEarlyAccess('_lv_anim_timeline_get_repeat_delay');
var _lv_anim_timeline_get_user_data = Module['_lv_anim_timeline_get_user_data'] = makeInvalidEarlyAccess('_lv_anim_timeline_get_user_data');
var _lv_anim_timeline_merge = Module['_lv_anim_timeline_merge'] = makeInvalidEarlyAccess('_lv_anim_timeline_merge');
var _lv_area_set_pos = Module['_lv_area_set_pos'] = makeInvalidEarlyAccess('_lv_area_set_pos');
var _lv_area_is_equal = Module['_lv_area_is_equal'] = makeInvalidEarlyAccess('_lv_area_is_equal');
var _lv_point_to_precise = Module['_lv_point_to_precise'] = makeInvalidEarlyAccess('_lv_point_to_precise');
var _lv_point_precise_set = Module['_lv_point_precise_set'] = makeInvalidEarlyAccess('_lv_point_precise_set');
var _lv_point_precise_swap = Module['_lv_point_precise_swap'] = makeInvalidEarlyAccess('_lv_point_precise_swap');
var _lv_pct = Module['_lv_pct'] = makeInvalidEarlyAccess('_lv_pct');
var _lv_pct_to_px = Module['_lv_pct_to_px'] = makeInvalidEarlyAccess('_lv_pct_to_px');
var _lv_array_init = Module['_lv_array_init'] = makeInvalidEarlyAccess('_lv_array_init');
var _lv_array_init_from_buf = Module['_lv_array_init_from_buf'] = makeInvalidEarlyAccess('_lv_array_init_from_buf');
var _lv_array_deinit = Module['_lv_array_deinit'] = makeInvalidEarlyAccess('_lv_array_deinit');
var _lv_array_copy = Module['_lv_array_copy'] = makeInvalidEarlyAccess('_lv_array_copy');
var _lv_array_shrink = Module['_lv_array_shrink'] = makeInvalidEarlyAccess('_lv_array_shrink');
var _lv_array_resize = Module['_lv_array_resize'] = makeInvalidEarlyAccess('_lv_array_resize');
var _lv_array_remove = Module['_lv_array_remove'] = makeInvalidEarlyAccess('_lv_array_remove');
var _lv_array_at = Module['_lv_array_at'] = makeInvalidEarlyAccess('_lv_array_at');
var _lv_array_erase = Module['_lv_array_erase'] = makeInvalidEarlyAccess('_lv_array_erase');
var _lv_array_concat = Module['_lv_array_concat'] = makeInvalidEarlyAccess('_lv_array_concat');
var _lv_array_push_back = Module['_lv_array_push_back'] = makeInvalidEarlyAccess('_lv_array_push_back');
var _lv_array_assign = Module['_lv_array_assign'] = makeInvalidEarlyAccess('_lv_array_assign');
var _lv_timer_set_repeat_count = Module['_lv_timer_set_repeat_count'] = makeInvalidEarlyAccess('_lv_timer_set_repeat_count');
var _lv_timer_get_next = Module['_lv_timer_get_next'] = makeInvalidEarlyAccess('_lv_timer_get_next');
var _lv_bidi_process = Module['_lv_bidi_process'] = makeInvalidEarlyAccess('_lv_bidi_process');
var _lv_bidi_detect_base_dir = Module['_lv_bidi_detect_base_dir'] = makeInvalidEarlyAccess('_lv_bidi_detect_base_dir');
var _lv_bidi_get_visual_pos = Module['_lv_bidi_get_visual_pos'] = makeInvalidEarlyAccess('_lv_bidi_get_visual_pos');
var _lv_bidi_set_custom_neutrals_static = Module['_lv_bidi_set_custom_neutrals_static'] = makeInvalidEarlyAccess('_lv_bidi_set_custom_neutrals_static');
var _lv_circle_buf_create = Module['_lv_circle_buf_create'] = makeInvalidEarlyAccess('_lv_circle_buf_create');
var _lv_circle_buf_create_from_buf = Module['_lv_circle_buf_create_from_buf'] = makeInvalidEarlyAccess('_lv_circle_buf_create_from_buf');
var _lv_circle_buf_create_from_array = Module['_lv_circle_buf_create_from_array'] = makeInvalidEarlyAccess('_lv_circle_buf_create_from_array');
var _lv_circle_buf_resize = Module['_lv_circle_buf_resize'] = makeInvalidEarlyAccess('_lv_circle_buf_resize');
var _lv_circle_buf_destroy = Module['_lv_circle_buf_destroy'] = makeInvalidEarlyAccess('_lv_circle_buf_destroy');
var _lv_circle_buf_size = Module['_lv_circle_buf_size'] = makeInvalidEarlyAccess('_lv_circle_buf_size');
var _lv_circle_buf_capacity = Module['_lv_circle_buf_capacity'] = makeInvalidEarlyAccess('_lv_circle_buf_capacity');
var _lv_circle_buf_remain = Module['_lv_circle_buf_remain'] = makeInvalidEarlyAccess('_lv_circle_buf_remain');
var _lv_circle_buf_is_empty = Module['_lv_circle_buf_is_empty'] = makeInvalidEarlyAccess('_lv_circle_buf_is_empty');
var _lv_circle_buf_is_full = Module['_lv_circle_buf_is_full'] = makeInvalidEarlyAccess('_lv_circle_buf_is_full');
var _lv_circle_buf_reset = Module['_lv_circle_buf_reset'] = makeInvalidEarlyAccess('_lv_circle_buf_reset');
var _lv_circle_buf_head = Module['_lv_circle_buf_head'] = makeInvalidEarlyAccess('_lv_circle_buf_head');
var _lv_circle_buf_tail = Module['_lv_circle_buf_tail'] = makeInvalidEarlyAccess('_lv_circle_buf_tail');
var _lv_circle_buf_read = Module['_lv_circle_buf_read'] = makeInvalidEarlyAccess('_lv_circle_buf_read');
var _lv_circle_buf_peek_at = Module['_lv_circle_buf_peek_at'] = makeInvalidEarlyAccess('_lv_circle_buf_peek_at');
var _lv_circle_buf_write = Module['_lv_circle_buf_write'] = makeInvalidEarlyAccess('_lv_circle_buf_write');
var _lv_circle_buf_fill = Module['_lv_circle_buf_fill'] = makeInvalidEarlyAccess('_lv_circle_buf_fill');
var _lv_circle_buf_skip = Module['_lv_circle_buf_skip'] = makeInvalidEarlyAccess('_lv_circle_buf_skip');
var _lv_circle_buf_peek = Module['_lv_circle_buf_peek'] = makeInvalidEarlyAccess('_lv_circle_buf_peek');
var _lv_color_lighten = Module['_lv_color_lighten'] = makeInvalidEarlyAccess('_lv_color_lighten');
var _lv_color_darken = Module['_lv_color_darken'] = makeInvalidEarlyAccess('_lv_color_darken');
var _lv_color_hsv_to_rgb = Module['_lv_color_hsv_to_rgb'] = makeInvalidEarlyAccess('_lv_color_hsv_to_rgb');
var _lv_color_rgb_to_hsv = Module['_lv_color_rgb_to_hsv'] = makeInvalidEarlyAccess('_lv_color_rgb_to_hsv');
var _lv_color_to_hsv = Module['_lv_color_to_hsv'] = makeInvalidEarlyAccess('_lv_color_to_hsv');
var _lv_color_to_int = Module['_lv_color_to_int'] = makeInvalidEarlyAccess('_lv_color_to_int');
var _lv_color_hex3 = Module['_lv_color_hex3'] = makeInvalidEarlyAccess('_lv_color_hex3');
var _lv_color_brightness = Module['_lv_color_brightness'] = makeInvalidEarlyAccess('_lv_color_brightness');
var _lv_color_filter_dsc_init = Module['_lv_color_filter_dsc_init'] = makeInvalidEarlyAccess('_lv_color_filter_dsc_init');
var _lv_event_dsc_get_cb = Module['_lv_event_dsc_get_cb'] = makeInvalidEarlyAccess('_lv_event_dsc_get_cb');
var _lv_event_dsc_get_user_data = Module['_lv_event_dsc_get_user_data'] = makeInvalidEarlyAccess('_lv_event_dsc_get_user_data');
var _lv_event_stop_bubbling = Module['_lv_event_stop_bubbling'] = makeInvalidEarlyAccess('_lv_event_stop_bubbling');
var _lv_event_stop_trickling = Module['_lv_event_stop_trickling'] = makeInvalidEarlyAccess('_lv_event_stop_trickling');
var _lv_event_stop_processing = Module['_lv_event_stop_processing'] = makeInvalidEarlyAccess('_lv_event_stop_processing');
var _lv_event_register_id = Module['_lv_event_register_id'] = makeInvalidEarlyAccess('_lv_event_register_id');
var _lv_event_code_get_name = Module['_lv_event_code_get_name'] = makeInvalidEarlyAccess('_lv_event_code_get_name');
var _lv_fs_is_ready = Module['_lv_fs_is_ready'] = makeInvalidEarlyAccess('_lv_fs_is_ready');
var _lv_fs_get_drv = Module['_lv_fs_get_drv'] = makeInvalidEarlyAccess('_lv_fs_get_drv');
var _lv_fs_get_buffer_from_path = Module['_lv_fs_get_buffer_from_path'] = makeInvalidEarlyAccess('_lv_fs_get_buffer_from_path');
var _lv_fs_make_path_from_buffer = Module['_lv_fs_make_path_from_buffer'] = makeInvalidEarlyAccess('_lv_fs_make_path_from_buffer');
var _lv_fs_write = Module['_lv_fs_write'] = makeInvalidEarlyAccess('_lv_fs_write');
var _lv_fs_tell = Module['_lv_fs_tell'] = makeInvalidEarlyAccess('_lv_fs_tell');
var _lv_fs_get_size = Module['_lv_fs_get_size'] = makeInvalidEarlyAccess('_lv_fs_get_size');
var _lv_fs_path_get_size = Module['_lv_fs_path_get_size'] = makeInvalidEarlyAccess('_lv_fs_path_get_size');
var _lv_fs_load_to_buf = Module['_lv_fs_load_to_buf'] = makeInvalidEarlyAccess('_lv_fs_load_to_buf');
var _lv_fs_dir_open = Module['_lv_fs_dir_open'] = makeInvalidEarlyAccess('_lv_fs_dir_open');
var _lv_fs_dir_read = Module['_lv_fs_dir_read'] = makeInvalidEarlyAccess('_lv_fs_dir_read');
var _lv_fs_dir_close = Module['_lv_fs_dir_close'] = makeInvalidEarlyAccess('_lv_fs_dir_close');
var _lv_fs_get_letters = Module['_lv_fs_get_letters'] = makeInvalidEarlyAccess('_lv_fs_get_letters');
var _lv_fs_up = Module['_lv_fs_up'] = makeInvalidEarlyAccess('_lv_fs_up');
var _lv_fs_get_last = Module['_lv_fs_get_last'] = makeInvalidEarlyAccess('_lv_fs_get_last');
var _lv_fs_path_join = Module['_lv_fs_path_join'] = makeInvalidEarlyAccess('_lv_fs_path_join');
var _lv_grad_init_stops = Module['_lv_grad_init_stops'] = makeInvalidEarlyAccess('_lv_grad_init_stops');
var _lv_grad_horizontal_init = Module['_lv_grad_horizontal_init'] = makeInvalidEarlyAccess('_lv_grad_horizontal_init');
var _lv_grad_vertical_init = Module['_lv_grad_vertical_init'] = makeInvalidEarlyAccess('_lv_grad_vertical_init');
var _lv_grad_linear_init = Module['_lv_grad_linear_init'] = makeInvalidEarlyAccess('_lv_grad_linear_init');
var _lv_grad_radial_init = Module['_lv_grad_radial_init'] = makeInvalidEarlyAccess('_lv_grad_radial_init');
var _lv_grad_conical_init = Module['_lv_grad_conical_init'] = makeInvalidEarlyAccess('_lv_grad_conical_init');
var _lv_grad_radial_set_focal = Module['_lv_grad_radial_set_focal'] = makeInvalidEarlyAccess('_lv_grad_radial_set_focal');
var _lv_iter_get_context = Module['_lv_iter_get_context'] = makeInvalidEarlyAccess('_lv_iter_get_context');
var _lv_iter_destroy = Module['_lv_iter_destroy'] = makeInvalidEarlyAccess('_lv_iter_destroy');
var _lv_iter_make_peekable = Module['_lv_iter_make_peekable'] = makeInvalidEarlyAccess('_lv_iter_make_peekable');
var _lv_iter_next = Module['_lv_iter_next'] = makeInvalidEarlyAccess('_lv_iter_next');
var _lv_iter_peek = Module['_lv_iter_peek'] = makeInvalidEarlyAccess('_lv_iter_peek');
var _lv_iter_peek_advance = Module['_lv_iter_peek_advance'] = makeInvalidEarlyAccess('_lv_iter_peek_advance');
var _lv_iter_peek_reset = Module['_lv_iter_peek_reset'] = makeInvalidEarlyAccess('_lv_iter_peek_reset');
var _lv_ll_chg_list = Module['_lv_ll_chg_list'] = makeInvalidEarlyAccess('_lv_ll_chg_list');
var _lv_vsnprintf = Module['_lv_vsnprintf'] = makeInvalidEarlyAccess('_lv_vsnprintf');
var _fflush = makeInvalidEarlyAccess('_fflush');
var _lv_log = Module['_lv_log'] = makeInvalidEarlyAccess('_lv_log');
var _lv_lru_create = Module['_lv_lru_create'] = makeInvalidEarlyAccess('_lv_lru_create');
var _lv_lru_delete = Module['_lv_lru_delete'] = makeInvalidEarlyAccess('_lv_lru_delete');
var _lv_lru_set = Module['_lv_lru_set'] = makeInvalidEarlyAccess('_lv_lru_set');
var _lv_lru_remove_lru_item = Module['_lv_lru_remove_lru_item'] = makeInvalidEarlyAccess('_lv_lru_remove_lru_item');
var _lv_lru_get = Module['_lv_lru_get'] = makeInvalidEarlyAccess('_lv_lru_get');
var _lv_lru_remove = Module['_lv_lru_remove'] = makeInvalidEarlyAccess('_lv_lru_remove');
var _lv_sqrt = Module['_lv_sqrt'] = makeInvalidEarlyAccess('_lv_sqrt');
var _lv_sqrt32 = Module['_lv_sqrt32'] = makeInvalidEarlyAccess('_lv_sqrt32');
var _lv_atan2 = Module['_lv_atan2'] = makeInvalidEarlyAccess('_lv_atan2');
var _lv_pow = Module['_lv_pow'] = makeInvalidEarlyAccess('_lv_pow');
var _lv_rand = Module['_lv_rand'] = makeInvalidEarlyAccess('_lv_rand');
var _lv_palette_lighten = Module['_lv_palette_lighten'] = makeInvalidEarlyAccess('_lv_palette_lighten');
var _lv_palette_darken = Module['_lv_palette_darken'] = makeInvalidEarlyAccess('_lv_palette_darken');
var _lv_rb_minimum_from = Module['_lv_rb_minimum_from'] = makeInvalidEarlyAccess('_lv_rb_minimum_from');
var _lv_rb_remove = Module['_lv_rb_remove'] = makeInvalidEarlyAccess('_lv_rb_remove');
var _lv_rb_drop = Module['_lv_rb_drop'] = makeInvalidEarlyAccess('_lv_rb_drop');
var _lv_rb_minimum = Module['_lv_rb_minimum'] = makeInvalidEarlyAccess('_lv_rb_minimum');
var _lv_rb_maximum = Module['_lv_rb_maximum'] = makeInvalidEarlyAccess('_lv_rb_maximum');
var _lv_rb_maximum_from = Module['_lv_rb_maximum_from'] = makeInvalidEarlyAccess('_lv_rb_maximum_from');
var _lv_style_copy = Module['_lv_style_copy'] = makeInvalidEarlyAccess('_lv_style_copy');
var _lv_style_merge = Module['_lv_style_merge'] = makeInvalidEarlyAccess('_lv_style_merge');
var _lv_style_register_prop = Module['_lv_style_register_prop'] = makeInvalidEarlyAccess('_lv_style_register_prop');
var _lv_style_get_num_custom_props = Module['_lv_style_get_num_custom_props'] = makeInvalidEarlyAccess('_lv_style_get_num_custom_props');
var _lv_style_transition_dsc_init = Module['_lv_style_transition_dsc_init'] = makeInvalidEarlyAccess('_lv_style_transition_dsc_init');
var _lv_style_set_width = Module['_lv_style_set_width'] = makeInvalidEarlyAccess('_lv_style_set_width');
var _lv_style_set_min_width = Module['_lv_style_set_min_width'] = makeInvalidEarlyAccess('_lv_style_set_min_width');
var _lv_style_set_max_width = Module['_lv_style_set_max_width'] = makeInvalidEarlyAccess('_lv_style_set_max_width');
var _lv_style_set_height = Module['_lv_style_set_height'] = makeInvalidEarlyAccess('_lv_style_set_height');
var _lv_style_set_min_height = Module['_lv_style_set_min_height'] = makeInvalidEarlyAccess('_lv_style_set_min_height');
var _lv_style_set_max_height = Module['_lv_style_set_max_height'] = makeInvalidEarlyAccess('_lv_style_set_max_height');
var _lv_style_set_length = Module['_lv_style_set_length'] = makeInvalidEarlyAccess('_lv_style_set_length');
var _lv_style_set_x = Module['_lv_style_set_x'] = makeInvalidEarlyAccess('_lv_style_set_x');
var _lv_style_set_y = Module['_lv_style_set_y'] = makeInvalidEarlyAccess('_lv_style_set_y');
var _lv_style_set_align = Module['_lv_style_set_align'] = makeInvalidEarlyAccess('_lv_style_set_align');
var _lv_style_set_transform_width = Module['_lv_style_set_transform_width'] = makeInvalidEarlyAccess('_lv_style_set_transform_width');
var _lv_style_set_transform_height = Module['_lv_style_set_transform_height'] = makeInvalidEarlyAccess('_lv_style_set_transform_height');
var _lv_style_set_translate_x = Module['_lv_style_set_translate_x'] = makeInvalidEarlyAccess('_lv_style_set_translate_x');
var _lv_style_set_translate_y = Module['_lv_style_set_translate_y'] = makeInvalidEarlyAccess('_lv_style_set_translate_y');
var _lv_style_set_translate_radial = Module['_lv_style_set_translate_radial'] = makeInvalidEarlyAccess('_lv_style_set_translate_radial');
var _lv_style_set_transform_scale_x = Module['_lv_style_set_transform_scale_x'] = makeInvalidEarlyAccess('_lv_style_set_transform_scale_x');
var _lv_style_set_transform_scale_y = Module['_lv_style_set_transform_scale_y'] = makeInvalidEarlyAccess('_lv_style_set_transform_scale_y');
var _lv_style_set_transform_rotation = Module['_lv_style_set_transform_rotation'] = makeInvalidEarlyAccess('_lv_style_set_transform_rotation');
var _lv_style_set_transform_pivot_x = Module['_lv_style_set_transform_pivot_x'] = makeInvalidEarlyAccess('_lv_style_set_transform_pivot_x');
var _lv_style_set_transform_pivot_y = Module['_lv_style_set_transform_pivot_y'] = makeInvalidEarlyAccess('_lv_style_set_transform_pivot_y');
var _lv_style_set_transform_skew_x = Module['_lv_style_set_transform_skew_x'] = makeInvalidEarlyAccess('_lv_style_set_transform_skew_x');
var _lv_style_set_transform_skew_y = Module['_lv_style_set_transform_skew_y'] = makeInvalidEarlyAccess('_lv_style_set_transform_skew_y');
var _lv_style_set_pad_top = Module['_lv_style_set_pad_top'] = makeInvalidEarlyAccess('_lv_style_set_pad_top');
var _lv_style_set_pad_bottom = Module['_lv_style_set_pad_bottom'] = makeInvalidEarlyAccess('_lv_style_set_pad_bottom');
var _lv_style_set_pad_left = Module['_lv_style_set_pad_left'] = makeInvalidEarlyAccess('_lv_style_set_pad_left');
var _lv_style_set_pad_right = Module['_lv_style_set_pad_right'] = makeInvalidEarlyAccess('_lv_style_set_pad_right');
var _lv_style_set_pad_row = Module['_lv_style_set_pad_row'] = makeInvalidEarlyAccess('_lv_style_set_pad_row');
var _lv_style_set_pad_column = Module['_lv_style_set_pad_column'] = makeInvalidEarlyAccess('_lv_style_set_pad_column');
var _lv_style_set_pad_radial = Module['_lv_style_set_pad_radial'] = makeInvalidEarlyAccess('_lv_style_set_pad_radial');
var _lv_style_set_margin_top = Module['_lv_style_set_margin_top'] = makeInvalidEarlyAccess('_lv_style_set_margin_top');
var _lv_style_set_margin_bottom = Module['_lv_style_set_margin_bottom'] = makeInvalidEarlyAccess('_lv_style_set_margin_bottom');
var _lv_style_set_margin_left = Module['_lv_style_set_margin_left'] = makeInvalidEarlyAccess('_lv_style_set_margin_left');
var _lv_style_set_margin_right = Module['_lv_style_set_margin_right'] = makeInvalidEarlyAccess('_lv_style_set_margin_right');
var _lv_style_set_bg_color = Module['_lv_style_set_bg_color'] = makeInvalidEarlyAccess('_lv_style_set_bg_color');
var _lv_style_set_bg_opa = Module['_lv_style_set_bg_opa'] = makeInvalidEarlyAccess('_lv_style_set_bg_opa');
var _lv_style_set_bg_grad_color = Module['_lv_style_set_bg_grad_color'] = makeInvalidEarlyAccess('_lv_style_set_bg_grad_color');
var _lv_style_set_bg_grad_dir = Module['_lv_style_set_bg_grad_dir'] = makeInvalidEarlyAccess('_lv_style_set_bg_grad_dir');
var _lv_style_set_bg_main_stop = Module['_lv_style_set_bg_main_stop'] = makeInvalidEarlyAccess('_lv_style_set_bg_main_stop');
var _lv_style_set_bg_grad_stop = Module['_lv_style_set_bg_grad_stop'] = makeInvalidEarlyAccess('_lv_style_set_bg_grad_stop');
var _lv_style_set_bg_main_opa = Module['_lv_style_set_bg_main_opa'] = makeInvalidEarlyAccess('_lv_style_set_bg_main_opa');
var _lv_style_set_bg_grad_opa = Module['_lv_style_set_bg_grad_opa'] = makeInvalidEarlyAccess('_lv_style_set_bg_grad_opa');
var _lv_style_set_bg_grad = Module['_lv_style_set_bg_grad'] = makeInvalidEarlyAccess('_lv_style_set_bg_grad');
var _lv_style_set_bg_image_src = Module['_lv_style_set_bg_image_src'] = makeInvalidEarlyAccess('_lv_style_set_bg_image_src');
var _lv_style_set_bg_image_opa = Module['_lv_style_set_bg_image_opa'] = makeInvalidEarlyAccess('_lv_style_set_bg_image_opa');
var _lv_style_set_bg_image_recolor = Module['_lv_style_set_bg_image_recolor'] = makeInvalidEarlyAccess('_lv_style_set_bg_image_recolor');
var _lv_style_set_bg_image_recolor_opa = Module['_lv_style_set_bg_image_recolor_opa'] = makeInvalidEarlyAccess('_lv_style_set_bg_image_recolor_opa');
var _lv_style_set_bg_image_tiled = Module['_lv_style_set_bg_image_tiled'] = makeInvalidEarlyAccess('_lv_style_set_bg_image_tiled');
var _lv_style_set_border_color = Module['_lv_style_set_border_color'] = makeInvalidEarlyAccess('_lv_style_set_border_color');
var _lv_style_set_border_opa = Module['_lv_style_set_border_opa'] = makeInvalidEarlyAccess('_lv_style_set_border_opa');
var _lv_style_set_border_width = Module['_lv_style_set_border_width'] = makeInvalidEarlyAccess('_lv_style_set_border_width');
var _lv_style_set_border_side = Module['_lv_style_set_border_side'] = makeInvalidEarlyAccess('_lv_style_set_border_side');
var _lv_style_set_border_post = Module['_lv_style_set_border_post'] = makeInvalidEarlyAccess('_lv_style_set_border_post');
var _lv_style_set_outline_width = Module['_lv_style_set_outline_width'] = makeInvalidEarlyAccess('_lv_style_set_outline_width');
var _lv_style_set_outline_color = Module['_lv_style_set_outline_color'] = makeInvalidEarlyAccess('_lv_style_set_outline_color');
var _lv_style_set_outline_opa = Module['_lv_style_set_outline_opa'] = makeInvalidEarlyAccess('_lv_style_set_outline_opa');
var _lv_style_set_outline_pad = Module['_lv_style_set_outline_pad'] = makeInvalidEarlyAccess('_lv_style_set_outline_pad');
var _lv_style_set_shadow_width = Module['_lv_style_set_shadow_width'] = makeInvalidEarlyAccess('_lv_style_set_shadow_width');
var _lv_style_set_shadow_offset_x = Module['_lv_style_set_shadow_offset_x'] = makeInvalidEarlyAccess('_lv_style_set_shadow_offset_x');
var _lv_style_set_shadow_offset_y = Module['_lv_style_set_shadow_offset_y'] = makeInvalidEarlyAccess('_lv_style_set_shadow_offset_y');
var _lv_style_set_shadow_spread = Module['_lv_style_set_shadow_spread'] = makeInvalidEarlyAccess('_lv_style_set_shadow_spread');
var _lv_style_set_shadow_color = Module['_lv_style_set_shadow_color'] = makeInvalidEarlyAccess('_lv_style_set_shadow_color');
var _lv_style_set_shadow_opa = Module['_lv_style_set_shadow_opa'] = makeInvalidEarlyAccess('_lv_style_set_shadow_opa');
var _lv_style_set_image_opa = Module['_lv_style_set_image_opa'] = makeInvalidEarlyAccess('_lv_style_set_image_opa');
var _lv_style_set_image_recolor = Module['_lv_style_set_image_recolor'] = makeInvalidEarlyAccess('_lv_style_set_image_recolor');
var _lv_style_set_image_recolor_opa = Module['_lv_style_set_image_recolor_opa'] = makeInvalidEarlyAccess('_lv_style_set_image_recolor_opa');
var _lv_style_set_image_colorkey = Module['_lv_style_set_image_colorkey'] = makeInvalidEarlyAccess('_lv_style_set_image_colorkey');
var _lv_style_set_line_width = Module['_lv_style_set_line_width'] = makeInvalidEarlyAccess('_lv_style_set_line_width');
var _lv_style_set_line_dash_width = Module['_lv_style_set_line_dash_width'] = makeInvalidEarlyAccess('_lv_style_set_line_dash_width');
var _lv_style_set_line_dash_gap = Module['_lv_style_set_line_dash_gap'] = makeInvalidEarlyAccess('_lv_style_set_line_dash_gap');
var _lv_style_set_line_rounded = Module['_lv_style_set_line_rounded'] = makeInvalidEarlyAccess('_lv_style_set_line_rounded');
var _lv_style_set_line_color = Module['_lv_style_set_line_color'] = makeInvalidEarlyAccess('_lv_style_set_line_color');
var _lv_style_set_line_opa = Module['_lv_style_set_line_opa'] = makeInvalidEarlyAccess('_lv_style_set_line_opa');
var _lv_style_set_arc_width = Module['_lv_style_set_arc_width'] = makeInvalidEarlyAccess('_lv_style_set_arc_width');
var _lv_style_set_arc_rounded = Module['_lv_style_set_arc_rounded'] = makeInvalidEarlyAccess('_lv_style_set_arc_rounded');
var _lv_style_set_arc_color = Module['_lv_style_set_arc_color'] = makeInvalidEarlyAccess('_lv_style_set_arc_color');
var _lv_style_set_arc_opa = Module['_lv_style_set_arc_opa'] = makeInvalidEarlyAccess('_lv_style_set_arc_opa');
var _lv_style_set_arc_image_src = Module['_lv_style_set_arc_image_src'] = makeInvalidEarlyAccess('_lv_style_set_arc_image_src');
var _lv_style_set_text_color = Module['_lv_style_set_text_color'] = makeInvalidEarlyAccess('_lv_style_set_text_color');
var _lv_style_set_text_opa = Module['_lv_style_set_text_opa'] = makeInvalidEarlyAccess('_lv_style_set_text_opa');
var _lv_style_set_text_font = Module['_lv_style_set_text_font'] = makeInvalidEarlyAccess('_lv_style_set_text_font');
var _lv_style_set_text_letter_space = Module['_lv_style_set_text_letter_space'] = makeInvalidEarlyAccess('_lv_style_set_text_letter_space');
var _lv_style_set_text_line_space = Module['_lv_style_set_text_line_space'] = makeInvalidEarlyAccess('_lv_style_set_text_line_space');
var _lv_style_set_text_decor = Module['_lv_style_set_text_decor'] = makeInvalidEarlyAccess('_lv_style_set_text_decor');
var _lv_style_set_text_align = Module['_lv_style_set_text_align'] = makeInvalidEarlyAccess('_lv_style_set_text_align');
var _lv_style_set_text_outline_stroke_color = Module['_lv_style_set_text_outline_stroke_color'] = makeInvalidEarlyAccess('_lv_style_set_text_outline_stroke_color');
var _lv_style_set_text_outline_stroke_width = Module['_lv_style_set_text_outline_stroke_width'] = makeInvalidEarlyAccess('_lv_style_set_text_outline_stroke_width');
var _lv_style_set_text_outline_stroke_opa = Module['_lv_style_set_text_outline_stroke_opa'] = makeInvalidEarlyAccess('_lv_style_set_text_outline_stroke_opa');
var _lv_style_set_radius = Module['_lv_style_set_radius'] = makeInvalidEarlyAccess('_lv_style_set_radius');
var _lv_style_set_radial_offset = Module['_lv_style_set_radial_offset'] = makeInvalidEarlyAccess('_lv_style_set_radial_offset');
var _lv_style_set_clip_corner = Module['_lv_style_set_clip_corner'] = makeInvalidEarlyAccess('_lv_style_set_clip_corner');
var _lv_style_set_opa = Module['_lv_style_set_opa'] = makeInvalidEarlyAccess('_lv_style_set_opa');
var _lv_style_set_opa_layered = Module['_lv_style_set_opa_layered'] = makeInvalidEarlyAccess('_lv_style_set_opa_layered');
var _lv_style_set_color_filter_dsc = Module['_lv_style_set_color_filter_dsc'] = makeInvalidEarlyAccess('_lv_style_set_color_filter_dsc');
var _lv_style_set_color_filter_opa = Module['_lv_style_set_color_filter_opa'] = makeInvalidEarlyAccess('_lv_style_set_color_filter_opa');
var _lv_style_set_recolor = Module['_lv_style_set_recolor'] = makeInvalidEarlyAccess('_lv_style_set_recolor');
var _lv_style_set_recolor_opa = Module['_lv_style_set_recolor_opa'] = makeInvalidEarlyAccess('_lv_style_set_recolor_opa');
var _lv_style_set_anim = Module['_lv_style_set_anim'] = makeInvalidEarlyAccess('_lv_style_set_anim');
var _lv_style_set_anim_duration = Module['_lv_style_set_anim_duration'] = makeInvalidEarlyAccess('_lv_style_set_anim_duration');
var _lv_style_set_transition = Module['_lv_style_set_transition'] = makeInvalidEarlyAccess('_lv_style_set_transition');
var _lv_style_set_blend_mode = Module['_lv_style_set_blend_mode'] = makeInvalidEarlyAccess('_lv_style_set_blend_mode');
var _lv_style_set_layout = Module['_lv_style_set_layout'] = makeInvalidEarlyAccess('_lv_style_set_layout');
var _lv_style_set_base_dir = Module['_lv_style_set_base_dir'] = makeInvalidEarlyAccess('_lv_style_set_base_dir');
var _lv_style_set_bitmap_mask_src = Module['_lv_style_set_bitmap_mask_src'] = makeInvalidEarlyAccess('_lv_style_set_bitmap_mask_src');
var _lv_style_set_rotary_sensitivity = Module['_lv_style_set_rotary_sensitivity'] = makeInvalidEarlyAccess('_lv_style_set_rotary_sensitivity');
var _lv_style_set_flex_flow = Module['_lv_style_set_flex_flow'] = makeInvalidEarlyAccess('_lv_style_set_flex_flow');
var _lv_style_set_flex_main_place = Module['_lv_style_set_flex_main_place'] = makeInvalidEarlyAccess('_lv_style_set_flex_main_place');
var _lv_style_set_flex_cross_place = Module['_lv_style_set_flex_cross_place'] = makeInvalidEarlyAccess('_lv_style_set_flex_cross_place');
var _lv_style_set_flex_track_place = Module['_lv_style_set_flex_track_place'] = makeInvalidEarlyAccess('_lv_style_set_flex_track_place');
var _lv_style_set_flex_grow = Module['_lv_style_set_flex_grow'] = makeInvalidEarlyAccess('_lv_style_set_flex_grow');
var _lv_style_set_grid_column_dsc_array = Module['_lv_style_set_grid_column_dsc_array'] = makeInvalidEarlyAccess('_lv_style_set_grid_column_dsc_array');
var _lv_style_set_grid_column_align = Module['_lv_style_set_grid_column_align'] = makeInvalidEarlyAccess('_lv_style_set_grid_column_align');
var _lv_style_set_grid_row_dsc_array = Module['_lv_style_set_grid_row_dsc_array'] = makeInvalidEarlyAccess('_lv_style_set_grid_row_dsc_array');
var _lv_style_set_grid_row_align = Module['_lv_style_set_grid_row_align'] = makeInvalidEarlyAccess('_lv_style_set_grid_row_align');
var _lv_style_set_grid_cell_column_pos = Module['_lv_style_set_grid_cell_column_pos'] = makeInvalidEarlyAccess('_lv_style_set_grid_cell_column_pos');
var _lv_style_set_grid_cell_x_align = Module['_lv_style_set_grid_cell_x_align'] = makeInvalidEarlyAccess('_lv_style_set_grid_cell_x_align');
var _lv_style_set_grid_cell_column_span = Module['_lv_style_set_grid_cell_column_span'] = makeInvalidEarlyAccess('_lv_style_set_grid_cell_column_span');
var _lv_style_set_grid_cell_row_pos = Module['_lv_style_set_grid_cell_row_pos'] = makeInvalidEarlyAccess('_lv_style_set_grid_cell_row_pos');
var _lv_style_set_grid_cell_y_align = Module['_lv_style_set_grid_cell_y_align'] = makeInvalidEarlyAccess('_lv_style_set_grid_cell_y_align');
var _lv_style_set_grid_cell_row_span = Module['_lv_style_set_grid_cell_row_span'] = makeInvalidEarlyAccess('_lv_style_set_grid_cell_row_span');
var _lv_text_attributes_init = Module['_lv_text_attributes_init'] = makeInvalidEarlyAccess('_lv_text_attributes_init');
var _lv_text_get_size = Module['_lv_text_get_size'] = makeInvalidEarlyAccess('_lv_text_get_size');
var _lv_text_is_cmd = Module['_lv_text_is_cmd'] = makeInvalidEarlyAccess('_lv_text_is_cmd');
var _lv_text_ins = Module['_lv_text_ins'] = makeInvalidEarlyAccess('_lv_text_ins');
var _lv_text_cut = Module['_lv_text_cut'] = makeInvalidEarlyAccess('_lv_text_cut');
var _lv_text_set_text_vfmt = Module['_lv_text_set_text_vfmt'] = makeInvalidEarlyAccess('_lv_text_set_text_vfmt');
var _lv_timer_enable = Module['_lv_timer_enable'] = makeInvalidEarlyAccess('_lv_timer_enable');
var _lv_lock = Module['_lv_lock'] = makeInvalidEarlyAccess('_lv_lock');
var _lv_unlock = Module['_lv_unlock'] = makeInvalidEarlyAccess('_lv_unlock');
var _lv_timer_periodic_handler = Module['_lv_timer_periodic_handler'] = makeInvalidEarlyAccess('_lv_timer_periodic_handler');
var _lv_timer_create_basic = Module['_lv_timer_create_basic'] = makeInvalidEarlyAccess('_lv_timer_create_basic');
var _lv_timer_set_period = Module['_lv_timer_set_period'] = makeInvalidEarlyAccess('_lv_timer_set_period');
var _lv_timer_set_auto_delete = Module['_lv_timer_set_auto_delete'] = makeInvalidEarlyAccess('_lv_timer_set_auto_delete');
var _lv_timer_set_user_data = Module['_lv_timer_set_user_data'] = makeInvalidEarlyAccess('_lv_timer_set_user_data');
var _lv_timer_reset = Module['_lv_timer_reset'] = makeInvalidEarlyAccess('_lv_timer_reset');
var _lv_timer_get_idle = Module['_lv_timer_get_idle'] = makeInvalidEarlyAccess('_lv_timer_get_idle');
var _lv_timer_get_time_until_next = Module['_lv_timer_get_time_until_next'] = makeInvalidEarlyAccess('_lv_timer_get_time_until_next');
var _lv_timer_handler_run_in_period = Module['_lv_timer_handler_run_in_period'] = makeInvalidEarlyAccess('_lv_timer_handler_run_in_period');
var _lv_timer_get_user_data = Module['_lv_timer_get_user_data'] = makeInvalidEarlyAccess('_lv_timer_get_user_data');
var _lv_timer_handler_set_resume_cb = Module['_lv_timer_handler_set_resume_cb'] = makeInvalidEarlyAccess('_lv_timer_handler_set_resume_cb');
var _lv_tree_node_create = Module['_lv_tree_node_create'] = makeInvalidEarlyAccess('_lv_tree_node_create');
var _lv_tree_node_delete = Module['_lv_tree_node_delete'] = makeInvalidEarlyAccess('_lv_tree_node_delete');
var _lv_tree_walk = Module['_lv_tree_walk'] = makeInvalidEarlyAccess('_lv_tree_walk');
var _lv_draw_buf_save_to_file = Module['_lv_draw_buf_save_to_file'] = makeInvalidEarlyAccess('_lv_draw_buf_save_to_file');
var _lv_lock_isr = Module['_lv_lock_isr'] = makeInvalidEarlyAccess('_lv_lock_isr');
var _lv_sleep_ms = Module['_lv_sleep_ms'] = makeInvalidEarlyAccess('_lv_sleep_ms');
var _lv_delay_ms = Module['_lv_delay_ms'] = makeInvalidEarlyAccess('_lv_delay_ms');
var _lv_os_get_idle_percent = Module['_lv_os_get_idle_percent'] = makeInvalidEarlyAccess('_lv_os_get_idle_percent');
var _lv_gridnav_add = Module['_lv_gridnav_add'] = makeInvalidEarlyAccess('_lv_gridnav_add');
var _lv_gridnav_remove = Module['_lv_gridnav_remove'] = makeInvalidEarlyAccess('_lv_gridnav_remove');
var _lv_gridnav_set_focused = Module['_lv_gridnav_set_focused'] = makeInvalidEarlyAccess('_lv_gridnav_set_focused');
var _lv_subject_init_int = Module['_lv_subject_init_int'] = makeInvalidEarlyAccess('_lv_subject_init_int');
var _lv_subject_set_int = Module['_lv_subject_set_int'] = makeInvalidEarlyAccess('_lv_subject_set_int');
var _lv_subject_notify = Module['_lv_subject_notify'] = makeInvalidEarlyAccess('_lv_subject_notify');
var _lv_subject_get_int = Module['_lv_subject_get_int'] = makeInvalidEarlyAccess('_lv_subject_get_int');
var _lv_subject_get_previous_int = Module['_lv_subject_get_previous_int'] = makeInvalidEarlyAccess('_lv_subject_get_previous_int');
var _lv_subject_set_min_value_int = Module['_lv_subject_set_min_value_int'] = makeInvalidEarlyAccess('_lv_subject_set_min_value_int');
var _lv_subject_set_max_value_int = Module['_lv_subject_set_max_value_int'] = makeInvalidEarlyAccess('_lv_subject_set_max_value_int');
var _lv_subject_init_string = Module['_lv_subject_init_string'] = makeInvalidEarlyAccess('_lv_subject_init_string');
var _lv_subject_copy_string = Module['_lv_subject_copy_string'] = makeInvalidEarlyAccess('_lv_subject_copy_string');
var _lv_subject_snprintf = Module['_lv_subject_snprintf'] = makeInvalidEarlyAccess('_lv_subject_snprintf');
var _lv_subject_get_string = Module['_lv_subject_get_string'] = makeInvalidEarlyAccess('_lv_subject_get_string');
var _lv_subject_get_previous_string = Module['_lv_subject_get_previous_string'] = makeInvalidEarlyAccess('_lv_subject_get_previous_string');
var _lv_subject_init_pointer = Module['_lv_subject_init_pointer'] = makeInvalidEarlyAccess('_lv_subject_init_pointer');
var _lv_subject_set_pointer = Module['_lv_subject_set_pointer'] = makeInvalidEarlyAccess('_lv_subject_set_pointer');
var _lv_subject_get_pointer = Module['_lv_subject_get_pointer'] = makeInvalidEarlyAccess('_lv_subject_get_pointer');
var _lv_subject_get_previous_pointer = Module['_lv_subject_get_previous_pointer'] = makeInvalidEarlyAccess('_lv_subject_get_previous_pointer');
var _lv_subject_init_color = Module['_lv_subject_init_color'] = makeInvalidEarlyAccess('_lv_subject_init_color');
var _lv_subject_set_color = Module['_lv_subject_set_color'] = makeInvalidEarlyAccess('_lv_subject_set_color');
var _lv_subject_get_color = Module['_lv_subject_get_color'] = makeInvalidEarlyAccess('_lv_subject_get_color');
var _lv_subject_get_previous_color = Module['_lv_subject_get_previous_color'] = makeInvalidEarlyAccess('_lv_subject_get_previous_color');
var _lv_subject_init_group = Module['_lv_subject_init_group'] = makeInvalidEarlyAccess('_lv_subject_init_group');
var _lv_subject_add_observer_obj = Module['_lv_subject_add_observer_obj'] = makeInvalidEarlyAccess('_lv_subject_add_observer_obj');
var _lv_subject_add_observer = Module['_lv_subject_add_observer'] = makeInvalidEarlyAccess('_lv_subject_add_observer');
var _lv_subject_deinit = Module['_lv_subject_deinit'] = makeInvalidEarlyAccess('_lv_subject_deinit');
var _lv_observer_remove = Module['_lv_observer_remove'] = makeInvalidEarlyAccess('_lv_observer_remove');
var _lv_subject_get_group_element = Module['_lv_subject_get_group_element'] = makeInvalidEarlyAccess('_lv_subject_get_group_element');
var _lv_subject_add_observer_with_target = Module['_lv_subject_add_observer_with_target'] = makeInvalidEarlyAccess('_lv_subject_add_observer_with_target');
var _lv_obj_remove_from_subject = Module['_lv_obj_remove_from_subject'] = makeInvalidEarlyAccess('_lv_obj_remove_from_subject');
var _lv_observer_get_target = Module['_lv_observer_get_target'] = makeInvalidEarlyAccess('_lv_observer_get_target');
var _lv_obj_add_subject_increment_event = Module['_lv_obj_add_subject_increment_event'] = makeInvalidEarlyAccess('_lv_obj_add_subject_increment_event');
var _lv_obj_set_subject_increment_event_min_value = Module['_lv_obj_set_subject_increment_event_min_value'] = makeInvalidEarlyAccess('_lv_obj_set_subject_increment_event_min_value');
var _lv_obj_set_subject_increment_event_max_value = Module['_lv_obj_set_subject_increment_event_max_value'] = makeInvalidEarlyAccess('_lv_obj_set_subject_increment_event_max_value');
var _lv_obj_set_subject_increment_event_rollover = Module['_lv_obj_set_subject_increment_event_rollover'] = makeInvalidEarlyAccess('_lv_obj_set_subject_increment_event_rollover');
var _lv_obj_add_subject_toggle_event = Module['_lv_obj_add_subject_toggle_event'] = makeInvalidEarlyAccess('_lv_obj_add_subject_toggle_event');
var _lv_obj_add_subject_set_int_event = Module['_lv_obj_add_subject_set_int_event'] = makeInvalidEarlyAccess('_lv_obj_add_subject_set_int_event');
var _lv_obj_add_subject_set_string_event = Module['_lv_obj_add_subject_set_string_event'] = makeInvalidEarlyAccess('_lv_obj_add_subject_set_string_event');
var _lv_obj_bind_style = Module['_lv_obj_bind_style'] = makeInvalidEarlyAccess('_lv_obj_bind_style');
var _lv_obj_bind_flag_if_eq = Module['_lv_obj_bind_flag_if_eq'] = makeInvalidEarlyAccess('_lv_obj_bind_flag_if_eq');
var _lv_obj_bind_flag_if_not_eq = Module['_lv_obj_bind_flag_if_not_eq'] = makeInvalidEarlyAccess('_lv_obj_bind_flag_if_not_eq');
var _lv_obj_bind_flag_if_gt = Module['_lv_obj_bind_flag_if_gt'] = makeInvalidEarlyAccess('_lv_obj_bind_flag_if_gt');
var _lv_obj_bind_flag_if_ge = Module['_lv_obj_bind_flag_if_ge'] = makeInvalidEarlyAccess('_lv_obj_bind_flag_if_ge');
var _lv_obj_bind_flag_if_lt = Module['_lv_obj_bind_flag_if_lt'] = makeInvalidEarlyAccess('_lv_obj_bind_flag_if_lt');
var _lv_obj_bind_flag_if_le = Module['_lv_obj_bind_flag_if_le'] = makeInvalidEarlyAccess('_lv_obj_bind_flag_if_le');
var _lv_obj_bind_state_if_eq = Module['_lv_obj_bind_state_if_eq'] = makeInvalidEarlyAccess('_lv_obj_bind_state_if_eq');
var _lv_obj_bind_state_if_not_eq = Module['_lv_obj_bind_state_if_not_eq'] = makeInvalidEarlyAccess('_lv_obj_bind_state_if_not_eq');
var _lv_obj_bind_state_if_gt = Module['_lv_obj_bind_state_if_gt'] = makeInvalidEarlyAccess('_lv_obj_bind_state_if_gt');
var _lv_obj_bind_state_if_ge = Module['_lv_obj_bind_state_if_ge'] = makeInvalidEarlyAccess('_lv_obj_bind_state_if_ge');
var _lv_obj_bind_state_if_lt = Module['_lv_obj_bind_state_if_lt'] = makeInvalidEarlyAccess('_lv_obj_bind_state_if_lt');
var _lv_obj_bind_state_if_le = Module['_lv_obj_bind_state_if_le'] = makeInvalidEarlyAccess('_lv_obj_bind_state_if_le');
var _lv_obj_bind_checked = Module['_lv_obj_bind_checked'] = makeInvalidEarlyAccess('_lv_obj_bind_checked');
var _lv_observer_get_target_obj = Module['_lv_observer_get_target_obj'] = makeInvalidEarlyAccess('_lv_observer_get_target_obj');
var _lv_observer_get_user_data = Module['_lv_observer_get_user_data'] = makeInvalidEarlyAccess('_lv_observer_get_user_data');
var _lv_strnlen = Module['_lv_strnlen'] = makeInvalidEarlyAccess('_lv_strnlen');
var _lv_strncpy = Module['_lv_strncpy'] = makeInvalidEarlyAccess('_lv_strncpy');
var _lv_strcpy = Module['_lv_strcpy'] = makeInvalidEarlyAccess('_lv_strcpy');
var _lv_strncmp = Module['_lv_strncmp'] = makeInvalidEarlyAccess('_lv_strncmp');
var _lv_strcat = Module['_lv_strcat'] = makeInvalidEarlyAccess('_lv_strcat');
var _lv_strncat = Module['_lv_strncat'] = makeInvalidEarlyAccess('_lv_strncat');
var _lv_strchr = Module['_lv_strchr'] = makeInvalidEarlyAccess('_lv_strchr');
var _lv_mem_add_pool = Module['_lv_mem_add_pool'] = makeInvalidEarlyAccess('_lv_mem_add_pool');
var _lv_mem_remove_pool = Module['_lv_mem_remove_pool'] = makeInvalidEarlyAccess('_lv_mem_remove_pool');
var _lv_malloc_core = Module['_lv_malloc_core'] = makeInvalidEarlyAccess('_lv_malloc_core');
var _lv_realloc_core = Module['_lv_realloc_core'] = makeInvalidEarlyAccess('_lv_realloc_core');
var _lv_free_core = Module['_lv_free_core'] = makeInvalidEarlyAccess('_lv_free_core');
var _lv_mem_monitor_core = Module['_lv_mem_monitor_core'] = makeInvalidEarlyAccess('_lv_mem_monitor_core');
var _lv_mem_test_core = Module['_lv_mem_test_core'] = makeInvalidEarlyAccess('_lv_mem_test_core');
var _lv_calloc = Module['_lv_calloc'] = makeInvalidEarlyAccess('_lv_calloc');
var _lv_zalloc = Module['_lv_zalloc'] = makeInvalidEarlyAccess('_lv_zalloc');
var _lv_reallocf = Module['_lv_reallocf'] = makeInvalidEarlyAccess('_lv_reallocf');
var _lv_mem_test = Module['_lv_mem_test'] = makeInvalidEarlyAccess('_lv_mem_test');
var _lv_mem_monitor = Module['_lv_mem_monitor'] = makeInvalidEarlyAccess('_lv_mem_monitor');
var _lv_theme_get_from_obj = Module['_lv_theme_get_from_obj'] = makeInvalidEarlyAccess('_lv_theme_get_from_obj');
var _lv_theme_set_parent = Module['_lv_theme_set_parent'] = makeInvalidEarlyAccess('_lv_theme_set_parent');
var _lv_theme_set_apply_cb = Module['_lv_theme_set_apply_cb'] = makeInvalidEarlyAccess('_lv_theme_set_apply_cb');
var _lv_theme_get_font_small = Module['_lv_theme_get_font_small'] = makeInvalidEarlyAccess('_lv_theme_get_font_small');
var _lv_theme_get_font_normal = Module['_lv_theme_get_font_normal'] = makeInvalidEarlyAccess('_lv_theme_get_font_normal');
var _lv_theme_get_font_large = Module['_lv_theme_get_font_large'] = makeInvalidEarlyAccess('_lv_theme_get_font_large');
var _lv_theme_get_color_primary = Module['_lv_theme_get_color_primary'] = makeInvalidEarlyAccess('_lv_theme_get_color_primary');
var _lv_theme_get_color_secondary = Module['_lv_theme_get_color_secondary'] = makeInvalidEarlyAccess('_lv_theme_get_color_secondary');
var _lv_theme_mono_init = Module['_lv_theme_mono_init'] = makeInvalidEarlyAccess('_lv_theme_mono_init');
var _lv_theme_mono_is_inited = Module['_lv_theme_mono_is_inited'] = makeInvalidEarlyAccess('_lv_theme_mono_is_inited');
var _lv_theme_mono_get = Module['_lv_theme_mono_get'] = makeInvalidEarlyAccess('_lv_theme_mono_get');
var _lv_theme_simple_init = Module['_lv_theme_simple_init'] = makeInvalidEarlyAccess('_lv_theme_simple_init');
var _lv_theme_simple_is_inited = Module['_lv_theme_simple_is_inited'] = makeInvalidEarlyAccess('_lv_theme_simple_is_inited');
var _lv_theme_simple_get = Module['_lv_theme_simple_get'] = makeInvalidEarlyAccess('_lv_theme_simple_get');
var _lv_tick_set_cb = Module['_lv_tick_set_cb'] = makeInvalidEarlyAccess('_lv_tick_set_cb');
var _lv_tick_get_cb = Module['_lv_tick_get_cb'] = makeInvalidEarlyAccess('_lv_tick_get_cb');
var _lv_delay_set_cb = Module['_lv_delay_set_cb'] = makeInvalidEarlyAccess('_lv_delay_set_cb');
var _lv_animimg_set_src_reverse = Module['_lv_animimg_set_src_reverse'] = makeInvalidEarlyAccess('_lv_animimg_set_src_reverse');
var _lv_animimg_delete = Module['_lv_animimg_delete'] = makeInvalidEarlyAccess('_lv_animimg_delete');
var _lv_animimg_set_reverse_duration = Module['_lv_animimg_set_reverse_duration'] = makeInvalidEarlyAccess('_lv_animimg_set_reverse_duration');
var _lv_animimg_set_reverse_delay = Module['_lv_animimg_set_reverse_delay'] = makeInvalidEarlyAccess('_lv_animimg_set_reverse_delay');
var _lv_animimg_set_start_cb = Module['_lv_animimg_set_start_cb'] = makeInvalidEarlyAccess('_lv_animimg_set_start_cb');
var _lv_animimg_set_completed_cb = Module['_lv_animimg_set_completed_cb'] = makeInvalidEarlyAccess('_lv_animimg_set_completed_cb');
var _lv_animimg_get_src = Module['_lv_animimg_get_src'] = makeInvalidEarlyAccess('_lv_animimg_get_src');
var _lv_animimg_get_src_count = Module['_lv_animimg_get_src_count'] = makeInvalidEarlyAccess('_lv_animimg_get_src_count');
var _lv_animimg_get_duration = Module['_lv_animimg_get_duration'] = makeInvalidEarlyAccess('_lv_animimg_get_duration');
var _lv_animimg_get_repeat_count = Module['_lv_animimg_get_repeat_count'] = makeInvalidEarlyAccess('_lv_animimg_get_repeat_count');
var _lv_animimg_get_anim = Module['_lv_animimg_get_anim'] = makeInvalidEarlyAccess('_lv_animimg_get_anim');
var _lv_arc_set_start_angle = Module['_lv_arc_set_start_angle'] = makeInvalidEarlyAccess('_lv_arc_set_start_angle');
var _lv_arc_set_end_angle = Module['_lv_arc_set_end_angle'] = makeInvalidEarlyAccess('_lv_arc_set_end_angle');
var _lv_arc_set_angles = Module['_lv_arc_set_angles'] = makeInvalidEarlyAccess('_lv_arc_set_angles');
var _lv_arc_set_bg_angles = Module['_lv_arc_set_bg_angles'] = makeInvalidEarlyAccess('_lv_arc_set_bg_angles');
var _lv_arc_set_min_value = Module['_lv_arc_set_min_value'] = makeInvalidEarlyAccess('_lv_arc_set_min_value');
var _lv_arc_set_max_value = Module['_lv_arc_set_max_value'] = makeInvalidEarlyAccess('_lv_arc_set_max_value');
var _lv_arc_set_change_rate = Module['_lv_arc_set_change_rate'] = makeInvalidEarlyAccess('_lv_arc_set_change_rate');
var _lv_arc_set_knob_offset = Module['_lv_arc_set_knob_offset'] = makeInvalidEarlyAccess('_lv_arc_set_knob_offset');
var _lv_arc_get_angle_start = Module['_lv_arc_get_angle_start'] = makeInvalidEarlyAccess('_lv_arc_get_angle_start');
var _lv_arc_get_angle_end = Module['_lv_arc_get_angle_end'] = makeInvalidEarlyAccess('_lv_arc_get_angle_end');
var _lv_arc_get_bg_angle_start = Module['_lv_arc_get_bg_angle_start'] = makeInvalidEarlyAccess('_lv_arc_get_bg_angle_start');
var _lv_arc_get_bg_angle_end = Module['_lv_arc_get_bg_angle_end'] = makeInvalidEarlyAccess('_lv_arc_get_bg_angle_end');
var _lv_arc_get_mode = Module['_lv_arc_get_mode'] = makeInvalidEarlyAccess('_lv_arc_get_mode');
var _lv_arc_get_rotation = Module['_lv_arc_get_rotation'] = makeInvalidEarlyAccess('_lv_arc_get_rotation');
var _lv_arc_get_knob_offset = Module['_lv_arc_get_knob_offset'] = makeInvalidEarlyAccess('_lv_arc_get_knob_offset');
var _lv_arc_bind_value = Module['_lv_arc_bind_value'] = makeInvalidEarlyAccess('_lv_arc_bind_value');
var _lv_arc_align_obj_to_angle = Module['_lv_arc_align_obj_to_angle'] = makeInvalidEarlyAccess('_lv_arc_align_obj_to_angle');
var _lv_arc_rotate_obj_to_angle = Module['_lv_arc_rotate_obj_to_angle'] = makeInvalidEarlyAccess('_lv_arc_rotate_obj_to_angle');
var _lv_arclabel_create = Module['_lv_arclabel_create'] = makeInvalidEarlyAccess('_lv_arclabel_create');
var _lv_arclabel_set_text = Module['_lv_arclabel_set_text'] = makeInvalidEarlyAccess('_lv_arclabel_set_text');
var _lv_arclabel_set_text_fmt = Module['_lv_arclabel_set_text_fmt'] = makeInvalidEarlyAccess('_lv_arclabel_set_text_fmt');
var _lv_arclabel_set_text_static = Module['_lv_arclabel_set_text_static'] = makeInvalidEarlyAccess('_lv_arclabel_set_text_static');
var _lv_arclabel_set_angle_start = Module['_lv_arclabel_set_angle_start'] = makeInvalidEarlyAccess('_lv_arclabel_set_angle_start');
var _lv_arclabel_set_angle_size = Module['_lv_arclabel_set_angle_size'] = makeInvalidEarlyAccess('_lv_arclabel_set_angle_size');
var _lv_arclabel_set_offset = Module['_lv_arclabel_set_offset'] = makeInvalidEarlyAccess('_lv_arclabel_set_offset');
var _lv_arclabel_set_dir = Module['_lv_arclabel_set_dir'] = makeInvalidEarlyAccess('_lv_arclabel_set_dir');
var _lv_arclabel_set_recolor = Module['_lv_arclabel_set_recolor'] = makeInvalidEarlyAccess('_lv_arclabel_set_recolor');
var _lv_arclabel_set_radius = Module['_lv_arclabel_set_radius'] = makeInvalidEarlyAccess('_lv_arclabel_set_radius');
var _lv_arclabel_set_center_offset_x = Module['_lv_arclabel_set_center_offset_x'] = makeInvalidEarlyAccess('_lv_arclabel_set_center_offset_x');
var _lv_arclabel_set_center_offset_y = Module['_lv_arclabel_set_center_offset_y'] = makeInvalidEarlyAccess('_lv_arclabel_set_center_offset_y');
var _lv_arclabel_set_text_vertical_align = Module['_lv_arclabel_set_text_vertical_align'] = makeInvalidEarlyAccess('_lv_arclabel_set_text_vertical_align');
var _lv_arclabel_set_text_horizontal_align = Module['_lv_arclabel_set_text_horizontal_align'] = makeInvalidEarlyAccess('_lv_arclabel_set_text_horizontal_align');
var _lv_arclabel_get_angle_start = Module['_lv_arclabel_get_angle_start'] = makeInvalidEarlyAccess('_lv_arclabel_get_angle_start');
var _lv_arclabel_get_angle_size = Module['_lv_arclabel_get_angle_size'] = makeInvalidEarlyAccess('_lv_arclabel_get_angle_size');
var _lv_arclabel_get_dir = Module['_lv_arclabel_get_dir'] = makeInvalidEarlyAccess('_lv_arclabel_get_dir');
var _lv_arclabel_get_recolor = Module['_lv_arclabel_get_recolor'] = makeInvalidEarlyAccess('_lv_arclabel_get_recolor');
var _lv_arclabel_get_radius = Module['_lv_arclabel_get_radius'] = makeInvalidEarlyAccess('_lv_arclabel_get_radius');
var _lv_arclabel_get_center_offset_x = Module['_lv_arclabel_get_center_offset_x'] = makeInvalidEarlyAccess('_lv_arclabel_get_center_offset_x');
var _lv_arclabel_get_center_offset_y = Module['_lv_arclabel_get_center_offset_y'] = makeInvalidEarlyAccess('_lv_arclabel_get_center_offset_y');
var _lv_arclabel_get_text_vertical_align = Module['_lv_arclabel_get_text_vertical_align'] = makeInvalidEarlyAccess('_lv_arclabel_get_text_vertical_align');
var _lv_arclabel_get_text_horizontal_align = Module['_lv_arclabel_get_text_horizontal_align'] = makeInvalidEarlyAccess('_lv_arclabel_get_text_horizontal_align');
var _lv_bar_get_mode = Module['_lv_bar_get_mode'] = makeInvalidEarlyAccess('_lv_bar_get_mode');
var _lv_bar_set_min_value = Module['_lv_bar_set_min_value'] = makeInvalidEarlyAccess('_lv_bar_set_min_value');
var _lv_bar_get_max_value = Module['_lv_bar_get_max_value'] = makeInvalidEarlyAccess('_lv_bar_get_max_value');
var _lv_bar_set_max_value = Module['_lv_bar_set_max_value'] = makeInvalidEarlyAccess('_lv_bar_set_max_value');
var _lv_bar_get_min_value = Module['_lv_bar_get_min_value'] = makeInvalidEarlyAccess('_lv_bar_get_min_value');
var _lv_bar_set_orientation = Module['_lv_bar_set_orientation'] = makeInvalidEarlyAccess('_lv_bar_set_orientation');
var _lv_bar_get_orientation = Module['_lv_bar_get_orientation'] = makeInvalidEarlyAccess('_lv_bar_get_orientation');
var _lv_bar_is_symmetrical = Module['_lv_bar_is_symmetrical'] = makeInvalidEarlyAccess('_lv_bar_is_symmetrical');
var _lv_bar_bind_value = Module['_lv_bar_bind_value'] = makeInvalidEarlyAccess('_lv_bar_bind_value');
var _lv_buttonmatrix_set_selected_button = Module['_lv_buttonmatrix_set_selected_button'] = makeInvalidEarlyAccess('_lv_buttonmatrix_set_selected_button');
var _lv_buttonmatrix_set_button_ctrl = Module['_lv_buttonmatrix_set_button_ctrl'] = makeInvalidEarlyAccess('_lv_buttonmatrix_set_button_ctrl');
var _lv_buttonmatrix_clear_button_ctrl_all = Module['_lv_buttonmatrix_clear_button_ctrl_all'] = makeInvalidEarlyAccess('_lv_buttonmatrix_clear_button_ctrl_all');
var _lv_buttonmatrix_clear_button_ctrl = Module['_lv_buttonmatrix_clear_button_ctrl'] = makeInvalidEarlyAccess('_lv_buttonmatrix_clear_button_ctrl');
var _lv_buttonmatrix_set_button_ctrl_all = Module['_lv_buttonmatrix_set_button_ctrl_all'] = makeInvalidEarlyAccess('_lv_buttonmatrix_set_button_ctrl_all');
var _lv_buttonmatrix_set_button_width = Module['_lv_buttonmatrix_set_button_width'] = makeInvalidEarlyAccess('_lv_buttonmatrix_set_button_width');
var _lv_buttonmatrix_get_map = Module['_lv_buttonmatrix_get_map'] = makeInvalidEarlyAccess('_lv_buttonmatrix_get_map');
var _lv_buttonmatrix_get_selected_button = Module['_lv_buttonmatrix_get_selected_button'] = makeInvalidEarlyAccess('_lv_buttonmatrix_get_selected_button');
var _lv_buttonmatrix_get_button_text = Module['_lv_buttonmatrix_get_button_text'] = makeInvalidEarlyAccess('_lv_buttonmatrix_get_button_text');
var _lv_buttonmatrix_has_button_ctrl = Module['_lv_buttonmatrix_has_button_ctrl'] = makeInvalidEarlyAccess('_lv_buttonmatrix_has_button_ctrl');
var _lv_buttonmatrix_get_one_checked = Module['_lv_buttonmatrix_get_one_checked'] = makeInvalidEarlyAccess('_lv_buttonmatrix_get_one_checked');
var _lv_calendar_set_day_names = Module['_lv_calendar_set_day_names'] = makeInvalidEarlyAccess('_lv_calendar_set_day_names');
var _lv_calendar_set_today_year = Module['_lv_calendar_set_today_year'] = makeInvalidEarlyAccess('_lv_calendar_set_today_year');
var _lv_calendar_set_today_month = Module['_lv_calendar_set_today_month'] = makeInvalidEarlyAccess('_lv_calendar_set_today_month');
var _lv_calendar_set_today_day = Module['_lv_calendar_set_today_day'] = makeInvalidEarlyAccess('_lv_calendar_set_today_day');
var _lv_calendar_set_highlighted_dates = Module['_lv_calendar_set_highlighted_dates'] = makeInvalidEarlyAccess('_lv_calendar_set_highlighted_dates');
var _lv_calendar_get_day_name = Module['_lv_calendar_get_day_name'] = makeInvalidEarlyAccess('_lv_calendar_get_day_name');
var _lv_calendar_set_shown_year = Module['_lv_calendar_set_shown_year'] = makeInvalidEarlyAccess('_lv_calendar_set_shown_year');
var _lv_calendar_set_shown_month = Module['_lv_calendar_set_shown_month'] = makeInvalidEarlyAccess('_lv_calendar_set_shown_month');
var _lv_calendar_get_btnmatrix = Module['_lv_calendar_get_btnmatrix'] = makeInvalidEarlyAccess('_lv_calendar_get_btnmatrix');
var _lv_calendar_get_today_date = Module['_lv_calendar_get_today_date'] = makeInvalidEarlyAccess('_lv_calendar_get_today_date');
var _lv_calendar_get_showed_date = Module['_lv_calendar_get_showed_date'] = makeInvalidEarlyAccess('_lv_calendar_get_showed_date');
var _lv_calendar_get_highlighted_dates = Module['_lv_calendar_get_highlighted_dates'] = makeInvalidEarlyAccess('_lv_calendar_get_highlighted_dates');
var _lv_calendar_get_highlighted_dates_num = Module['_lv_calendar_get_highlighted_dates_num'] = makeInvalidEarlyAccess('_lv_calendar_get_highlighted_dates_num');
var _lv_calendar_get_pressed_date = Module['_lv_calendar_get_pressed_date'] = makeInvalidEarlyAccess('_lv_calendar_get_pressed_date');
var _lv_calendar_set_chinese_mode = Module['_lv_calendar_set_chinese_mode'] = makeInvalidEarlyAccess('_lv_calendar_set_chinese_mode');
var _lv_calendar_gregorian_to_chinese = Module['_lv_calendar_gregorian_to_chinese'] = makeInvalidEarlyAccess('_lv_calendar_gregorian_to_chinese');
var _lv_label_set_text_fmt = Module['_lv_label_set_text_fmt'] = makeInvalidEarlyAccess('_lv_label_set_text_fmt');
var _lv_calendar_add_header_dropdown = Module['_lv_calendar_add_header_dropdown'] = makeInvalidEarlyAccess('_lv_calendar_add_header_dropdown');
var _lv_calendar_header_dropdown_set_year_list = Module['_lv_calendar_header_dropdown_set_year_list'] = makeInvalidEarlyAccess('_lv_calendar_header_dropdown_set_year_list');
var _lv_dropdown_clear_options = Module['_lv_dropdown_clear_options'] = makeInvalidEarlyAccess('_lv_dropdown_clear_options');
var _lv_canvas_set_buffer = Module['_lv_canvas_set_buffer'] = makeInvalidEarlyAccess('_lv_canvas_set_buffer');
var _lv_image_get_src = Module['_lv_image_get_src'] = makeInvalidEarlyAccess('_lv_image_get_src');
var _lv_canvas_get_px = Module['_lv_canvas_get_px'] = makeInvalidEarlyAccess('_lv_canvas_get_px');
var _lv_canvas_get_image = Module['_lv_canvas_get_image'] = makeInvalidEarlyAccess('_lv_canvas_get_image');
var _lv_canvas_get_buf = Module['_lv_canvas_get_buf'] = makeInvalidEarlyAccess('_lv_canvas_get_buf');
var _lv_canvas_copy_buf = Module['_lv_canvas_copy_buf'] = makeInvalidEarlyAccess('_lv_canvas_copy_buf');
var _lv_canvas_fill_bg = Module['_lv_canvas_fill_bg'] = makeInvalidEarlyAccess('_lv_canvas_fill_bg');
var _lv_canvas_init_layer = Module['_lv_canvas_init_layer'] = makeInvalidEarlyAccess('_lv_canvas_init_layer');
var _lv_canvas_finish_layer = Module['_lv_canvas_finish_layer'] = makeInvalidEarlyAccess('_lv_canvas_finish_layer');
var _lv_canvas_buf_size = Module['_lv_canvas_buf_size'] = makeInvalidEarlyAccess('_lv_canvas_buf_size');
var _lv_chart_get_point_pos_by_id = Module['_lv_chart_get_point_pos_by_id'] = makeInvalidEarlyAccess('_lv_chart_get_point_pos_by_id');
var _lv_chart_set_type = Module['_lv_chart_set_type'] = makeInvalidEarlyAccess('_lv_chart_set_type');
var _lv_chart_refresh = Module['_lv_chart_refresh'] = makeInvalidEarlyAccess('_lv_chart_refresh');
var _lv_chart_set_point_count = Module['_lv_chart_set_point_count'] = makeInvalidEarlyAccess('_lv_chart_set_point_count');
var _lv_chart_set_axis_min_value = Module['_lv_chart_set_axis_min_value'] = makeInvalidEarlyAccess('_lv_chart_set_axis_min_value');
var _lv_chart_set_axis_max_value = Module['_lv_chart_set_axis_max_value'] = makeInvalidEarlyAccess('_lv_chart_set_axis_max_value');
var _lv_chart_set_axis_range = Module['_lv_chart_set_axis_range'] = makeInvalidEarlyAccess('_lv_chart_set_axis_range');
var _lv_chart_set_update_mode = Module['_lv_chart_set_update_mode'] = makeInvalidEarlyAccess('_lv_chart_set_update_mode');
var _lv_chart_set_div_line_count = Module['_lv_chart_set_div_line_count'] = makeInvalidEarlyAccess('_lv_chart_set_div_line_count');
var _lv_chart_set_hor_div_line_count = Module['_lv_chart_set_hor_div_line_count'] = makeInvalidEarlyAccess('_lv_chart_set_hor_div_line_count');
var _lv_chart_set_ver_div_line_count = Module['_lv_chart_set_ver_div_line_count'] = makeInvalidEarlyAccess('_lv_chart_set_ver_div_line_count');
var _lv_chart_get_type = Module['_lv_chart_get_type'] = makeInvalidEarlyAccess('_lv_chart_get_type');
var _lv_chart_get_point_count = Module['_lv_chart_get_point_count'] = makeInvalidEarlyAccess('_lv_chart_get_point_count');
var _lv_chart_get_x_start_point = Module['_lv_chart_get_x_start_point'] = makeInvalidEarlyAccess('_lv_chart_get_x_start_point');
var _lv_chart_add_series = Module['_lv_chart_add_series'] = makeInvalidEarlyAccess('_lv_chart_add_series');
var _lv_chart_remove_series = Module['_lv_chart_remove_series'] = makeInvalidEarlyAccess('_lv_chart_remove_series');
var _lv_chart_hide_series = Module['_lv_chart_hide_series'] = makeInvalidEarlyAccess('_lv_chart_hide_series');
var _lv_chart_set_series_color = Module['_lv_chart_set_series_color'] = makeInvalidEarlyAccess('_lv_chart_set_series_color');
var _lv_chart_get_series_color = Module['_lv_chart_get_series_color'] = makeInvalidEarlyAccess('_lv_chart_get_series_color');
var _lv_chart_set_x_start_point = Module['_lv_chart_set_x_start_point'] = makeInvalidEarlyAccess('_lv_chart_set_x_start_point');
var _lv_chart_get_series_next = Module['_lv_chart_get_series_next'] = makeInvalidEarlyAccess('_lv_chart_get_series_next');
var _lv_chart_add_cursor = Module['_lv_chart_add_cursor'] = makeInvalidEarlyAccess('_lv_chart_add_cursor');
var _lv_chart_remove_cursor = Module['_lv_chart_remove_cursor'] = makeInvalidEarlyAccess('_lv_chart_remove_cursor');
var _lv_chart_set_cursor_pos = Module['_lv_chart_set_cursor_pos'] = makeInvalidEarlyAccess('_lv_chart_set_cursor_pos');
var _lv_chart_set_cursor_pos_x = Module['_lv_chart_set_cursor_pos_x'] = makeInvalidEarlyAccess('_lv_chart_set_cursor_pos_x');
var _lv_chart_set_cursor_pos_y = Module['_lv_chart_set_cursor_pos_y'] = makeInvalidEarlyAccess('_lv_chart_set_cursor_pos_y');
var _lv_chart_set_cursor_point = Module['_lv_chart_set_cursor_point'] = makeInvalidEarlyAccess('_lv_chart_set_cursor_point');
var _lv_chart_get_cursor_point = Module['_lv_chart_get_cursor_point'] = makeInvalidEarlyAccess('_lv_chart_get_cursor_point');
var _lv_chart_set_all_values = Module['_lv_chart_set_all_values'] = makeInvalidEarlyAccess('_lv_chart_set_all_values');
var _lv_chart_set_next_value = Module['_lv_chart_set_next_value'] = makeInvalidEarlyAccess('_lv_chart_set_next_value');
var _lv_chart_set_next_value2 = Module['_lv_chart_set_next_value2'] = makeInvalidEarlyAccess('_lv_chart_set_next_value2');
var _lv_chart_set_series_values = Module['_lv_chart_set_series_values'] = makeInvalidEarlyAccess('_lv_chart_set_series_values');
var _lv_chart_set_series_values2 = Module['_lv_chart_set_series_values2'] = makeInvalidEarlyAccess('_lv_chart_set_series_values2');
var _lv_chart_set_series_value_by_id = Module['_lv_chart_set_series_value_by_id'] = makeInvalidEarlyAccess('_lv_chart_set_series_value_by_id');
var _lv_chart_set_series_value_by_id2 = Module['_lv_chart_set_series_value_by_id2'] = makeInvalidEarlyAccess('_lv_chart_set_series_value_by_id2');
var _lv_chart_set_series_ext_y_array = Module['_lv_chart_set_series_ext_y_array'] = makeInvalidEarlyAccess('_lv_chart_set_series_ext_y_array');
var _lv_chart_set_series_ext_x_array = Module['_lv_chart_set_series_ext_x_array'] = makeInvalidEarlyAccess('_lv_chart_set_series_ext_x_array');
var _lv_chart_get_series_y_array = Module['_lv_chart_get_series_y_array'] = makeInvalidEarlyAccess('_lv_chart_get_series_y_array');
var _lv_chart_get_series_x_array = Module['_lv_chart_get_series_x_array'] = makeInvalidEarlyAccess('_lv_chart_get_series_x_array');
var _lv_chart_get_pressed_point = Module['_lv_chart_get_pressed_point'] = makeInvalidEarlyAccess('_lv_chart_get_pressed_point');
var _lv_chart_get_first_point_center_offset = Module['_lv_chart_get_first_point_center_offset'] = makeInvalidEarlyAccess('_lv_chart_get_first_point_center_offset');
var _lv_checkbox_set_text_static = Module['_lv_checkbox_set_text_static'] = makeInvalidEarlyAccess('_lv_checkbox_set_text_static');
var _lv_checkbox_get_text = Module['_lv_checkbox_get_text'] = makeInvalidEarlyAccess('_lv_checkbox_get_text');
var _lv_dropdown_set_options_static = Module['_lv_dropdown_set_options_static'] = makeInvalidEarlyAccess('_lv_dropdown_set_options_static');
var _lv_dropdown_open = Module['_lv_dropdown_open'] = makeInvalidEarlyAccess('_lv_dropdown_open');
var _lv_dropdown_is_open = Module['_lv_dropdown_is_open'] = makeInvalidEarlyAccess('_lv_dropdown_is_open');
var _lv_dropdown_close = Module['_lv_dropdown_close'] = makeInvalidEarlyAccess('_lv_dropdown_close');
var _lv_dropdown_set_text = Module['_lv_dropdown_set_text'] = makeInvalidEarlyAccess('_lv_dropdown_set_text');
var _lv_dropdown_add_option = Module['_lv_dropdown_add_option'] = makeInvalidEarlyAccess('_lv_dropdown_add_option');
var _lv_dropdown_set_selected_highlight = Module['_lv_dropdown_set_selected_highlight'] = makeInvalidEarlyAccess('_lv_dropdown_set_selected_highlight');
var _lv_dropdown_get_text = Module['_lv_dropdown_get_text'] = makeInvalidEarlyAccess('_lv_dropdown_get_text');
var _lv_dropdown_get_option_count = Module['_lv_dropdown_get_option_count'] = makeInvalidEarlyAccess('_lv_dropdown_get_option_count');
var _lv_dropdown_get_selected_str = Module['_lv_dropdown_get_selected_str'] = makeInvalidEarlyAccess('_lv_dropdown_get_selected_str');
var _lv_dropdown_get_option_index = Module['_lv_dropdown_get_option_index'] = makeInvalidEarlyAccess('_lv_dropdown_get_option_index');
var _lv_dropdown_get_symbol = Module['_lv_dropdown_get_symbol'] = makeInvalidEarlyAccess('_lv_dropdown_get_symbol');
var _lv_dropdown_get_selected_highlight = Module['_lv_dropdown_get_selected_highlight'] = makeInvalidEarlyAccess('_lv_dropdown_get_selected_highlight');
var _lv_dropdown_get_dir = Module['_lv_dropdown_get_dir'] = makeInvalidEarlyAccess('_lv_dropdown_get_dir');
var _lv_label_set_text_static = Module['_lv_label_set_text_static'] = makeInvalidEarlyAccess('_lv_label_set_text_static');
var _lv_dropdown_bind_value = Module['_lv_dropdown_bind_value'] = makeInvalidEarlyAccess('_lv_dropdown_bind_value');
var _lv_image_get_pivot = Module['_lv_image_get_pivot'] = makeInvalidEarlyAccess('_lv_image_get_pivot');
var _lv_image_set_offset_x = Module['_lv_image_set_offset_x'] = makeInvalidEarlyAccess('_lv_image_set_offset_x');
var _lv_image_set_offset_y = Module['_lv_image_set_offset_y'] = makeInvalidEarlyAccess('_lv_image_set_offset_y');
var _lv_image_set_pivot_x = Module['_lv_image_set_pivot_x'] = makeInvalidEarlyAccess('_lv_image_set_pivot_x');
var _lv_image_set_pivot_y = Module['_lv_image_set_pivot_y'] = makeInvalidEarlyAccess('_lv_image_set_pivot_y');
var _lv_image_set_scale_x = Module['_lv_image_set_scale_x'] = makeInvalidEarlyAccess('_lv_image_set_scale_x');
var _lv_image_set_scale_y = Module['_lv_image_set_scale_y'] = makeInvalidEarlyAccess('_lv_image_set_scale_y');
var _lv_image_set_blend_mode = Module['_lv_image_set_blend_mode'] = makeInvalidEarlyAccess('_lv_image_set_blend_mode');
var _lv_image_set_antialias = Module['_lv_image_set_antialias'] = makeInvalidEarlyAccess('_lv_image_set_antialias');
var _lv_image_set_bitmap_map_src = Module['_lv_image_set_bitmap_map_src'] = makeInvalidEarlyAccess('_lv_image_set_bitmap_map_src');
var _lv_image_get_offset_x = Module['_lv_image_get_offset_x'] = makeInvalidEarlyAccess('_lv_image_get_offset_x');
var _lv_image_get_offset_y = Module['_lv_image_get_offset_y'] = makeInvalidEarlyAccess('_lv_image_get_offset_y');
var _lv_image_get_rotation = Module['_lv_image_get_rotation'] = makeInvalidEarlyAccess('_lv_image_get_rotation');
var _lv_image_get_scale = Module['_lv_image_get_scale'] = makeInvalidEarlyAccess('_lv_image_get_scale');
var _lv_image_get_scale_x = Module['_lv_image_get_scale_x'] = makeInvalidEarlyAccess('_lv_image_get_scale_x');
var _lv_image_get_scale_y = Module['_lv_image_get_scale_y'] = makeInvalidEarlyAccess('_lv_image_get_scale_y');
var _lv_image_get_src_width = Module['_lv_image_get_src_width'] = makeInvalidEarlyAccess('_lv_image_get_src_width');
var _lv_image_get_src_height = Module['_lv_image_get_src_height'] = makeInvalidEarlyAccess('_lv_image_get_src_height');
var _lv_image_get_transformed_width = Module['_lv_image_get_transformed_width'] = makeInvalidEarlyAccess('_lv_image_get_transformed_width');
var _lv_image_get_transformed_height = Module['_lv_image_get_transformed_height'] = makeInvalidEarlyAccess('_lv_image_get_transformed_height');
var _lv_image_get_blend_mode = Module['_lv_image_get_blend_mode'] = makeInvalidEarlyAccess('_lv_image_get_blend_mode');
var _lv_image_get_antialias = Module['_lv_image_get_antialias'] = makeInvalidEarlyAccess('_lv_image_get_antialias');
var _lv_image_get_inner_align = Module['_lv_image_get_inner_align'] = makeInvalidEarlyAccess('_lv_image_get_inner_align');
var _lv_image_get_bitmap_map_src = Module['_lv_image_get_bitmap_map_src'] = makeInvalidEarlyAccess('_lv_image_get_bitmap_map_src');
var _lv_image_bind_src = Module['_lv_image_bind_src'] = makeInvalidEarlyAccess('_lv_image_bind_src');
var _lv_imagebutton_set_state = Module['_lv_imagebutton_set_state'] = makeInvalidEarlyAccess('_lv_imagebutton_set_state');
var _lv_imagebutton_get_src_left = Module['_lv_imagebutton_get_src_left'] = makeInvalidEarlyAccess('_lv_imagebutton_get_src_left');
var _lv_imagebutton_get_src_middle = Module['_lv_imagebutton_get_src_middle'] = makeInvalidEarlyAccess('_lv_imagebutton_get_src_middle');
var _lv_imagebutton_get_src_right = Module['_lv_imagebutton_get_src_right'] = makeInvalidEarlyAccess('_lv_imagebutton_get_src_right');
var _lv_keyboard_def_event_cb = Module['_lv_keyboard_def_event_cb'] = makeInvalidEarlyAccess('_lv_keyboard_def_event_cb');
var _lv_keyboard_set_popovers = Module['_lv_keyboard_set_popovers'] = makeInvalidEarlyAccess('_lv_keyboard_set_popovers');
var _lv_keyboard_set_map = Module['_lv_keyboard_set_map'] = makeInvalidEarlyAccess('_lv_keyboard_set_map');
var _lv_keyboard_get_textarea = Module['_lv_keyboard_get_textarea'] = makeInvalidEarlyAccess('_lv_keyboard_get_textarea');
var _lv_keyboard_get_mode = Module['_lv_keyboard_get_mode'] = makeInvalidEarlyAccess('_lv_keyboard_get_mode');
var _lv_keyboard_get_popovers = Module['_lv_keyboard_get_popovers'] = makeInvalidEarlyAccess('_lv_keyboard_get_popovers');
var _lv_textarea_add_char = Module['_lv_textarea_add_char'] = makeInvalidEarlyAccess('_lv_textarea_add_char');
var _lv_textarea_get_one_line = Module['_lv_textarea_get_one_line'] = makeInvalidEarlyAccess('_lv_textarea_get_one_line');
var _lv_textarea_cursor_left = Module['_lv_textarea_cursor_left'] = makeInvalidEarlyAccess('_lv_textarea_cursor_left');
var _lv_textarea_cursor_right = Module['_lv_textarea_cursor_right'] = makeInvalidEarlyAccess('_lv_textarea_cursor_right');
var _lv_textarea_delete_char = Module['_lv_textarea_delete_char'] = makeInvalidEarlyAccess('_lv_textarea_delete_char');
var _lv_textarea_get_cursor_pos = Module['_lv_textarea_get_cursor_pos'] = makeInvalidEarlyAccess('_lv_textarea_get_cursor_pos');
var _lv_textarea_set_cursor_pos = Module['_lv_textarea_set_cursor_pos'] = makeInvalidEarlyAccess('_lv_textarea_set_cursor_pos');
var _lv_textarea_add_text = Module['_lv_textarea_add_text'] = makeInvalidEarlyAccess('_lv_textarea_add_text');
var _lv_keyboard_get_map_array = Module['_lv_keyboard_get_map_array'] = makeInvalidEarlyAccess('_lv_keyboard_get_map_array');
var _lv_keyboard_get_selected_button = Module['_lv_keyboard_get_selected_button'] = makeInvalidEarlyAccess('_lv_keyboard_get_selected_button');
var _lv_keyboard_get_button_text = Module['_lv_keyboard_get_button_text'] = makeInvalidEarlyAccess('_lv_keyboard_get_button_text');
var _lv_label_set_text_vfmt = Module['_lv_label_set_text_vfmt'] = makeInvalidEarlyAccess('_lv_label_set_text_vfmt');
var _lv_label_get_letter_on = Module['_lv_label_get_letter_on'] = makeInvalidEarlyAccess('_lv_label_get_letter_on');
var _lv_label_set_text_selection_start = Module['_lv_label_set_text_selection_start'] = makeInvalidEarlyAccess('_lv_label_set_text_selection_start');
var _lv_label_set_text_selection_end = Module['_lv_label_set_text_selection_end'] = makeInvalidEarlyAccess('_lv_label_set_text_selection_end');
var _lv_label_set_recolor = Module['_lv_label_set_recolor'] = makeInvalidEarlyAccess('_lv_label_set_recolor');
var _lv_label_get_long_mode = Module['_lv_label_get_long_mode'] = makeInvalidEarlyAccess('_lv_label_get_long_mode');
var _lv_label_get_letter_pos = Module['_lv_label_get_letter_pos'] = makeInvalidEarlyAccess('_lv_label_get_letter_pos');
var _lv_label_is_char_under_pos = Module['_lv_label_is_char_under_pos'] = makeInvalidEarlyAccess('_lv_label_is_char_under_pos');
var _lv_label_get_text_selection_start = Module['_lv_label_get_text_selection_start'] = makeInvalidEarlyAccess('_lv_label_get_text_selection_start');
var _lv_label_get_text_selection_end = Module['_lv_label_get_text_selection_end'] = makeInvalidEarlyAccess('_lv_label_get_text_selection_end');
var _lv_label_get_recolor = Module['_lv_label_get_recolor'] = makeInvalidEarlyAccess('_lv_label_get_recolor');
var _lv_label_bind_text = Module['_lv_label_bind_text'] = makeInvalidEarlyAccess('_lv_label_bind_text');
var _lv_label_ins_text = Module['_lv_label_ins_text'] = makeInvalidEarlyAccess('_lv_label_ins_text');
var _lv_label_cut_text = Module['_lv_label_cut_text'] = makeInvalidEarlyAccess('_lv_label_cut_text');
var _lv_led_on = Module['_lv_led_on'] = makeInvalidEarlyAccess('_lv_led_on');
var _lv_led_off = Module['_lv_led_off'] = makeInvalidEarlyAccess('_lv_led_off');
var _lv_led_toggle = Module['_lv_led_toggle'] = makeInvalidEarlyAccess('_lv_led_toggle');
var _lv_line_set_points_mutable = Module['_lv_line_set_points_mutable'] = makeInvalidEarlyAccess('_lv_line_set_points_mutable');
var _lv_line_get_points = Module['_lv_line_get_points'] = makeInvalidEarlyAccess('_lv_line_get_points');
var _lv_line_get_point_count = Module['_lv_line_get_point_count'] = makeInvalidEarlyAccess('_lv_line_get_point_count');
var _lv_line_is_point_array_mutable = Module['_lv_line_is_point_array_mutable'] = makeInvalidEarlyAccess('_lv_line_is_point_array_mutable');
var _lv_line_get_points_mutable = Module['_lv_line_get_points_mutable'] = makeInvalidEarlyAccess('_lv_line_get_points_mutable');
var _lv_line_get_y_invert = Module['_lv_line_get_y_invert'] = makeInvalidEarlyAccess('_lv_line_get_y_invert');
var _lv_list_add_text = Module['_lv_list_add_text'] = makeInvalidEarlyAccess('_lv_list_add_text');
var _lv_list_add_button = Module['_lv_list_add_button'] = makeInvalidEarlyAccess('_lv_list_add_button');
var _lv_list_get_button_text = Module['_lv_list_get_button_text'] = makeInvalidEarlyAccess('_lv_list_get_button_text');
var _lv_list_set_button_text = Module['_lv_list_set_button_text'] = makeInvalidEarlyAccess('_lv_list_set_button_text');
var _lv_menu_page_create = Module['_lv_menu_page_create'] = makeInvalidEarlyAccess('_lv_menu_page_create');
var _lv_menu_set_page_title = Module['_lv_menu_set_page_title'] = makeInvalidEarlyAccess('_lv_menu_set_page_title');
var _lv_menu_cont_create = Module['_lv_menu_cont_create'] = makeInvalidEarlyAccess('_lv_menu_cont_create');
var _lv_menu_section_create = Module['_lv_menu_section_create'] = makeInvalidEarlyAccess('_lv_menu_section_create');
var _lv_menu_separator_create = Module['_lv_menu_separator_create'] = makeInvalidEarlyAccess('_lv_menu_separator_create');
var _lv_menu_set_page = Module['_lv_menu_set_page'] = makeInvalidEarlyAccess('_lv_menu_set_page');
var _lv_menu_clear_history = Module['_lv_menu_clear_history'] = makeInvalidEarlyAccess('_lv_menu_clear_history');
var _lv_menu_set_sidebar_page = Module['_lv_menu_set_sidebar_page'] = makeInvalidEarlyAccess('_lv_menu_set_sidebar_page');
var _lv_menu_set_mode_header = Module['_lv_menu_set_mode_header'] = makeInvalidEarlyAccess('_lv_menu_set_mode_header');
var _lv_menu_set_mode_root_back_button = Module['_lv_menu_set_mode_root_back_button'] = makeInvalidEarlyAccess('_lv_menu_set_mode_root_back_button');
var _lv_menu_set_load_page_event = Module['_lv_menu_set_load_page_event'] = makeInvalidEarlyAccess('_lv_menu_set_load_page_event');
var _lv_menu_set_page_title_static = Module['_lv_menu_set_page_title_static'] = makeInvalidEarlyAccess('_lv_menu_set_page_title_static');
var _lv_menu_get_cur_main_page = Module['_lv_menu_get_cur_main_page'] = makeInvalidEarlyAccess('_lv_menu_get_cur_main_page');
var _lv_menu_get_cur_sidebar_page = Module['_lv_menu_get_cur_sidebar_page'] = makeInvalidEarlyAccess('_lv_menu_get_cur_sidebar_page');
var _lv_menu_get_main_header = Module['_lv_menu_get_main_header'] = makeInvalidEarlyAccess('_lv_menu_get_main_header');
var _lv_menu_get_main_header_back_button = Module['_lv_menu_get_main_header_back_button'] = makeInvalidEarlyAccess('_lv_menu_get_main_header_back_button');
var _lv_menu_get_sidebar_header = Module['_lv_menu_get_sidebar_header'] = makeInvalidEarlyAccess('_lv_menu_get_sidebar_header');
var _lv_menu_get_sidebar_header_back_button = Module['_lv_menu_get_sidebar_header_back_button'] = makeInvalidEarlyAccess('_lv_menu_get_sidebar_header_back_button');
var _lv_menu_back_button_is_root = Module['_lv_menu_back_button_is_root'] = makeInvalidEarlyAccess('_lv_menu_back_button_is_root');
var _lv_msgbox_add_title = Module['_lv_msgbox_add_title'] = makeInvalidEarlyAccess('_lv_msgbox_add_title');
var _lv_msgbox_add_header_button = Module['_lv_msgbox_add_header_button'] = makeInvalidEarlyAccess('_lv_msgbox_add_header_button');
var _lv_msgbox_add_text = Module['_lv_msgbox_add_text'] = makeInvalidEarlyAccess('_lv_msgbox_add_text');
var _lv_msgbox_add_footer_button = Module['_lv_msgbox_add_footer_button'] = makeInvalidEarlyAccess('_lv_msgbox_add_footer_button');
var _lv_msgbox_add_close_button = Module['_lv_msgbox_add_close_button'] = makeInvalidEarlyAccess('_lv_msgbox_add_close_button');
var _lv_msgbox_get_header = Module['_lv_msgbox_get_header'] = makeInvalidEarlyAccess('_lv_msgbox_get_header');
var _lv_msgbox_get_footer = Module['_lv_msgbox_get_footer'] = makeInvalidEarlyAccess('_lv_msgbox_get_footer');
var _lv_msgbox_get_content = Module['_lv_msgbox_get_content'] = makeInvalidEarlyAccess('_lv_msgbox_get_content');
var _lv_msgbox_get_title = Module['_lv_msgbox_get_title'] = makeInvalidEarlyAccess('_lv_msgbox_get_title');
var _lv_msgbox_close = Module['_lv_msgbox_close'] = makeInvalidEarlyAccess('_lv_msgbox_close');
var _lv_msgbox_close_async = Module['_lv_msgbox_close_async'] = makeInvalidEarlyAccess('_lv_msgbox_close_async');
var _lv_roller_set_selected_str = Module['_lv_roller_set_selected_str'] = makeInvalidEarlyAccess('_lv_roller_set_selected_str');
var _lv_roller_set_visible_row_count = Module['_lv_roller_set_visible_row_count'] = makeInvalidEarlyAccess('_lv_roller_set_visible_row_count');
var _lv_roller_get_selected_str = Module['_lv_roller_get_selected_str'] = makeInvalidEarlyAccess('_lv_roller_get_selected_str');
var _lv_roller_get_option_str = Module['_lv_roller_get_option_str'] = makeInvalidEarlyAccess('_lv_roller_get_option_str');
var _lv_roller_bind_value = Module['_lv_roller_bind_value'] = makeInvalidEarlyAccess('_lv_roller_bind_value');
var _lv_scale_set_min_value = Module['_lv_scale_set_min_value'] = makeInvalidEarlyAccess('_lv_scale_set_min_value');
var _lv_scale_set_max_value = Module['_lv_scale_set_max_value'] = makeInvalidEarlyAccess('_lv_scale_set_max_value');
var _lv_scale_set_angle_range = Module['_lv_scale_set_angle_range'] = makeInvalidEarlyAccess('_lv_scale_set_angle_range');
var _lv_scale_set_rotation = Module['_lv_scale_set_rotation'] = makeInvalidEarlyAccess('_lv_scale_set_rotation');
var _lv_scale_set_line_needle_value = Module['_lv_scale_set_line_needle_value'] = makeInvalidEarlyAccess('_lv_scale_set_line_needle_value');
var _lv_scale_set_image_needle_value = Module['_lv_scale_set_image_needle_value'] = makeInvalidEarlyAccess('_lv_scale_set_image_needle_value');
var _lv_scale_set_text_src = Module['_lv_scale_set_text_src'] = makeInvalidEarlyAccess('_lv_scale_set_text_src');
var _lv_scale_set_post_draw = Module['_lv_scale_set_post_draw'] = makeInvalidEarlyAccess('_lv_scale_set_post_draw');
var _lv_scale_set_draw_ticks_on_top = Module['_lv_scale_set_draw_ticks_on_top'] = makeInvalidEarlyAccess('_lv_scale_set_draw_ticks_on_top');
var _lv_scale_add_section = Module['_lv_scale_add_section'] = makeInvalidEarlyAccess('_lv_scale_add_section');
var _lv_scale_set_section_range = Module['_lv_scale_set_section_range'] = makeInvalidEarlyAccess('_lv_scale_set_section_range');
var _lv_scale_set_section_min_value = Module['_lv_scale_set_section_min_value'] = makeInvalidEarlyAccess('_lv_scale_set_section_min_value');
var _lv_scale_set_section_max_value = Module['_lv_scale_set_section_max_value'] = makeInvalidEarlyAccess('_lv_scale_set_section_max_value');
var _lv_scale_section_set_range = Module['_lv_scale_section_set_range'] = makeInvalidEarlyAccess('_lv_scale_section_set_range');
var _lv_scale_set_section_style_main = Module['_lv_scale_set_section_style_main'] = makeInvalidEarlyAccess('_lv_scale_set_section_style_main');
var _lv_scale_set_section_style_indicator = Module['_lv_scale_set_section_style_indicator'] = makeInvalidEarlyAccess('_lv_scale_set_section_style_indicator');
var _lv_scale_set_section_style_items = Module['_lv_scale_set_section_style_items'] = makeInvalidEarlyAccess('_lv_scale_set_section_style_items');
var _lv_scale_section_set_style = Module['_lv_scale_section_set_style'] = makeInvalidEarlyAccess('_lv_scale_section_set_style');
var _lv_scale_get_mode = Module['_lv_scale_get_mode'] = makeInvalidEarlyAccess('_lv_scale_get_mode');
var _lv_scale_get_total_tick_count = Module['_lv_scale_get_total_tick_count'] = makeInvalidEarlyAccess('_lv_scale_get_total_tick_count');
var _lv_scale_get_major_tick_every = Module['_lv_scale_get_major_tick_every'] = makeInvalidEarlyAccess('_lv_scale_get_major_tick_every');
var _lv_scale_get_rotation = Module['_lv_scale_get_rotation'] = makeInvalidEarlyAccess('_lv_scale_get_rotation');
var _lv_scale_get_label_show = Module['_lv_scale_get_label_show'] = makeInvalidEarlyAccess('_lv_scale_get_label_show');
var _lv_scale_get_angle_range = Module['_lv_scale_get_angle_range'] = makeInvalidEarlyAccess('_lv_scale_get_angle_range');
var _lv_scale_get_range_min_value = Module['_lv_scale_get_range_min_value'] = makeInvalidEarlyAccess('_lv_scale_get_range_min_value');
var _lv_scale_get_range_max_value = Module['_lv_scale_get_range_max_value'] = makeInvalidEarlyAccess('_lv_scale_get_range_max_value');
var _lv_scale_bind_section_min_value = Module['_lv_scale_bind_section_min_value'] = makeInvalidEarlyAccess('_lv_scale_bind_section_min_value');
var _lv_scale_bind_section_max_value = Module['_lv_scale_bind_section_max_value'] = makeInvalidEarlyAccess('_lv_scale_bind_section_max_value');
var _lv_slider_is_dragged = Module['_lv_slider_is_dragged'] = makeInvalidEarlyAccess('_lv_slider_is_dragged');
var _lv_slider_set_min_value = Module['_lv_slider_set_min_value'] = makeInvalidEarlyAccess('_lv_slider_set_min_value');
var _lv_slider_set_max_value = Module['_lv_slider_set_max_value'] = makeInvalidEarlyAccess('_lv_slider_set_max_value');
var _lv_slider_set_orientation = Module['_lv_slider_set_orientation'] = makeInvalidEarlyAccess('_lv_slider_set_orientation');
var _lv_slider_get_value = Module['_lv_slider_get_value'] = makeInvalidEarlyAccess('_lv_slider_get_value');
var _lv_slider_get_mode = Module['_lv_slider_get_mode'] = makeInvalidEarlyAccess('_lv_slider_get_mode');
var _lv_slider_get_orientation = Module['_lv_slider_get_orientation'] = makeInvalidEarlyAccess('_lv_slider_get_orientation');
var _lv_slider_is_symmetrical = Module['_lv_slider_is_symmetrical'] = makeInvalidEarlyAccess('_lv_slider_is_symmetrical');
var _lv_slider_bind_value = Module['_lv_slider_bind_value'] = makeInvalidEarlyAccess('_lv_slider_bind_value');
var _lv_spangroup_get_expand_height = Module['_lv_spangroup_get_expand_height'] = makeInvalidEarlyAccess('_lv_spangroup_get_expand_height');
var _lv_spangroup_get_expand_width = Module['_lv_spangroup_get_expand_width'] = makeInvalidEarlyAccess('_lv_spangroup_get_expand_width');
var _lv_spangroup_get_max_line_height = Module['_lv_spangroup_get_max_line_height'] = makeInvalidEarlyAccess('_lv_spangroup_get_max_line_height');
var _lv_spangroup_add_span = Module['_lv_spangroup_add_span'] = makeInvalidEarlyAccess('_lv_spangroup_add_span');
var _lv_spangroup_refresh = Module['_lv_spangroup_refresh'] = makeInvalidEarlyAccess('_lv_spangroup_refresh');
var _lv_spangroup_delete_span = Module['_lv_spangroup_delete_span'] = makeInvalidEarlyAccess('_lv_spangroup_delete_span');
var _lv_span_set_text = Module['_lv_span_set_text'] = makeInvalidEarlyAccess('_lv_span_set_text');
var _lv_span_set_text_fmt = Module['_lv_span_set_text_fmt'] = makeInvalidEarlyAccess('_lv_span_set_text_fmt');
var _lv_spangroup_set_span_text = Module['_lv_spangroup_set_span_text'] = makeInvalidEarlyAccess('_lv_spangroup_set_span_text');
var _lv_span_set_text_static = Module['_lv_span_set_text_static'] = makeInvalidEarlyAccess('_lv_span_set_text_static');
var _lv_spangroup_set_span_text_static = Module['_lv_spangroup_set_span_text_static'] = makeInvalidEarlyAccess('_lv_spangroup_set_span_text_static');
var _lv_spangroup_set_span_text_fmt = Module['_lv_spangroup_set_span_text_fmt'] = makeInvalidEarlyAccess('_lv_spangroup_set_span_text_fmt');
var _lv_spangroup_set_span_style = Module['_lv_spangroup_set_span_style'] = makeInvalidEarlyAccess('_lv_spangroup_set_span_style');
var _lv_spangroup_set_align = Module['_lv_spangroup_set_align'] = makeInvalidEarlyAccess('_lv_spangroup_set_align');
var _lv_spangroup_set_overflow = Module['_lv_spangroup_set_overflow'] = makeInvalidEarlyAccess('_lv_spangroup_set_overflow');
var _lv_spangroup_set_indent = Module['_lv_spangroup_set_indent'] = makeInvalidEarlyAccess('_lv_spangroup_set_indent');
var _lv_spangroup_set_mode = Module['_lv_spangroup_set_mode'] = makeInvalidEarlyAccess('_lv_spangroup_set_mode');
var _lv_spangroup_set_max_lines = Module['_lv_spangroup_set_max_lines'] = makeInvalidEarlyAccess('_lv_spangroup_set_max_lines');
var _lv_span_get_style = Module['_lv_span_get_style'] = makeInvalidEarlyAccess('_lv_span_get_style');
var _lv_span_get_text = Module['_lv_span_get_text'] = makeInvalidEarlyAccess('_lv_span_get_text');
var _lv_spangroup_get_child = Module['_lv_spangroup_get_child'] = makeInvalidEarlyAccess('_lv_spangroup_get_child');
var _lv_spangroup_get_span_count = Module['_lv_spangroup_get_span_count'] = makeInvalidEarlyAccess('_lv_spangroup_get_span_count');
var _lv_spangroup_get_align = Module['_lv_spangroup_get_align'] = makeInvalidEarlyAccess('_lv_spangroup_get_align');
var _lv_spangroup_get_overflow = Module['_lv_spangroup_get_overflow'] = makeInvalidEarlyAccess('_lv_spangroup_get_overflow');
var _lv_spangroup_get_indent = Module['_lv_spangroup_get_indent'] = makeInvalidEarlyAccess('_lv_spangroup_get_indent');
var _lv_spangroup_get_mode = Module['_lv_spangroup_get_mode'] = makeInvalidEarlyAccess('_lv_spangroup_get_mode');
var _lv_spangroup_get_max_lines = Module['_lv_spangroup_get_max_lines'] = makeInvalidEarlyAccess('_lv_spangroup_get_max_lines');
var _lv_spangroup_get_span_coords = Module['_lv_spangroup_get_span_coords'] = makeInvalidEarlyAccess('_lv_spangroup_get_span_coords');
var _lv_spangroup_get_span_by_point = Module['_lv_spangroup_get_span_by_point'] = makeInvalidEarlyAccess('_lv_spangroup_get_span_by_point');
var _lv_spangroup_bind_span_text = Module['_lv_spangroup_bind_span_text'] = makeInvalidEarlyAccess('_lv_spangroup_bind_span_text');
var _lv_textarea_set_cursor_click_pos = Module['_lv_textarea_set_cursor_click_pos'] = makeInvalidEarlyAccess('_lv_textarea_set_cursor_click_pos');
var _lv_spinbox_step_next = Module['_lv_spinbox_step_next'] = makeInvalidEarlyAccess('_lv_spinbox_step_next');
var _lv_spinbox_step_prev = Module['_lv_spinbox_step_prev'] = makeInvalidEarlyAccess('_lv_spinbox_step_prev');
var _lv_spinbox_increment = Module['_lv_spinbox_increment'] = makeInvalidEarlyAccess('_lv_spinbox_increment');
var _lv_spinbox_decrement = Module['_lv_spinbox_decrement'] = makeInvalidEarlyAccess('_lv_spinbox_decrement');
var _lv_spinbox_set_digit_count = Module['_lv_spinbox_set_digit_count'] = makeInvalidEarlyAccess('_lv_spinbox_set_digit_count');
var _lv_spinbox_set_dec_point_pos = Module['_lv_spinbox_set_dec_point_pos'] = makeInvalidEarlyAccess('_lv_spinbox_set_dec_point_pos');
var _lv_spinbox_set_min_value = Module['_lv_spinbox_set_min_value'] = makeInvalidEarlyAccess('_lv_spinbox_set_min_value');
var _lv_spinbox_set_max_value = Module['_lv_spinbox_set_max_value'] = makeInvalidEarlyAccess('_lv_spinbox_set_max_value');
var _lv_spinbox_set_cursor_pos = Module['_lv_spinbox_set_cursor_pos'] = makeInvalidEarlyAccess('_lv_spinbox_set_cursor_pos');
var _lv_spinbox_set_digit_step_direction = Module['_lv_spinbox_set_digit_step_direction'] = makeInvalidEarlyAccess('_lv_spinbox_set_digit_step_direction');
var _lv_spinbox_get_rollover = Module['_lv_spinbox_get_rollover'] = makeInvalidEarlyAccess('_lv_spinbox_get_rollover');
var _lv_spinbox_bind_value = Module['_lv_spinbox_bind_value'] = makeInvalidEarlyAccess('_lv_spinbox_bind_value');
var _lv_switch_set_orientation = Module['_lv_switch_set_orientation'] = makeInvalidEarlyAccess('_lv_switch_set_orientation');
var _lv_switch_get_orientation = Module['_lv_switch_get_orientation'] = makeInvalidEarlyAccess('_lv_switch_get_orientation');
var _lv_table_set_cell_value = Module['_lv_table_set_cell_value'] = makeInvalidEarlyAccess('_lv_table_set_cell_value');
var _lv_table_set_column_count = Module['_lv_table_set_column_count'] = makeInvalidEarlyAccess('_lv_table_set_column_count');
var _lv_table_set_row_count = Module['_lv_table_set_row_count'] = makeInvalidEarlyAccess('_lv_table_set_row_count');
var _lv_table_set_cell_value_fmt = Module['_lv_table_set_cell_value_fmt'] = makeInvalidEarlyAccess('_lv_table_set_cell_value_fmt');
var _lv_table_set_column_width = Module['_lv_table_set_column_width'] = makeInvalidEarlyAccess('_lv_table_set_column_width');
var _lv_table_set_cell_ctrl = Module['_lv_table_set_cell_ctrl'] = makeInvalidEarlyAccess('_lv_table_set_cell_ctrl');
var _lv_table_clear_cell_ctrl = Module['_lv_table_clear_cell_ctrl'] = makeInvalidEarlyAccess('_lv_table_clear_cell_ctrl');
var _lv_table_set_cell_user_data = Module['_lv_table_set_cell_user_data'] = makeInvalidEarlyAccess('_lv_table_set_cell_user_data');
var _lv_table_set_selected_cell = Module['_lv_table_set_selected_cell'] = makeInvalidEarlyAccess('_lv_table_set_selected_cell');
var _lv_table_get_cell_value = Module['_lv_table_get_cell_value'] = makeInvalidEarlyAccess('_lv_table_get_cell_value');
var _lv_table_get_row_count = Module['_lv_table_get_row_count'] = makeInvalidEarlyAccess('_lv_table_get_row_count');
var _lv_table_get_column_count = Module['_lv_table_get_column_count'] = makeInvalidEarlyAccess('_lv_table_get_column_count');
var _lv_table_get_column_width = Module['_lv_table_get_column_width'] = makeInvalidEarlyAccess('_lv_table_get_column_width');
var _lv_table_has_cell_ctrl = Module['_lv_table_has_cell_ctrl'] = makeInvalidEarlyAccess('_lv_table_has_cell_ctrl');
var _lv_table_get_selected_cell = Module['_lv_table_get_selected_cell'] = makeInvalidEarlyAccess('_lv_table_get_selected_cell');
var _lv_table_get_cell_user_data = Module['_lv_table_get_cell_user_data'] = makeInvalidEarlyAccess('_lv_table_get_cell_user_data');
var _lv_tabview_get_content = Module['_lv_tabview_get_content'] = makeInvalidEarlyAccess('_lv_tabview_get_content');
var _lv_tabview_rename_tab = Module['_lv_tabview_rename_tab'] = makeInvalidEarlyAccess('_lv_tabview_rename_tab');
var _lv_tabview_get_tab_count = Module['_lv_tabview_get_tab_count'] = makeInvalidEarlyAccess('_lv_tabview_get_tab_count');
var _lv_tabview_get_tab_active = Module['_lv_tabview_get_tab_active'] = makeInvalidEarlyAccess('_lv_tabview_get_tab_active');
var _lv_tabview_get_tab_button = Module['_lv_tabview_get_tab_button'] = makeInvalidEarlyAccess('_lv_tabview_get_tab_button');
var _lv_textarea_cursor_up = Module['_lv_textarea_cursor_up'] = makeInvalidEarlyAccess('_lv_textarea_cursor_up');
var _lv_textarea_cursor_down = Module['_lv_textarea_cursor_down'] = makeInvalidEarlyAccess('_lv_textarea_cursor_down');
var _lv_textarea_delete_char_forward = Module['_lv_textarea_delete_char_forward'] = makeInvalidEarlyAccess('_lv_textarea_delete_char_forward');
var _lv_textarea_clear_selection = Module['_lv_textarea_clear_selection'] = makeInvalidEarlyAccess('_lv_textarea_clear_selection');
var _lv_textarea_get_accepted_chars = Module['_lv_textarea_get_accepted_chars'] = makeInvalidEarlyAccess('_lv_textarea_get_accepted_chars');
var _lv_textarea_set_password_bullet = Module['_lv_textarea_set_password_bullet'] = makeInvalidEarlyAccess('_lv_textarea_set_password_bullet');
var _lv_textarea_set_insert_replace = Module['_lv_textarea_set_insert_replace'] = makeInvalidEarlyAccess('_lv_textarea_set_insert_replace');
var _lv_textarea_set_text_selection = Module['_lv_textarea_set_text_selection'] = makeInvalidEarlyAccess('_lv_textarea_set_text_selection');
var _lv_textarea_set_password_show_time = Module['_lv_textarea_set_password_show_time'] = makeInvalidEarlyAccess('_lv_textarea_set_password_show_time');
var _lv_textarea_set_align = Module['_lv_textarea_set_align'] = makeInvalidEarlyAccess('_lv_textarea_set_align');
var _lv_textarea_get_label = Module['_lv_textarea_get_label'] = makeInvalidEarlyAccess('_lv_textarea_get_label');
var _lv_textarea_get_placeholder_text = Module['_lv_textarea_get_placeholder_text'] = makeInvalidEarlyAccess('_lv_textarea_get_placeholder_text');
var _lv_textarea_get_cursor_click_pos = Module['_lv_textarea_get_cursor_click_pos'] = makeInvalidEarlyAccess('_lv_textarea_get_cursor_click_pos');
var _lv_textarea_get_password_mode = Module['_lv_textarea_get_password_mode'] = makeInvalidEarlyAccess('_lv_textarea_get_password_mode');
var _lv_textarea_get_password_bullet = Module['_lv_textarea_get_password_bullet'] = makeInvalidEarlyAccess('_lv_textarea_get_password_bullet');
var _lv_textarea_text_is_selected = Module['_lv_textarea_text_is_selected'] = makeInvalidEarlyAccess('_lv_textarea_text_is_selected');
var _lv_textarea_get_text_selection = Module['_lv_textarea_get_text_selection'] = makeInvalidEarlyAccess('_lv_textarea_get_text_selection');
var _lv_textarea_get_password_show_time = Module['_lv_textarea_get_password_show_time'] = makeInvalidEarlyAccess('_lv_textarea_get_password_show_time');
var _lv_textarea_get_current_char = Module['_lv_textarea_get_current_char'] = makeInvalidEarlyAccess('_lv_textarea_get_current_char');
var _lv_tileview_add_tile = Module['_lv_tileview_add_tile'] = makeInvalidEarlyAccess('_lv_tileview_add_tile');
var _lv_tileview_set_tile = Module['_lv_tileview_set_tile'] = makeInvalidEarlyAccess('_lv_tileview_set_tile');
var _lv_tileview_set_tile_by_index = Module['_lv_tileview_set_tile_by_index'] = makeInvalidEarlyAccess('_lv_tileview_set_tile_by_index');
var _lv_tileview_get_tile_active = Module['_lv_tileview_get_tile_active'] = makeInvalidEarlyAccess('_lv_tileview_get_tile_active');
var _lv_win_add_title = Module['_lv_win_add_title'] = makeInvalidEarlyAccess('_lv_win_add_title');
var _lv_win_get_header = Module['_lv_win_get_header'] = makeInvalidEarlyAccess('_lv_win_get_header');
var _lv_win_add_button = Module['_lv_win_add_button'] = makeInvalidEarlyAccess('_lv_win_add_button');
var _lv_win_get_content = Module['_lv_win_get_content'] = makeInvalidEarlyAccess('_lv_win_get_content');
var _onMqttEvent = Module['_onMqttEvent'] = makeInvalidEarlyAccess('_onMqttEvent');
var _eez_flow_init_themes = Module['_eez_flow_init_themes'] = makeInvalidEarlyAccess('_eez_flow_init_themes');
var _flowPropagateValueLVGLEvent = Module['_flowPropagateValueLVGLEvent'] = makeInvalidEarlyAccess('_flowPropagateValueLVGLEvent');
var __evalTextProperty = Module['__evalTextProperty'] = makeInvalidEarlyAccess('__evalTextProperty');
var __evalIntegerProperty = Module['__evalIntegerProperty'] = makeInvalidEarlyAccess('__evalIntegerProperty');
var __evalUnsignedIntegerProperty = Module['__evalUnsignedIntegerProperty'] = makeInvalidEarlyAccess('__evalUnsignedIntegerProperty');
var __evalBooleanProperty = Module['__evalBooleanProperty'] = makeInvalidEarlyAccess('__evalBooleanProperty');
var __evalStringArrayPropertyAndJoin = Module['__evalStringArrayPropertyAndJoin'] = makeInvalidEarlyAccess('__evalStringArrayPropertyAndJoin');
var __assignStringProperty = Module['__assignStringProperty'] = makeInvalidEarlyAccess('__assignStringProperty');
var __assignIntegerProperty = Module['__assignIntegerProperty'] = makeInvalidEarlyAccess('__assignIntegerProperty');
var __assignBooleanProperty = Module['__assignBooleanProperty'] = makeInvalidEarlyAccess('__assignBooleanProperty');
var _compareRollerOptions = Module['_compareRollerOptions'] = makeInvalidEarlyAccess('_compareRollerOptions');
var _emscripten_stack_get_end = makeInvalidEarlyAccess('_emscripten_stack_get_end');
var _emscripten_stack_get_base = makeInvalidEarlyAccess('_emscripten_stack_get_base');
var _emscripten_builtin_memalign = makeInvalidEarlyAccess('_emscripten_builtin_memalign');
var _strerror = makeInvalidEarlyAccess('_strerror');
var _setThrew = makeInvalidEarlyAccess('_setThrew');
var _emscripten_stack_init = makeInvalidEarlyAccess('_emscripten_stack_init');
var _emscripten_stack_get_free = makeInvalidEarlyAccess('_emscripten_stack_get_free');
var __emscripten_stack_restore = makeInvalidEarlyAccess('__emscripten_stack_restore');
var __emscripten_stack_alloc = makeInvalidEarlyAccess('__emscripten_stack_alloc');
var _emscripten_stack_get_current = makeInvalidEarlyAccess('_emscripten_stack_get_current');
var memory = makeInvalidEarlyAccess('memory');
var __indirect_function_table = makeInvalidEarlyAccess('__indirect_function_table');
var wasmMemory = makeInvalidEarlyAccess('wasmMemory');
var wasmTable = makeInvalidEarlyAccess('wasmTable');

function assignWasmExports(wasmExports) {
  assert(typeof wasmExports['lv_display_flush_ready'] != 'undefined', 'missing Wasm export: lv_display_flush_ready');
  assert(typeof wasmExports['lv_area_get_width'] != 'undefined', 'missing Wasm export: lv_area_get_width');
  assert(typeof wasmExports['lv_malloc'] != 'undefined', 'missing Wasm export: lv_malloc');
  assert(typeof wasmExports['lv_free'] != 'undefined', 'missing Wasm export: lv_free');
  assert(typeof wasmExports['lvglSetEncoderGroup'] != 'undefined', 'missing Wasm export: lvglSetEncoderGroup');
  assert(typeof wasmExports['lv_indev_set_group'] != 'undefined', 'missing Wasm export: lv_indev_set_group');
  assert(typeof wasmExports['lvglSetKeyboardGroup'] != 'undefined', 'missing Wasm export: lvglSetKeyboardGroup');
  assert(typeof wasmExports['hal_init'] != 'undefined', 'missing Wasm export: hal_init');
  assert(typeof wasmExports['malloc'] != 'undefined', 'missing Wasm export: malloc');
  assert(typeof wasmExports['lv_display_create'] != 'undefined', 'missing Wasm export: lv_display_create');
  assert(typeof wasmExports['lv_display_set_flush_cb'] != 'undefined', 'missing Wasm export: lv_display_set_flush_cb');
  assert(typeof wasmExports['lv_display_set_buffers'] != 'undefined', 'missing Wasm export: lv_display_set_buffers');
  assert(typeof wasmExports['lv_indev_create'] != 'undefined', 'missing Wasm export: lv_indev_create');
  assert(typeof wasmExports['lv_indev_set_type'] != 'undefined', 'missing Wasm export: lv_indev_set_type');
  assert(typeof wasmExports['lv_indev_set_read_cb'] != 'undefined', 'missing Wasm export: lv_indev_set_read_cb');
  assert(typeof wasmExports['lv_fs_drv_init'] != 'undefined', 'missing Wasm export: lv_fs_drv_init');
  assert(typeof wasmExports['lv_fs_drv_register'] != 'undefined', 'missing Wasm export: lv_fs_drv_register');
  assert(typeof wasmExports['init'] != 'undefined', 'missing Wasm export: init');
  assert(typeof wasmExports['lv_init'] != 'undefined', 'missing Wasm export: lv_init');
  assert(typeof wasmExports['lv_display_get_default'] != 'undefined', 'missing Wasm export: lv_display_get_default');
  assert(typeof wasmExports['lv_palette_main'] != 'undefined', 'missing Wasm export: lv_palette_main');
  assert(typeof wasmExports['lv_theme_default_init'] != 'undefined', 'missing Wasm export: lv_theme_default_init');
  assert(typeof wasmExports['lv_display_set_theme'] != 'undefined', 'missing Wasm export: lv_display_set_theme');
  assert(typeof wasmExports['mainLoop'] != 'undefined', 'missing Wasm export: mainLoop');
  assert(typeof wasmExports['lv_tick_inc'] != 'undefined', 'missing Wasm export: lv_tick_inc');
  assert(typeof wasmExports['lv_timer_handler'] != 'undefined', 'missing Wasm export: lv_timer_handler');
  assert(typeof wasmExports['getSyncedBuffer'] != 'undefined', 'missing Wasm export: getSyncedBuffer');
  assert(typeof wasmExports['isRTL'] != 'undefined', 'missing Wasm export: isRTL');
  assert(typeof wasmExports['onPointerEvent'] != 'undefined', 'missing Wasm export: onPointerEvent');
  assert(typeof wasmExports['onMouseWheelEvent'] != 'undefined', 'missing Wasm export: onMouseWheelEvent');
  assert(typeof wasmExports['onKeyPressed'] != 'undefined', 'missing Wasm export: onKeyPressed');
  assert(typeof wasmExports['lv_spinner_create'] != 'undefined', 'missing Wasm export: lv_spinner_create');
  assert(typeof wasmExports['lv_qrcode_create'] != 'undefined', 'missing Wasm export: lv_qrcode_create');
  assert(typeof wasmExports['lv_obj_has_flag'] != 'undefined', 'missing Wasm export: lv_obj_has_flag');
  assert(typeof wasmExports['lv_obj_delete'] != 'undefined', 'missing Wasm export: lv_obj_delete');
  assert(typeof wasmExports['getStudioSymbols'] != 'undefined', 'missing Wasm export: getStudioSymbols');
  assert(typeof wasmExports['lv_color_hex'] != 'undefined', 'missing Wasm export: lv_color_hex');
  assert(typeof wasmExports['lv_style_init'] != 'undefined', 'missing Wasm export: lv_style_init');
  assert(typeof wasmExports['lv_animimg_set_duration'] != 'undefined', 'missing Wasm export: lv_animimg_set_duration');
  assert(typeof wasmExports['lv_animimg_set_repeat_count'] != 'undefined', 'missing Wasm export: lv_animimg_set_repeat_count');
  assert(typeof wasmExports['lv_animimg_set_src'] != 'undefined', 'missing Wasm export: lv_animimg_set_src');
  assert(typeof wasmExports['lv_animimg_start'] != 'undefined', 'missing Wasm export: lv_animimg_start');
  assert(typeof wasmExports['lv_arc_set_bg_end_angle'] != 'undefined', 'missing Wasm export: lv_arc_set_bg_end_angle');
  assert(typeof wasmExports['lv_arc_set_bg_start_angle'] != 'undefined', 'missing Wasm export: lv_arc_set_bg_start_angle');
  assert(typeof wasmExports['lv_arc_set_mode'] != 'undefined', 'missing Wasm export: lv_arc_set_mode');
  assert(typeof wasmExports['lv_arc_set_range'] != 'undefined', 'missing Wasm export: lv_arc_set_range');
  assert(typeof wasmExports['lv_arc_set_rotation'] != 'undefined', 'missing Wasm export: lv_arc_set_rotation');
  assert(typeof wasmExports['lv_arc_set_value'] != 'undefined', 'missing Wasm export: lv_arc_set_value');
  assert(typeof wasmExports['lv_bar_set_mode'] != 'undefined', 'missing Wasm export: lv_bar_set_mode');
  assert(typeof wasmExports['lv_bar_set_range'] != 'undefined', 'missing Wasm export: lv_bar_set_range');
  assert(typeof wasmExports['lv_bar_set_start_value'] != 'undefined', 'missing Wasm export: lv_bar_set_start_value');
  assert(typeof wasmExports['lv_bar_set_value'] != 'undefined', 'missing Wasm export: lv_bar_set_value');
  assert(typeof wasmExports['lv_buttonmatrix_set_map'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_set_map');
  assert(typeof wasmExports['lv_buttonmatrix_set_ctrl_map'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_set_ctrl_map');
  assert(typeof wasmExports['lv_buttonmatrix_set_one_checked'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_set_one_checked');
  assert(typeof wasmExports['lv_dropdown_set_dir'] != 'undefined', 'missing Wasm export: lv_dropdown_set_dir');
  assert(typeof wasmExports['lv_dropdown_set_options'] != 'undefined', 'missing Wasm export: lv_dropdown_set_options');
  assert(typeof wasmExports['lv_dropdown_set_selected'] != 'undefined', 'missing Wasm export: lv_dropdown_set_selected');
  assert(typeof wasmExports['lv_dropdown_set_symbol'] != 'undefined', 'missing Wasm export: lv_dropdown_set_symbol');
  assert(typeof wasmExports['lv_event_get_code'] != 'undefined', 'missing Wasm export: lv_event_get_code');
  assert(typeof wasmExports['lv_event_get_user_data'] != 'undefined', 'missing Wasm export: lv_event_get_user_data');
  assert(typeof wasmExports['lv_label_set_text'] != 'undefined', 'missing Wasm export: lv_label_set_text');
  assert(typeof wasmExports['lv_label_set_long_mode'] != 'undefined', 'missing Wasm export: lv_label_set_long_mode');
  assert(typeof wasmExports['lv_color_to_32'] != 'undefined', 'missing Wasm export: lv_color_to_32');
  assert(typeof wasmExports['lv_led_set_brightness'] != 'undefined', 'missing Wasm export: lv_led_set_brightness');
  assert(typeof wasmExports['lv_led_get_brightness'] != 'undefined', 'missing Wasm export: lv_led_get_brightness');
  assert(typeof wasmExports['lv_led_set_color'] != 'undefined', 'missing Wasm export: lv_led_set_color');
  assert(typeof wasmExports['lv_obj_get_state'] != 'undefined', 'missing Wasm export: lv_obj_get_state');
  assert(typeof wasmExports['lv_obj_set_pos'] != 'undefined', 'missing Wasm export: lv_obj_set_pos');
  assert(typeof wasmExports['lv_obj_set_size'] != 'undefined', 'missing Wasm export: lv_obj_set_size');
  assert(typeof wasmExports['lv_obj_update_layout'] != 'undefined', 'missing Wasm export: lv_obj_update_layout');
  assert(typeof wasmExports['lv_qrcode_set_size'] != 'undefined', 'missing Wasm export: lv_qrcode_set_size');
  assert(typeof wasmExports['lv_spinbox_set_range'] != 'undefined', 'missing Wasm export: lv_spinbox_set_range');
  assert(typeof wasmExports['lv_spinbox_set_step'] != 'undefined', 'missing Wasm export: lv_spinbox_set_step');
  assert(typeof wasmExports['lv_spinbox_set_digit_format'] != 'undefined', 'missing Wasm export: lv_spinbox_set_digit_format');
  assert(typeof wasmExports['lv_spinbox_set_rollover'] != 'undefined', 'missing Wasm export: lv_spinbox_set_rollover');
  assert(typeof wasmExports['lv_spinbox_set_value'] != 'undefined', 'missing Wasm export: lv_spinbox_set_value');
  assert(typeof wasmExports['lv_tabview_set_tab_bar_size'] != 'undefined', 'missing Wasm export: lv_tabview_set_tab_bar_size');
  assert(typeof wasmExports['lv_textarea_set_one_line'] != 'undefined', 'missing Wasm export: lv_textarea_set_one_line');
  assert(typeof wasmExports['lv_textarea_set_password_mode'] != 'undefined', 'missing Wasm export: lv_textarea_set_password_mode');
  assert(typeof wasmExports['lv_textarea_set_placeholder_text'] != 'undefined', 'missing Wasm export: lv_textarea_set_placeholder_text');
  assert(typeof wasmExports['lv_textarea_set_accepted_chars'] != 'undefined', 'missing Wasm export: lv_textarea_set_accepted_chars');
  assert(typeof wasmExports['lv_textarea_set_max_length'] != 'undefined', 'missing Wasm export: lv_textarea_set_max_length');
  assert(typeof wasmExports['lv_textarea_set_text'] != 'undefined', 'missing Wasm export: lv_textarea_set_text');
  assert(typeof wasmExports['lv_roller_set_options'] != 'undefined', 'missing Wasm export: lv_roller_set_options');
  assert(typeof wasmExports['lv_roller_set_selected'] != 'undefined', 'missing Wasm export: lv_roller_set_selected');
  assert(typeof wasmExports['lv_roller_get_option_count'] != 'undefined', 'missing Wasm export: lv_roller_get_option_count');
  assert(typeof wasmExports['lv_slider_set_mode'] != 'undefined', 'missing Wasm export: lv_slider_set_mode');
  assert(typeof wasmExports['lv_slider_set_range'] != 'undefined', 'missing Wasm export: lv_slider_set_range');
  assert(typeof wasmExports['lv_slider_set_start_value'] != 'undefined', 'missing Wasm export: lv_slider_set_start_value');
  assert(typeof wasmExports['lv_slider_set_value'] != 'undefined', 'missing Wasm export: lv_slider_set_value');
  assert(typeof wasmExports['lv_arc_get_max_value'] != 'undefined', 'missing Wasm export: lv_arc_get_max_value');
  assert(typeof wasmExports['lv_arc_get_min_value'] != 'undefined', 'missing Wasm export: lv_arc_get_min_value');
  assert(typeof wasmExports['lv_arc_get_value'] != 'undefined', 'missing Wasm export: lv_arc_get_value');
  assert(typeof wasmExports['lv_bar_get_start_value'] != 'undefined', 'missing Wasm export: lv_bar_get_start_value');
  assert(typeof wasmExports['lv_bar_get_value'] != 'undefined', 'missing Wasm export: lv_bar_get_value');
  assert(typeof wasmExports['lv_dropdown_get_options'] != 'undefined', 'missing Wasm export: lv_dropdown_get_options');
  assert(typeof wasmExports['lv_dropdown_get_selected'] != 'undefined', 'missing Wasm export: lv_dropdown_get_selected');
  assert(typeof wasmExports['lv_event_get_draw_task'] != 'undefined', 'missing Wasm export: lv_event_get_draw_task');
  assert(typeof wasmExports['lv_label_get_text'] != 'undefined', 'missing Wasm export: lv_label_get_text');
  assert(typeof wasmExports['lv_roller_get_options'] != 'undefined', 'missing Wasm export: lv_roller_get_options');
  assert(typeof wasmExports['lv_roller_get_selected'] != 'undefined', 'missing Wasm export: lv_roller_get_selected');
  assert(typeof wasmExports['lv_slider_get_max_value'] != 'undefined', 'missing Wasm export: lv_slider_get_max_value');
  assert(typeof wasmExports['lv_slider_get_min_value'] != 'undefined', 'missing Wasm export: lv_slider_get_min_value');
  assert(typeof wasmExports['lv_slider_get_left_value'] != 'undefined', 'missing Wasm export: lv_slider_get_left_value');
  assert(typeof wasmExports['lv_spinbox_get_step'] != 'undefined', 'missing Wasm export: lv_spinbox_get_step');
  assert(typeof wasmExports['lv_spinbox_get_value'] != 'undefined', 'missing Wasm export: lv_spinbox_get_value');
  assert(typeof wasmExports['lv_textarea_get_max_length'] != 'undefined', 'missing Wasm export: lv_textarea_get_max_length');
  assert(typeof wasmExports['lv_textarea_get_text'] != 'undefined', 'missing Wasm export: lv_textarea_get_text');
  assert(typeof wasmExports['lv_obj_get_parent'] != 'undefined', 'missing Wasm export: lv_obj_get_parent');
  assert(typeof wasmExports['to_lvgl_color'] != 'undefined', 'missing Wasm export: to_lvgl_color');
  assert(typeof wasmExports['lv_obj_add_event_cb'] != 'undefined', 'missing Wasm export: lv_obj_add_event_cb');
  assert(typeof wasmExports['lv_obj_add_flag'] != 'undefined', 'missing Wasm export: lv_obj_add_flag');
  assert(typeof wasmExports['lv_obj_add_state'] != 'undefined', 'missing Wasm export: lv_obj_add_state');
  assert(typeof wasmExports['lv_obj_remove_flag'] != 'undefined', 'missing Wasm export: lv_obj_remove_flag');
  assert(typeof wasmExports['lv_obj_remove_state'] != 'undefined', 'missing Wasm export: lv_obj_remove_state');
  assert(typeof wasmExports['lv_obj_has_state'] != 'undefined', 'missing Wasm export: lv_obj_has_state');
  assert(typeof wasmExports['lv_obj_remove_style'] != 'undefined', 'missing Wasm export: lv_obj_remove_style');
  assert(typeof wasmExports['lv_obj_set_scroll_dir'] != 'undefined', 'missing Wasm export: lv_obj_set_scroll_dir');
  assert(typeof wasmExports['lv_obj_set_scroll_snap_x'] != 'undefined', 'missing Wasm export: lv_obj_set_scroll_snap_x');
  assert(typeof wasmExports['lv_obj_set_scroll_snap_y'] != 'undefined', 'missing Wasm export: lv_obj_set_scroll_snap_y');
  assert(typeof wasmExports['lv_obj_set_scrollbar_mode'] != 'undefined', 'missing Wasm export: lv_obj_set_scrollbar_mode');
  assert(typeof wasmExports['lv_event_get_target'] != 'undefined', 'missing Wasm export: lv_event_get_target');
  assert(typeof wasmExports['lv_buttonmatrix_create'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_create');
  assert(typeof wasmExports['lv_button_create'] != 'undefined', 'missing Wasm export: lv_button_create');
  assert(typeof wasmExports['lv_animimg_create'] != 'undefined', 'missing Wasm export: lv_animimg_create');
  assert(typeof wasmExports['lv_arc_create'] != 'undefined', 'missing Wasm export: lv_arc_create');
  assert(typeof wasmExports['lv_bar_create'] != 'undefined', 'missing Wasm export: lv_bar_create');
  assert(typeof wasmExports['lv_calendar_create'] != 'undefined', 'missing Wasm export: lv_calendar_create');
  assert(typeof wasmExports['lv_calendar_add_header_arrow'] != 'undefined', 'missing Wasm export: lv_calendar_add_header_arrow');
  assert(typeof wasmExports['lv_calendar_set_month_shown'] != 'undefined', 'missing Wasm export: lv_calendar_set_month_shown');
  assert(typeof wasmExports['lv_calendar_set_today_date'] != 'undefined', 'missing Wasm export: lv_calendar_set_today_date');
  assert(typeof wasmExports['lv_canvas_create'] != 'undefined', 'missing Wasm export: lv_canvas_create');
  assert(typeof wasmExports['lv_chart_create'] != 'undefined', 'missing Wasm export: lv_chart_create');
  assert(typeof wasmExports['lv_checkbox_create'] != 'undefined', 'missing Wasm export: lv_checkbox_create');
  assert(typeof wasmExports['lv_checkbox_set_text'] != 'undefined', 'missing Wasm export: lv_checkbox_set_text');
  assert(typeof wasmExports['lv_label_create'] != 'undefined', 'missing Wasm export: lv_label_create');
  assert(typeof wasmExports['lv_keyboard_create'] != 'undefined', 'missing Wasm export: lv_keyboard_create');
  assert(typeof wasmExports['lv_led_create'] != 'undefined', 'missing Wasm export: lv_led_create');
  assert(typeof wasmExports['lv_line_create'] != 'undefined', 'missing Wasm export: lv_line_create');
  assert(typeof wasmExports['lv_line_set_points'] != 'undefined', 'missing Wasm export: lv_line_set_points');
  assert(typeof wasmExports['lv_line_set_y_invert'] != 'undefined', 'missing Wasm export: lv_line_set_y_invert');
  assert(typeof wasmExports['lv_list_create'] != 'undefined', 'missing Wasm export: lv_list_create');
  assert(typeof wasmExports['lv_menu_create'] != 'undefined', 'missing Wasm export: lv_menu_create');
  assert(typeof wasmExports['lv_msgbox_create'] != 'undefined', 'missing Wasm export: lv_msgbox_create');
  assert(typeof wasmExports['lv_obj_create'] != 'undefined', 'missing Wasm export: lv_obj_create');
  assert(typeof wasmExports['lv_obj_add_style'] != 'undefined', 'missing Wasm export: lv_obj_add_style');
  assert(typeof wasmExports['lv_obj_get_style_prop'] != 'undefined', 'missing Wasm export: lv_obj_get_style_prop');
  assert(typeof wasmExports['lv_obj_set_local_style_prop'] != 'undefined', 'missing Wasm export: lv_obj_set_local_style_prop');
  assert(typeof wasmExports['lv_obj_set_style_bg_color'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_color');
  assert(typeof wasmExports['lv_obj_set_style_border_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_border_width');
  assert(typeof wasmExports['lv_spangroup_create'] != 'undefined', 'missing Wasm export: lv_spangroup_create');
  assert(typeof wasmExports['lv_table_create'] != 'undefined', 'missing Wasm export: lv_table_create');
  assert(typeof wasmExports['lv_tabview_create'] != 'undefined', 'missing Wasm export: lv_tabview_create');
  assert(typeof wasmExports['lv_tabview_set_active'] != 'undefined', 'missing Wasm export: lv_tabview_set_active');
  assert(typeof wasmExports['lv_tabview_set_tab_bar_position'] != 'undefined', 'missing Wasm export: lv_tabview_set_tab_bar_position');
  assert(typeof wasmExports['lv_tileview_create'] != 'undefined', 'missing Wasm export: lv_tileview_create');
  assert(typeof wasmExports['lv_win_create'] != 'undefined', 'missing Wasm export: lv_win_create');
  assert(typeof wasmExports['lv_dropdown_create'] != 'undefined', 'missing Wasm export: lv_dropdown_create');
  assert(typeof wasmExports['lv_image_create'] != 'undefined', 'missing Wasm export: lv_image_create');
  assert(typeof wasmExports['lv_image_set_inner_align'] != 'undefined', 'missing Wasm export: lv_image_set_inner_align');
  assert(typeof wasmExports['lv_image_set_pivot'] != 'undefined', 'missing Wasm export: lv_image_set_pivot');
  assert(typeof wasmExports['lv_image_set_rotation'] != 'undefined', 'missing Wasm export: lv_image_set_rotation');
  assert(typeof wasmExports['lv_image_set_scale'] != 'undefined', 'missing Wasm export: lv_image_set_scale');
  assert(typeof wasmExports['lv_image_set_src'] != 'undefined', 'missing Wasm export: lv_image_set_src');
  assert(typeof wasmExports['lv_imagebutton_create'] != 'undefined', 'missing Wasm export: lv_imagebutton_create');
  assert(typeof wasmExports['lv_imagebutton_set_src'] != 'undefined', 'missing Wasm export: lv_imagebutton_set_src');
  assert(typeof wasmExports['lv_keyboard_set_mode'] != 'undefined', 'missing Wasm export: lv_keyboard_set_mode');
  assert(typeof wasmExports['lv_keyboard_set_textarea'] != 'undefined', 'missing Wasm export: lv_keyboard_set_textarea');
  assert(typeof wasmExports['lv_qrcode_set_dark_color'] != 'undefined', 'missing Wasm export: lv_qrcode_set_dark_color');
  assert(typeof wasmExports['lv_qrcode_set_light_color'] != 'undefined', 'missing Wasm export: lv_qrcode_set_light_color');
  assert(typeof wasmExports['lv_qrcode_update'] != 'undefined', 'missing Wasm export: lv_qrcode_update');
  assert(typeof wasmExports['lv_roller_create'] != 'undefined', 'missing Wasm export: lv_roller_create');
  assert(typeof wasmExports['lv_scale_create'] != 'undefined', 'missing Wasm export: lv_scale_create');
  assert(typeof wasmExports['lv_scale_set_label_show'] != 'undefined', 'missing Wasm export: lv_scale_set_label_show');
  assert(typeof wasmExports['lv_scale_set_major_tick_every'] != 'undefined', 'missing Wasm export: lv_scale_set_major_tick_every');
  assert(typeof wasmExports['lv_scale_set_mode'] != 'undefined', 'missing Wasm export: lv_scale_set_mode');
  assert(typeof wasmExports['lv_scale_set_range'] != 'undefined', 'missing Wasm export: lv_scale_set_range');
  assert(typeof wasmExports['lv_scale_set_total_tick_count'] != 'undefined', 'missing Wasm export: lv_scale_set_total_tick_count');
  assert(typeof wasmExports['lv_slider_create'] != 'undefined', 'missing Wasm export: lv_slider_create');
  assert(typeof wasmExports['lv_spinbox_create'] != 'undefined', 'missing Wasm export: lv_spinbox_create');
  assert(typeof wasmExports['lv_spinner_set_anim_params'] != 'undefined', 'missing Wasm export: lv_spinner_set_anim_params');
  assert(typeof wasmExports['lv_dropdown_get_list'] != 'undefined', 'missing Wasm export: lv_dropdown_get_list');
  assert(typeof wasmExports['lv_tabview_add_tab'] != 'undefined', 'missing Wasm export: lv_tabview_add_tab');
  assert(typeof wasmExports['lv_switch_create'] != 'undefined', 'missing Wasm export: lv_switch_create');
  assert(typeof wasmExports['lv_textarea_create'] != 'undefined', 'missing Wasm export: lv_textarea_create');
  assert(typeof wasmExports['stopScript'] != 'undefined', 'missing Wasm export: stopScript');
  assert(typeof wasmExports['onMessageFromDebugger'] != 'undefined', 'missing Wasm export: onMessageFromDebugger');
  assert(typeof wasmExports['lvglGetFlowState'] != 'undefined', 'missing Wasm export: lvglGetFlowState');
  assert(typeof wasmExports['setDebuggerMessageSubsciptionFilter'] != 'undefined', 'missing Wasm export: setDebuggerMessageSubsciptionFilter');
  assert(typeof wasmExports['setObjectIndex'] != 'undefined', 'missing Wasm export: setObjectIndex');
  assert(typeof wasmExports['getLvglObjectFromIndex'] != 'undefined', 'missing Wasm export: getLvglObjectFromIndex');
  assert(typeof wasmExports['lv_group_remove_all_objs'] != 'undefined', 'missing Wasm export: lv_group_remove_all_objs');
  assert(typeof wasmExports['lv_group_add_obj'] != 'undefined', 'missing Wasm export: lv_group_add_obj');
  assert(typeof wasmExports['lvglCreateGroup'] != 'undefined', 'missing Wasm export: lvglCreateGroup');
  assert(typeof wasmExports['lv_group_create'] != 'undefined', 'missing Wasm export: lv_group_create');
  assert(typeof wasmExports['lvglAddScreenLoadedEventHandler'] != 'undefined', 'missing Wasm export: lvglAddScreenLoadedEventHandler');
  assert(typeof wasmExports['lvglGroupAddObject'] != 'undefined', 'missing Wasm export: lvglGroupAddObject');
  assert(typeof wasmExports['lvglGroupRemoveObjectsForScreen'] != 'undefined', 'missing Wasm export: lvglGroupRemoveObjectsForScreen');
  assert(typeof wasmExports['lvglAddEventHandler'] != 'undefined', 'missing Wasm export: lvglAddEventHandler');
  assert(typeof wasmExports['lvglSetEventUserData'] != 'undefined', 'missing Wasm export: lvglSetEventUserData');
  assert(typeof wasmExports['lvglCreateScreen'] != 'undefined', 'missing Wasm export: lvglCreateScreen');
  assert(typeof wasmExports['lvglCreateUserWidget'] != 'undefined', 'missing Wasm export: lvglCreateUserWidget');
  assert(typeof wasmExports['lvglScreenLoad'] != 'undefined', 'missing Wasm export: lvglScreenLoad');
  assert(typeof wasmExports['lv_screen_load_anim'] != 'undefined', 'missing Wasm export: lv_screen_load_anim');
  assert(typeof wasmExports['lvglDeleteObject'] != 'undefined', 'missing Wasm export: lvglDeleteObject');
  assert(typeof wasmExports['lv_screen_active'] != 'undefined', 'missing Wasm export: lv_screen_active');
  assert(typeof wasmExports['lv_screen_load'] != 'undefined', 'missing Wasm export: lv_screen_load');
  assert(typeof wasmExports['lvglDeleteObjectIndex'] != 'undefined', 'missing Wasm export: lvglDeleteObjectIndex');
  assert(typeof wasmExports['lvglDeletePageFlowState'] != 'undefined', 'missing Wasm export: lvglDeletePageFlowState');
  assert(typeof wasmExports['lvglObjGetStylePropColor'] != 'undefined', 'missing Wasm export: lvglObjGetStylePropColor');
  assert(typeof wasmExports['lvglObjGetStylePropNum'] != 'undefined', 'missing Wasm export: lvglObjGetStylePropNum');
  assert(typeof wasmExports['lvglObjSetLocalStylePropColor'] != 'undefined', 'missing Wasm export: lvglObjSetLocalStylePropColor');
  assert(typeof wasmExports['lvglObjSetLocalStylePropNum'] != 'undefined', 'missing Wasm export: lvglObjSetLocalStylePropNum');
  assert(typeof wasmExports['lvglObjSetLocalStylePropPtr'] != 'undefined', 'missing Wasm export: lvglObjSetLocalStylePropPtr');
  assert(typeof wasmExports['lvglGetBuiltinFontPtr'] != 'undefined', 'missing Wasm export: lvglGetBuiltinFontPtr');
  assert(typeof wasmExports['strcmp'] != 'undefined', 'missing Wasm export: strcmp');
  assert(typeof wasmExports['lvglObjGetStylePropBuiltInFont'] != 'undefined', 'missing Wasm export: lvglObjGetStylePropBuiltInFont');
  assert(typeof wasmExports['lvglObjGetStylePropFontAddr'] != 'undefined', 'missing Wasm export: lvglObjGetStylePropFontAddr');
  assert(typeof wasmExports['lvglObjSetLocalStylePropBuiltInFont'] != 'undefined', 'missing Wasm export: lvglObjSetLocalStylePropBuiltInFont');
  assert(typeof wasmExports['lvglSetObjStylePropBuiltInFont'] != 'undefined', 'missing Wasm export: lvglSetObjStylePropBuiltInFont');
  assert(typeof wasmExports['lv_style_set_prop'] != 'undefined', 'missing Wasm export: lv_style_set_prop');
  assert(typeof wasmExports['lvglSetObjStylePropPtr'] != 'undefined', 'missing Wasm export: lvglSetObjStylePropPtr');
  assert(typeof wasmExports['lvglStyleCreate'] != 'undefined', 'missing Wasm export: lvglStyleCreate');
  assert(typeof wasmExports['lvglStyleSetPropColor'] != 'undefined', 'missing Wasm export: lvglStyleSetPropColor');
  assert(typeof wasmExports['lvglSetStylePropBuiltInFont'] != 'undefined', 'missing Wasm export: lvglSetStylePropBuiltInFont');
  assert(typeof wasmExports['lvglSetStylePropPtr'] != 'undefined', 'missing Wasm export: lvglSetStylePropPtr');
  assert(typeof wasmExports['lvglSetStylePropNum'] != 'undefined', 'missing Wasm export: lvglSetStylePropNum');
  assert(typeof wasmExports['lvglStyleDelete'] != 'undefined', 'missing Wasm export: lvglStyleDelete');
  assert(typeof wasmExports['lvglObjAddStyle'] != 'undefined', 'missing Wasm export: lvglObjAddStyle');
  assert(typeof wasmExports['lvglObjRemoveStyle'] != 'undefined', 'missing Wasm export: lvglObjRemoveStyle');
  assert(typeof wasmExports['lvglGetObjRelX'] != 'undefined', 'missing Wasm export: lvglGetObjRelX');
  assert(typeof wasmExports['lvglGetObjRelY'] != 'undefined', 'missing Wasm export: lvglGetObjRelY');
  assert(typeof wasmExports['lvglGetObjWidth'] != 'undefined', 'missing Wasm export: lvglGetObjWidth');
  assert(typeof wasmExports['lv_obj_get_width'] != 'undefined', 'missing Wasm export: lv_obj_get_width');
  assert(typeof wasmExports['lvglGetObjHeight'] != 'undefined', 'missing Wasm export: lvglGetObjHeight');
  assert(typeof wasmExports['lv_obj_get_height'] != 'undefined', 'missing Wasm export: lv_obj_get_height');
  assert(typeof wasmExports['lvglLoadFont'] != 'undefined', 'missing Wasm export: lvglLoadFont');
  assert(typeof wasmExports['lv_binfont_create'] != 'undefined', 'missing Wasm export: lv_binfont_create');
  assert(typeof wasmExports['lvglFreeFont'] != 'undefined', 'missing Wasm export: lvglFreeFont');
  assert(typeof wasmExports['lv_binfont_destroy'] != 'undefined', 'missing Wasm export: lv_binfont_destroy');
  assert(typeof wasmExports['lvglLedGetColor'] != 'undefined', 'missing Wasm export: lvglLedGetColor');
  assert(typeof wasmExports['lv_color_to_u32'] != 'undefined', 'missing Wasm export: lv_color_to_u32');
  assert(typeof wasmExports['lvglMeterIndicatorNeedleLineSetColor'] != 'undefined', 'missing Wasm export: lvglMeterIndicatorNeedleLineSetColor');
  assert(typeof wasmExports['lvglMeterIndicatorScaleLinesSetColorStart'] != 'undefined', 'missing Wasm export: lvglMeterIndicatorScaleLinesSetColorStart');
  assert(typeof wasmExports['lvglMeterIndicatorScaleLinesSetColorEnd'] != 'undefined', 'missing Wasm export: lvglMeterIndicatorScaleLinesSetColorEnd');
  assert(typeof wasmExports['lvglMeterIndicatorArcSetColor'] != 'undefined', 'missing Wasm export: lvglMeterIndicatorArcSetColor');
  assert(typeof wasmExports['lvglMeterScaleSetMinorTickColor'] != 'undefined', 'missing Wasm export: lvglMeterScaleSetMinorTickColor');
  assert(typeof wasmExports['lvglMeterScaleSetMajorTickColor'] != 'undefined', 'missing Wasm export: lvglMeterScaleSetMajorTickColor');
  assert(typeof wasmExports['lvglGetIndicator_start_value'] != 'undefined', 'missing Wasm export: lvglGetIndicator_start_value');
  assert(typeof wasmExports['lvglGetIndicator_end_value'] != 'undefined', 'missing Wasm export: lvglGetIndicator_end_value');
  assert(typeof wasmExports['lvglAddTimelineKeyframe'] != 'undefined', 'missing Wasm export: lvglAddTimelineKeyframe');
  assert(typeof wasmExports['lvglSetTimelinePosition'] != 'undefined', 'missing Wasm export: lvglSetTimelinePosition');
  assert(typeof wasmExports['lvglClearTimeline'] != 'undefined', 'missing Wasm export: lvglClearTimeline');
  assert(typeof wasmExports['lvglLineSetPoints'] != 'undefined', 'missing Wasm export: lvglLineSetPoints');
  assert(typeof wasmExports['lvglScrollTo'] != 'undefined', 'missing Wasm export: lvglScrollTo');
  assert(typeof wasmExports['lv_obj_scroll_to'] != 'undefined', 'missing Wasm export: lv_obj_scroll_to');
  assert(typeof wasmExports['lvglGetScrollX'] != 'undefined', 'missing Wasm export: lvglGetScrollX');
  assert(typeof wasmExports['lv_obj_get_scroll_x'] != 'undefined', 'missing Wasm export: lv_obj_get_scroll_x');
  assert(typeof wasmExports['lvglGetScrollY'] != 'undefined', 'missing Wasm export: lvglGetScrollY');
  assert(typeof wasmExports['lv_obj_get_scroll_y'] != 'undefined', 'missing Wasm export: lv_obj_get_scroll_y');
  assert(typeof wasmExports['lvglObjInvalidate'] != 'undefined', 'missing Wasm export: lvglObjInvalidate');
  assert(typeof wasmExports['lv_obj_invalidate'] != 'undefined', 'missing Wasm export: lv_obj_invalidate');
  assert(typeof wasmExports['lvglDeleteScreenOnUnload'] != 'undefined', 'missing Wasm export: lvglDeleteScreenOnUnload');
  assert(typeof wasmExports['lvglGetTabName'] != 'undefined', 'missing Wasm export: lvglGetTabName');
  assert(typeof wasmExports['lv_tabview_get_tab_bar'] != 'undefined', 'missing Wasm export: lv_tabview_get_tab_bar');
  assert(typeof wasmExports['lv_obj_get_child_by_type'] != 'undefined', 'missing Wasm export: lv_obj_get_child_by_type');
  assert(typeof wasmExports['lvglCreateFreeTypeFont'] != 'undefined', 'missing Wasm export: lvglCreateFreeTypeFont');
  assert(typeof wasmExports['lv_log_add'] != 'undefined', 'missing Wasm export: lv_log_add');
  assert(typeof wasmExports['lvglCreateAnim'] != 'undefined', 'missing Wasm export: lvglCreateAnim');
  assert(typeof wasmExports['lv_anim_init'] != 'undefined', 'missing Wasm export: lv_anim_init');
  assert(typeof wasmExports['lv_anim_set_delay'] != 'undefined', 'missing Wasm export: lv_anim_set_delay');
  assert(typeof wasmExports['lv_anim_set_repeat_delay'] != 'undefined', 'missing Wasm export: lv_anim_set_repeat_delay');
  assert(typeof wasmExports['lv_anim_set_repeat_count'] != 'undefined', 'missing Wasm export: lv_anim_set_repeat_count');
  assert(typeof wasmExports['lv_group_init'] != 'undefined', 'missing Wasm export: lv_group_init');
  assert(typeof wasmExports['lv_group_deinit'] != 'undefined', 'missing Wasm export: lv_group_deinit');
  assert(typeof wasmExports['lv_ll_init'] != 'undefined', 'missing Wasm export: lv_ll_init');
  assert(typeof wasmExports['lv_ll_clear'] != 'undefined', 'missing Wasm export: lv_ll_clear');
  assert(typeof wasmExports['lv_ll_ins_head'] != 'undefined', 'missing Wasm export: lv_ll_ins_head');
  assert(typeof wasmExports['lv_group_delete'] != 'undefined', 'missing Wasm export: lv_group_delete');
  assert(typeof wasmExports['lv_indev_get_next'] != 'undefined', 'missing Wasm export: lv_indev_get_next');
  assert(typeof wasmExports['lv_indev_get_type'] != 'undefined', 'missing Wasm export: lv_indev_get_type');
  assert(typeof wasmExports['lv_indev_get_group'] != 'undefined', 'missing Wasm export: lv_indev_get_group');
  assert(typeof wasmExports['lv_obj_send_event'] != 'undefined', 'missing Wasm export: lv_obj_send_event');
  assert(typeof wasmExports['lv_ll_get_head'] != 'undefined', 'missing Wasm export: lv_ll_get_head');
  assert(typeof wasmExports['lv_ll_get_next'] != 'undefined', 'missing Wasm export: lv_ll_get_next');
  assert(typeof wasmExports['lv_ll_remove'] != 'undefined', 'missing Wasm export: lv_ll_remove');
  assert(typeof wasmExports['lv_group_get_default'] != 'undefined', 'missing Wasm export: lv_group_get_default');
  assert(typeof wasmExports['lv_group_set_default'] != 'undefined', 'missing Wasm export: lv_group_set_default');
  assert(typeof wasmExports['lv_group_remove_obj'] != 'undefined', 'missing Wasm export: lv_group_remove_obj');
  assert(typeof wasmExports['lv_obj_allocate_spec_attr'] != 'undefined', 'missing Wasm export: lv_obj_allocate_spec_attr');
  assert(typeof wasmExports['lv_ll_ins_tail'] != 'undefined', 'missing Wasm export: lv_ll_ins_tail');
  assert(typeof wasmExports['lv_ll_get_tail'] != 'undefined', 'missing Wasm export: lv_ll_get_tail');
  assert(typeof wasmExports['lv_ll_get_prev'] != 'undefined', 'missing Wasm export: lv_ll_get_prev');
  assert(typeof wasmExports['lv_obj_get_group'] != 'undefined', 'missing Wasm export: lv_obj_get_group');
  assert(typeof wasmExports['lv_group_swap_obj'] != 'undefined', 'missing Wasm export: lv_group_swap_obj');
  assert(typeof wasmExports['lv_group_focus_obj'] != 'undefined', 'missing Wasm export: lv_group_focus_obj');
  assert(typeof wasmExports['lv_group_get_focused'] != 'undefined', 'missing Wasm export: lv_group_get_focused');
  assert(typeof wasmExports['lv_group_set_editing'] != 'undefined', 'missing Wasm export: lv_group_set_editing');
  assert(typeof wasmExports['lv_group_focus_next'] != 'undefined', 'missing Wasm export: lv_group_focus_next');
  assert(typeof wasmExports['lv_group_focus_prev'] != 'undefined', 'missing Wasm export: lv_group_focus_prev');
  assert(typeof wasmExports['lv_group_focus_freeze'] != 'undefined', 'missing Wasm export: lv_group_focus_freeze');
  assert(typeof wasmExports['lv_group_send_data'] != 'undefined', 'missing Wasm export: lv_group_send_data');
  assert(typeof wasmExports['lv_group_set_focus_cb'] != 'undefined', 'missing Wasm export: lv_group_set_focus_cb');
  assert(typeof wasmExports['lv_group_set_edge_cb'] != 'undefined', 'missing Wasm export: lv_group_set_edge_cb');
  assert(typeof wasmExports['lv_group_set_refocus_policy'] != 'undefined', 'missing Wasm export: lv_group_set_refocus_policy');
  assert(typeof wasmExports['lv_group_set_wrap'] != 'undefined', 'missing Wasm export: lv_group_set_wrap');
  assert(typeof wasmExports['lv_group_get_focus_cb'] != 'undefined', 'missing Wasm export: lv_group_get_focus_cb');
  assert(typeof wasmExports['lv_group_get_edge_cb'] != 'undefined', 'missing Wasm export: lv_group_get_edge_cb');
  assert(typeof wasmExports['lv_group_get_editing'] != 'undefined', 'missing Wasm export: lv_group_get_editing');
  assert(typeof wasmExports['lv_group_get_wrap'] != 'undefined', 'missing Wasm export: lv_group_get_wrap');
  assert(typeof wasmExports['lv_group_get_obj_count'] != 'undefined', 'missing Wasm export: lv_group_get_obj_count');
  assert(typeof wasmExports['lv_ll_get_len'] != 'undefined', 'missing Wasm export: lv_ll_get_len');
  assert(typeof wasmExports['lv_group_get_obj_by_index'] != 'undefined', 'missing Wasm export: lv_group_get_obj_by_index');
  assert(typeof wasmExports['lv_group_get_count'] != 'undefined', 'missing Wasm export: lv_group_get_count');
  assert(typeof wasmExports['lv_group_by_index'] != 'undefined', 'missing Wasm export: lv_group_by_index');
  assert(typeof wasmExports['lv_obj_get_scroll_left'] != 'undefined', 'missing Wasm export: lv_obj_get_scroll_left');
  assert(typeof wasmExports['lv_obj_get_scroll_top'] != 'undefined', 'missing Wasm export: lv_obj_get_scroll_top');
  assert(typeof wasmExports['lv_event_mark_deleted'] != 'undefined', 'missing Wasm export: lv_event_mark_deleted');
  assert(typeof wasmExports['lv_obj_enable_style_refresh'] != 'undefined', 'missing Wasm export: lv_obj_enable_style_refresh');
  assert(typeof wasmExports['lv_obj_remove_style_all'] != 'undefined', 'missing Wasm export: lv_obj_remove_style_all');
  assert(typeof wasmExports['lv_anim_delete'] != 'undefined', 'missing Wasm export: lv_anim_delete');
  assert(typeof wasmExports['lv_event_remove_all'] != 'undefined', 'missing Wasm export: lv_event_remove_all');
  assert(typeof wasmExports['lv_event_get_current_target'] != 'undefined', 'missing Wasm export: lv_event_get_current_target');
  assert(typeof wasmExports['lv_event_get_param'] != 'undefined', 'missing Wasm export: lv_event_get_param');
  assert(typeof wasmExports['lv_indev_get_scroll_obj'] != 'undefined', 'missing Wasm export: lv_indev_get_scroll_obj');
  assert(typeof wasmExports['lv_obj_get_child_count'] != 'undefined', 'missing Wasm export: lv_obj_get_child_count');
  assert(typeof wasmExports['lv_obj_mark_layout_as_dirty'] != 'undefined', 'missing Wasm export: lv_obj_mark_layout_as_dirty');
  assert(typeof wasmExports['lv_event_get_key'] != 'undefined', 'missing Wasm export: lv_event_get_key');
  assert(typeof wasmExports['lv_obj_is_editable'] != 'undefined', 'missing Wasm export: lv_obj_is_editable');
  assert(typeof wasmExports['lv_obj_get_scroll_right'] != 'undefined', 'missing Wasm export: lv_obj_get_scroll_right');
  assert(typeof wasmExports['lv_obj_scroll_to_y'] != 'undefined', 'missing Wasm export: lv_obj_scroll_to_y');
  assert(typeof wasmExports['lv_obj_get_scroll_dir'] != 'undefined', 'missing Wasm export: lv_obj_get_scroll_dir');
  assert(typeof wasmExports['lv_obj_scroll_to_x'] != 'undefined', 'missing Wasm export: lv_obj_scroll_to_x');
  assert(typeof wasmExports['lv_obj_scroll_to_view_recursive'] != 'undefined', 'missing Wasm export: lv_obj_scroll_to_view_recursive');
  assert(typeof wasmExports['lv_indev_active'] != 'undefined', 'missing Wasm export: lv_indev_active');
  assert(typeof wasmExports['lv_event_get_indev'] != 'undefined', 'missing Wasm export: lv_event_get_indev');
  assert(typeof wasmExports['lv_obj_get_scrollbar_mode'] != 'undefined', 'missing Wasm export: lv_obj_get_scrollbar_mode');
  assert(typeof wasmExports['lv_obj_get_scrollbar_area'] != 'undefined', 'missing Wasm export: lv_obj_get_scrollbar_area');
  assert(typeof wasmExports['lv_obj_invalidate_area'] != 'undefined', 'missing Wasm export: lv_obj_invalidate_area');
  assert(typeof wasmExports['lv_obj_calculate_ext_draw_size'] != 'undefined', 'missing Wasm export: lv_obj_calculate_ext_draw_size');
  assert(typeof wasmExports['lv_event_set_ext_draw_size'] != 'undefined', 'missing Wasm export: lv_event_set_ext_draw_size');
  assert(typeof wasmExports['lv_area_increase'] != 'undefined', 'missing Wasm export: lv_area_increase');
  assert(typeof wasmExports['lv_area_is_in'] != 'undefined', 'missing Wasm export: lv_area_is_in');
  assert(typeof wasmExports['lv_event_get_layer'] != 'undefined', 'missing Wasm export: lv_event_get_layer');
  assert(typeof wasmExports['lv_draw_rect_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_rect_dsc_init');
  assert(typeof wasmExports['lv_obj_init_draw_rect_dsc'] != 'undefined', 'missing Wasm export: lv_obj_init_draw_rect_dsc');
  assert(typeof wasmExports['lv_draw_rect'] != 'undefined', 'missing Wasm export: lv_draw_rect');
  assert(typeof wasmExports['lv_area_get_size'] != 'undefined', 'missing Wasm export: lv_area_get_size');
  assert(typeof wasmExports['lv_obj_get_style_opa_recursive'] != 'undefined', 'missing Wasm export: lv_obj_get_style_opa_recursive');
  assert(typeof wasmExports['lv_obj_class_create_obj'] != 'undefined', 'missing Wasm export: lv_obj_class_create_obj');
  assert(typeof wasmExports['lv_obj_class_init_obj'] != 'undefined', 'missing Wasm export: lv_obj_class_init_obj');
  assert(typeof wasmExports['lv_obj_is_layout_positioned'] != 'undefined', 'missing Wasm export: lv_obj_is_layout_positioned');
  assert(typeof wasmExports['lv_obj_has_flag_any'] != 'undefined', 'missing Wasm export: lv_obj_has_flag_any');
  assert(typeof wasmExports['lv_obj_set_flag'] != 'undefined', 'missing Wasm export: lv_obj_set_flag');
  assert(typeof wasmExports['lv_obj_get_child'] != 'undefined', 'missing Wasm export: lv_obj_get_child');
  assert(typeof wasmExports['lv_obj_style_state_compare'] != 'undefined', 'missing Wasm export: lv_obj_style_state_compare');
  assert(typeof wasmExports['lv_obj_update_layer_type'] != 'undefined', 'missing Wasm export: lv_obj_update_layer_type');
  assert(typeof wasmExports['lv_malloc_zeroed'] != 'undefined', 'missing Wasm export: lv_malloc_zeroed');
  assert(typeof wasmExports['lv_obj_style_create_transition'] != 'undefined', 'missing Wasm export: lv_obj_style_create_transition');
  assert(typeof wasmExports['lv_obj_refresh_style'] != 'undefined', 'missing Wasm export: lv_obj_refresh_style');
  assert(typeof wasmExports['lv_obj_refresh_ext_draw_size'] != 'undefined', 'missing Wasm export: lv_obj_refresh_ext_draw_size');
  assert(typeof wasmExports['lv_obj_set_state'] != 'undefined', 'missing Wasm export: lv_obj_set_state');
  assert(typeof wasmExports['lv_obj_check_type'] != 'undefined', 'missing Wasm export: lv_obj_check_type');
  assert(typeof wasmExports['lv_obj_has_class'] != 'undefined', 'missing Wasm export: lv_obj_has_class');
  assert(typeof wasmExports['lv_obj_get_class'] != 'undefined', 'missing Wasm export: lv_obj_get_class');
  assert(typeof wasmExports['lv_obj_is_valid'] != 'undefined', 'missing Wasm export: lv_obj_is_valid');
  assert(typeof wasmExports['lv_display_get_next'] != 'undefined', 'missing Wasm export: lv_display_get_next');
  assert(typeof wasmExports['lv_obj_null_on_delete'] != 'undefined', 'missing Wasm export: lv_obj_null_on_delete');
  assert(typeof wasmExports['lv_obj_add_screen_load_event'] != 'undefined', 'missing Wasm export: lv_obj_add_screen_load_event');
  assert(typeof wasmExports['lv_memset'] != 'undefined', 'missing Wasm export: lv_memset');
  assert(typeof wasmExports['lv_event_free_user_data_cb'] != 'undefined', 'missing Wasm export: lv_event_free_user_data_cb');
  assert(typeof wasmExports['lv_obj_add_screen_create_event'] != 'undefined', 'missing Wasm export: lv_obj_add_screen_create_event');
  assert(typeof wasmExports['lv_obj_add_play_timeline_event'] != 'undefined', 'missing Wasm export: lv_obj_add_play_timeline_event');
  assert(typeof wasmExports['lv_anim_timeline_get_progress'] != 'undefined', 'missing Wasm export: lv_anim_timeline_get_progress');
  assert(typeof wasmExports['lv_anim_timeline_set_progress'] != 'undefined', 'missing Wasm export: lv_anim_timeline_set_progress');
  assert(typeof wasmExports['lv_anim_timeline_set_delay'] != 'undefined', 'missing Wasm export: lv_anim_timeline_set_delay');
  assert(typeof wasmExports['lv_anim_timeline_set_reverse'] != 'undefined', 'missing Wasm export: lv_anim_timeline_set_reverse');
  assert(typeof wasmExports['lv_anim_timeline_start'] != 'undefined', 'missing Wasm export: lv_anim_timeline_start');
  assert(typeof wasmExports['lv_obj_set_user_data'] != 'undefined', 'missing Wasm export: lv_obj_set_user_data');
  assert(typeof wasmExports['lv_obj_get_user_data'] != 'undefined', 'missing Wasm export: lv_obj_get_user_data');
  assert(typeof wasmExports['lv_event_get_target_obj'] != 'undefined', 'missing Wasm export: lv_event_get_target_obj');
  assert(typeof wasmExports['lv_realloc'] != 'undefined', 'missing Wasm export: lv_realloc');
  assert(typeof wasmExports['lv_display_get_horizontal_resolution'] != 'undefined', 'missing Wasm export: lv_display_get_horizontal_resolution');
  assert(typeof wasmExports['lv_display_get_vertical_resolution'] != 'undefined', 'missing Wasm export: lv_display_get_vertical_resolution');
  assert(typeof wasmExports['lv_theme_apply'] != 'undefined', 'missing Wasm export: lv_theme_apply');
  assert(typeof wasmExports['lv_obj_refresh_self_size'] != 'undefined', 'missing Wasm export: lv_obj_refresh_self_size');
  assert(typeof wasmExports['lv_obj_is_group_def'] != 'undefined', 'missing Wasm export: lv_obj_is_group_def');
  assert(typeof wasmExports['lv_obj_destruct'] != 'undefined', 'missing Wasm export: lv_obj_destruct');
  assert(typeof wasmExports['lv_obj_style_apply_color_filter'] != 'undefined', 'missing Wasm export: lv_obj_style_apply_color_filter');
  assert(typeof wasmExports['lv_obj_style_apply_recolor'] != 'undefined', 'missing Wasm export: lv_obj_style_apply_recolor');
  assert(typeof wasmExports['lv_obj_get_style_recolor_recursive'] != 'undefined', 'missing Wasm export: lv_obj_get_style_recolor_recursive');
  assert(typeof wasmExports['lv_color_make'] != 'undefined', 'missing Wasm export: lv_color_make');
  assert(typeof wasmExports['lv_color_mix'] != 'undefined', 'missing Wasm export: lv_color_mix');
  assert(typeof wasmExports['lv_memcpy'] != 'undefined', 'missing Wasm export: lv_memcpy');
  assert(typeof wasmExports['lv_image_src_get_type'] != 'undefined', 'missing Wasm export: lv_image_src_get_type');
  assert(typeof wasmExports['lv_color_over32'] != 'undefined', 'missing Wasm export: lv_color_over32');
  assert(typeof wasmExports['lv_obj_init_draw_label_dsc'] != 'undefined', 'missing Wasm export: lv_obj_init_draw_label_dsc');
  assert(typeof wasmExports['lv_obj_init_draw_image_dsc'] != 'undefined', 'missing Wasm export: lv_obj_init_draw_image_dsc');
  assert(typeof wasmExports['lv_area_get_height'] != 'undefined', 'missing Wasm export: lv_area_get_height');
  assert(typeof wasmExports['lv_obj_init_draw_line_dsc'] != 'undefined', 'missing Wasm export: lv_obj_init_draw_line_dsc');
  assert(typeof wasmExports['lv_obj_init_draw_arc_dsc'] != 'undefined', 'missing Wasm export: lv_obj_init_draw_arc_dsc');
  assert(typeof wasmExports['lv_obj_get_ext_draw_size'] != 'undefined', 'missing Wasm export: lv_obj_get_ext_draw_size');
  assert(typeof wasmExports['lv_obj_get_layer_type'] != 'undefined', 'missing Wasm export: lv_obj_get_layer_type');
  assert(typeof wasmExports['lv_event_push'] != 'undefined', 'missing Wasm export: lv_event_push');
  assert(typeof wasmExports['lv_event_pop'] != 'undefined', 'missing Wasm export: lv_event_pop');
  assert(typeof wasmExports['lv_event_send'] != 'undefined', 'missing Wasm export: lv_event_send');
  assert(typeof wasmExports['lv_obj_event_base'] != 'undefined', 'missing Wasm export: lv_obj_event_base');
  assert(typeof wasmExports['lv_event_add'] != 'undefined', 'missing Wasm export: lv_event_add');
  assert(typeof wasmExports['lv_obj_get_event_count'] != 'undefined', 'missing Wasm export: lv_obj_get_event_count');
  assert(typeof wasmExports['lv_event_get_count'] != 'undefined', 'missing Wasm export: lv_event_get_count');
  assert(typeof wasmExports['lv_obj_get_event_dsc'] != 'undefined', 'missing Wasm export: lv_obj_get_event_dsc');
  assert(typeof wasmExports['lv_event_get_dsc'] != 'undefined', 'missing Wasm export: lv_event_get_dsc');
  assert(typeof wasmExports['lv_obj_remove_event'] != 'undefined', 'missing Wasm export: lv_obj_remove_event');
  assert(typeof wasmExports['lv_event_remove'] != 'undefined', 'missing Wasm export: lv_event_remove');
  assert(typeof wasmExports['lv_obj_remove_event_dsc'] != 'undefined', 'missing Wasm export: lv_obj_remove_event_dsc');
  assert(typeof wasmExports['lv_event_remove_dsc'] != 'undefined', 'missing Wasm export: lv_event_remove_dsc');
  assert(typeof wasmExports['lv_obj_remove_event_cb'] != 'undefined', 'missing Wasm export: lv_obj_remove_event_cb');
  assert(typeof wasmExports['lv_obj_remove_event_cb_with_user_data'] != 'undefined', 'missing Wasm export: lv_obj_remove_event_cb_with_user_data');
  assert(typeof wasmExports['lv_event_get_current_target_obj'] != 'undefined', 'missing Wasm export: lv_event_get_current_target_obj');
  assert(typeof wasmExports['lv_event_get_old_size'] != 'undefined', 'missing Wasm export: lv_event_get_old_size');
  assert(typeof wasmExports['lv_event_get_rotary_diff'] != 'undefined', 'missing Wasm export: lv_event_get_rotary_diff');
  assert(typeof wasmExports['lv_event_get_scroll_anim'] != 'undefined', 'missing Wasm export: lv_event_get_scroll_anim');
  assert(typeof wasmExports['lv_event_get_self_size_info'] != 'undefined', 'missing Wasm export: lv_event_get_self_size_info');
  assert(typeof wasmExports['lv_event_get_hit_test_info'] != 'undefined', 'missing Wasm export: lv_event_get_hit_test_info');
  assert(typeof wasmExports['lv_event_get_cover_area'] != 'undefined', 'missing Wasm export: lv_event_get_cover_area');
  assert(typeof wasmExports['lv_event_set_cover_res'] != 'undefined', 'missing Wasm export: lv_event_set_cover_res');
  assert(typeof wasmExports['lv_obj_get_local_style_prop'] != 'undefined', 'missing Wasm export: lv_obj_get_local_style_prop');
  assert(typeof wasmExports['lv_obj_set_style_x'] != 'undefined', 'missing Wasm export: lv_obj_set_style_x');
  assert(typeof wasmExports['lv_obj_set_style_y'] != 'undefined', 'missing Wasm export: lv_obj_set_style_y');
  assert(typeof wasmExports['lv_obj_set_x'] != 'undefined', 'missing Wasm export: lv_obj_set_x');
  assert(typeof wasmExports['lv_obj_set_y'] != 'undefined', 'missing Wasm export: lv_obj_set_y');
  assert(typeof wasmExports['lv_obj_refr_size'] != 'undefined', 'missing Wasm export: lv_obj_refr_size');
  assert(typeof wasmExports['lv_obj_get_content_coords'] != 'undefined', 'missing Wasm export: lv_obj_get_content_coords');
  assert(typeof wasmExports['lv_obj_scrollbar_invalidate'] != 'undefined', 'missing Wasm export: lv_obj_scrollbar_invalidate');
  assert(typeof wasmExports['lv_obj_get_content_width'] != 'undefined', 'missing Wasm export: lv_obj_get_content_width');
  assert(typeof wasmExports['lv_obj_get_content_height'] != 'undefined', 'missing Wasm export: lv_obj_get_content_height');
  assert(typeof wasmExports['lv_obj_get_coords'] != 'undefined', 'missing Wasm export: lv_obj_get_coords');
  assert(typeof wasmExports['lv_obj_set_style_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_width');
  assert(typeof wasmExports['lv_obj_set_style_height'] != 'undefined', 'missing Wasm export: lv_obj_set_style_height');
  assert(typeof wasmExports['lv_obj_set_width'] != 'undefined', 'missing Wasm export: lv_obj_set_width');
  assert(typeof wasmExports['lv_obj_set_height'] != 'undefined', 'missing Wasm export: lv_obj_set_height');
  assert(typeof wasmExports['lv_obj_set_content_width'] != 'undefined', 'missing Wasm export: lv_obj_set_content_width');
  assert(typeof wasmExports['lv_obj_set_content_height'] != 'undefined', 'missing Wasm export: lv_obj_set_content_height');
  assert(typeof wasmExports['lv_obj_set_layout'] != 'undefined', 'missing Wasm export: lv_obj_set_layout');
  assert(typeof wasmExports['lv_obj_set_style_layout'] != 'undefined', 'missing Wasm export: lv_obj_set_style_layout');
  assert(typeof wasmExports['lv_obj_get_screen'] != 'undefined', 'missing Wasm export: lv_obj_get_screen');
  assert(typeof wasmExports['lv_obj_get_display'] != 'undefined', 'missing Wasm export: lv_obj_get_display');
  assert(typeof wasmExports['lv_display_send_event'] != 'undefined', 'missing Wasm export: lv_display_send_event');
  assert(typeof wasmExports['lv_obj_refr_pos'] != 'undefined', 'missing Wasm export: lv_obj_refr_pos');
  assert(typeof wasmExports['lv_layout_apply'] != 'undefined', 'missing Wasm export: lv_layout_apply');
  assert(typeof wasmExports['lv_obj_readjust_scroll'] != 'undefined', 'missing Wasm export: lv_obj_readjust_scroll');
  assert(typeof wasmExports['lv_obj_set_align'] != 'undefined', 'missing Wasm export: lv_obj_set_align');
  assert(typeof wasmExports['lv_obj_set_style_align'] != 'undefined', 'missing Wasm export: lv_obj_set_style_align');
  assert(typeof wasmExports['lv_obj_align'] != 'undefined', 'missing Wasm export: lv_obj_align');
  assert(typeof wasmExports['lv_obj_align_to'] != 'undefined', 'missing Wasm export: lv_obj_align_to');
  assert(typeof wasmExports['lv_obj_get_x'] != 'undefined', 'missing Wasm export: lv_obj_get_x');
  assert(typeof wasmExports['lv_obj_get_x2'] != 'undefined', 'missing Wasm export: lv_obj_get_x2');
  assert(typeof wasmExports['lv_obj_get_y'] != 'undefined', 'missing Wasm export: lv_obj_get_y');
  assert(typeof wasmExports['lv_obj_get_y2'] != 'undefined', 'missing Wasm export: lv_obj_get_y2');
  assert(typeof wasmExports['lv_obj_get_x_aligned'] != 'undefined', 'missing Wasm export: lv_obj_get_x_aligned');
  assert(typeof wasmExports['lv_obj_get_y_aligned'] != 'undefined', 'missing Wasm export: lv_obj_get_y_aligned');
  assert(typeof wasmExports['lv_obj_get_self_width'] != 'undefined', 'missing Wasm export: lv_obj_get_self_width');
  assert(typeof wasmExports['lv_obj_get_self_height'] != 'undefined', 'missing Wasm export: lv_obj_get_self_height');
  assert(typeof wasmExports['lv_obj_move_to'] != 'undefined', 'missing Wasm export: lv_obj_move_to');
  assert(typeof wasmExports['lv_obj_move_children_by'] != 'undefined', 'missing Wasm export: lv_obj_move_children_by');
  assert(typeof wasmExports['lv_obj_transform_point'] != 'undefined', 'missing Wasm export: lv_obj_transform_point');
  assert(typeof wasmExports['lv_obj_transform_point_array'] != 'undefined', 'missing Wasm export: lv_obj_transform_point_array');
  assert(typeof wasmExports['lv_point_array_transform'] != 'undefined', 'missing Wasm export: lv_point_array_transform');
  assert(typeof wasmExports['lv_obj_get_transformed_area'] != 'undefined', 'missing Wasm export: lv_obj_get_transformed_area');
  assert(typeof wasmExports['lv_display_is_invalidation_enabled'] != 'undefined', 'missing Wasm export: lv_display_is_invalidation_enabled');
  assert(typeof wasmExports['lv_obj_area_is_visible'] != 'undefined', 'missing Wasm export: lv_obj_area_is_visible');
  assert(typeof wasmExports['lv_inv_area'] != 'undefined', 'missing Wasm export: lv_inv_area');
  assert(typeof wasmExports['lv_display_get_screen_active'] != 'undefined', 'missing Wasm export: lv_display_get_screen_active');
  assert(typeof wasmExports['lv_display_get_screen_prev'] != 'undefined', 'missing Wasm export: lv_display_get_screen_prev');
  assert(typeof wasmExports['lv_display_get_layer_bottom'] != 'undefined', 'missing Wasm export: lv_display_get_layer_bottom');
  assert(typeof wasmExports['lv_display_get_layer_top'] != 'undefined', 'missing Wasm export: lv_display_get_layer_top');
  assert(typeof wasmExports['lv_display_get_layer_sys'] != 'undefined', 'missing Wasm export: lv_display_get_layer_sys');
  assert(typeof wasmExports['lv_area_intersect'] != 'undefined', 'missing Wasm export: lv_area_intersect');
  assert(typeof wasmExports['lv_obj_is_visible'] != 'undefined', 'missing Wasm export: lv_obj_is_visible');
  assert(typeof wasmExports['lv_obj_set_ext_click_area'] != 'undefined', 'missing Wasm export: lv_obj_set_ext_click_area');
  assert(typeof wasmExports['lv_obj_get_click_area'] != 'undefined', 'missing Wasm export: lv_obj_get_click_area');
  assert(typeof wasmExports['lv_obj_hit_test'] != 'undefined', 'missing Wasm export: lv_obj_hit_test');
  assert(typeof wasmExports['lv_area_is_point_on'] != 'undefined', 'missing Wasm export: lv_area_is_point_on');
  assert(typeof wasmExports['lv_clamp_width'] != 'undefined', 'missing Wasm export: lv_clamp_width');
  assert(typeof wasmExports['lv_clamp_height'] != 'undefined', 'missing Wasm export: lv_clamp_height');
  assert(typeof wasmExports['lv_obj_center'] != 'undefined', 'missing Wasm export: lv_obj_center');
  assert(typeof wasmExports['lv_obj_set_transform'] != 'undefined', 'missing Wasm export: lv_obj_set_transform');
  assert(typeof wasmExports['lv_obj_reset_transform'] != 'undefined', 'missing Wasm export: lv_obj_reset_transform');
  assert(typeof wasmExports['lv_obj_get_transform'] != 'undefined', 'missing Wasm export: lv_obj_get_transform');
  assert(typeof wasmExports['lv_obj_get_scroll_snap_x'] != 'undefined', 'missing Wasm export: lv_obj_get_scroll_snap_x');
  assert(typeof wasmExports['lv_obj_get_scroll_snap_y'] != 'undefined', 'missing Wasm export: lv_obj_get_scroll_snap_y');
  assert(typeof wasmExports['lv_obj_get_scroll_bottom'] != 'undefined', 'missing Wasm export: lv_obj_get_scroll_bottom');
  assert(typeof wasmExports['lv_obj_get_scroll_end'] != 'undefined', 'missing Wasm export: lv_obj_get_scroll_end');
  assert(typeof wasmExports['lv_anim_get'] != 'undefined', 'missing Wasm export: lv_anim_get');
  assert(typeof wasmExports['lv_obj_scroll_by_bounded'] != 'undefined', 'missing Wasm export: lv_obj_scroll_by_bounded');
  assert(typeof wasmExports['lv_obj_scroll_by'] != 'undefined', 'missing Wasm export: lv_obj_scroll_by');
  assert(typeof wasmExports['lv_anim_set_var'] != 'undefined', 'missing Wasm export: lv_anim_set_var');
  assert(typeof wasmExports['lv_anim_set_deleted_cb'] != 'undefined', 'missing Wasm export: lv_anim_set_deleted_cb');
  assert(typeof wasmExports['lv_anim_speed_clamped'] != 'undefined', 'missing Wasm export: lv_anim_speed_clamped');
  assert(typeof wasmExports['lv_anim_set_duration'] != 'undefined', 'missing Wasm export: lv_anim_set_duration');
  assert(typeof wasmExports['lv_anim_set_values'] != 'undefined', 'missing Wasm export: lv_anim_set_values');
  assert(typeof wasmExports['lv_anim_set_exec_cb'] != 'undefined', 'missing Wasm export: lv_anim_set_exec_cb');
  assert(typeof wasmExports['lv_anim_path_ease_out'] != 'undefined', 'missing Wasm export: lv_anim_path_ease_out');
  assert(typeof wasmExports['lv_anim_set_path_cb'] != 'undefined', 'missing Wasm export: lv_anim_set_path_cb');
  assert(typeof wasmExports['lv_anim_start'] != 'undefined', 'missing Wasm export: lv_anim_start');
  assert(typeof wasmExports['lv_obj_scroll_by_raw'] != 'undefined', 'missing Wasm export: lv_obj_scroll_by_raw');
  assert(typeof wasmExports['lv_obj_scroll_to_view'] != 'undefined', 'missing Wasm export: lv_obj_scroll_to_view');
  assert(typeof wasmExports['lv_obj_is_scrolling'] != 'undefined', 'missing Wasm export: lv_obj_is_scrolling');
  assert(typeof wasmExports['lv_obj_stop_scroll_anim'] != 'undefined', 'missing Wasm export: lv_obj_stop_scroll_anim');
  assert(typeof wasmExports['lv_obj_update_snap'] != 'undefined', 'missing Wasm export: lv_obj_update_snap');
  assert(typeof wasmExports['lv_indev_scroll_get_snap_dist'] != 'undefined', 'missing Wasm export: lv_indev_scroll_get_snap_dist');
  assert(typeof wasmExports['lv_area_set'] != 'undefined', 'missing Wasm export: lv_area_set');
  assert(typeof wasmExports['lv_indev_get_scroll_dir'] != 'undefined', 'missing Wasm export: lv_indev_get_scroll_dir');
  assert(typeof wasmExports['lv_display_get_dpi'] != 'undefined', 'missing Wasm export: lv_display_get_dpi');
  assert(typeof wasmExports['lv_obj_style_init'] != 'undefined', 'missing Wasm export: lv_obj_style_init');
  assert(typeof wasmExports['lv_obj_style_deinit'] != 'undefined', 'missing Wasm export: lv_obj_style_deinit');
  assert(typeof wasmExports['lv_style_prop_lookup_flags'] != 'undefined', 'missing Wasm export: lv_style_prop_lookup_flags');
  assert(typeof wasmExports['lv_style_remove_prop'] != 'undefined', 'missing Wasm export: lv_style_remove_prop');
  assert(typeof wasmExports['lv_style_reset'] != 'undefined', 'missing Wasm export: lv_style_reset');
  assert(typeof wasmExports['lv_style_prop_get_default'] != 'undefined', 'missing Wasm export: lv_style_prop_get_default');
  assert(typeof wasmExports['lv_obj_replace_style'] != 'undefined', 'missing Wasm export: lv_obj_replace_style');
  assert(typeof wasmExports['lv_obj_report_style_change'] != 'undefined', 'missing Wasm export: lv_obj_report_style_change');
  assert(typeof wasmExports['lv_obj_style_set_disabled'] != 'undefined', 'missing Wasm export: lv_obj_style_set_disabled');
  assert(typeof wasmExports['lv_obj_style_get_disabled'] != 'undefined', 'missing Wasm export: lv_obj_style_get_disabled');
  assert(typeof wasmExports['lv_obj_has_style_prop'] != 'undefined', 'missing Wasm export: lv_obj_has_style_prop');
  assert(typeof wasmExports['lv_style_get_prop'] != 'undefined', 'missing Wasm export: lv_style_get_prop');
  assert(typeof wasmExports['lv_obj_remove_local_style_prop'] != 'undefined', 'missing Wasm export: lv_obj_remove_local_style_prop');
  assert(typeof wasmExports['lv_color_eq'] != 'undefined', 'missing Wasm export: lv_color_eq');
  assert(typeof wasmExports['lv_anim_set_start_cb'] != 'undefined', 'missing Wasm export: lv_anim_set_start_cb');
  assert(typeof wasmExports['lv_anim_set_completed_cb'] != 'undefined', 'missing Wasm export: lv_anim_set_completed_cb');
  assert(typeof wasmExports['lv_anim_set_early_apply'] != 'undefined', 'missing Wasm export: lv_anim_set_early_apply');
  assert(typeof wasmExports['lv_anim_set_user_data'] != 'undefined', 'missing Wasm export: lv_anim_set_user_data');
  assert(typeof wasmExports['lv_style_is_empty'] != 'undefined', 'missing Wasm export: lv_style_is_empty');
  assert(typeof wasmExports['lv_obj_fade_in'] != 'undefined', 'missing Wasm export: lv_obj_fade_in');
  assert(typeof wasmExports['lv_obj_set_style_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_opa');
  assert(typeof wasmExports['lv_obj_fade_out'] != 'undefined', 'missing Wasm export: lv_obj_fade_out');
  assert(typeof wasmExports['lv_obj_calculate_style_text_align'] != 'undefined', 'missing Wasm export: lv_obj_calculate_style_text_align');
  assert(typeof wasmExports['lv_bidi_calculate_align'] != 'undefined', 'missing Wasm export: lv_bidi_calculate_align');
  assert(typeof wasmExports['lv_obj_set_style_min_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_min_width');
  assert(typeof wasmExports['lv_obj_set_style_max_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_max_width');
  assert(typeof wasmExports['lv_obj_set_style_min_height'] != 'undefined', 'missing Wasm export: lv_obj_set_style_min_height');
  assert(typeof wasmExports['lv_obj_set_style_max_height'] != 'undefined', 'missing Wasm export: lv_obj_set_style_max_height');
  assert(typeof wasmExports['lv_obj_set_style_length'] != 'undefined', 'missing Wasm export: lv_obj_set_style_length');
  assert(typeof wasmExports['lv_obj_set_style_transform_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_transform_width');
  assert(typeof wasmExports['lv_obj_set_style_transform_height'] != 'undefined', 'missing Wasm export: lv_obj_set_style_transform_height');
  assert(typeof wasmExports['lv_obj_set_style_translate_x'] != 'undefined', 'missing Wasm export: lv_obj_set_style_translate_x');
  assert(typeof wasmExports['lv_obj_set_style_translate_y'] != 'undefined', 'missing Wasm export: lv_obj_set_style_translate_y');
  assert(typeof wasmExports['lv_obj_set_style_translate_radial'] != 'undefined', 'missing Wasm export: lv_obj_set_style_translate_radial');
  assert(typeof wasmExports['lv_obj_set_style_transform_scale_x'] != 'undefined', 'missing Wasm export: lv_obj_set_style_transform_scale_x');
  assert(typeof wasmExports['lv_obj_set_style_transform_scale_y'] != 'undefined', 'missing Wasm export: lv_obj_set_style_transform_scale_y');
  assert(typeof wasmExports['lv_obj_set_style_transform_rotation'] != 'undefined', 'missing Wasm export: lv_obj_set_style_transform_rotation');
  assert(typeof wasmExports['lv_obj_set_style_transform_pivot_x'] != 'undefined', 'missing Wasm export: lv_obj_set_style_transform_pivot_x');
  assert(typeof wasmExports['lv_obj_set_style_transform_pivot_y'] != 'undefined', 'missing Wasm export: lv_obj_set_style_transform_pivot_y');
  assert(typeof wasmExports['lv_obj_set_style_transform_skew_x'] != 'undefined', 'missing Wasm export: lv_obj_set_style_transform_skew_x');
  assert(typeof wasmExports['lv_obj_set_style_transform_skew_y'] != 'undefined', 'missing Wasm export: lv_obj_set_style_transform_skew_y');
  assert(typeof wasmExports['lv_obj_set_style_pad_top'] != 'undefined', 'missing Wasm export: lv_obj_set_style_pad_top');
  assert(typeof wasmExports['lv_obj_set_style_pad_bottom'] != 'undefined', 'missing Wasm export: lv_obj_set_style_pad_bottom');
  assert(typeof wasmExports['lv_obj_set_style_pad_left'] != 'undefined', 'missing Wasm export: lv_obj_set_style_pad_left');
  assert(typeof wasmExports['lv_obj_set_style_pad_right'] != 'undefined', 'missing Wasm export: lv_obj_set_style_pad_right');
  assert(typeof wasmExports['lv_obj_set_style_pad_row'] != 'undefined', 'missing Wasm export: lv_obj_set_style_pad_row');
  assert(typeof wasmExports['lv_obj_set_style_pad_column'] != 'undefined', 'missing Wasm export: lv_obj_set_style_pad_column');
  assert(typeof wasmExports['lv_obj_set_style_pad_radial'] != 'undefined', 'missing Wasm export: lv_obj_set_style_pad_radial');
  assert(typeof wasmExports['lv_obj_set_style_margin_top'] != 'undefined', 'missing Wasm export: lv_obj_set_style_margin_top');
  assert(typeof wasmExports['lv_obj_set_style_margin_bottom'] != 'undefined', 'missing Wasm export: lv_obj_set_style_margin_bottom');
  assert(typeof wasmExports['lv_obj_set_style_margin_left'] != 'undefined', 'missing Wasm export: lv_obj_set_style_margin_left');
  assert(typeof wasmExports['lv_obj_set_style_margin_right'] != 'undefined', 'missing Wasm export: lv_obj_set_style_margin_right');
  assert(typeof wasmExports['lv_obj_set_style_bg_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_opa');
  assert(typeof wasmExports['lv_obj_set_style_bg_grad_color'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_grad_color');
  assert(typeof wasmExports['lv_obj_set_style_bg_grad_dir'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_grad_dir');
  assert(typeof wasmExports['lv_obj_set_style_bg_main_stop'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_main_stop');
  assert(typeof wasmExports['lv_obj_set_style_bg_grad_stop'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_grad_stop');
  assert(typeof wasmExports['lv_obj_set_style_bg_main_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_main_opa');
  assert(typeof wasmExports['lv_obj_set_style_bg_grad_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_grad_opa');
  assert(typeof wasmExports['lv_obj_set_style_bg_grad'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_grad');
  assert(typeof wasmExports['lv_obj_set_style_bg_image_src'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_image_src');
  assert(typeof wasmExports['lv_obj_set_style_bg_image_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_image_opa');
  assert(typeof wasmExports['lv_obj_set_style_bg_image_recolor'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_image_recolor');
  assert(typeof wasmExports['lv_obj_set_style_bg_image_recolor_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_image_recolor_opa');
  assert(typeof wasmExports['lv_obj_set_style_bg_image_tiled'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bg_image_tiled');
  assert(typeof wasmExports['lv_obj_set_style_border_color'] != 'undefined', 'missing Wasm export: lv_obj_set_style_border_color');
  assert(typeof wasmExports['lv_obj_set_style_border_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_border_opa');
  assert(typeof wasmExports['lv_obj_set_style_border_side'] != 'undefined', 'missing Wasm export: lv_obj_set_style_border_side');
  assert(typeof wasmExports['lv_obj_set_style_border_post'] != 'undefined', 'missing Wasm export: lv_obj_set_style_border_post');
  assert(typeof wasmExports['lv_obj_set_style_outline_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_outline_width');
  assert(typeof wasmExports['lv_obj_set_style_outline_color'] != 'undefined', 'missing Wasm export: lv_obj_set_style_outline_color');
  assert(typeof wasmExports['lv_obj_set_style_outline_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_outline_opa');
  assert(typeof wasmExports['lv_obj_set_style_outline_pad'] != 'undefined', 'missing Wasm export: lv_obj_set_style_outline_pad');
  assert(typeof wasmExports['lv_obj_set_style_shadow_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_shadow_width');
  assert(typeof wasmExports['lv_obj_set_style_shadow_offset_x'] != 'undefined', 'missing Wasm export: lv_obj_set_style_shadow_offset_x');
  assert(typeof wasmExports['lv_obj_set_style_shadow_offset_y'] != 'undefined', 'missing Wasm export: lv_obj_set_style_shadow_offset_y');
  assert(typeof wasmExports['lv_obj_set_style_shadow_spread'] != 'undefined', 'missing Wasm export: lv_obj_set_style_shadow_spread');
  assert(typeof wasmExports['lv_obj_set_style_shadow_color'] != 'undefined', 'missing Wasm export: lv_obj_set_style_shadow_color');
  assert(typeof wasmExports['lv_obj_set_style_shadow_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_shadow_opa');
  assert(typeof wasmExports['lv_obj_set_style_image_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_image_opa');
  assert(typeof wasmExports['lv_obj_set_style_image_recolor'] != 'undefined', 'missing Wasm export: lv_obj_set_style_image_recolor');
  assert(typeof wasmExports['lv_obj_set_style_image_recolor_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_image_recolor_opa');
  assert(typeof wasmExports['lv_obj_set_style_image_colorkey'] != 'undefined', 'missing Wasm export: lv_obj_set_style_image_colorkey');
  assert(typeof wasmExports['lv_obj_set_style_line_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_line_width');
  assert(typeof wasmExports['lv_obj_set_style_line_dash_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_line_dash_width');
  assert(typeof wasmExports['lv_obj_set_style_line_dash_gap'] != 'undefined', 'missing Wasm export: lv_obj_set_style_line_dash_gap');
  assert(typeof wasmExports['lv_obj_set_style_line_rounded'] != 'undefined', 'missing Wasm export: lv_obj_set_style_line_rounded');
  assert(typeof wasmExports['lv_obj_set_style_line_color'] != 'undefined', 'missing Wasm export: lv_obj_set_style_line_color');
  assert(typeof wasmExports['lv_obj_set_style_line_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_line_opa');
  assert(typeof wasmExports['lv_obj_set_style_arc_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_arc_width');
  assert(typeof wasmExports['lv_obj_set_style_arc_rounded'] != 'undefined', 'missing Wasm export: lv_obj_set_style_arc_rounded');
  assert(typeof wasmExports['lv_obj_set_style_arc_color'] != 'undefined', 'missing Wasm export: lv_obj_set_style_arc_color');
  assert(typeof wasmExports['lv_obj_set_style_arc_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_arc_opa');
  assert(typeof wasmExports['lv_obj_set_style_arc_image_src'] != 'undefined', 'missing Wasm export: lv_obj_set_style_arc_image_src');
  assert(typeof wasmExports['lv_obj_set_style_text_color'] != 'undefined', 'missing Wasm export: lv_obj_set_style_text_color');
  assert(typeof wasmExports['lv_obj_set_style_text_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_text_opa');
  assert(typeof wasmExports['lv_obj_set_style_text_font'] != 'undefined', 'missing Wasm export: lv_obj_set_style_text_font');
  assert(typeof wasmExports['lv_obj_set_style_text_letter_space'] != 'undefined', 'missing Wasm export: lv_obj_set_style_text_letter_space');
  assert(typeof wasmExports['lv_obj_set_style_text_line_space'] != 'undefined', 'missing Wasm export: lv_obj_set_style_text_line_space');
  assert(typeof wasmExports['lv_obj_set_style_text_decor'] != 'undefined', 'missing Wasm export: lv_obj_set_style_text_decor');
  assert(typeof wasmExports['lv_obj_set_style_text_align'] != 'undefined', 'missing Wasm export: lv_obj_set_style_text_align');
  assert(typeof wasmExports['lv_obj_set_style_text_outline_stroke_color'] != 'undefined', 'missing Wasm export: lv_obj_set_style_text_outline_stroke_color');
  assert(typeof wasmExports['lv_obj_set_style_text_outline_stroke_width'] != 'undefined', 'missing Wasm export: lv_obj_set_style_text_outline_stroke_width');
  assert(typeof wasmExports['lv_obj_set_style_text_outline_stroke_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_text_outline_stroke_opa');
  assert(typeof wasmExports['lv_obj_set_style_radius'] != 'undefined', 'missing Wasm export: lv_obj_set_style_radius');
  assert(typeof wasmExports['lv_obj_set_style_radial_offset'] != 'undefined', 'missing Wasm export: lv_obj_set_style_radial_offset');
  assert(typeof wasmExports['lv_obj_set_style_clip_corner'] != 'undefined', 'missing Wasm export: lv_obj_set_style_clip_corner');
  assert(typeof wasmExports['lv_obj_set_style_opa_layered'] != 'undefined', 'missing Wasm export: lv_obj_set_style_opa_layered');
  assert(typeof wasmExports['lv_obj_set_style_color_filter_dsc'] != 'undefined', 'missing Wasm export: lv_obj_set_style_color_filter_dsc');
  assert(typeof wasmExports['lv_obj_set_style_color_filter_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_color_filter_opa');
  assert(typeof wasmExports['lv_obj_set_style_recolor'] != 'undefined', 'missing Wasm export: lv_obj_set_style_recolor');
  assert(typeof wasmExports['lv_obj_set_style_recolor_opa'] != 'undefined', 'missing Wasm export: lv_obj_set_style_recolor_opa');
  assert(typeof wasmExports['lv_obj_set_style_anim'] != 'undefined', 'missing Wasm export: lv_obj_set_style_anim');
  assert(typeof wasmExports['lv_obj_set_style_anim_duration'] != 'undefined', 'missing Wasm export: lv_obj_set_style_anim_duration');
  assert(typeof wasmExports['lv_obj_set_style_transition'] != 'undefined', 'missing Wasm export: lv_obj_set_style_transition');
  assert(typeof wasmExports['lv_obj_set_style_blend_mode'] != 'undefined', 'missing Wasm export: lv_obj_set_style_blend_mode');
  assert(typeof wasmExports['lv_obj_set_style_base_dir'] != 'undefined', 'missing Wasm export: lv_obj_set_style_base_dir');
  assert(typeof wasmExports['lv_obj_set_style_bitmap_mask_src'] != 'undefined', 'missing Wasm export: lv_obj_set_style_bitmap_mask_src');
  assert(typeof wasmExports['lv_obj_set_style_rotary_sensitivity'] != 'undefined', 'missing Wasm export: lv_obj_set_style_rotary_sensitivity');
  assert(typeof wasmExports['lv_obj_set_style_flex_flow'] != 'undefined', 'missing Wasm export: lv_obj_set_style_flex_flow');
  assert(typeof wasmExports['lv_obj_set_style_flex_main_place'] != 'undefined', 'missing Wasm export: lv_obj_set_style_flex_main_place');
  assert(typeof wasmExports['lv_obj_set_style_flex_cross_place'] != 'undefined', 'missing Wasm export: lv_obj_set_style_flex_cross_place');
  assert(typeof wasmExports['lv_obj_set_style_flex_track_place'] != 'undefined', 'missing Wasm export: lv_obj_set_style_flex_track_place');
  assert(typeof wasmExports['lv_obj_set_style_flex_grow'] != 'undefined', 'missing Wasm export: lv_obj_set_style_flex_grow');
  assert(typeof wasmExports['lv_obj_set_style_grid_column_dsc_array'] != 'undefined', 'missing Wasm export: lv_obj_set_style_grid_column_dsc_array');
  assert(typeof wasmExports['lv_obj_set_style_grid_column_align'] != 'undefined', 'missing Wasm export: lv_obj_set_style_grid_column_align');
  assert(typeof wasmExports['lv_obj_set_style_grid_row_dsc_array'] != 'undefined', 'missing Wasm export: lv_obj_set_style_grid_row_dsc_array');
  assert(typeof wasmExports['lv_obj_set_style_grid_row_align'] != 'undefined', 'missing Wasm export: lv_obj_set_style_grid_row_align');
  assert(typeof wasmExports['lv_obj_set_style_grid_cell_column_pos'] != 'undefined', 'missing Wasm export: lv_obj_set_style_grid_cell_column_pos');
  assert(typeof wasmExports['lv_obj_set_style_grid_cell_x_align'] != 'undefined', 'missing Wasm export: lv_obj_set_style_grid_cell_x_align');
  assert(typeof wasmExports['lv_obj_set_style_grid_cell_column_span'] != 'undefined', 'missing Wasm export: lv_obj_set_style_grid_cell_column_span');
  assert(typeof wasmExports['lv_obj_set_style_grid_cell_row_pos'] != 'undefined', 'missing Wasm export: lv_obj_set_style_grid_cell_row_pos');
  assert(typeof wasmExports['lv_obj_set_style_grid_cell_y_align'] != 'undefined', 'missing Wasm export: lv_obj_set_style_grid_cell_y_align');
  assert(typeof wasmExports['lv_obj_set_style_grid_cell_row_span'] != 'undefined', 'missing Wasm export: lv_obj_set_style_grid_cell_row_span');
  assert(typeof wasmExports['lv_indev_get_state'] != 'undefined', 'missing Wasm export: lv_indev_get_state');
  assert(typeof wasmExports['lv_indev_wait_release'] != 'undefined', 'missing Wasm export: lv_indev_wait_release');
  assert(typeof wasmExports['lv_indev_reset'] != 'undefined', 'missing Wasm export: lv_indev_reset');
  assert(typeof wasmExports['lv_indev_get_active_obj'] != 'undefined', 'missing Wasm export: lv_indev_get_active_obj');
  assert(typeof wasmExports['lv_async_call_cancel'] != 'undefined', 'missing Wasm export: lv_async_call_cancel');
  assert(typeof wasmExports['lv_obj_clean'] != 'undefined', 'missing Wasm export: lv_obj_clean');
  assert(typeof wasmExports['lv_obj_delete_delayed'] != 'undefined', 'missing Wasm export: lv_obj_delete_delayed');
  assert(typeof wasmExports['lv_obj_delete_anim_completed_cb'] != 'undefined', 'missing Wasm export: lv_obj_delete_anim_completed_cb');
  assert(typeof wasmExports['lv_obj_delete_async'] != 'undefined', 'missing Wasm export: lv_obj_delete_async');
  assert(typeof wasmExports['lv_async_call'] != 'undefined', 'missing Wasm export: lv_async_call');
  assert(typeof wasmExports['lv_obj_set_parent'] != 'undefined', 'missing Wasm export: lv_obj_set_parent');
  assert(typeof wasmExports['lv_obj_get_index'] != 'undefined', 'missing Wasm export: lv_obj_get_index');
  assert(typeof wasmExports['lv_obj_move_to_index'] != 'undefined', 'missing Wasm export: lv_obj_move_to_index');
  assert(typeof wasmExports['lv_obj_swap'] != 'undefined', 'missing Wasm export: lv_obj_swap');
  assert(typeof wasmExports['lv_obj_get_sibling'] != 'undefined', 'missing Wasm export: lv_obj_get_sibling');
  assert(typeof wasmExports['lv_obj_get_sibling_by_type'] != 'undefined', 'missing Wasm export: lv_obj_get_sibling_by_type');
  assert(typeof wasmExports['lv_obj_get_index_by_type'] != 'undefined', 'missing Wasm export: lv_obj_get_index_by_type');
  assert(typeof wasmExports['lv_obj_get_child_count_by_type'] != 'undefined', 'missing Wasm export: lv_obj_get_child_count_by_type');
  assert(typeof wasmExports['lv_obj_tree_walk'] != 'undefined', 'missing Wasm export: lv_obj_tree_walk');
  assert(typeof wasmExports['lv_obj_dump_tree'] != 'undefined', 'missing Wasm export: lv_obj_dump_tree');
  assert(typeof wasmExports['lv_refr_init'] != 'undefined', 'missing Wasm export: lv_refr_init');
  assert(typeof wasmExports['lv_refr_deinit'] != 'undefined', 'missing Wasm export: lv_refr_deinit');
  assert(typeof wasmExports['lv_refr_now'] != 'undefined', 'missing Wasm export: lv_refr_now');
  assert(typeof wasmExports['lv_display_refr_timer'] != 'undefined', 'missing Wasm export: lv_display_refr_timer');
  assert(typeof wasmExports['lv_obj_redraw'] != 'undefined', 'missing Wasm export: lv_obj_redraw');
  assert(typeof wasmExports['lv_obj_refr'] != 'undefined', 'missing Wasm export: lv_obj_refr');
  assert(typeof wasmExports['lv_anim_refr_now'] != 'undefined', 'missing Wasm export: lv_anim_refr_now');
  assert(typeof wasmExports['lv_timer_pause'] != 'undefined', 'missing Wasm export: lv_timer_pause');
  assert(typeof wasmExports['lv_area_is_on'] != 'undefined', 'missing Wasm export: lv_area_is_on');
  assert(typeof wasmExports['lv_area_join'] != 'undefined', 'missing Wasm export: lv_area_join');
  assert(typeof wasmExports['lv_display_is_double_buffered'] != 'undefined', 'missing Wasm export: lv_display_is_double_buffered');
  assert(typeof wasmExports['lv_ll_is_empty'] != 'undefined', 'missing Wasm export: lv_ll_is_empty');
  assert(typeof wasmExports['lv_area_diff'] != 'undefined', 'missing Wasm export: lv_area_diff');
  assert(typeof wasmExports['lv_ll_ins_prev'] != 'undefined', 'missing Wasm export: lv_ll_ins_prev');
  assert(typeof wasmExports['lv_draw_buf_copy'] != 'undefined', 'missing Wasm export: lv_draw_buf_copy');
  assert(typeof wasmExports['lv_draw_buf_width_to_stride'] != 'undefined', 'missing Wasm export: lv_draw_buf_width_to_stride');
  assert(typeof wasmExports['lv_draw_sw_mask_cleanup'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_cleanup');
  assert(typeof wasmExports['lv_draw_mask_rect_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_mask_rect_dsc_init');
  assert(typeof wasmExports['lv_draw_image_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_image_dsc_init');
  assert(typeof wasmExports['lv_draw_layer_create'] != 'undefined', 'missing Wasm export: lv_draw_layer_create');
  assert(typeof wasmExports['lv_draw_mask_rect'] != 'undefined', 'missing Wasm export: lv_draw_mask_rect');
  assert(typeof wasmExports['lv_draw_layer'] != 'undefined', 'missing Wasm export: lv_draw_layer');
  assert(typeof wasmExports['lv_color_format_get_size'] != 'undefined', 'missing Wasm export: lv_color_format_get_size');
  assert(typeof wasmExports['lv_refr_get_disp_refreshing'] != 'undefined', 'missing Wasm export: lv_refr_get_disp_refreshing');
  assert(typeof wasmExports['lv_refr_set_disp_refreshing'] != 'undefined', 'missing Wasm export: lv_refr_set_disp_refreshing');
  assert(typeof wasmExports['lv_refr_get_top_obj'] != 'undefined', 'missing Wasm export: lv_refr_get_top_obj');
  assert(typeof wasmExports['lv_draw_buf_reshape'] != 'undefined', 'missing Wasm export: lv_draw_buf_reshape');
  assert(typeof wasmExports['lv_display_get_matrix_rotation'] != 'undefined', 'missing Wasm export: lv_display_get_matrix_rotation');
  assert(typeof wasmExports['lv_display_get_original_horizontal_resolution'] != 'undefined', 'missing Wasm export: lv_display_get_original_horizontal_resolution');
  assert(typeof wasmExports['lv_display_get_original_vertical_resolution'] != 'undefined', 'missing Wasm export: lv_display_get_original_vertical_resolution');
  assert(typeof wasmExports['lv_draw_layer_init'] != 'undefined', 'missing Wasm export: lv_draw_layer_init');
  assert(typeof wasmExports['lv_draw_dispatch_wait_for_request'] != 'undefined', 'missing Wasm export: lv_draw_dispatch_wait_for_request');
  assert(typeof wasmExports['lv_draw_dispatch'] != 'undefined', 'missing Wasm export: lv_draw_dispatch');
  assert(typeof wasmExports['lv_layer_reset'] != 'undefined', 'missing Wasm export: lv_layer_reset');
  assert(typeof wasmExports['lv_color_format_has_alpha'] != 'undefined', 'missing Wasm export: lv_color_format_has_alpha');
  assert(typeof wasmExports['lv_area_move'] != 'undefined', 'missing Wasm export: lv_area_move');
  assert(typeof wasmExports['lv_draw_buf_clear'] != 'undefined', 'missing Wasm export: lv_draw_buf_clear');
  assert(typeof wasmExports['lv_layer_init'] != 'undefined', 'missing Wasm export: lv_layer_init');
  assert(typeof wasmExports['lv_tick_get'] != 'undefined', 'missing Wasm export: lv_tick_get');
  assert(typeof wasmExports['lv_timer_create'] != 'undefined', 'missing Wasm export: lv_timer_create');
  assert(typeof wasmExports['lv_theme_default_is_inited'] != 'undefined', 'missing Wasm export: lv_theme_default_is_inited');
  assert(typeof wasmExports['lv_theme_default_get'] != 'undefined', 'missing Wasm export: lv_theme_default_get');
  assert(typeof wasmExports['lv_timer_ready'] != 'undefined', 'missing Wasm export: lv_timer_ready');
  assert(typeof wasmExports['lv_display_add_event_cb'] != 'undefined', 'missing Wasm export: lv_display_add_event_cb');
  assert(typeof wasmExports['lv_timer_resume'] != 'undefined', 'missing Wasm export: lv_timer_resume');
  assert(typeof wasmExports['lv_display_delete'] != 'undefined', 'missing Wasm export: lv_display_delete');
  assert(typeof wasmExports['lv_event_push_and_send'] != 'undefined', 'missing Wasm export: lv_event_push_and_send');
  assert(typeof wasmExports['lv_indev_get_display'] != 'undefined', 'missing Wasm export: lv_indev_get_display');
  assert(typeof wasmExports['lv_indev_set_display'] != 'undefined', 'missing Wasm export: lv_indev_set_display');
  assert(typeof wasmExports['lv_timer_delete'] != 'undefined', 'missing Wasm export: lv_timer_delete');
  assert(typeof wasmExports['lv_display_set_default'] != 'undefined', 'missing Wasm export: lv_display_set_default');
  assert(typeof wasmExports['lv_display_set_resolution'] != 'undefined', 'missing Wasm export: lv_display_set_resolution');
  assert(typeof wasmExports['lv_area_set_width'] != 'undefined', 'missing Wasm export: lv_area_set_width');
  assert(typeof wasmExports['lv_area_set_height'] != 'undefined', 'missing Wasm export: lv_area_set_height');
  assert(typeof wasmExports['lv_display_set_physical_resolution'] != 'undefined', 'missing Wasm export: lv_display_set_physical_resolution');
  assert(typeof wasmExports['lv_display_set_offset'] != 'undefined', 'missing Wasm export: lv_display_set_offset');
  assert(typeof wasmExports['lv_display_set_dpi'] != 'undefined', 'missing Wasm export: lv_display_set_dpi');
  assert(typeof wasmExports['lv_display_get_physical_horizontal_resolution'] != 'undefined', 'missing Wasm export: lv_display_get_physical_horizontal_resolution');
  assert(typeof wasmExports['lv_display_get_physical_vertical_resolution'] != 'undefined', 'missing Wasm export: lv_display_get_physical_vertical_resolution');
  assert(typeof wasmExports['lv_display_get_offset_x'] != 'undefined', 'missing Wasm export: lv_display_get_offset_x');
  assert(typeof wasmExports['lv_display_get_offset_y'] != 'undefined', 'missing Wasm export: lv_display_get_offset_y');
  assert(typeof wasmExports['lv_display_set_draw_buffers'] != 'undefined', 'missing Wasm export: lv_display_set_draw_buffers');
  assert(typeof wasmExports['lv_display_set_3rd_draw_buffer'] != 'undefined', 'missing Wasm export: lv_display_set_3rd_draw_buffer');
  assert(typeof wasmExports['lv_draw_buf_align'] != 'undefined', 'missing Wasm export: lv_draw_buf_align');
  assert(typeof wasmExports['lv_draw_buf_init'] != 'undefined', 'missing Wasm export: lv_draw_buf_init');
  assert(typeof wasmExports['lv_display_get_color_format'] != 'undefined', 'missing Wasm export: lv_display_get_color_format');
  assert(typeof wasmExports['lv_display_set_render_mode'] != 'undefined', 'missing Wasm export: lv_display_set_render_mode');
  assert(typeof wasmExports['lv_display_set_buffers_with_stride'] != 'undefined', 'missing Wasm export: lv_display_set_buffers_with_stride');
  assert(typeof wasmExports['lv_display_set_flush_wait_cb'] != 'undefined', 'missing Wasm export: lv_display_set_flush_wait_cb');
  assert(typeof wasmExports['lv_display_set_color_format'] != 'undefined', 'missing Wasm export: lv_display_set_color_format');
  assert(typeof wasmExports['lv_display_set_tile_cnt'] != 'undefined', 'missing Wasm export: lv_display_set_tile_cnt');
  assert(typeof wasmExports['lv_display_get_tile_cnt'] != 'undefined', 'missing Wasm export: lv_display_get_tile_cnt');
  assert(typeof wasmExports['lv_display_set_antialiasing'] != 'undefined', 'missing Wasm export: lv_display_set_antialiasing');
  assert(typeof wasmExports['lv_display_get_antialiasing'] != 'undefined', 'missing Wasm export: lv_display_get_antialiasing');
  assert(typeof wasmExports['lv_display_flush_is_last'] != 'undefined', 'missing Wasm export: lv_display_flush_is_last');
  assert(typeof wasmExports['lv_display_get_screen_loading'] != 'undefined', 'missing Wasm export: lv_display_get_screen_loading');
  assert(typeof wasmExports['lv_display_get_event_count'] != 'undefined', 'missing Wasm export: lv_display_get_event_count');
  assert(typeof wasmExports['lv_display_get_event_dsc'] != 'undefined', 'missing Wasm export: lv_display_get_event_dsc');
  assert(typeof wasmExports['lv_display_delete_event'] != 'undefined', 'missing Wasm export: lv_display_delete_event');
  assert(typeof wasmExports['lv_display_remove_event_cb_with_user_data'] != 'undefined', 'missing Wasm export: lv_display_remove_event_cb_with_user_data');
  assert(typeof wasmExports['lv_event_get_invalidated_area'] != 'undefined', 'missing Wasm export: lv_event_get_invalidated_area');
  assert(typeof wasmExports['lv_display_set_rotation'] != 'undefined', 'missing Wasm export: lv_display_set_rotation');
  assert(typeof wasmExports['lv_display_get_rotation'] != 'undefined', 'missing Wasm export: lv_display_get_rotation');
  assert(typeof wasmExports['lv_display_set_matrix_rotation'] != 'undefined', 'missing Wasm export: lv_display_set_matrix_rotation');
  assert(typeof wasmExports['lv_display_get_theme'] != 'undefined', 'missing Wasm export: lv_display_get_theme');
  assert(typeof wasmExports['lv_display_get_inactive_time'] != 'undefined', 'missing Wasm export: lv_display_get_inactive_time');
  assert(typeof wasmExports['lv_tick_elaps'] != 'undefined', 'missing Wasm export: lv_tick_elaps');
  assert(typeof wasmExports['lv_display_trigger_activity'] != 'undefined', 'missing Wasm export: lv_display_trigger_activity');
  assert(typeof wasmExports['lv_display_enable_invalidation'] != 'undefined', 'missing Wasm export: lv_display_enable_invalidation');
  assert(typeof wasmExports['lv_display_get_refr_timer'] != 'undefined', 'missing Wasm export: lv_display_get_refr_timer');
  assert(typeof wasmExports['lv_display_delete_refr_timer'] != 'undefined', 'missing Wasm export: lv_display_delete_refr_timer');
  assert(typeof wasmExports['lv_display_send_vsync_event'] != 'undefined', 'missing Wasm export: lv_display_send_vsync_event');
  assert(typeof wasmExports['lv_display_register_vsync_event'] != 'undefined', 'missing Wasm export: lv_display_register_vsync_event');
  assert(typeof wasmExports['lv_display_unregister_vsync_event'] != 'undefined', 'missing Wasm export: lv_display_unregister_vsync_event');
  assert(typeof wasmExports['lv_display_set_user_data'] != 'undefined', 'missing Wasm export: lv_display_set_user_data');
  assert(typeof wasmExports['lv_display_set_driver_data'] != 'undefined', 'missing Wasm export: lv_display_set_driver_data');
  assert(typeof wasmExports['lv_display_get_user_data'] != 'undefined', 'missing Wasm export: lv_display_get_user_data');
  assert(typeof wasmExports['lv_display_get_driver_data'] != 'undefined', 'missing Wasm export: lv_display_get_driver_data');
  assert(typeof wasmExports['lv_display_get_buf_active'] != 'undefined', 'missing Wasm export: lv_display_get_buf_active');
  assert(typeof wasmExports['lv_display_rotate_area'] != 'undefined', 'missing Wasm export: lv_display_rotate_area');
  assert(typeof wasmExports['lv_display_get_draw_buf_size'] != 'undefined', 'missing Wasm export: lv_display_get_draw_buf_size');
  assert(typeof wasmExports['lv_display_get_invalidated_draw_buf_size'] != 'undefined', 'missing Wasm export: lv_display_get_invalidated_draw_buf_size');
  assert(typeof wasmExports['lv_layer_top'] != 'undefined', 'missing Wasm export: lv_layer_top');
  assert(typeof wasmExports['lv_layer_sys'] != 'undefined', 'missing Wasm export: lv_layer_sys');
  assert(typeof wasmExports['lv_layer_bottom'] != 'undefined', 'missing Wasm export: lv_layer_bottom');
  assert(typeof wasmExports['lv_dpx'] != 'undefined', 'missing Wasm export: lv_dpx');
  assert(typeof wasmExports['lv_display_dpx'] != 'undefined', 'missing Wasm export: lv_display_dpx');
  assert(typeof wasmExports['lv_draw_buf_convert_premultiply'] != 'undefined', 'missing Wasm export: lv_draw_buf_convert_premultiply');
  assert(typeof wasmExports['lv_draw_init'] != 'undefined', 'missing Wasm export: lv_draw_init');
  assert(typeof wasmExports['lv_draw_deinit'] != 'undefined', 'missing Wasm export: lv_draw_deinit');
  assert(typeof wasmExports['lv_draw_create_unit'] != 'undefined', 'missing Wasm export: lv_draw_create_unit');
  assert(typeof wasmExports['lv_draw_add_task'] != 'undefined', 'missing Wasm export: lv_draw_add_task');
  assert(typeof wasmExports['lv_draw_finalize_task_creation'] != 'undefined', 'missing Wasm export: lv_draw_finalize_task_creation');
  assert(typeof wasmExports['lv_draw_dispatch_layer'] != 'undefined', 'missing Wasm export: lv_draw_dispatch_layer');
  assert(typeof wasmExports['lv_draw_wait_for_finish'] != 'undefined', 'missing Wasm export: lv_draw_wait_for_finish');
  assert(typeof wasmExports['lv_draw_buf_destroy'] != 'undefined', 'missing Wasm export: lv_draw_buf_destroy');
  assert(typeof wasmExports['lv_draw_task_get_label_dsc'] != 'undefined', 'missing Wasm export: lv_draw_task_get_label_dsc');
  assert(typeof wasmExports['lv_draw_dispatch_request'] != 'undefined', 'missing Wasm export: lv_draw_dispatch_request');
  assert(typeof wasmExports['lv_draw_get_unit_count'] != 'undefined', 'missing Wasm export: lv_draw_get_unit_count');
  assert(typeof wasmExports['lv_draw_get_available_task'] != 'undefined', 'missing Wasm export: lv_draw_get_available_task');
  assert(typeof wasmExports['lv_draw_get_next_available_task'] != 'undefined', 'missing Wasm export: lv_draw_get_next_available_task');
  assert(typeof wasmExports['lv_draw_get_dependent_count'] != 'undefined', 'missing Wasm export: lv_draw_get_dependent_count');
  assert(typeof wasmExports['lv_draw_unit_send_event'] != 'undefined', 'missing Wasm export: lv_draw_unit_send_event');
  assert(typeof wasmExports['lv_strcmp'] != 'undefined', 'missing Wasm export: lv_strcmp');
  assert(typeof wasmExports['lv_color32_make'] != 'undefined', 'missing Wasm export: lv_color32_make');
  assert(typeof wasmExports['lv_draw_layer_alloc_buf'] != 'undefined', 'missing Wasm export: lv_draw_layer_alloc_buf');
  assert(typeof wasmExports['lv_draw_buf_create'] != 'undefined', 'missing Wasm export: lv_draw_buf_create');
  assert(typeof wasmExports['lv_draw_layer_go_to_xy'] != 'undefined', 'missing Wasm export: lv_draw_layer_go_to_xy');
  assert(typeof wasmExports['lv_draw_buf_goto_xy'] != 'undefined', 'missing Wasm export: lv_draw_buf_goto_xy');
  assert(typeof wasmExports['lv_draw_task_get_type'] != 'undefined', 'missing Wasm export: lv_draw_task_get_type');
  assert(typeof wasmExports['lv_draw_task_get_draw_dsc'] != 'undefined', 'missing Wasm export: lv_draw_task_get_draw_dsc');
  assert(typeof wasmExports['lv_draw_task_get_area'] != 'undefined', 'missing Wasm export: lv_draw_task_get_area');
  assert(typeof wasmExports['lv_draw_arc_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_arc_dsc_init');
  assert(typeof wasmExports['lv_draw_task_get_arc_dsc'] != 'undefined', 'missing Wasm export: lv_draw_task_get_arc_dsc');
  assert(typeof wasmExports['lv_draw_arc'] != 'undefined', 'missing Wasm export: lv_draw_arc');
  assert(typeof wasmExports['lv_draw_arc_get_area'] != 'undefined', 'missing Wasm export: lv_draw_arc_get_area');
  assert(typeof wasmExports['lv_draw_buf_init_handlers'] != 'undefined', 'missing Wasm export: lv_draw_buf_init_handlers');
  assert(typeof wasmExports['lv_draw_buf_init_with_default_handlers'] != 'undefined', 'missing Wasm export: lv_draw_buf_init_with_default_handlers');
  assert(typeof wasmExports['lv_draw_buf_handlers_init'] != 'undefined', 'missing Wasm export: lv_draw_buf_handlers_init');
  assert(typeof wasmExports['lv_draw_buf_get_handlers'] != 'undefined', 'missing Wasm export: lv_draw_buf_get_handlers');
  assert(typeof wasmExports['lv_draw_buf_get_font_handlers'] != 'undefined', 'missing Wasm export: lv_draw_buf_get_font_handlers');
  assert(typeof wasmExports['lv_draw_buf_get_image_handlers'] != 'undefined', 'missing Wasm export: lv_draw_buf_get_image_handlers');
  assert(typeof wasmExports['lv_color_format_get_bpp'] != 'undefined', 'missing Wasm export: lv_color_format_get_bpp');
  assert(typeof wasmExports['lv_draw_buf_width_to_stride_ex'] != 'undefined', 'missing Wasm export: lv_draw_buf_width_to_stride_ex');
  assert(typeof wasmExports['lv_draw_buf_align_ex'] != 'undefined', 'missing Wasm export: lv_draw_buf_align_ex');
  assert(typeof wasmExports['lv_draw_buf_invalidate_cache'] != 'undefined', 'missing Wasm export: lv_draw_buf_invalidate_cache');
  assert(typeof wasmExports['lv_draw_buf_flush_cache'] != 'undefined', 'missing Wasm export: lv_draw_buf_flush_cache');
  assert(typeof wasmExports['lv_draw_buf_create_ex'] != 'undefined', 'missing Wasm export: lv_draw_buf_create_ex');
  assert(typeof wasmExports['lv_draw_buf_dup'] != 'undefined', 'missing Wasm export: lv_draw_buf_dup');
  assert(typeof wasmExports['lv_draw_buf_dup_ex'] != 'undefined', 'missing Wasm export: lv_draw_buf_dup_ex');
  assert(typeof wasmExports['lv_draw_buf_adjust_stride'] != 'undefined', 'missing Wasm export: lv_draw_buf_adjust_stride');
  assert(typeof wasmExports['lv_memmove'] != 'undefined', 'missing Wasm export: lv_memmove');
  assert(typeof wasmExports['lv_draw_buf_has_flag'] != 'undefined', 'missing Wasm export: lv_draw_buf_has_flag');
  assert(typeof wasmExports['lv_draw_buf_premultiply'] != 'undefined', 'missing Wasm export: lv_draw_buf_premultiply');
  assert(typeof wasmExports['lv_color_premultiply'] != 'undefined', 'missing Wasm export: lv_color_premultiply');
  assert(typeof wasmExports['lv_color16_premultiply'] != 'undefined', 'missing Wasm export: lv_color16_premultiply');
  assert(typeof wasmExports['lv_draw_buf_set_palette'] != 'undefined', 'missing Wasm export: lv_draw_buf_set_palette');
  assert(typeof wasmExports['lv_draw_buf_set_flag'] != 'undefined', 'missing Wasm export: lv_draw_buf_set_flag');
  assert(typeof wasmExports['lv_draw_buf_clear_flag'] != 'undefined', 'missing Wasm export: lv_draw_buf_clear_flag');
  assert(typeof wasmExports['lv_draw_buf_from_image'] != 'undefined', 'missing Wasm export: lv_draw_buf_from_image');
  assert(typeof wasmExports['lv_draw_buf_to_image'] != 'undefined', 'missing Wasm export: lv_draw_buf_to_image');
  assert(typeof wasmExports['lv_image_buf_set_palette'] != 'undefined', 'missing Wasm export: lv_image_buf_set_palette');
  assert(typeof wasmExports['lv_image_buf_free'] != 'undefined', 'missing Wasm export: lv_image_buf_free');
  assert(typeof wasmExports['lv_color_black'] != 'undefined', 'missing Wasm export: lv_color_black');
  assert(typeof wasmExports['lv_draw_task_get_image_dsc'] != 'undefined', 'missing Wasm export: lv_draw_task_get_image_dsc');
  assert(typeof wasmExports['lv_image_buf_get_transformed_area'] != 'undefined', 'missing Wasm export: lv_image_buf_get_transformed_area');
  assert(typeof wasmExports['lv_point_transform'] != 'undefined', 'missing Wasm export: lv_point_transform');
  assert(typeof wasmExports['lv_draw_image'] != 'undefined', 'missing Wasm export: lv_draw_image');
  assert(typeof wasmExports['lv_image_decoder_get_info'] != 'undefined', 'missing Wasm export: lv_image_decoder_get_info');
  assert(typeof wasmExports['lv_image_decoder_open'] != 'undefined', 'missing Wasm export: lv_image_decoder_open');
  assert(typeof wasmExports['lv_image_decoder_close'] != 'undefined', 'missing Wasm export: lv_image_decoder_close');
  assert(typeof wasmExports['lv_draw_image_normal_helper'] != 'undefined', 'missing Wasm export: lv_draw_image_normal_helper');
  assert(typeof wasmExports['lv_image_decoder_get_area'] != 'undefined', 'missing Wasm export: lv_image_decoder_get_area');
  assert(typeof wasmExports['lv_draw_image_tiled_helper'] != 'undefined', 'missing Wasm export: lv_draw_image_tiled_helper');
  assert(typeof wasmExports['lv_draw_letter_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_letter_dsc_init');
  assert(typeof wasmExports['lv_draw_label_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_label_dsc_init');
  assert(typeof wasmExports['lv_draw_glyph_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_glyph_dsc_init');
  assert(typeof wasmExports['lv_draw_label'] != 'undefined', 'missing Wasm export: lv_draw_label');
  assert(typeof wasmExports['lv_strndup'] != 'undefined', 'missing Wasm export: lv_strndup');
  assert(typeof wasmExports['lv_draw_character'] != 'undefined', 'missing Wasm export: lv_draw_character');
  assert(typeof wasmExports['lv_font_get_glyph_dsc'] != 'undefined', 'missing Wasm export: lv_font_get_glyph_dsc');
  assert(typeof wasmExports['lv_font_get_line_height'] != 'undefined', 'missing Wasm export: lv_font_get_line_height');
  assert(typeof wasmExports['lv_draw_letter'] != 'undefined', 'missing Wasm export: lv_draw_letter');
  assert(typeof wasmExports['lv_draw_label_iterate_characters'] != 'undefined', 'missing Wasm export: lv_draw_label_iterate_characters');
  assert(typeof wasmExports['lv_text_get_size_attributes'] != 'undefined', 'missing Wasm export: lv_text_get_size_attributes');
  assert(typeof wasmExports['lv_point_set'] != 'undefined', 'missing Wasm export: lv_point_set');
  assert(typeof wasmExports['lv_text_get_next_line'] != 'undefined', 'missing Wasm export: lv_text_get_next_line');
  assert(typeof wasmExports['lv_text_get_width'] != 'undefined', 'missing Wasm export: lv_text_get_width');
  assert(typeof wasmExports['lv_draw_fill_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_fill_dsc_init');
  assert(typeof wasmExports['lv_bidi_process_paragraph'] != 'undefined', 'missing Wasm export: lv_bidi_process_paragraph');
  assert(typeof wasmExports['lv_bidi_get_logical_pos'] != 'undefined', 'missing Wasm export: lv_bidi_get_logical_pos');
  assert(typeof wasmExports['lv_text_encoded_letter_next_2'] != 'undefined', 'missing Wasm export: lv_text_encoded_letter_next_2');
  assert(typeof wasmExports['lv_draw_unit_draw_letter'] != 'undefined', 'missing Wasm export: lv_draw_unit_draw_letter');
  assert(typeof wasmExports['lv_area_is_out'] != 'undefined', 'missing Wasm export: lv_area_is_out');
  assert(typeof wasmExports['lv_font_get_glyph_bitmap'] != 'undefined', 'missing Wasm export: lv_font_get_glyph_bitmap');
  assert(typeof wasmExports['lv_font_glyph_release_draw_data'] != 'undefined', 'missing Wasm export: lv_font_glyph_release_draw_data');
  assert(typeof wasmExports['lv_draw_line_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_line_dsc_init');
  assert(typeof wasmExports['lv_draw_task_get_line_dsc'] != 'undefined', 'missing Wasm export: lv_draw_task_get_line_dsc');
  assert(typeof wasmExports['lv_draw_line'] != 'undefined', 'missing Wasm export: lv_draw_line');
  assert(typeof wasmExports['lv_draw_task_get_mask_rect_dsc'] != 'undefined', 'missing Wasm export: lv_draw_task_get_mask_rect_dsc');
  assert(typeof wasmExports['lv_color_white'] != 'undefined', 'missing Wasm export: lv_color_white');
  assert(typeof wasmExports['lv_draw_task_get_fill_dsc'] != 'undefined', 'missing Wasm export: lv_draw_task_get_fill_dsc');
  assert(typeof wasmExports['lv_draw_fill'] != 'undefined', 'missing Wasm export: lv_draw_fill');
  assert(typeof wasmExports['lv_draw_border_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_border_dsc_init');
  assert(typeof wasmExports['lv_draw_task_get_border_dsc'] != 'undefined', 'missing Wasm export: lv_draw_task_get_border_dsc');
  assert(typeof wasmExports['lv_draw_border'] != 'undefined', 'missing Wasm export: lv_draw_border');
  assert(typeof wasmExports['lv_draw_box_shadow_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_box_shadow_dsc_init');
  assert(typeof wasmExports['lv_draw_task_get_box_shadow_dsc'] != 'undefined', 'missing Wasm export: lv_draw_task_get_box_shadow_dsc');
  assert(typeof wasmExports['lv_draw_box_shadow'] != 'undefined', 'missing Wasm export: lv_draw_box_shadow');
  assert(typeof wasmExports['lv_area_align'] != 'undefined', 'missing Wasm export: lv_area_align');
  assert(typeof wasmExports['lv_draw_triangle_dsc_init'] != 'undefined', 'missing Wasm export: lv_draw_triangle_dsc_init');
  assert(typeof wasmExports['lv_draw_task_get_triangle_dsc'] != 'undefined', 'missing Wasm export: lv_draw_task_get_triangle_dsc');
  assert(typeof wasmExports['lv_draw_triangle'] != 'undefined', 'missing Wasm export: lv_draw_triangle');
  assert(typeof wasmExports['lv_image_decoder_init'] != 'undefined', 'missing Wasm export: lv_image_decoder_init');
  assert(typeof wasmExports['lv_image_decoder_deinit'] != 'undefined', 'missing Wasm export: lv_image_decoder_deinit');
  assert(typeof wasmExports['lv_image_cache_init'] != 'undefined', 'missing Wasm export: lv_image_cache_init');
  assert(typeof wasmExports['lv_image_header_cache_init'] != 'undefined', 'missing Wasm export: lv_image_header_cache_init');
  assert(typeof wasmExports['lv_cache_destroy'] != 'undefined', 'missing Wasm export: lv_cache_destroy');
  assert(typeof wasmExports['lv_image_header_cache_is_enabled'] != 'undefined', 'missing Wasm export: lv_image_header_cache_is_enabled');
  assert(typeof wasmExports['lv_cache_acquire'] != 'undefined', 'missing Wasm export: lv_cache_acquire');
  assert(typeof wasmExports['lv_cache_entry_get_data'] != 'undefined', 'missing Wasm export: lv_cache_entry_get_data');
  assert(typeof wasmExports['lv_cache_release'] != 'undefined', 'missing Wasm export: lv_cache_release');
  assert(typeof wasmExports['lv_fs_open'] != 'undefined', 'missing Wasm export: lv_fs_open');
  assert(typeof wasmExports['lv_fs_seek'] != 'undefined', 'missing Wasm export: lv_fs_seek');
  assert(typeof wasmExports['lv_fs_close'] != 'undefined', 'missing Wasm export: lv_fs_close');
  assert(typeof wasmExports['lv_strdup'] != 'undefined', 'missing Wasm export: lv_strdup');
  assert(typeof wasmExports['lv_cache_add'] != 'undefined', 'missing Wasm export: lv_cache_add');
  assert(typeof wasmExports['lv_image_cache_is_enabled'] != 'undefined', 'missing Wasm export: lv_image_cache_is_enabled');
  assert(typeof wasmExports['lv_image_decoder_create'] != 'undefined', 'missing Wasm export: lv_image_decoder_create');
  assert(typeof wasmExports['lv_image_decoder_delete'] != 'undefined', 'missing Wasm export: lv_image_decoder_delete');
  assert(typeof wasmExports['lv_image_decoder_get_next'] != 'undefined', 'missing Wasm export: lv_image_decoder_get_next');
  assert(typeof wasmExports['lv_image_decoder_set_info_cb'] != 'undefined', 'missing Wasm export: lv_image_decoder_set_info_cb');
  assert(typeof wasmExports['lv_image_decoder_set_open_cb'] != 'undefined', 'missing Wasm export: lv_image_decoder_set_open_cb');
  assert(typeof wasmExports['lv_image_decoder_set_get_area_cb'] != 'undefined', 'missing Wasm export: lv_image_decoder_set_get_area_cb');
  assert(typeof wasmExports['lv_image_decoder_set_close_cb'] != 'undefined', 'missing Wasm export: lv_image_decoder_set_close_cb');
  assert(typeof wasmExports['lv_image_decoder_add_to_cache'] != 'undefined', 'missing Wasm export: lv_image_decoder_add_to_cache');
  assert(typeof wasmExports['lv_image_decoder_post_process'] != 'undefined', 'missing Wasm export: lv_image_decoder_post_process');
  assert(typeof wasmExports['lv_draw_sw_blend'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend');
  assert(typeof wasmExports['lv_draw_sw_blend_color_to_al88'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_color_to_al88');
  assert(typeof wasmExports['lv_draw_sw_blend_image_to_al88'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_image_to_al88');
  assert(typeof wasmExports['lv_draw_sw_blend_color_to_argb8888'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_color_to_argb8888');
  assert(typeof wasmExports['lv_draw_sw_blend_image_to_argb8888'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_image_to_argb8888');
  assert(typeof wasmExports['lv_draw_sw_blend_color_to_argb8888_premultiplied'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_color_to_argb8888_premultiplied');
  assert(typeof wasmExports['lv_draw_sw_blend_image_to_argb8888_premultiplied'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_image_to_argb8888_premultiplied');
  assert(typeof wasmExports['lv_draw_sw_blend_color_to_i1'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_color_to_i1');
  assert(typeof wasmExports['lv_draw_sw_blend_image_to_i1'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_image_to_i1');
  assert(typeof wasmExports['lv_draw_sw_blend_color_to_l8'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_color_to_l8');
  assert(typeof wasmExports['lv_draw_sw_blend_image_to_l8'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_image_to_l8');
  assert(typeof wasmExports['lv_draw_sw_blend_color_to_rgb565'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_color_to_rgb565');
  assert(typeof wasmExports['lv_draw_sw_blend_image_to_rgb565'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_image_to_rgb565');
  assert(typeof wasmExports['lv_draw_sw_blend_color_to_rgb565_swapped'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_color_to_rgb565_swapped');
  assert(typeof wasmExports['lv_draw_sw_blend_image_to_rgb565_swapped'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_image_to_rgb565_swapped');
  assert(typeof wasmExports['lv_draw_sw_blend_color_to_rgb888'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_color_to_rgb888');
  assert(typeof wasmExports['lv_draw_sw_blend_image_to_rgb888'] != 'undefined', 'missing Wasm export: lv_draw_sw_blend_image_to_rgb888');
  assert(typeof wasmExports['lv_draw_sw_init'] != 'undefined', 'missing Wasm export: lv_draw_sw_init');
  assert(typeof wasmExports['lv_draw_sw_deinit'] != 'undefined', 'missing Wasm export: lv_draw_sw_deinit');
  assert(typeof wasmExports['lv_draw_sw_register_blend_handler'] != 'undefined', 'missing Wasm export: lv_draw_sw_register_blend_handler');
  assert(typeof wasmExports['lv_draw_sw_unregister_blend_handler'] != 'undefined', 'missing Wasm export: lv_draw_sw_unregister_blend_handler');
  assert(typeof wasmExports['lv_draw_sw_get_blend_handler'] != 'undefined', 'missing Wasm export: lv_draw_sw_get_blend_handler');
  assert(typeof wasmExports['lv_draw_sw_arc'] != 'undefined', 'missing Wasm export: lv_draw_sw_arc');
  assert(typeof wasmExports['lv_draw_sw_border'] != 'undefined', 'missing Wasm export: lv_draw_sw_border');
  assert(typeof wasmExports['lv_draw_sw_box_shadow'] != 'undefined', 'missing Wasm export: lv_draw_sw_box_shadow');
  assert(typeof wasmExports['lv_draw_sw_fill'] != 'undefined', 'missing Wasm export: lv_draw_sw_fill');
  assert(typeof wasmExports['lv_draw_sw_grad_get'] != 'undefined', 'missing Wasm export: lv_draw_sw_grad_get');
  assert(typeof wasmExports['lv_draw_sw_grad_color_calculate'] != 'undefined', 'missing Wasm export: lv_draw_sw_grad_color_calculate');
  assert(typeof wasmExports['lv_draw_sw_grad_cleanup'] != 'undefined', 'missing Wasm export: lv_draw_sw_grad_cleanup');
  assert(typeof wasmExports['lv_draw_sw_layer'] != 'undefined', 'missing Wasm export: lv_draw_sw_layer');
  assert(typeof wasmExports['lv_draw_sw_image'] != 'undefined', 'missing Wasm export: lv_draw_sw_image');
  assert(typeof wasmExports['lv_draw_sw_letter'] != 'undefined', 'missing Wasm export: lv_draw_sw_letter');
  assert(typeof wasmExports['lv_draw_sw_label'] != 'undefined', 'missing Wasm export: lv_draw_sw_label');
  assert(typeof wasmExports['lv_draw_sw_line'] != 'undefined', 'missing Wasm export: lv_draw_sw_line');
  assert(typeof wasmExports['lv_draw_sw_mask_init'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_init');
  assert(typeof wasmExports['lv_draw_sw_mask_deinit'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_deinit');
  assert(typeof wasmExports['lv_draw_sw_mask_apply'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_apply');
  assert(typeof wasmExports['lv_draw_sw_mask_free_param'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_free_param');
  assert(typeof wasmExports['lv_draw_sw_mask_line_points_init'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_line_points_init');
  assert(typeof wasmExports['lv_draw_sw_mask_line_angle_init'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_line_angle_init');
  assert(typeof wasmExports['lv_trigo_sin'] != 'undefined', 'missing Wasm export: lv_trigo_sin');
  assert(typeof wasmExports['lv_draw_sw_mask_angle_init'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_angle_init');
  assert(typeof wasmExports['lv_draw_sw_mask_radius_init'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_radius_init');
  assert(typeof wasmExports['lv_draw_sw_mask_fade_init'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_fade_init');
  assert(typeof wasmExports['lv_draw_sw_mask_map_init'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_map_init');
  assert(typeof wasmExports['lv_draw_sw_mask_rect'] != 'undefined', 'missing Wasm export: lv_draw_sw_mask_rect');
  assert(typeof wasmExports['lv_draw_sw_transform'] != 'undefined', 'missing Wasm export: lv_draw_sw_transform');
  assert(typeof wasmExports['lv_draw_sw_triangle'] != 'undefined', 'missing Wasm export: lv_draw_sw_triangle');
  assert(typeof wasmExports['lv_draw_sw_i1_to_argb8888'] != 'undefined', 'missing Wasm export: lv_draw_sw_i1_to_argb8888');
  assert(typeof wasmExports['lv_draw_sw_rgb565_swap'] != 'undefined', 'missing Wasm export: lv_draw_sw_rgb565_swap');
  assert(typeof wasmExports['lv_draw_sw_i1_invert'] != 'undefined', 'missing Wasm export: lv_draw_sw_i1_invert');
  assert(typeof wasmExports['lv_draw_sw_i1_convert_to_vtiled'] != 'undefined', 'missing Wasm export: lv_draw_sw_i1_convert_to_vtiled');
  assert(typeof wasmExports['lv_draw_sw_rotate'] != 'undefined', 'missing Wasm export: lv_draw_sw_rotate');
  assert(typeof wasmExports['lv_fs_read'] != 'undefined', 'missing Wasm export: lv_fs_read');
  assert(typeof wasmExports['lv_font_get_bitmap_fmt_txt'] != 'undefined', 'missing Wasm export: lv_font_get_bitmap_fmt_txt');
  assert(typeof wasmExports['lv_font_get_glyph_dsc_fmt_txt'] != 'undefined', 'missing Wasm export: lv_font_get_glyph_dsc_fmt_txt');
  assert(typeof wasmExports['lv_memcmp'] != 'undefined', 'missing Wasm export: lv_memcmp');
  assert(typeof wasmExports['lv_font_get_glyph_static_bitmap'] != 'undefined', 'missing Wasm export: lv_font_get_glyph_static_bitmap');
  assert(typeof wasmExports['lv_font_get_glyph_width'] != 'undefined', 'missing Wasm export: lv_font_get_glyph_width');
  assert(typeof wasmExports['lv_font_set_kerning'] != 'undefined', 'missing Wasm export: lv_font_set_kerning');
  assert(typeof wasmExports['lv_font_get_default'] != 'undefined', 'missing Wasm export: lv_font_get_default');
  assert(typeof wasmExports['lv_font_info_is_equal'] != 'undefined', 'missing Wasm export: lv_font_info_is_equal');
  assert(typeof wasmExports['lv_font_has_static_bitmap'] != 'undefined', 'missing Wasm export: lv_font_has_static_bitmap');
  assert(typeof wasmExports['lv_utils_bsearch'] != 'undefined', 'missing Wasm export: lv_utils_bsearch');
  assert(typeof wasmExports['lv_indev_read_timer_cb'] != 'undefined', 'missing Wasm export: lv_indev_read_timer_cb');
  assert(typeof wasmExports['lv_indev_read'] != 'undefined', 'missing Wasm export: lv_indev_read');
  assert(typeof wasmExports['lv_indev_delete'] != 'undefined', 'missing Wasm export: lv_indev_delete');
  assert(typeof wasmExports['lv_indev_send_event'] != 'undefined', 'missing Wasm export: lv_indev_send_event');
  assert(typeof wasmExports['lv_indev_find_scroll_obj'] != 'undefined', 'missing Wasm export: lv_indev_find_scroll_obj');
  assert(typeof wasmExports['lv_indev_scroll_handler'] != 'undefined', 'missing Wasm export: lv_indev_scroll_handler');
  assert(typeof wasmExports['lv_tick_diff'] != 'undefined', 'missing Wasm export: lv_tick_diff');
  assert(typeof wasmExports['lv_indev_enable'] != 'undefined', 'missing Wasm export: lv_indev_enable');
  assert(typeof wasmExports['lv_indev_set_user_data'] != 'undefined', 'missing Wasm export: lv_indev_set_user_data');
  assert(typeof wasmExports['lv_indev_set_driver_data'] != 'undefined', 'missing Wasm export: lv_indev_set_driver_data');
  assert(typeof wasmExports['lv_indev_get_read_cb'] != 'undefined', 'missing Wasm export: lv_indev_get_read_cb');
  assert(typeof wasmExports['lv_indev_set_long_press_time'] != 'undefined', 'missing Wasm export: lv_indev_set_long_press_time');
  assert(typeof wasmExports['lv_indev_set_long_press_repeat_time'] != 'undefined', 'missing Wasm export: lv_indev_set_long_press_repeat_time');
  assert(typeof wasmExports['lv_indev_set_scroll_limit'] != 'undefined', 'missing Wasm export: lv_indev_set_scroll_limit');
  assert(typeof wasmExports['lv_indev_set_scroll_throw'] != 'undefined', 'missing Wasm export: lv_indev_set_scroll_throw');
  assert(typeof wasmExports['lv_indev_get_user_data'] != 'undefined', 'missing Wasm export: lv_indev_get_user_data');
  assert(typeof wasmExports['lv_indev_get_driver_data'] != 'undefined', 'missing Wasm export: lv_indev_get_driver_data');
  assert(typeof wasmExports['lv_indev_get_press_moved'] != 'undefined', 'missing Wasm export: lv_indev_get_press_moved');
  assert(typeof wasmExports['lv_indev_stop_processing'] != 'undefined', 'missing Wasm export: lv_indev_stop_processing');
  assert(typeof wasmExports['lv_indev_reset_long_press'] != 'undefined', 'missing Wasm export: lv_indev_reset_long_press');
  assert(typeof wasmExports['lv_indev_set_cursor'] != 'undefined', 'missing Wasm export: lv_indev_set_cursor');
  assert(typeof wasmExports['lv_indev_set_button_points'] != 'undefined', 'missing Wasm export: lv_indev_set_button_points');
  assert(typeof wasmExports['lv_indev_get_point'] != 'undefined', 'missing Wasm export: lv_indev_get_point');
  assert(typeof wasmExports['lv_indev_get_gesture_dir'] != 'undefined', 'missing Wasm export: lv_indev_get_gesture_dir');
  assert(typeof wasmExports['lv_indev_get_key'] != 'undefined', 'missing Wasm export: lv_indev_get_key');
  assert(typeof wasmExports['lv_indev_get_short_click_streak'] != 'undefined', 'missing Wasm export: lv_indev_get_short_click_streak');
  assert(typeof wasmExports['lv_indev_get_vect'] != 'undefined', 'missing Wasm export: lv_indev_get_vect');
  assert(typeof wasmExports['lv_indev_get_cursor'] != 'undefined', 'missing Wasm export: lv_indev_get_cursor');
  assert(typeof wasmExports['lv_indev_get_read_timer'] != 'undefined', 'missing Wasm export: lv_indev_get_read_timer');
  assert(typeof wasmExports['lv_indev_get_mode'] != 'undefined', 'missing Wasm export: lv_indev_get_mode');
  assert(typeof wasmExports['lv_indev_set_mode'] != 'undefined', 'missing Wasm export: lv_indev_set_mode');
  assert(typeof wasmExports['lv_timer_set_cb'] != 'undefined', 'missing Wasm export: lv_timer_set_cb');
  assert(typeof wasmExports['lv_indev_search_obj'] != 'undefined', 'missing Wasm export: lv_indev_search_obj');
  assert(typeof wasmExports['lv_indev_add_event_cb'] != 'undefined', 'missing Wasm export: lv_indev_add_event_cb');
  assert(typeof wasmExports['lv_indev_get_event_count'] != 'undefined', 'missing Wasm export: lv_indev_get_event_count');
  assert(typeof wasmExports['lv_indev_get_event_dsc'] != 'undefined', 'missing Wasm export: lv_indev_get_event_dsc');
  assert(typeof wasmExports['lv_indev_remove_event'] != 'undefined', 'missing Wasm export: lv_indev_remove_event');
  assert(typeof wasmExports['lv_indev_remove_event_cb_with_user_data'] != 'undefined', 'missing Wasm export: lv_indev_remove_event_cb_with_user_data');
  assert(typeof wasmExports['lv_indev_scroll_throw_handler'] != 'undefined', 'missing Wasm export: lv_indev_scroll_throw_handler');
  assert(typeof wasmExports['lv_timer_get_paused'] != 'undefined', 'missing Wasm export: lv_timer_get_paused');
  assert(typeof wasmExports['lv_indev_scroll_throw_predict'] != 'undefined', 'missing Wasm export: lv_indev_scroll_throw_predict');
  assert(typeof wasmExports['lv_flex_init'] != 'undefined', 'missing Wasm export: lv_flex_init');
  assert(typeof wasmExports['lv_obj_set_flex_flow'] != 'undefined', 'missing Wasm export: lv_obj_set_flex_flow');
  assert(typeof wasmExports['lv_obj_set_flex_align'] != 'undefined', 'missing Wasm export: lv_obj_set_flex_align');
  assert(typeof wasmExports['lv_obj_set_flex_grow'] != 'undefined', 'missing Wasm export: lv_obj_set_flex_grow');
  assert(typeof wasmExports['lv_grid_init'] != 'undefined', 'missing Wasm export: lv_grid_init');
  assert(typeof wasmExports['lv_obj_set_grid_dsc_array'] != 'undefined', 'missing Wasm export: lv_obj_set_grid_dsc_array');
  assert(typeof wasmExports['lv_obj_set_grid_align'] != 'undefined', 'missing Wasm export: lv_obj_set_grid_align');
  assert(typeof wasmExports['lv_obj_set_grid_cell'] != 'undefined', 'missing Wasm export: lv_obj_set_grid_cell');
  assert(typeof wasmExports['lv_grid_fr'] != 'undefined', 'missing Wasm export: lv_grid_fr');
  assert(typeof wasmExports['lv_layout_init'] != 'undefined', 'missing Wasm export: lv_layout_init');
  assert(typeof wasmExports['lv_layout_deinit'] != 'undefined', 'missing Wasm export: lv_layout_deinit');
  assert(typeof wasmExports['lv_layout_register'] != 'undefined', 'missing Wasm export: lv_layout_register');
  assert(typeof wasmExports['lv_bin_decoder_init'] != 'undefined', 'missing Wasm export: lv_bin_decoder_init');
  assert(typeof wasmExports['lv_bin_decoder_info'] != 'undefined', 'missing Wasm export: lv_bin_decoder_info');
  assert(typeof wasmExports['lv_bin_decoder_open'] != 'undefined', 'missing Wasm export: lv_bin_decoder_open');
  assert(typeof wasmExports['lv_bin_decoder_get_area'] != 'undefined', 'missing Wasm export: lv_bin_decoder_get_area');
  assert(typeof wasmExports['lv_bin_decoder_close'] != 'undefined', 'missing Wasm export: lv_bin_decoder_close');
  assert(typeof wasmExports['free'] != 'undefined', 'missing Wasm export: free');
  assert(typeof wasmExports['strncmp'] != 'undefined', 'missing Wasm export: strncmp');
  assert(typeof wasmExports['lv_cache_create'] != 'undefined', 'missing Wasm export: lv_cache_create');
  assert(typeof wasmExports['lv_cache_set_name'] != 'undefined', 'missing Wasm export: lv_cache_set_name');
  assert(typeof wasmExports['lv_strlen'] != 'undefined', 'missing Wasm export: lv_strlen');
  assert(typeof wasmExports['lv_cache_acquire_or_create'] != 'undefined', 'missing Wasm export: lv_cache_acquire_or_create');
  assert(typeof wasmExports['lv_cache_entry_get_ref'] != 'undefined', 'missing Wasm export: lv_cache_entry_get_ref');
  assert(typeof wasmExports['lv_cache_drop'] != 'undefined', 'missing Wasm export: lv_cache_drop');
  assert(typeof wasmExports['lv_fs_stdio_init'] != 'undefined', 'missing Wasm export: lv_fs_stdio_init');
  assert(typeof wasmExports['lv_canvas_get_draw_buf'] != 'undefined', 'missing Wasm export: lv_canvas_get_draw_buf');
  assert(typeof wasmExports['lv_image_cache_drop'] != 'undefined', 'missing Wasm export: lv_image_cache_drop');
  assert(typeof wasmExports['lv_canvas_set_draw_buf'] != 'undefined', 'missing Wasm export: lv_canvas_set_draw_buf');
  assert(typeof wasmExports['lv_canvas_set_palette'] != 'undefined', 'missing Wasm export: lv_canvas_set_palette');
  assert(typeof wasmExports['lv_canvas_set_px'] != 'undefined', 'missing Wasm export: lv_canvas_set_px');
  assert(typeof wasmExports['lv_qrcode_set_data'] != 'undefined', 'missing Wasm export: lv_qrcode_set_data');
  assert(typeof wasmExports['lv_qrcode_set_quiet_zone'] != 'undefined', 'missing Wasm export: lv_qrcode_set_quiet_zone');
  assert(typeof wasmExports['lv_is_initialized'] != 'undefined', 'missing Wasm export: lv_is_initialized');
  assert(typeof wasmExports['lv_rand_set_seed'] != 'undefined', 'missing Wasm export: lv_rand_set_seed');
  assert(typeof wasmExports['lv_mem_init'] != 'undefined', 'missing Wasm export: lv_mem_init');
  assert(typeof wasmExports['lv_span_stack_init'] != 'undefined', 'missing Wasm export: lv_span_stack_init');
  assert(typeof wasmExports['lv_os_init'] != 'undefined', 'missing Wasm export: lv_os_init');
  assert(typeof wasmExports['lv_timer_core_init'] != 'undefined', 'missing Wasm export: lv_timer_core_init');
  assert(typeof wasmExports['lv_fs_init'] != 'undefined', 'missing Wasm export: lv_fs_init');
  assert(typeof wasmExports['lv_anim_core_init'] != 'undefined', 'missing Wasm export: lv_anim_core_init');
  assert(typeof wasmExports['lv_color_to_u16'] != 'undefined', 'missing Wasm export: lv_color_to_u16');
  assert(typeof wasmExports['lv_color_16_16_mix'] != 'undefined', 'missing Wasm export: lv_color_16_16_mix');
  assert(typeof wasmExports['lv_color_mix32'] != 'undefined', 'missing Wasm export: lv_color_mix32');
  assert(typeof wasmExports['lv_color32_eq'] != 'undefined', 'missing Wasm export: lv_color32_eq');
  assert(typeof wasmExports['lv_color_mix32_premultiplied'] != 'undefined', 'missing Wasm export: lv_color_mix32_premultiplied');
  assert(typeof wasmExports['lv_color_luminance'] != 'undefined', 'missing Wasm export: lv_color_luminance');
  assert(typeof wasmExports['lv_color32_luminance'] != 'undefined', 'missing Wasm export: lv_color32_luminance');
  assert(typeof wasmExports['lv_color16_luminance'] != 'undefined', 'missing Wasm export: lv_color16_luminance');
  assert(typeof wasmExports['lv_color24_luminance'] != 'undefined', 'missing Wasm export: lv_color24_luminance');
  assert(typeof wasmExports['lv_trigo_cos'] != 'undefined', 'missing Wasm export: lv_trigo_cos');
  assert(typeof wasmExports['lv_point_from_precise'] != 'undefined', 'missing Wasm export: lv_point_from_precise');
  assert(typeof wasmExports['lv_point_swap'] != 'undefined', 'missing Wasm export: lv_point_swap');
  assert(typeof wasmExports['lv_fs_get_ext'] != 'undefined', 'missing Wasm export: lv_fs_get_ext');
  assert(typeof wasmExports['lv_snprintf'] != 'undefined', 'missing Wasm export: lv_snprintf');
  assert(typeof wasmExports['lv_strlcpy'] != 'undefined', 'missing Wasm export: lv_strlcpy');
  assert(typeof wasmExports['lv_ll_clear_custom'] != 'undefined', 'missing Wasm export: lv_ll_clear_custom');
  assert(typeof wasmExports['lv_span_stack_deinit'] != 'undefined', 'missing Wasm export: lv_span_stack_deinit');
  assert(typeof wasmExports['lv_theme_default_deinit'] != 'undefined', 'missing Wasm export: lv_theme_default_deinit');
  assert(typeof wasmExports['lv_theme_simple_deinit'] != 'undefined', 'missing Wasm export: lv_theme_simple_deinit');
  assert(typeof wasmExports['lv_theme_mono_deinit'] != 'undefined', 'missing Wasm export: lv_theme_mono_deinit');
  assert(typeof wasmExports['lv_anim_core_deinit'] != 'undefined', 'missing Wasm export: lv_anim_core_deinit');
  assert(typeof wasmExports['lv_timer_core_deinit'] != 'undefined', 'missing Wasm export: lv_timer_core_deinit');
  assert(typeof wasmExports['lv_fs_deinit'] != 'undefined', 'missing Wasm export: lv_fs_deinit');
  assert(typeof wasmExports['lv_mem_deinit'] != 'undefined', 'missing Wasm export: lv_mem_deinit');
  assert(typeof wasmExports['lv_log_register_print_cb'] != 'undefined', 'missing Wasm export: lv_log_register_print_cb');
  assert(typeof wasmExports['lv_cache_entry_get_size'] != 'undefined', 'missing Wasm export: lv_cache_entry_get_size');
  assert(typeof wasmExports['lv_rb_init'] != 'undefined', 'missing Wasm export: lv_rb_init');
  assert(typeof wasmExports['lv_cache_entry_get_entry'] != 'undefined', 'missing Wasm export: lv_cache_entry_get_entry');
  assert(typeof wasmExports['lv_rb_find'] != 'undefined', 'missing Wasm export: lv_rb_find');
  assert(typeof wasmExports['lv_ll_move_before'] != 'undefined', 'missing Wasm export: lv_ll_move_before');
  assert(typeof wasmExports['lv_rb_insert'] != 'undefined', 'missing Wasm export: lv_rb_insert');
  assert(typeof wasmExports['lv_rb_drop_node'] != 'undefined', 'missing Wasm export: lv_rb_drop_node');
  assert(typeof wasmExports['lv_cache_entry_init'] != 'undefined', 'missing Wasm export: lv_cache_entry_init');
  assert(typeof wasmExports['lv_rb_remove_node'] != 'undefined', 'missing Wasm export: lv_rb_remove_node');
  assert(typeof wasmExports['lv_cache_entry_delete'] != 'undefined', 'missing Wasm export: lv_cache_entry_delete');
  assert(typeof wasmExports['lv_rb_destroy'] != 'undefined', 'missing Wasm export: lv_rb_destroy');
  assert(typeof wasmExports['lv_iter_create'] != 'undefined', 'missing Wasm export: lv_iter_create');
  assert(typeof wasmExports['lv_image_cache_resize'] != 'undefined', 'missing Wasm export: lv_image_cache_resize');
  assert(typeof wasmExports['lv_cache_set_max_size'] != 'undefined', 'missing Wasm export: lv_cache_set_max_size');
  assert(typeof wasmExports['lv_cache_reserve'] != 'undefined', 'missing Wasm export: lv_cache_reserve');
  assert(typeof wasmExports['lv_image_header_cache_drop'] != 'undefined', 'missing Wasm export: lv_image_header_cache_drop');
  assert(typeof wasmExports['lv_cache_drop_all'] != 'undefined', 'missing Wasm export: lv_cache_drop_all');
  assert(typeof wasmExports['lv_cache_is_enabled'] != 'undefined', 'missing Wasm export: lv_cache_is_enabled');
  assert(typeof wasmExports['lv_image_cache_iter_create'] != 'undefined', 'missing Wasm export: lv_image_cache_iter_create');
  assert(typeof wasmExports['lv_cache_iter_create'] != 'undefined', 'missing Wasm export: lv_cache_iter_create');
  assert(typeof wasmExports['lv_image_cache_dump'] != 'undefined', 'missing Wasm export: lv_image_cache_dump');
  assert(typeof wasmExports['lv_iter_inspect'] != 'undefined', 'missing Wasm export: lv_iter_inspect');
  assert(typeof wasmExports['lv_image_header_cache_resize'] != 'undefined', 'missing Wasm export: lv_image_header_cache_resize');
  assert(typeof wasmExports['lv_image_header_cache_iter_create'] != 'undefined', 'missing Wasm export: lv_image_header_cache_iter_create');
  assert(typeof wasmExports['lv_image_header_cache_dump'] != 'undefined', 'missing Wasm export: lv_image_header_cache_dump');
  assert(typeof wasmExports['lv_cache_entry_acquire_data'] != 'undefined', 'missing Wasm export: lv_cache_entry_acquire_data');
  assert(typeof wasmExports['lv_cache_entry_release_data'] != 'undefined', 'missing Wasm export: lv_cache_entry_release_data');
  assert(typeof wasmExports['lv_cache_entry_is_invalid'] != 'undefined', 'missing Wasm export: lv_cache_entry_is_invalid');
  assert(typeof wasmExports['lv_cache_entry_set_flag'] != 'undefined', 'missing Wasm export: lv_cache_entry_set_flag');
  assert(typeof wasmExports['lv_cache_evict_one'] != 'undefined', 'missing Wasm export: lv_cache_evict_one');
  assert(typeof wasmExports['lv_cache_get_max_size'] != 'undefined', 'missing Wasm export: lv_cache_get_max_size');
  assert(typeof wasmExports['lv_cache_get_size'] != 'undefined', 'missing Wasm export: lv_cache_get_size');
  assert(typeof wasmExports['lv_cache_get_free_size'] != 'undefined', 'missing Wasm export: lv_cache_get_free_size');
  assert(typeof wasmExports['lv_cache_set_compare_cb'] != 'undefined', 'missing Wasm export: lv_cache_set_compare_cb');
  assert(typeof wasmExports['lv_cache_set_create_cb'] != 'undefined', 'missing Wasm export: lv_cache_set_create_cb');
  assert(typeof wasmExports['lv_cache_set_free_cb'] != 'undefined', 'missing Wasm export: lv_cache_set_free_cb');
  assert(typeof wasmExports['lv_cache_get_name'] != 'undefined', 'missing Wasm export: lv_cache_get_name');
  assert(typeof wasmExports['lv_cache_entry_reset_ref'] != 'undefined', 'missing Wasm export: lv_cache_entry_reset_ref');
  assert(typeof wasmExports['lv_cache_entry_inc_ref'] != 'undefined', 'missing Wasm export: lv_cache_entry_inc_ref');
  assert(typeof wasmExports['lv_cache_entry_dec_ref'] != 'undefined', 'missing Wasm export: lv_cache_entry_dec_ref');
  assert(typeof wasmExports['lv_cache_entry_get_node_size'] != 'undefined', 'missing Wasm export: lv_cache_entry_get_node_size');
  assert(typeof wasmExports['lv_cache_entry_set_node_size'] != 'undefined', 'missing Wasm export: lv_cache_entry_set_node_size');
  assert(typeof wasmExports['lv_cache_entry_set_cache'] != 'undefined', 'missing Wasm export: lv_cache_entry_set_cache');
  assert(typeof wasmExports['lv_cache_entry_get_cache'] != 'undefined', 'missing Wasm export: lv_cache_entry_get_cache');
  assert(typeof wasmExports['lv_cache_entry_alloc'] != 'undefined', 'missing Wasm export: lv_cache_entry_alloc');
  assert(typeof wasmExports['lv_cache_entry_remove_flag'] != 'undefined', 'missing Wasm export: lv_cache_entry_remove_flag');
  assert(typeof wasmExports['lv_cache_entry_has_flag'] != 'undefined', 'missing Wasm export: lv_cache_entry_has_flag');
  assert(typeof wasmExports['lv_anim_delete_all'] != 'undefined', 'missing Wasm export: lv_anim_delete_all');
  assert(typeof wasmExports['lv_anim_enable_vsync_mode'] != 'undefined', 'missing Wasm export: lv_anim_enable_vsync_mode');
  assert(typeof wasmExports['lv_anim_path_linear'] != 'undefined', 'missing Wasm export: lv_anim_path_linear');
  assert(typeof wasmExports['lv_map'] != 'undefined', 'missing Wasm export: lv_map');
  assert(typeof wasmExports['lv_anim_get_playtime'] != 'undefined', 'missing Wasm export: lv_anim_get_playtime');
  assert(typeof wasmExports['lv_anim_get_timer'] != 'undefined', 'missing Wasm export: lv_anim_get_timer');
  assert(typeof wasmExports['lv_anim_count_running'] != 'undefined', 'missing Wasm export: lv_anim_count_running');
  assert(typeof wasmExports['lv_anim_speed'] != 'undefined', 'missing Wasm export: lv_anim_speed');
  assert(typeof wasmExports['lv_anim_speed_to_time'] != 'undefined', 'missing Wasm export: lv_anim_speed_to_time');
  assert(typeof wasmExports['lv_anim_path_ease_in'] != 'undefined', 'missing Wasm export: lv_anim_path_ease_in');
  assert(typeof wasmExports['lv_cubic_bezier'] != 'undefined', 'missing Wasm export: lv_cubic_bezier');
  assert(typeof wasmExports['lv_anim_path_ease_in_out'] != 'undefined', 'missing Wasm export: lv_anim_path_ease_in_out');
  assert(typeof wasmExports['lv_anim_path_overshoot'] != 'undefined', 'missing Wasm export: lv_anim_path_overshoot');
  assert(typeof wasmExports['lv_anim_path_bounce'] != 'undefined', 'missing Wasm export: lv_anim_path_bounce');
  assert(typeof wasmExports['lv_bezier3'] != 'undefined', 'missing Wasm export: lv_bezier3');
  assert(typeof wasmExports['lv_anim_path_step'] != 'undefined', 'missing Wasm export: lv_anim_path_step');
  assert(typeof wasmExports['lv_anim_path_custom_bezier3'] != 'undefined', 'missing Wasm export: lv_anim_path_custom_bezier3');
  assert(typeof wasmExports['lv_anim_set_custom_exec_cb'] != 'undefined', 'missing Wasm export: lv_anim_set_custom_exec_cb');
  assert(typeof wasmExports['lv_anim_set_get_value_cb'] != 'undefined', 'missing Wasm export: lv_anim_set_get_value_cb');
  assert(typeof wasmExports['lv_anim_set_reverse_duration'] != 'undefined', 'missing Wasm export: lv_anim_set_reverse_duration');
  assert(typeof wasmExports['lv_anim_set_reverse_time'] != 'undefined', 'missing Wasm export: lv_anim_set_reverse_time');
  assert(typeof wasmExports['lv_anim_set_reverse_delay'] != 'undefined', 'missing Wasm export: lv_anim_set_reverse_delay');
  assert(typeof wasmExports['lv_anim_set_bezier3_param'] != 'undefined', 'missing Wasm export: lv_anim_set_bezier3_param');
  assert(typeof wasmExports['lv_anim_get_delay'] != 'undefined', 'missing Wasm export: lv_anim_get_delay');
  assert(typeof wasmExports['lv_anim_get_time'] != 'undefined', 'missing Wasm export: lv_anim_get_time');
  assert(typeof wasmExports['lv_anim_get_repeat_count'] != 'undefined', 'missing Wasm export: lv_anim_get_repeat_count');
  assert(typeof wasmExports['lv_anim_get_user_data'] != 'undefined', 'missing Wasm export: lv_anim_get_user_data');
  assert(typeof wasmExports['lv_anim_custom_delete'] != 'undefined', 'missing Wasm export: lv_anim_custom_delete');
  assert(typeof wasmExports['lv_anim_custom_get'] != 'undefined', 'missing Wasm export: lv_anim_custom_get');
  assert(typeof wasmExports['lv_anim_resolve_speed'] != 'undefined', 'missing Wasm export: lv_anim_resolve_speed');
  assert(typeof wasmExports['lv_anim_is_paused'] != 'undefined', 'missing Wasm export: lv_anim_is_paused');
  assert(typeof wasmExports['lv_anim_pause'] != 'undefined', 'missing Wasm export: lv_anim_pause');
  assert(typeof wasmExports['lv_anim_pause_for'] != 'undefined', 'missing Wasm export: lv_anim_pause_for');
  assert(typeof wasmExports['lv_anim_resume'] != 'undefined', 'missing Wasm export: lv_anim_resume');
  assert(typeof wasmExports['lv_anim_timeline_create'] != 'undefined', 'missing Wasm export: lv_anim_timeline_create');
  assert(typeof wasmExports['lv_anim_timeline_delete'] != 'undefined', 'missing Wasm export: lv_anim_timeline_delete');
  assert(typeof wasmExports['lv_anim_timeline_pause'] != 'undefined', 'missing Wasm export: lv_anim_timeline_pause');
  assert(typeof wasmExports['lv_anim_timeline_add'] != 'undefined', 'missing Wasm export: lv_anim_timeline_add');
  assert(typeof wasmExports['lv_anim_timeline_get_playtime'] != 'undefined', 'missing Wasm export: lv_anim_timeline_get_playtime');
  assert(typeof wasmExports['lv_anim_timeline_set_repeat_count'] != 'undefined', 'missing Wasm export: lv_anim_timeline_set_repeat_count');
  assert(typeof wasmExports['lv_anim_timeline_set_repeat_delay'] != 'undefined', 'missing Wasm export: lv_anim_timeline_set_repeat_delay');
  assert(typeof wasmExports['lv_anim_timeline_set_user_data'] != 'undefined', 'missing Wasm export: lv_anim_timeline_set_user_data');
  assert(typeof wasmExports['lv_anim_timeline_get_reverse'] != 'undefined', 'missing Wasm export: lv_anim_timeline_get_reverse');
  assert(typeof wasmExports['lv_anim_timeline_get_delay'] != 'undefined', 'missing Wasm export: lv_anim_timeline_get_delay');
  assert(typeof wasmExports['lv_anim_timeline_get_repeat_count'] != 'undefined', 'missing Wasm export: lv_anim_timeline_get_repeat_count');
  assert(typeof wasmExports['lv_anim_timeline_get_repeat_delay'] != 'undefined', 'missing Wasm export: lv_anim_timeline_get_repeat_delay');
  assert(typeof wasmExports['lv_anim_timeline_get_user_data'] != 'undefined', 'missing Wasm export: lv_anim_timeline_get_user_data');
  assert(typeof wasmExports['lv_anim_timeline_merge'] != 'undefined', 'missing Wasm export: lv_anim_timeline_merge');
  assert(typeof wasmExports['lv_area_set_pos'] != 'undefined', 'missing Wasm export: lv_area_set_pos');
  assert(typeof wasmExports['lv_area_is_equal'] != 'undefined', 'missing Wasm export: lv_area_is_equal');
  assert(typeof wasmExports['lv_point_to_precise'] != 'undefined', 'missing Wasm export: lv_point_to_precise');
  assert(typeof wasmExports['lv_point_precise_set'] != 'undefined', 'missing Wasm export: lv_point_precise_set');
  assert(typeof wasmExports['lv_point_precise_swap'] != 'undefined', 'missing Wasm export: lv_point_precise_swap');
  assert(typeof wasmExports['lv_pct'] != 'undefined', 'missing Wasm export: lv_pct');
  assert(typeof wasmExports['lv_pct_to_px'] != 'undefined', 'missing Wasm export: lv_pct_to_px');
  assert(typeof wasmExports['lv_array_init'] != 'undefined', 'missing Wasm export: lv_array_init');
  assert(typeof wasmExports['lv_array_init_from_buf'] != 'undefined', 'missing Wasm export: lv_array_init_from_buf');
  assert(typeof wasmExports['lv_array_deinit'] != 'undefined', 'missing Wasm export: lv_array_deinit');
  assert(typeof wasmExports['lv_array_copy'] != 'undefined', 'missing Wasm export: lv_array_copy');
  assert(typeof wasmExports['lv_array_shrink'] != 'undefined', 'missing Wasm export: lv_array_shrink');
  assert(typeof wasmExports['lv_array_resize'] != 'undefined', 'missing Wasm export: lv_array_resize');
  assert(typeof wasmExports['lv_array_remove'] != 'undefined', 'missing Wasm export: lv_array_remove');
  assert(typeof wasmExports['lv_array_at'] != 'undefined', 'missing Wasm export: lv_array_at');
  assert(typeof wasmExports['lv_array_erase'] != 'undefined', 'missing Wasm export: lv_array_erase');
  assert(typeof wasmExports['lv_array_concat'] != 'undefined', 'missing Wasm export: lv_array_concat');
  assert(typeof wasmExports['lv_array_push_back'] != 'undefined', 'missing Wasm export: lv_array_push_back');
  assert(typeof wasmExports['lv_array_assign'] != 'undefined', 'missing Wasm export: lv_array_assign');
  assert(typeof wasmExports['lv_timer_set_repeat_count'] != 'undefined', 'missing Wasm export: lv_timer_set_repeat_count');
  assert(typeof wasmExports['lv_timer_get_next'] != 'undefined', 'missing Wasm export: lv_timer_get_next');
  assert(typeof wasmExports['lv_bidi_process'] != 'undefined', 'missing Wasm export: lv_bidi_process');
  assert(typeof wasmExports['lv_bidi_detect_base_dir'] != 'undefined', 'missing Wasm export: lv_bidi_detect_base_dir');
  assert(typeof wasmExports['lv_bidi_get_visual_pos'] != 'undefined', 'missing Wasm export: lv_bidi_get_visual_pos');
  assert(typeof wasmExports['lv_bidi_set_custom_neutrals_static'] != 'undefined', 'missing Wasm export: lv_bidi_set_custom_neutrals_static');
  assert(typeof wasmExports['lv_circle_buf_create'] != 'undefined', 'missing Wasm export: lv_circle_buf_create');
  assert(typeof wasmExports['lv_circle_buf_create_from_buf'] != 'undefined', 'missing Wasm export: lv_circle_buf_create_from_buf');
  assert(typeof wasmExports['lv_circle_buf_create_from_array'] != 'undefined', 'missing Wasm export: lv_circle_buf_create_from_array');
  assert(typeof wasmExports['lv_circle_buf_resize'] != 'undefined', 'missing Wasm export: lv_circle_buf_resize');
  assert(typeof wasmExports['lv_circle_buf_destroy'] != 'undefined', 'missing Wasm export: lv_circle_buf_destroy');
  assert(typeof wasmExports['lv_circle_buf_size'] != 'undefined', 'missing Wasm export: lv_circle_buf_size');
  assert(typeof wasmExports['lv_circle_buf_capacity'] != 'undefined', 'missing Wasm export: lv_circle_buf_capacity');
  assert(typeof wasmExports['lv_circle_buf_remain'] != 'undefined', 'missing Wasm export: lv_circle_buf_remain');
  assert(typeof wasmExports['lv_circle_buf_is_empty'] != 'undefined', 'missing Wasm export: lv_circle_buf_is_empty');
  assert(typeof wasmExports['lv_circle_buf_is_full'] != 'undefined', 'missing Wasm export: lv_circle_buf_is_full');
  assert(typeof wasmExports['lv_circle_buf_reset'] != 'undefined', 'missing Wasm export: lv_circle_buf_reset');
  assert(typeof wasmExports['lv_circle_buf_head'] != 'undefined', 'missing Wasm export: lv_circle_buf_head');
  assert(typeof wasmExports['lv_circle_buf_tail'] != 'undefined', 'missing Wasm export: lv_circle_buf_tail');
  assert(typeof wasmExports['lv_circle_buf_read'] != 'undefined', 'missing Wasm export: lv_circle_buf_read');
  assert(typeof wasmExports['lv_circle_buf_peek_at'] != 'undefined', 'missing Wasm export: lv_circle_buf_peek_at');
  assert(typeof wasmExports['lv_circle_buf_write'] != 'undefined', 'missing Wasm export: lv_circle_buf_write');
  assert(typeof wasmExports['lv_circle_buf_fill'] != 'undefined', 'missing Wasm export: lv_circle_buf_fill');
  assert(typeof wasmExports['lv_circle_buf_skip'] != 'undefined', 'missing Wasm export: lv_circle_buf_skip');
  assert(typeof wasmExports['lv_circle_buf_peek'] != 'undefined', 'missing Wasm export: lv_circle_buf_peek');
  assert(typeof wasmExports['lv_color_lighten'] != 'undefined', 'missing Wasm export: lv_color_lighten');
  assert(typeof wasmExports['lv_color_darken'] != 'undefined', 'missing Wasm export: lv_color_darken');
  assert(typeof wasmExports['lv_color_hsv_to_rgb'] != 'undefined', 'missing Wasm export: lv_color_hsv_to_rgb');
  assert(typeof wasmExports['lv_color_rgb_to_hsv'] != 'undefined', 'missing Wasm export: lv_color_rgb_to_hsv');
  assert(typeof wasmExports['lv_color_to_hsv'] != 'undefined', 'missing Wasm export: lv_color_to_hsv');
  assert(typeof wasmExports['lv_color_to_int'] != 'undefined', 'missing Wasm export: lv_color_to_int');
  assert(typeof wasmExports['lv_color_hex3'] != 'undefined', 'missing Wasm export: lv_color_hex3');
  assert(typeof wasmExports['lv_color_brightness'] != 'undefined', 'missing Wasm export: lv_color_brightness');
  assert(typeof wasmExports['lv_color_filter_dsc_init'] != 'undefined', 'missing Wasm export: lv_color_filter_dsc_init');
  assert(typeof wasmExports['lv_event_dsc_get_cb'] != 'undefined', 'missing Wasm export: lv_event_dsc_get_cb');
  assert(typeof wasmExports['lv_event_dsc_get_user_data'] != 'undefined', 'missing Wasm export: lv_event_dsc_get_user_data');
  assert(typeof wasmExports['lv_event_stop_bubbling'] != 'undefined', 'missing Wasm export: lv_event_stop_bubbling');
  assert(typeof wasmExports['lv_event_stop_trickling'] != 'undefined', 'missing Wasm export: lv_event_stop_trickling');
  assert(typeof wasmExports['lv_event_stop_processing'] != 'undefined', 'missing Wasm export: lv_event_stop_processing');
  assert(typeof wasmExports['lv_event_register_id'] != 'undefined', 'missing Wasm export: lv_event_register_id');
  assert(typeof wasmExports['lv_event_code_get_name'] != 'undefined', 'missing Wasm export: lv_event_code_get_name');
  assert(typeof wasmExports['lv_fs_is_ready'] != 'undefined', 'missing Wasm export: lv_fs_is_ready');
  assert(typeof wasmExports['lv_fs_get_drv'] != 'undefined', 'missing Wasm export: lv_fs_get_drv');
  assert(typeof wasmExports['lv_fs_get_buffer_from_path'] != 'undefined', 'missing Wasm export: lv_fs_get_buffer_from_path');
  assert(typeof wasmExports['lv_fs_make_path_from_buffer'] != 'undefined', 'missing Wasm export: lv_fs_make_path_from_buffer');
  assert(typeof wasmExports['lv_fs_write'] != 'undefined', 'missing Wasm export: lv_fs_write');
  assert(typeof wasmExports['lv_fs_tell'] != 'undefined', 'missing Wasm export: lv_fs_tell');
  assert(typeof wasmExports['lv_fs_get_size'] != 'undefined', 'missing Wasm export: lv_fs_get_size');
  assert(typeof wasmExports['lv_fs_path_get_size'] != 'undefined', 'missing Wasm export: lv_fs_path_get_size');
  assert(typeof wasmExports['lv_fs_load_to_buf'] != 'undefined', 'missing Wasm export: lv_fs_load_to_buf');
  assert(typeof wasmExports['lv_fs_dir_open'] != 'undefined', 'missing Wasm export: lv_fs_dir_open');
  assert(typeof wasmExports['lv_fs_dir_read'] != 'undefined', 'missing Wasm export: lv_fs_dir_read');
  assert(typeof wasmExports['lv_fs_dir_close'] != 'undefined', 'missing Wasm export: lv_fs_dir_close');
  assert(typeof wasmExports['lv_fs_get_letters'] != 'undefined', 'missing Wasm export: lv_fs_get_letters');
  assert(typeof wasmExports['lv_fs_up'] != 'undefined', 'missing Wasm export: lv_fs_up');
  assert(typeof wasmExports['lv_fs_get_last'] != 'undefined', 'missing Wasm export: lv_fs_get_last');
  assert(typeof wasmExports['lv_fs_path_join'] != 'undefined', 'missing Wasm export: lv_fs_path_join');
  assert(typeof wasmExports['lv_grad_init_stops'] != 'undefined', 'missing Wasm export: lv_grad_init_stops');
  assert(typeof wasmExports['lv_grad_horizontal_init'] != 'undefined', 'missing Wasm export: lv_grad_horizontal_init');
  assert(typeof wasmExports['lv_grad_vertical_init'] != 'undefined', 'missing Wasm export: lv_grad_vertical_init');
  assert(typeof wasmExports['lv_grad_linear_init'] != 'undefined', 'missing Wasm export: lv_grad_linear_init');
  assert(typeof wasmExports['lv_grad_radial_init'] != 'undefined', 'missing Wasm export: lv_grad_radial_init');
  assert(typeof wasmExports['lv_grad_conical_init'] != 'undefined', 'missing Wasm export: lv_grad_conical_init');
  assert(typeof wasmExports['lv_grad_radial_set_focal'] != 'undefined', 'missing Wasm export: lv_grad_radial_set_focal');
  assert(typeof wasmExports['lv_iter_get_context'] != 'undefined', 'missing Wasm export: lv_iter_get_context');
  assert(typeof wasmExports['lv_iter_destroy'] != 'undefined', 'missing Wasm export: lv_iter_destroy');
  assert(typeof wasmExports['lv_iter_make_peekable'] != 'undefined', 'missing Wasm export: lv_iter_make_peekable');
  assert(typeof wasmExports['lv_iter_next'] != 'undefined', 'missing Wasm export: lv_iter_next');
  assert(typeof wasmExports['lv_iter_peek'] != 'undefined', 'missing Wasm export: lv_iter_peek');
  assert(typeof wasmExports['lv_iter_peek_advance'] != 'undefined', 'missing Wasm export: lv_iter_peek_advance');
  assert(typeof wasmExports['lv_iter_peek_reset'] != 'undefined', 'missing Wasm export: lv_iter_peek_reset');
  assert(typeof wasmExports['lv_ll_chg_list'] != 'undefined', 'missing Wasm export: lv_ll_chg_list');
  assert(typeof wasmExports['lv_vsnprintf'] != 'undefined', 'missing Wasm export: lv_vsnprintf');
  assert(typeof wasmExports['fflush'] != 'undefined', 'missing Wasm export: fflush');
  assert(typeof wasmExports['lv_log'] != 'undefined', 'missing Wasm export: lv_log');
  assert(typeof wasmExports['lv_lru_create'] != 'undefined', 'missing Wasm export: lv_lru_create');
  assert(typeof wasmExports['lv_lru_delete'] != 'undefined', 'missing Wasm export: lv_lru_delete');
  assert(typeof wasmExports['lv_lru_set'] != 'undefined', 'missing Wasm export: lv_lru_set');
  assert(typeof wasmExports['lv_lru_remove_lru_item'] != 'undefined', 'missing Wasm export: lv_lru_remove_lru_item');
  assert(typeof wasmExports['lv_lru_get'] != 'undefined', 'missing Wasm export: lv_lru_get');
  assert(typeof wasmExports['lv_lru_remove'] != 'undefined', 'missing Wasm export: lv_lru_remove');
  assert(typeof wasmExports['lv_sqrt'] != 'undefined', 'missing Wasm export: lv_sqrt');
  assert(typeof wasmExports['lv_sqrt32'] != 'undefined', 'missing Wasm export: lv_sqrt32');
  assert(typeof wasmExports['lv_atan2'] != 'undefined', 'missing Wasm export: lv_atan2');
  assert(typeof wasmExports['lv_pow'] != 'undefined', 'missing Wasm export: lv_pow');
  assert(typeof wasmExports['lv_rand'] != 'undefined', 'missing Wasm export: lv_rand');
  assert(typeof wasmExports['lv_palette_lighten'] != 'undefined', 'missing Wasm export: lv_palette_lighten');
  assert(typeof wasmExports['lv_palette_darken'] != 'undefined', 'missing Wasm export: lv_palette_darken');
  assert(typeof wasmExports['lv_rb_minimum_from'] != 'undefined', 'missing Wasm export: lv_rb_minimum_from');
  assert(typeof wasmExports['lv_rb_remove'] != 'undefined', 'missing Wasm export: lv_rb_remove');
  assert(typeof wasmExports['lv_rb_drop'] != 'undefined', 'missing Wasm export: lv_rb_drop');
  assert(typeof wasmExports['lv_rb_minimum'] != 'undefined', 'missing Wasm export: lv_rb_minimum');
  assert(typeof wasmExports['lv_rb_maximum'] != 'undefined', 'missing Wasm export: lv_rb_maximum');
  assert(typeof wasmExports['lv_rb_maximum_from'] != 'undefined', 'missing Wasm export: lv_rb_maximum_from');
  assert(typeof wasmExports['lv_style_copy'] != 'undefined', 'missing Wasm export: lv_style_copy');
  assert(typeof wasmExports['lv_style_merge'] != 'undefined', 'missing Wasm export: lv_style_merge');
  assert(typeof wasmExports['lv_style_register_prop'] != 'undefined', 'missing Wasm export: lv_style_register_prop');
  assert(typeof wasmExports['lv_style_get_num_custom_props'] != 'undefined', 'missing Wasm export: lv_style_get_num_custom_props');
  assert(typeof wasmExports['lv_style_transition_dsc_init'] != 'undefined', 'missing Wasm export: lv_style_transition_dsc_init');
  assert(typeof wasmExports['lv_style_set_width'] != 'undefined', 'missing Wasm export: lv_style_set_width');
  assert(typeof wasmExports['lv_style_set_min_width'] != 'undefined', 'missing Wasm export: lv_style_set_min_width');
  assert(typeof wasmExports['lv_style_set_max_width'] != 'undefined', 'missing Wasm export: lv_style_set_max_width');
  assert(typeof wasmExports['lv_style_set_height'] != 'undefined', 'missing Wasm export: lv_style_set_height');
  assert(typeof wasmExports['lv_style_set_min_height'] != 'undefined', 'missing Wasm export: lv_style_set_min_height');
  assert(typeof wasmExports['lv_style_set_max_height'] != 'undefined', 'missing Wasm export: lv_style_set_max_height');
  assert(typeof wasmExports['lv_style_set_length'] != 'undefined', 'missing Wasm export: lv_style_set_length');
  assert(typeof wasmExports['lv_style_set_x'] != 'undefined', 'missing Wasm export: lv_style_set_x');
  assert(typeof wasmExports['lv_style_set_y'] != 'undefined', 'missing Wasm export: lv_style_set_y');
  assert(typeof wasmExports['lv_style_set_align'] != 'undefined', 'missing Wasm export: lv_style_set_align');
  assert(typeof wasmExports['lv_style_set_transform_width'] != 'undefined', 'missing Wasm export: lv_style_set_transform_width');
  assert(typeof wasmExports['lv_style_set_transform_height'] != 'undefined', 'missing Wasm export: lv_style_set_transform_height');
  assert(typeof wasmExports['lv_style_set_translate_x'] != 'undefined', 'missing Wasm export: lv_style_set_translate_x');
  assert(typeof wasmExports['lv_style_set_translate_y'] != 'undefined', 'missing Wasm export: lv_style_set_translate_y');
  assert(typeof wasmExports['lv_style_set_translate_radial'] != 'undefined', 'missing Wasm export: lv_style_set_translate_radial');
  assert(typeof wasmExports['lv_style_set_transform_scale_x'] != 'undefined', 'missing Wasm export: lv_style_set_transform_scale_x');
  assert(typeof wasmExports['lv_style_set_transform_scale_y'] != 'undefined', 'missing Wasm export: lv_style_set_transform_scale_y');
  assert(typeof wasmExports['lv_style_set_transform_rotation'] != 'undefined', 'missing Wasm export: lv_style_set_transform_rotation');
  assert(typeof wasmExports['lv_style_set_transform_pivot_x'] != 'undefined', 'missing Wasm export: lv_style_set_transform_pivot_x');
  assert(typeof wasmExports['lv_style_set_transform_pivot_y'] != 'undefined', 'missing Wasm export: lv_style_set_transform_pivot_y');
  assert(typeof wasmExports['lv_style_set_transform_skew_x'] != 'undefined', 'missing Wasm export: lv_style_set_transform_skew_x');
  assert(typeof wasmExports['lv_style_set_transform_skew_y'] != 'undefined', 'missing Wasm export: lv_style_set_transform_skew_y');
  assert(typeof wasmExports['lv_style_set_pad_top'] != 'undefined', 'missing Wasm export: lv_style_set_pad_top');
  assert(typeof wasmExports['lv_style_set_pad_bottom'] != 'undefined', 'missing Wasm export: lv_style_set_pad_bottom');
  assert(typeof wasmExports['lv_style_set_pad_left'] != 'undefined', 'missing Wasm export: lv_style_set_pad_left');
  assert(typeof wasmExports['lv_style_set_pad_right'] != 'undefined', 'missing Wasm export: lv_style_set_pad_right');
  assert(typeof wasmExports['lv_style_set_pad_row'] != 'undefined', 'missing Wasm export: lv_style_set_pad_row');
  assert(typeof wasmExports['lv_style_set_pad_column'] != 'undefined', 'missing Wasm export: lv_style_set_pad_column');
  assert(typeof wasmExports['lv_style_set_pad_radial'] != 'undefined', 'missing Wasm export: lv_style_set_pad_radial');
  assert(typeof wasmExports['lv_style_set_margin_top'] != 'undefined', 'missing Wasm export: lv_style_set_margin_top');
  assert(typeof wasmExports['lv_style_set_margin_bottom'] != 'undefined', 'missing Wasm export: lv_style_set_margin_bottom');
  assert(typeof wasmExports['lv_style_set_margin_left'] != 'undefined', 'missing Wasm export: lv_style_set_margin_left');
  assert(typeof wasmExports['lv_style_set_margin_right'] != 'undefined', 'missing Wasm export: lv_style_set_margin_right');
  assert(typeof wasmExports['lv_style_set_bg_color'] != 'undefined', 'missing Wasm export: lv_style_set_bg_color');
  assert(typeof wasmExports['lv_style_set_bg_opa'] != 'undefined', 'missing Wasm export: lv_style_set_bg_opa');
  assert(typeof wasmExports['lv_style_set_bg_grad_color'] != 'undefined', 'missing Wasm export: lv_style_set_bg_grad_color');
  assert(typeof wasmExports['lv_style_set_bg_grad_dir'] != 'undefined', 'missing Wasm export: lv_style_set_bg_grad_dir');
  assert(typeof wasmExports['lv_style_set_bg_main_stop'] != 'undefined', 'missing Wasm export: lv_style_set_bg_main_stop');
  assert(typeof wasmExports['lv_style_set_bg_grad_stop'] != 'undefined', 'missing Wasm export: lv_style_set_bg_grad_stop');
  assert(typeof wasmExports['lv_style_set_bg_main_opa'] != 'undefined', 'missing Wasm export: lv_style_set_bg_main_opa');
  assert(typeof wasmExports['lv_style_set_bg_grad_opa'] != 'undefined', 'missing Wasm export: lv_style_set_bg_grad_opa');
  assert(typeof wasmExports['lv_style_set_bg_grad'] != 'undefined', 'missing Wasm export: lv_style_set_bg_grad');
  assert(typeof wasmExports['lv_style_set_bg_image_src'] != 'undefined', 'missing Wasm export: lv_style_set_bg_image_src');
  assert(typeof wasmExports['lv_style_set_bg_image_opa'] != 'undefined', 'missing Wasm export: lv_style_set_bg_image_opa');
  assert(typeof wasmExports['lv_style_set_bg_image_recolor'] != 'undefined', 'missing Wasm export: lv_style_set_bg_image_recolor');
  assert(typeof wasmExports['lv_style_set_bg_image_recolor_opa'] != 'undefined', 'missing Wasm export: lv_style_set_bg_image_recolor_opa');
  assert(typeof wasmExports['lv_style_set_bg_image_tiled'] != 'undefined', 'missing Wasm export: lv_style_set_bg_image_tiled');
  assert(typeof wasmExports['lv_style_set_border_color'] != 'undefined', 'missing Wasm export: lv_style_set_border_color');
  assert(typeof wasmExports['lv_style_set_border_opa'] != 'undefined', 'missing Wasm export: lv_style_set_border_opa');
  assert(typeof wasmExports['lv_style_set_border_width'] != 'undefined', 'missing Wasm export: lv_style_set_border_width');
  assert(typeof wasmExports['lv_style_set_border_side'] != 'undefined', 'missing Wasm export: lv_style_set_border_side');
  assert(typeof wasmExports['lv_style_set_border_post'] != 'undefined', 'missing Wasm export: lv_style_set_border_post');
  assert(typeof wasmExports['lv_style_set_outline_width'] != 'undefined', 'missing Wasm export: lv_style_set_outline_width');
  assert(typeof wasmExports['lv_style_set_outline_color'] != 'undefined', 'missing Wasm export: lv_style_set_outline_color');
  assert(typeof wasmExports['lv_style_set_outline_opa'] != 'undefined', 'missing Wasm export: lv_style_set_outline_opa');
  assert(typeof wasmExports['lv_style_set_outline_pad'] != 'undefined', 'missing Wasm export: lv_style_set_outline_pad');
  assert(typeof wasmExports['lv_style_set_shadow_width'] != 'undefined', 'missing Wasm export: lv_style_set_shadow_width');
  assert(typeof wasmExports['lv_style_set_shadow_offset_x'] != 'undefined', 'missing Wasm export: lv_style_set_shadow_offset_x');
  assert(typeof wasmExports['lv_style_set_shadow_offset_y'] != 'undefined', 'missing Wasm export: lv_style_set_shadow_offset_y');
  assert(typeof wasmExports['lv_style_set_shadow_spread'] != 'undefined', 'missing Wasm export: lv_style_set_shadow_spread');
  assert(typeof wasmExports['lv_style_set_shadow_color'] != 'undefined', 'missing Wasm export: lv_style_set_shadow_color');
  assert(typeof wasmExports['lv_style_set_shadow_opa'] != 'undefined', 'missing Wasm export: lv_style_set_shadow_opa');
  assert(typeof wasmExports['lv_style_set_image_opa'] != 'undefined', 'missing Wasm export: lv_style_set_image_opa');
  assert(typeof wasmExports['lv_style_set_image_recolor'] != 'undefined', 'missing Wasm export: lv_style_set_image_recolor');
  assert(typeof wasmExports['lv_style_set_image_recolor_opa'] != 'undefined', 'missing Wasm export: lv_style_set_image_recolor_opa');
  assert(typeof wasmExports['lv_style_set_image_colorkey'] != 'undefined', 'missing Wasm export: lv_style_set_image_colorkey');
  assert(typeof wasmExports['lv_style_set_line_width'] != 'undefined', 'missing Wasm export: lv_style_set_line_width');
  assert(typeof wasmExports['lv_style_set_line_dash_width'] != 'undefined', 'missing Wasm export: lv_style_set_line_dash_width');
  assert(typeof wasmExports['lv_style_set_line_dash_gap'] != 'undefined', 'missing Wasm export: lv_style_set_line_dash_gap');
  assert(typeof wasmExports['lv_style_set_line_rounded'] != 'undefined', 'missing Wasm export: lv_style_set_line_rounded');
  assert(typeof wasmExports['lv_style_set_line_color'] != 'undefined', 'missing Wasm export: lv_style_set_line_color');
  assert(typeof wasmExports['lv_style_set_line_opa'] != 'undefined', 'missing Wasm export: lv_style_set_line_opa');
  assert(typeof wasmExports['lv_style_set_arc_width'] != 'undefined', 'missing Wasm export: lv_style_set_arc_width');
  assert(typeof wasmExports['lv_style_set_arc_rounded'] != 'undefined', 'missing Wasm export: lv_style_set_arc_rounded');
  assert(typeof wasmExports['lv_style_set_arc_color'] != 'undefined', 'missing Wasm export: lv_style_set_arc_color');
  assert(typeof wasmExports['lv_style_set_arc_opa'] != 'undefined', 'missing Wasm export: lv_style_set_arc_opa');
  assert(typeof wasmExports['lv_style_set_arc_image_src'] != 'undefined', 'missing Wasm export: lv_style_set_arc_image_src');
  assert(typeof wasmExports['lv_style_set_text_color'] != 'undefined', 'missing Wasm export: lv_style_set_text_color');
  assert(typeof wasmExports['lv_style_set_text_opa'] != 'undefined', 'missing Wasm export: lv_style_set_text_opa');
  assert(typeof wasmExports['lv_style_set_text_font'] != 'undefined', 'missing Wasm export: lv_style_set_text_font');
  assert(typeof wasmExports['lv_style_set_text_letter_space'] != 'undefined', 'missing Wasm export: lv_style_set_text_letter_space');
  assert(typeof wasmExports['lv_style_set_text_line_space'] != 'undefined', 'missing Wasm export: lv_style_set_text_line_space');
  assert(typeof wasmExports['lv_style_set_text_decor'] != 'undefined', 'missing Wasm export: lv_style_set_text_decor');
  assert(typeof wasmExports['lv_style_set_text_align'] != 'undefined', 'missing Wasm export: lv_style_set_text_align');
  assert(typeof wasmExports['lv_style_set_text_outline_stroke_color'] != 'undefined', 'missing Wasm export: lv_style_set_text_outline_stroke_color');
  assert(typeof wasmExports['lv_style_set_text_outline_stroke_width'] != 'undefined', 'missing Wasm export: lv_style_set_text_outline_stroke_width');
  assert(typeof wasmExports['lv_style_set_text_outline_stroke_opa'] != 'undefined', 'missing Wasm export: lv_style_set_text_outline_stroke_opa');
  assert(typeof wasmExports['lv_style_set_radius'] != 'undefined', 'missing Wasm export: lv_style_set_radius');
  assert(typeof wasmExports['lv_style_set_radial_offset'] != 'undefined', 'missing Wasm export: lv_style_set_radial_offset');
  assert(typeof wasmExports['lv_style_set_clip_corner'] != 'undefined', 'missing Wasm export: lv_style_set_clip_corner');
  assert(typeof wasmExports['lv_style_set_opa'] != 'undefined', 'missing Wasm export: lv_style_set_opa');
  assert(typeof wasmExports['lv_style_set_opa_layered'] != 'undefined', 'missing Wasm export: lv_style_set_opa_layered');
  assert(typeof wasmExports['lv_style_set_color_filter_dsc'] != 'undefined', 'missing Wasm export: lv_style_set_color_filter_dsc');
  assert(typeof wasmExports['lv_style_set_color_filter_opa'] != 'undefined', 'missing Wasm export: lv_style_set_color_filter_opa');
  assert(typeof wasmExports['lv_style_set_recolor'] != 'undefined', 'missing Wasm export: lv_style_set_recolor');
  assert(typeof wasmExports['lv_style_set_recolor_opa'] != 'undefined', 'missing Wasm export: lv_style_set_recolor_opa');
  assert(typeof wasmExports['lv_style_set_anim'] != 'undefined', 'missing Wasm export: lv_style_set_anim');
  assert(typeof wasmExports['lv_style_set_anim_duration'] != 'undefined', 'missing Wasm export: lv_style_set_anim_duration');
  assert(typeof wasmExports['lv_style_set_transition'] != 'undefined', 'missing Wasm export: lv_style_set_transition');
  assert(typeof wasmExports['lv_style_set_blend_mode'] != 'undefined', 'missing Wasm export: lv_style_set_blend_mode');
  assert(typeof wasmExports['lv_style_set_layout'] != 'undefined', 'missing Wasm export: lv_style_set_layout');
  assert(typeof wasmExports['lv_style_set_base_dir'] != 'undefined', 'missing Wasm export: lv_style_set_base_dir');
  assert(typeof wasmExports['lv_style_set_bitmap_mask_src'] != 'undefined', 'missing Wasm export: lv_style_set_bitmap_mask_src');
  assert(typeof wasmExports['lv_style_set_rotary_sensitivity'] != 'undefined', 'missing Wasm export: lv_style_set_rotary_sensitivity');
  assert(typeof wasmExports['lv_style_set_flex_flow'] != 'undefined', 'missing Wasm export: lv_style_set_flex_flow');
  assert(typeof wasmExports['lv_style_set_flex_main_place'] != 'undefined', 'missing Wasm export: lv_style_set_flex_main_place');
  assert(typeof wasmExports['lv_style_set_flex_cross_place'] != 'undefined', 'missing Wasm export: lv_style_set_flex_cross_place');
  assert(typeof wasmExports['lv_style_set_flex_track_place'] != 'undefined', 'missing Wasm export: lv_style_set_flex_track_place');
  assert(typeof wasmExports['lv_style_set_flex_grow'] != 'undefined', 'missing Wasm export: lv_style_set_flex_grow');
  assert(typeof wasmExports['lv_style_set_grid_column_dsc_array'] != 'undefined', 'missing Wasm export: lv_style_set_grid_column_dsc_array');
  assert(typeof wasmExports['lv_style_set_grid_column_align'] != 'undefined', 'missing Wasm export: lv_style_set_grid_column_align');
  assert(typeof wasmExports['lv_style_set_grid_row_dsc_array'] != 'undefined', 'missing Wasm export: lv_style_set_grid_row_dsc_array');
  assert(typeof wasmExports['lv_style_set_grid_row_align'] != 'undefined', 'missing Wasm export: lv_style_set_grid_row_align');
  assert(typeof wasmExports['lv_style_set_grid_cell_column_pos'] != 'undefined', 'missing Wasm export: lv_style_set_grid_cell_column_pos');
  assert(typeof wasmExports['lv_style_set_grid_cell_x_align'] != 'undefined', 'missing Wasm export: lv_style_set_grid_cell_x_align');
  assert(typeof wasmExports['lv_style_set_grid_cell_column_span'] != 'undefined', 'missing Wasm export: lv_style_set_grid_cell_column_span');
  assert(typeof wasmExports['lv_style_set_grid_cell_row_pos'] != 'undefined', 'missing Wasm export: lv_style_set_grid_cell_row_pos');
  assert(typeof wasmExports['lv_style_set_grid_cell_y_align'] != 'undefined', 'missing Wasm export: lv_style_set_grid_cell_y_align');
  assert(typeof wasmExports['lv_style_set_grid_cell_row_span'] != 'undefined', 'missing Wasm export: lv_style_set_grid_cell_row_span');
  assert(typeof wasmExports['lv_text_attributes_init'] != 'undefined', 'missing Wasm export: lv_text_attributes_init');
  assert(typeof wasmExports['lv_text_get_size'] != 'undefined', 'missing Wasm export: lv_text_get_size');
  assert(typeof wasmExports['lv_text_is_cmd'] != 'undefined', 'missing Wasm export: lv_text_is_cmd');
  assert(typeof wasmExports['lv_text_ins'] != 'undefined', 'missing Wasm export: lv_text_ins');
  assert(typeof wasmExports['lv_text_cut'] != 'undefined', 'missing Wasm export: lv_text_cut');
  assert(typeof wasmExports['lv_text_set_text_vfmt'] != 'undefined', 'missing Wasm export: lv_text_set_text_vfmt');
  assert(typeof wasmExports['lv_timer_enable'] != 'undefined', 'missing Wasm export: lv_timer_enable');
  assert(typeof wasmExports['lv_lock'] != 'undefined', 'missing Wasm export: lv_lock');
  assert(typeof wasmExports['lv_unlock'] != 'undefined', 'missing Wasm export: lv_unlock');
  assert(typeof wasmExports['lv_timer_periodic_handler'] != 'undefined', 'missing Wasm export: lv_timer_periodic_handler');
  assert(typeof wasmExports['lv_timer_create_basic'] != 'undefined', 'missing Wasm export: lv_timer_create_basic');
  assert(typeof wasmExports['lv_timer_set_period'] != 'undefined', 'missing Wasm export: lv_timer_set_period');
  assert(typeof wasmExports['lv_timer_set_auto_delete'] != 'undefined', 'missing Wasm export: lv_timer_set_auto_delete');
  assert(typeof wasmExports['lv_timer_set_user_data'] != 'undefined', 'missing Wasm export: lv_timer_set_user_data');
  assert(typeof wasmExports['lv_timer_reset'] != 'undefined', 'missing Wasm export: lv_timer_reset');
  assert(typeof wasmExports['lv_timer_get_idle'] != 'undefined', 'missing Wasm export: lv_timer_get_idle');
  assert(typeof wasmExports['lv_timer_get_time_until_next'] != 'undefined', 'missing Wasm export: lv_timer_get_time_until_next');
  assert(typeof wasmExports['lv_timer_handler_run_in_period'] != 'undefined', 'missing Wasm export: lv_timer_handler_run_in_period');
  assert(typeof wasmExports['lv_timer_get_user_data'] != 'undefined', 'missing Wasm export: lv_timer_get_user_data');
  assert(typeof wasmExports['lv_timer_handler_set_resume_cb'] != 'undefined', 'missing Wasm export: lv_timer_handler_set_resume_cb');
  assert(typeof wasmExports['lv_tree_node_create'] != 'undefined', 'missing Wasm export: lv_tree_node_create');
  assert(typeof wasmExports['lv_tree_node_delete'] != 'undefined', 'missing Wasm export: lv_tree_node_delete');
  assert(typeof wasmExports['lv_tree_walk'] != 'undefined', 'missing Wasm export: lv_tree_walk');
  assert(typeof wasmExports['lv_draw_buf_save_to_file'] != 'undefined', 'missing Wasm export: lv_draw_buf_save_to_file');
  assert(typeof wasmExports['lv_lock_isr'] != 'undefined', 'missing Wasm export: lv_lock_isr');
  assert(typeof wasmExports['lv_sleep_ms'] != 'undefined', 'missing Wasm export: lv_sleep_ms');
  assert(typeof wasmExports['lv_delay_ms'] != 'undefined', 'missing Wasm export: lv_delay_ms');
  assert(typeof wasmExports['lv_os_get_idle_percent'] != 'undefined', 'missing Wasm export: lv_os_get_idle_percent');
  assert(typeof wasmExports['lv_gridnav_add'] != 'undefined', 'missing Wasm export: lv_gridnav_add');
  assert(typeof wasmExports['lv_gridnav_remove'] != 'undefined', 'missing Wasm export: lv_gridnav_remove');
  assert(typeof wasmExports['lv_gridnav_set_focused'] != 'undefined', 'missing Wasm export: lv_gridnav_set_focused');
  assert(typeof wasmExports['lv_subject_init_int'] != 'undefined', 'missing Wasm export: lv_subject_init_int');
  assert(typeof wasmExports['lv_subject_set_int'] != 'undefined', 'missing Wasm export: lv_subject_set_int');
  assert(typeof wasmExports['lv_subject_notify'] != 'undefined', 'missing Wasm export: lv_subject_notify');
  assert(typeof wasmExports['lv_subject_get_int'] != 'undefined', 'missing Wasm export: lv_subject_get_int');
  assert(typeof wasmExports['lv_subject_get_previous_int'] != 'undefined', 'missing Wasm export: lv_subject_get_previous_int');
  assert(typeof wasmExports['lv_subject_set_min_value_int'] != 'undefined', 'missing Wasm export: lv_subject_set_min_value_int');
  assert(typeof wasmExports['lv_subject_set_max_value_int'] != 'undefined', 'missing Wasm export: lv_subject_set_max_value_int');
  assert(typeof wasmExports['lv_subject_init_string'] != 'undefined', 'missing Wasm export: lv_subject_init_string');
  assert(typeof wasmExports['lv_subject_copy_string'] != 'undefined', 'missing Wasm export: lv_subject_copy_string');
  assert(typeof wasmExports['lv_subject_snprintf'] != 'undefined', 'missing Wasm export: lv_subject_snprintf');
  assert(typeof wasmExports['lv_subject_get_string'] != 'undefined', 'missing Wasm export: lv_subject_get_string');
  assert(typeof wasmExports['lv_subject_get_previous_string'] != 'undefined', 'missing Wasm export: lv_subject_get_previous_string');
  assert(typeof wasmExports['lv_subject_init_pointer'] != 'undefined', 'missing Wasm export: lv_subject_init_pointer');
  assert(typeof wasmExports['lv_subject_set_pointer'] != 'undefined', 'missing Wasm export: lv_subject_set_pointer');
  assert(typeof wasmExports['lv_subject_get_pointer'] != 'undefined', 'missing Wasm export: lv_subject_get_pointer');
  assert(typeof wasmExports['lv_subject_get_previous_pointer'] != 'undefined', 'missing Wasm export: lv_subject_get_previous_pointer');
  assert(typeof wasmExports['lv_subject_init_color'] != 'undefined', 'missing Wasm export: lv_subject_init_color');
  assert(typeof wasmExports['lv_subject_set_color'] != 'undefined', 'missing Wasm export: lv_subject_set_color');
  assert(typeof wasmExports['lv_subject_get_color'] != 'undefined', 'missing Wasm export: lv_subject_get_color');
  assert(typeof wasmExports['lv_subject_get_previous_color'] != 'undefined', 'missing Wasm export: lv_subject_get_previous_color');
  assert(typeof wasmExports['lv_subject_init_group'] != 'undefined', 'missing Wasm export: lv_subject_init_group');
  assert(typeof wasmExports['lv_subject_add_observer_obj'] != 'undefined', 'missing Wasm export: lv_subject_add_observer_obj');
  assert(typeof wasmExports['lv_subject_add_observer'] != 'undefined', 'missing Wasm export: lv_subject_add_observer');
  assert(typeof wasmExports['lv_subject_deinit'] != 'undefined', 'missing Wasm export: lv_subject_deinit');
  assert(typeof wasmExports['lv_observer_remove'] != 'undefined', 'missing Wasm export: lv_observer_remove');
  assert(typeof wasmExports['lv_subject_get_group_element'] != 'undefined', 'missing Wasm export: lv_subject_get_group_element');
  assert(typeof wasmExports['lv_subject_add_observer_with_target'] != 'undefined', 'missing Wasm export: lv_subject_add_observer_with_target');
  assert(typeof wasmExports['lv_obj_remove_from_subject'] != 'undefined', 'missing Wasm export: lv_obj_remove_from_subject');
  assert(typeof wasmExports['lv_observer_get_target'] != 'undefined', 'missing Wasm export: lv_observer_get_target');
  assert(typeof wasmExports['lv_obj_add_subject_increment_event'] != 'undefined', 'missing Wasm export: lv_obj_add_subject_increment_event');
  assert(typeof wasmExports['lv_obj_set_subject_increment_event_min_value'] != 'undefined', 'missing Wasm export: lv_obj_set_subject_increment_event_min_value');
  assert(typeof wasmExports['lv_obj_set_subject_increment_event_max_value'] != 'undefined', 'missing Wasm export: lv_obj_set_subject_increment_event_max_value');
  assert(typeof wasmExports['lv_obj_set_subject_increment_event_rollover'] != 'undefined', 'missing Wasm export: lv_obj_set_subject_increment_event_rollover');
  assert(typeof wasmExports['lv_obj_add_subject_toggle_event'] != 'undefined', 'missing Wasm export: lv_obj_add_subject_toggle_event');
  assert(typeof wasmExports['lv_obj_add_subject_set_int_event'] != 'undefined', 'missing Wasm export: lv_obj_add_subject_set_int_event');
  assert(typeof wasmExports['lv_obj_add_subject_set_string_event'] != 'undefined', 'missing Wasm export: lv_obj_add_subject_set_string_event');
  assert(typeof wasmExports['lv_obj_bind_style'] != 'undefined', 'missing Wasm export: lv_obj_bind_style');
  assert(typeof wasmExports['lv_obj_bind_flag_if_eq'] != 'undefined', 'missing Wasm export: lv_obj_bind_flag_if_eq');
  assert(typeof wasmExports['lv_obj_bind_flag_if_not_eq'] != 'undefined', 'missing Wasm export: lv_obj_bind_flag_if_not_eq');
  assert(typeof wasmExports['lv_obj_bind_flag_if_gt'] != 'undefined', 'missing Wasm export: lv_obj_bind_flag_if_gt');
  assert(typeof wasmExports['lv_obj_bind_flag_if_ge'] != 'undefined', 'missing Wasm export: lv_obj_bind_flag_if_ge');
  assert(typeof wasmExports['lv_obj_bind_flag_if_lt'] != 'undefined', 'missing Wasm export: lv_obj_bind_flag_if_lt');
  assert(typeof wasmExports['lv_obj_bind_flag_if_le'] != 'undefined', 'missing Wasm export: lv_obj_bind_flag_if_le');
  assert(typeof wasmExports['lv_obj_bind_state_if_eq'] != 'undefined', 'missing Wasm export: lv_obj_bind_state_if_eq');
  assert(typeof wasmExports['lv_obj_bind_state_if_not_eq'] != 'undefined', 'missing Wasm export: lv_obj_bind_state_if_not_eq');
  assert(typeof wasmExports['lv_obj_bind_state_if_gt'] != 'undefined', 'missing Wasm export: lv_obj_bind_state_if_gt');
  assert(typeof wasmExports['lv_obj_bind_state_if_ge'] != 'undefined', 'missing Wasm export: lv_obj_bind_state_if_ge');
  assert(typeof wasmExports['lv_obj_bind_state_if_lt'] != 'undefined', 'missing Wasm export: lv_obj_bind_state_if_lt');
  assert(typeof wasmExports['lv_obj_bind_state_if_le'] != 'undefined', 'missing Wasm export: lv_obj_bind_state_if_le');
  assert(typeof wasmExports['lv_obj_bind_checked'] != 'undefined', 'missing Wasm export: lv_obj_bind_checked');
  assert(typeof wasmExports['lv_observer_get_target_obj'] != 'undefined', 'missing Wasm export: lv_observer_get_target_obj');
  assert(typeof wasmExports['lv_observer_get_user_data'] != 'undefined', 'missing Wasm export: lv_observer_get_user_data');
  assert(typeof wasmExports['lv_strnlen'] != 'undefined', 'missing Wasm export: lv_strnlen');
  assert(typeof wasmExports['lv_strncpy'] != 'undefined', 'missing Wasm export: lv_strncpy');
  assert(typeof wasmExports['lv_strcpy'] != 'undefined', 'missing Wasm export: lv_strcpy');
  assert(typeof wasmExports['lv_strncmp'] != 'undefined', 'missing Wasm export: lv_strncmp');
  assert(typeof wasmExports['lv_strcat'] != 'undefined', 'missing Wasm export: lv_strcat');
  assert(typeof wasmExports['lv_strncat'] != 'undefined', 'missing Wasm export: lv_strncat');
  assert(typeof wasmExports['lv_strchr'] != 'undefined', 'missing Wasm export: lv_strchr');
  assert(typeof wasmExports['lv_mem_add_pool'] != 'undefined', 'missing Wasm export: lv_mem_add_pool');
  assert(typeof wasmExports['lv_mem_remove_pool'] != 'undefined', 'missing Wasm export: lv_mem_remove_pool');
  assert(typeof wasmExports['lv_malloc_core'] != 'undefined', 'missing Wasm export: lv_malloc_core');
  assert(typeof wasmExports['lv_realloc_core'] != 'undefined', 'missing Wasm export: lv_realloc_core');
  assert(typeof wasmExports['lv_free_core'] != 'undefined', 'missing Wasm export: lv_free_core');
  assert(typeof wasmExports['lv_mem_monitor_core'] != 'undefined', 'missing Wasm export: lv_mem_monitor_core');
  assert(typeof wasmExports['lv_mem_test_core'] != 'undefined', 'missing Wasm export: lv_mem_test_core');
  assert(typeof wasmExports['lv_calloc'] != 'undefined', 'missing Wasm export: lv_calloc');
  assert(typeof wasmExports['lv_zalloc'] != 'undefined', 'missing Wasm export: lv_zalloc');
  assert(typeof wasmExports['lv_reallocf'] != 'undefined', 'missing Wasm export: lv_reallocf');
  assert(typeof wasmExports['lv_mem_test'] != 'undefined', 'missing Wasm export: lv_mem_test');
  assert(typeof wasmExports['lv_mem_monitor'] != 'undefined', 'missing Wasm export: lv_mem_monitor');
  assert(typeof wasmExports['lv_theme_get_from_obj'] != 'undefined', 'missing Wasm export: lv_theme_get_from_obj');
  assert(typeof wasmExports['lv_theme_set_parent'] != 'undefined', 'missing Wasm export: lv_theme_set_parent');
  assert(typeof wasmExports['lv_theme_set_apply_cb'] != 'undefined', 'missing Wasm export: lv_theme_set_apply_cb');
  assert(typeof wasmExports['lv_theme_get_font_small'] != 'undefined', 'missing Wasm export: lv_theme_get_font_small');
  assert(typeof wasmExports['lv_theme_get_font_normal'] != 'undefined', 'missing Wasm export: lv_theme_get_font_normal');
  assert(typeof wasmExports['lv_theme_get_font_large'] != 'undefined', 'missing Wasm export: lv_theme_get_font_large');
  assert(typeof wasmExports['lv_theme_get_color_primary'] != 'undefined', 'missing Wasm export: lv_theme_get_color_primary');
  assert(typeof wasmExports['lv_theme_get_color_secondary'] != 'undefined', 'missing Wasm export: lv_theme_get_color_secondary');
  assert(typeof wasmExports['lv_theme_mono_init'] != 'undefined', 'missing Wasm export: lv_theme_mono_init');
  assert(typeof wasmExports['lv_theme_mono_is_inited'] != 'undefined', 'missing Wasm export: lv_theme_mono_is_inited');
  assert(typeof wasmExports['lv_theme_mono_get'] != 'undefined', 'missing Wasm export: lv_theme_mono_get');
  assert(typeof wasmExports['lv_theme_simple_init'] != 'undefined', 'missing Wasm export: lv_theme_simple_init');
  assert(typeof wasmExports['lv_theme_simple_is_inited'] != 'undefined', 'missing Wasm export: lv_theme_simple_is_inited');
  assert(typeof wasmExports['lv_theme_simple_get'] != 'undefined', 'missing Wasm export: lv_theme_simple_get');
  assert(typeof wasmExports['lv_tick_set_cb'] != 'undefined', 'missing Wasm export: lv_tick_set_cb');
  assert(typeof wasmExports['lv_tick_get_cb'] != 'undefined', 'missing Wasm export: lv_tick_get_cb');
  assert(typeof wasmExports['lv_delay_set_cb'] != 'undefined', 'missing Wasm export: lv_delay_set_cb');
  assert(typeof wasmExports['lv_animimg_set_src_reverse'] != 'undefined', 'missing Wasm export: lv_animimg_set_src_reverse');
  assert(typeof wasmExports['lv_animimg_delete'] != 'undefined', 'missing Wasm export: lv_animimg_delete');
  assert(typeof wasmExports['lv_animimg_set_reverse_duration'] != 'undefined', 'missing Wasm export: lv_animimg_set_reverse_duration');
  assert(typeof wasmExports['lv_animimg_set_reverse_delay'] != 'undefined', 'missing Wasm export: lv_animimg_set_reverse_delay');
  assert(typeof wasmExports['lv_animimg_set_start_cb'] != 'undefined', 'missing Wasm export: lv_animimg_set_start_cb');
  assert(typeof wasmExports['lv_animimg_set_completed_cb'] != 'undefined', 'missing Wasm export: lv_animimg_set_completed_cb');
  assert(typeof wasmExports['lv_animimg_get_src'] != 'undefined', 'missing Wasm export: lv_animimg_get_src');
  assert(typeof wasmExports['lv_animimg_get_src_count'] != 'undefined', 'missing Wasm export: lv_animimg_get_src_count');
  assert(typeof wasmExports['lv_animimg_get_duration'] != 'undefined', 'missing Wasm export: lv_animimg_get_duration');
  assert(typeof wasmExports['lv_animimg_get_repeat_count'] != 'undefined', 'missing Wasm export: lv_animimg_get_repeat_count');
  assert(typeof wasmExports['lv_animimg_get_anim'] != 'undefined', 'missing Wasm export: lv_animimg_get_anim');
  assert(typeof wasmExports['lv_arc_set_start_angle'] != 'undefined', 'missing Wasm export: lv_arc_set_start_angle');
  assert(typeof wasmExports['lv_arc_set_end_angle'] != 'undefined', 'missing Wasm export: lv_arc_set_end_angle');
  assert(typeof wasmExports['lv_arc_set_angles'] != 'undefined', 'missing Wasm export: lv_arc_set_angles');
  assert(typeof wasmExports['lv_arc_set_bg_angles'] != 'undefined', 'missing Wasm export: lv_arc_set_bg_angles');
  assert(typeof wasmExports['lv_arc_set_min_value'] != 'undefined', 'missing Wasm export: lv_arc_set_min_value');
  assert(typeof wasmExports['lv_arc_set_max_value'] != 'undefined', 'missing Wasm export: lv_arc_set_max_value');
  assert(typeof wasmExports['lv_arc_set_change_rate'] != 'undefined', 'missing Wasm export: lv_arc_set_change_rate');
  assert(typeof wasmExports['lv_arc_set_knob_offset'] != 'undefined', 'missing Wasm export: lv_arc_set_knob_offset');
  assert(typeof wasmExports['lv_arc_get_angle_start'] != 'undefined', 'missing Wasm export: lv_arc_get_angle_start');
  assert(typeof wasmExports['lv_arc_get_angle_end'] != 'undefined', 'missing Wasm export: lv_arc_get_angle_end');
  assert(typeof wasmExports['lv_arc_get_bg_angle_start'] != 'undefined', 'missing Wasm export: lv_arc_get_bg_angle_start');
  assert(typeof wasmExports['lv_arc_get_bg_angle_end'] != 'undefined', 'missing Wasm export: lv_arc_get_bg_angle_end');
  assert(typeof wasmExports['lv_arc_get_mode'] != 'undefined', 'missing Wasm export: lv_arc_get_mode');
  assert(typeof wasmExports['lv_arc_get_rotation'] != 'undefined', 'missing Wasm export: lv_arc_get_rotation');
  assert(typeof wasmExports['lv_arc_get_knob_offset'] != 'undefined', 'missing Wasm export: lv_arc_get_knob_offset');
  assert(typeof wasmExports['lv_arc_bind_value'] != 'undefined', 'missing Wasm export: lv_arc_bind_value');
  assert(typeof wasmExports['lv_arc_align_obj_to_angle'] != 'undefined', 'missing Wasm export: lv_arc_align_obj_to_angle');
  assert(typeof wasmExports['lv_arc_rotate_obj_to_angle'] != 'undefined', 'missing Wasm export: lv_arc_rotate_obj_to_angle');
  assert(typeof wasmExports['lv_arclabel_create'] != 'undefined', 'missing Wasm export: lv_arclabel_create');
  assert(typeof wasmExports['lv_arclabel_set_text'] != 'undefined', 'missing Wasm export: lv_arclabel_set_text');
  assert(typeof wasmExports['lv_arclabel_set_text_fmt'] != 'undefined', 'missing Wasm export: lv_arclabel_set_text_fmt');
  assert(typeof wasmExports['lv_arclabel_set_text_static'] != 'undefined', 'missing Wasm export: lv_arclabel_set_text_static');
  assert(typeof wasmExports['lv_arclabel_set_angle_start'] != 'undefined', 'missing Wasm export: lv_arclabel_set_angle_start');
  assert(typeof wasmExports['lv_arclabel_set_angle_size'] != 'undefined', 'missing Wasm export: lv_arclabel_set_angle_size');
  assert(typeof wasmExports['lv_arclabel_set_offset'] != 'undefined', 'missing Wasm export: lv_arclabel_set_offset');
  assert(typeof wasmExports['lv_arclabel_set_dir'] != 'undefined', 'missing Wasm export: lv_arclabel_set_dir');
  assert(typeof wasmExports['lv_arclabel_set_recolor'] != 'undefined', 'missing Wasm export: lv_arclabel_set_recolor');
  assert(typeof wasmExports['lv_arclabel_set_radius'] != 'undefined', 'missing Wasm export: lv_arclabel_set_radius');
  assert(typeof wasmExports['lv_arclabel_set_center_offset_x'] != 'undefined', 'missing Wasm export: lv_arclabel_set_center_offset_x');
  assert(typeof wasmExports['lv_arclabel_set_center_offset_y'] != 'undefined', 'missing Wasm export: lv_arclabel_set_center_offset_y');
  assert(typeof wasmExports['lv_arclabel_set_text_vertical_align'] != 'undefined', 'missing Wasm export: lv_arclabel_set_text_vertical_align');
  assert(typeof wasmExports['lv_arclabel_set_text_horizontal_align'] != 'undefined', 'missing Wasm export: lv_arclabel_set_text_horizontal_align');
  assert(typeof wasmExports['lv_arclabel_get_angle_start'] != 'undefined', 'missing Wasm export: lv_arclabel_get_angle_start');
  assert(typeof wasmExports['lv_arclabel_get_angle_size'] != 'undefined', 'missing Wasm export: lv_arclabel_get_angle_size');
  assert(typeof wasmExports['lv_arclabel_get_dir'] != 'undefined', 'missing Wasm export: lv_arclabel_get_dir');
  assert(typeof wasmExports['lv_arclabel_get_recolor'] != 'undefined', 'missing Wasm export: lv_arclabel_get_recolor');
  assert(typeof wasmExports['lv_arclabel_get_radius'] != 'undefined', 'missing Wasm export: lv_arclabel_get_radius');
  assert(typeof wasmExports['lv_arclabel_get_center_offset_x'] != 'undefined', 'missing Wasm export: lv_arclabel_get_center_offset_x');
  assert(typeof wasmExports['lv_arclabel_get_center_offset_y'] != 'undefined', 'missing Wasm export: lv_arclabel_get_center_offset_y');
  assert(typeof wasmExports['lv_arclabel_get_text_vertical_align'] != 'undefined', 'missing Wasm export: lv_arclabel_get_text_vertical_align');
  assert(typeof wasmExports['lv_arclabel_get_text_horizontal_align'] != 'undefined', 'missing Wasm export: lv_arclabel_get_text_horizontal_align');
  assert(typeof wasmExports['lv_bar_get_mode'] != 'undefined', 'missing Wasm export: lv_bar_get_mode');
  assert(typeof wasmExports['lv_bar_set_min_value'] != 'undefined', 'missing Wasm export: lv_bar_set_min_value');
  assert(typeof wasmExports['lv_bar_get_max_value'] != 'undefined', 'missing Wasm export: lv_bar_get_max_value');
  assert(typeof wasmExports['lv_bar_set_max_value'] != 'undefined', 'missing Wasm export: lv_bar_set_max_value');
  assert(typeof wasmExports['lv_bar_get_min_value'] != 'undefined', 'missing Wasm export: lv_bar_get_min_value');
  assert(typeof wasmExports['lv_bar_set_orientation'] != 'undefined', 'missing Wasm export: lv_bar_set_orientation');
  assert(typeof wasmExports['lv_bar_get_orientation'] != 'undefined', 'missing Wasm export: lv_bar_get_orientation');
  assert(typeof wasmExports['lv_bar_is_symmetrical'] != 'undefined', 'missing Wasm export: lv_bar_is_symmetrical');
  assert(typeof wasmExports['lv_bar_bind_value'] != 'undefined', 'missing Wasm export: lv_bar_bind_value');
  assert(typeof wasmExports['lv_buttonmatrix_set_selected_button'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_set_selected_button');
  assert(typeof wasmExports['lv_buttonmatrix_set_button_ctrl'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_set_button_ctrl');
  assert(typeof wasmExports['lv_buttonmatrix_clear_button_ctrl_all'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_clear_button_ctrl_all');
  assert(typeof wasmExports['lv_buttonmatrix_clear_button_ctrl'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_clear_button_ctrl');
  assert(typeof wasmExports['lv_buttonmatrix_set_button_ctrl_all'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_set_button_ctrl_all');
  assert(typeof wasmExports['lv_buttonmatrix_set_button_width'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_set_button_width');
  assert(typeof wasmExports['lv_buttonmatrix_get_map'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_get_map');
  assert(typeof wasmExports['lv_buttonmatrix_get_selected_button'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_get_selected_button');
  assert(typeof wasmExports['lv_buttonmatrix_get_button_text'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_get_button_text');
  assert(typeof wasmExports['lv_buttonmatrix_has_button_ctrl'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_has_button_ctrl');
  assert(typeof wasmExports['lv_buttonmatrix_get_one_checked'] != 'undefined', 'missing Wasm export: lv_buttonmatrix_get_one_checked');
  assert(typeof wasmExports['lv_calendar_set_day_names'] != 'undefined', 'missing Wasm export: lv_calendar_set_day_names');
  assert(typeof wasmExports['lv_calendar_set_today_year'] != 'undefined', 'missing Wasm export: lv_calendar_set_today_year');
  assert(typeof wasmExports['lv_calendar_set_today_month'] != 'undefined', 'missing Wasm export: lv_calendar_set_today_month');
  assert(typeof wasmExports['lv_calendar_set_today_day'] != 'undefined', 'missing Wasm export: lv_calendar_set_today_day');
  assert(typeof wasmExports['lv_calendar_set_highlighted_dates'] != 'undefined', 'missing Wasm export: lv_calendar_set_highlighted_dates');
  assert(typeof wasmExports['lv_calendar_get_day_name'] != 'undefined', 'missing Wasm export: lv_calendar_get_day_name');
  assert(typeof wasmExports['lv_calendar_set_shown_year'] != 'undefined', 'missing Wasm export: lv_calendar_set_shown_year');
  assert(typeof wasmExports['lv_calendar_set_shown_month'] != 'undefined', 'missing Wasm export: lv_calendar_set_shown_month');
  assert(typeof wasmExports['lv_calendar_get_btnmatrix'] != 'undefined', 'missing Wasm export: lv_calendar_get_btnmatrix');
  assert(typeof wasmExports['lv_calendar_get_today_date'] != 'undefined', 'missing Wasm export: lv_calendar_get_today_date');
  assert(typeof wasmExports['lv_calendar_get_showed_date'] != 'undefined', 'missing Wasm export: lv_calendar_get_showed_date');
  assert(typeof wasmExports['lv_calendar_get_highlighted_dates'] != 'undefined', 'missing Wasm export: lv_calendar_get_highlighted_dates');
  assert(typeof wasmExports['lv_calendar_get_highlighted_dates_num'] != 'undefined', 'missing Wasm export: lv_calendar_get_highlighted_dates_num');
  assert(typeof wasmExports['lv_calendar_get_pressed_date'] != 'undefined', 'missing Wasm export: lv_calendar_get_pressed_date');
  assert(typeof wasmExports['lv_calendar_set_chinese_mode'] != 'undefined', 'missing Wasm export: lv_calendar_set_chinese_mode');
  assert(typeof wasmExports['lv_calendar_gregorian_to_chinese'] != 'undefined', 'missing Wasm export: lv_calendar_gregorian_to_chinese');
  assert(typeof wasmExports['lv_label_set_text_fmt'] != 'undefined', 'missing Wasm export: lv_label_set_text_fmt');
  assert(typeof wasmExports['lv_calendar_add_header_dropdown'] != 'undefined', 'missing Wasm export: lv_calendar_add_header_dropdown');
  assert(typeof wasmExports['lv_calendar_header_dropdown_set_year_list'] != 'undefined', 'missing Wasm export: lv_calendar_header_dropdown_set_year_list');
  assert(typeof wasmExports['lv_dropdown_clear_options'] != 'undefined', 'missing Wasm export: lv_dropdown_clear_options');
  assert(typeof wasmExports['lv_canvas_set_buffer'] != 'undefined', 'missing Wasm export: lv_canvas_set_buffer');
  assert(typeof wasmExports['lv_image_get_src'] != 'undefined', 'missing Wasm export: lv_image_get_src');
  assert(typeof wasmExports['lv_canvas_get_px'] != 'undefined', 'missing Wasm export: lv_canvas_get_px');
  assert(typeof wasmExports['lv_canvas_get_image'] != 'undefined', 'missing Wasm export: lv_canvas_get_image');
  assert(typeof wasmExports['lv_canvas_get_buf'] != 'undefined', 'missing Wasm export: lv_canvas_get_buf');
  assert(typeof wasmExports['lv_canvas_copy_buf'] != 'undefined', 'missing Wasm export: lv_canvas_copy_buf');
  assert(typeof wasmExports['lv_canvas_fill_bg'] != 'undefined', 'missing Wasm export: lv_canvas_fill_bg');
  assert(typeof wasmExports['lv_canvas_init_layer'] != 'undefined', 'missing Wasm export: lv_canvas_init_layer');
  assert(typeof wasmExports['lv_canvas_finish_layer'] != 'undefined', 'missing Wasm export: lv_canvas_finish_layer');
  assert(typeof wasmExports['lv_canvas_buf_size'] != 'undefined', 'missing Wasm export: lv_canvas_buf_size');
  assert(typeof wasmExports['lv_chart_get_point_pos_by_id'] != 'undefined', 'missing Wasm export: lv_chart_get_point_pos_by_id');
  assert(typeof wasmExports['lv_chart_set_type'] != 'undefined', 'missing Wasm export: lv_chart_set_type');
  assert(typeof wasmExports['lv_chart_refresh'] != 'undefined', 'missing Wasm export: lv_chart_refresh');
  assert(typeof wasmExports['lv_chart_set_point_count'] != 'undefined', 'missing Wasm export: lv_chart_set_point_count');
  assert(typeof wasmExports['lv_chart_set_axis_min_value'] != 'undefined', 'missing Wasm export: lv_chart_set_axis_min_value');
  assert(typeof wasmExports['lv_chart_set_axis_max_value'] != 'undefined', 'missing Wasm export: lv_chart_set_axis_max_value');
  assert(typeof wasmExports['lv_chart_set_axis_range'] != 'undefined', 'missing Wasm export: lv_chart_set_axis_range');
  assert(typeof wasmExports['lv_chart_set_update_mode'] != 'undefined', 'missing Wasm export: lv_chart_set_update_mode');
  assert(typeof wasmExports['lv_chart_set_div_line_count'] != 'undefined', 'missing Wasm export: lv_chart_set_div_line_count');
  assert(typeof wasmExports['lv_chart_set_hor_div_line_count'] != 'undefined', 'missing Wasm export: lv_chart_set_hor_div_line_count');
  assert(typeof wasmExports['lv_chart_set_ver_div_line_count'] != 'undefined', 'missing Wasm export: lv_chart_set_ver_div_line_count');
  assert(typeof wasmExports['lv_chart_get_type'] != 'undefined', 'missing Wasm export: lv_chart_get_type');
  assert(typeof wasmExports['lv_chart_get_point_count'] != 'undefined', 'missing Wasm export: lv_chart_get_point_count');
  assert(typeof wasmExports['lv_chart_get_x_start_point'] != 'undefined', 'missing Wasm export: lv_chart_get_x_start_point');
  assert(typeof wasmExports['lv_chart_add_series'] != 'undefined', 'missing Wasm export: lv_chart_add_series');
  assert(typeof wasmExports['lv_chart_remove_series'] != 'undefined', 'missing Wasm export: lv_chart_remove_series');
  assert(typeof wasmExports['lv_chart_hide_series'] != 'undefined', 'missing Wasm export: lv_chart_hide_series');
  assert(typeof wasmExports['lv_chart_set_series_color'] != 'undefined', 'missing Wasm export: lv_chart_set_series_color');
  assert(typeof wasmExports['lv_chart_get_series_color'] != 'undefined', 'missing Wasm export: lv_chart_get_series_color');
  assert(typeof wasmExports['lv_chart_set_x_start_point'] != 'undefined', 'missing Wasm export: lv_chart_set_x_start_point');
  assert(typeof wasmExports['lv_chart_get_series_next'] != 'undefined', 'missing Wasm export: lv_chart_get_series_next');
  assert(typeof wasmExports['lv_chart_add_cursor'] != 'undefined', 'missing Wasm export: lv_chart_add_cursor');
  assert(typeof wasmExports['lv_chart_remove_cursor'] != 'undefined', 'missing Wasm export: lv_chart_remove_cursor');
  assert(typeof wasmExports['lv_chart_set_cursor_pos'] != 'undefined', 'missing Wasm export: lv_chart_set_cursor_pos');
  assert(typeof wasmExports['lv_chart_set_cursor_pos_x'] != 'undefined', 'missing Wasm export: lv_chart_set_cursor_pos_x');
  assert(typeof wasmExports['lv_chart_set_cursor_pos_y'] != 'undefined', 'missing Wasm export: lv_chart_set_cursor_pos_y');
  assert(typeof wasmExports['lv_chart_set_cursor_point'] != 'undefined', 'missing Wasm export: lv_chart_set_cursor_point');
  assert(typeof wasmExports['lv_chart_get_cursor_point'] != 'undefined', 'missing Wasm export: lv_chart_get_cursor_point');
  assert(typeof wasmExports['lv_chart_set_all_values'] != 'undefined', 'missing Wasm export: lv_chart_set_all_values');
  assert(typeof wasmExports['lv_chart_set_next_value'] != 'undefined', 'missing Wasm export: lv_chart_set_next_value');
  assert(typeof wasmExports['lv_chart_set_next_value2'] != 'undefined', 'missing Wasm export: lv_chart_set_next_value2');
  assert(typeof wasmExports['lv_chart_set_series_values'] != 'undefined', 'missing Wasm export: lv_chart_set_series_values');
  assert(typeof wasmExports['lv_chart_set_series_values2'] != 'undefined', 'missing Wasm export: lv_chart_set_series_values2');
  assert(typeof wasmExports['lv_chart_set_series_value_by_id'] != 'undefined', 'missing Wasm export: lv_chart_set_series_value_by_id');
  assert(typeof wasmExports['lv_chart_set_series_value_by_id2'] != 'undefined', 'missing Wasm export: lv_chart_set_series_value_by_id2');
  assert(typeof wasmExports['lv_chart_set_series_ext_y_array'] != 'undefined', 'missing Wasm export: lv_chart_set_series_ext_y_array');
  assert(typeof wasmExports['lv_chart_set_series_ext_x_array'] != 'undefined', 'missing Wasm export: lv_chart_set_series_ext_x_array');
  assert(typeof wasmExports['lv_chart_get_series_y_array'] != 'undefined', 'missing Wasm export: lv_chart_get_series_y_array');
  assert(typeof wasmExports['lv_chart_get_series_x_array'] != 'undefined', 'missing Wasm export: lv_chart_get_series_x_array');
  assert(typeof wasmExports['lv_chart_get_pressed_point'] != 'undefined', 'missing Wasm export: lv_chart_get_pressed_point');
  assert(typeof wasmExports['lv_chart_get_first_point_center_offset'] != 'undefined', 'missing Wasm export: lv_chart_get_first_point_center_offset');
  assert(typeof wasmExports['lv_checkbox_set_text_static'] != 'undefined', 'missing Wasm export: lv_checkbox_set_text_static');
  assert(typeof wasmExports['lv_checkbox_get_text'] != 'undefined', 'missing Wasm export: lv_checkbox_get_text');
  assert(typeof wasmExports['lv_dropdown_set_options_static'] != 'undefined', 'missing Wasm export: lv_dropdown_set_options_static');
  assert(typeof wasmExports['lv_dropdown_open'] != 'undefined', 'missing Wasm export: lv_dropdown_open');
  assert(typeof wasmExports['lv_dropdown_is_open'] != 'undefined', 'missing Wasm export: lv_dropdown_is_open');
  assert(typeof wasmExports['lv_dropdown_close'] != 'undefined', 'missing Wasm export: lv_dropdown_close');
  assert(typeof wasmExports['lv_dropdown_set_text'] != 'undefined', 'missing Wasm export: lv_dropdown_set_text');
  assert(typeof wasmExports['lv_dropdown_add_option'] != 'undefined', 'missing Wasm export: lv_dropdown_add_option');
  assert(typeof wasmExports['lv_dropdown_set_selected_highlight'] != 'undefined', 'missing Wasm export: lv_dropdown_set_selected_highlight');
  assert(typeof wasmExports['lv_dropdown_get_text'] != 'undefined', 'missing Wasm export: lv_dropdown_get_text');
  assert(typeof wasmExports['lv_dropdown_get_option_count'] != 'undefined', 'missing Wasm export: lv_dropdown_get_option_count');
  assert(typeof wasmExports['lv_dropdown_get_selected_str'] != 'undefined', 'missing Wasm export: lv_dropdown_get_selected_str');
  assert(typeof wasmExports['lv_dropdown_get_option_index'] != 'undefined', 'missing Wasm export: lv_dropdown_get_option_index');
  assert(typeof wasmExports['lv_dropdown_get_symbol'] != 'undefined', 'missing Wasm export: lv_dropdown_get_symbol');
  assert(typeof wasmExports['lv_dropdown_get_selected_highlight'] != 'undefined', 'missing Wasm export: lv_dropdown_get_selected_highlight');
  assert(typeof wasmExports['lv_dropdown_get_dir'] != 'undefined', 'missing Wasm export: lv_dropdown_get_dir');
  assert(typeof wasmExports['lv_label_set_text_static'] != 'undefined', 'missing Wasm export: lv_label_set_text_static');
  assert(typeof wasmExports['lv_dropdown_bind_value'] != 'undefined', 'missing Wasm export: lv_dropdown_bind_value');
  assert(typeof wasmExports['lv_image_get_pivot'] != 'undefined', 'missing Wasm export: lv_image_get_pivot');
  assert(typeof wasmExports['lv_image_set_offset_x'] != 'undefined', 'missing Wasm export: lv_image_set_offset_x');
  assert(typeof wasmExports['lv_image_set_offset_y'] != 'undefined', 'missing Wasm export: lv_image_set_offset_y');
  assert(typeof wasmExports['lv_image_set_pivot_x'] != 'undefined', 'missing Wasm export: lv_image_set_pivot_x');
  assert(typeof wasmExports['lv_image_set_pivot_y'] != 'undefined', 'missing Wasm export: lv_image_set_pivot_y');
  assert(typeof wasmExports['lv_image_set_scale_x'] != 'undefined', 'missing Wasm export: lv_image_set_scale_x');
  assert(typeof wasmExports['lv_image_set_scale_y'] != 'undefined', 'missing Wasm export: lv_image_set_scale_y');
  assert(typeof wasmExports['lv_image_set_blend_mode'] != 'undefined', 'missing Wasm export: lv_image_set_blend_mode');
  assert(typeof wasmExports['lv_image_set_antialias'] != 'undefined', 'missing Wasm export: lv_image_set_antialias');
  assert(typeof wasmExports['lv_image_set_bitmap_map_src'] != 'undefined', 'missing Wasm export: lv_image_set_bitmap_map_src');
  assert(typeof wasmExports['lv_image_get_offset_x'] != 'undefined', 'missing Wasm export: lv_image_get_offset_x');
  assert(typeof wasmExports['lv_image_get_offset_y'] != 'undefined', 'missing Wasm export: lv_image_get_offset_y');
  assert(typeof wasmExports['lv_image_get_rotation'] != 'undefined', 'missing Wasm export: lv_image_get_rotation');
  assert(typeof wasmExports['lv_image_get_scale'] != 'undefined', 'missing Wasm export: lv_image_get_scale');
  assert(typeof wasmExports['lv_image_get_scale_x'] != 'undefined', 'missing Wasm export: lv_image_get_scale_x');
  assert(typeof wasmExports['lv_image_get_scale_y'] != 'undefined', 'missing Wasm export: lv_image_get_scale_y');
  assert(typeof wasmExports['lv_image_get_src_width'] != 'undefined', 'missing Wasm export: lv_image_get_src_width');
  assert(typeof wasmExports['lv_image_get_src_height'] != 'undefined', 'missing Wasm export: lv_image_get_src_height');
  assert(typeof wasmExports['lv_image_get_transformed_width'] != 'undefined', 'missing Wasm export: lv_image_get_transformed_width');
  assert(typeof wasmExports['lv_image_get_transformed_height'] != 'undefined', 'missing Wasm export: lv_image_get_transformed_height');
  assert(typeof wasmExports['lv_image_get_blend_mode'] != 'undefined', 'missing Wasm export: lv_image_get_blend_mode');
  assert(typeof wasmExports['lv_image_get_antialias'] != 'undefined', 'missing Wasm export: lv_image_get_antialias');
  assert(typeof wasmExports['lv_image_get_inner_align'] != 'undefined', 'missing Wasm export: lv_image_get_inner_align');
  assert(typeof wasmExports['lv_image_get_bitmap_map_src'] != 'undefined', 'missing Wasm export: lv_image_get_bitmap_map_src');
  assert(typeof wasmExports['lv_image_bind_src'] != 'undefined', 'missing Wasm export: lv_image_bind_src');
  assert(typeof wasmExports['lv_imagebutton_set_state'] != 'undefined', 'missing Wasm export: lv_imagebutton_set_state');
  assert(typeof wasmExports['lv_imagebutton_get_src_left'] != 'undefined', 'missing Wasm export: lv_imagebutton_get_src_left');
  assert(typeof wasmExports['lv_imagebutton_get_src_middle'] != 'undefined', 'missing Wasm export: lv_imagebutton_get_src_middle');
  assert(typeof wasmExports['lv_imagebutton_get_src_right'] != 'undefined', 'missing Wasm export: lv_imagebutton_get_src_right');
  assert(typeof wasmExports['lv_keyboard_def_event_cb'] != 'undefined', 'missing Wasm export: lv_keyboard_def_event_cb');
  assert(typeof wasmExports['lv_keyboard_set_popovers'] != 'undefined', 'missing Wasm export: lv_keyboard_set_popovers');
  assert(typeof wasmExports['lv_keyboard_set_map'] != 'undefined', 'missing Wasm export: lv_keyboard_set_map');
  assert(typeof wasmExports['lv_keyboard_get_textarea'] != 'undefined', 'missing Wasm export: lv_keyboard_get_textarea');
  assert(typeof wasmExports['lv_keyboard_get_mode'] != 'undefined', 'missing Wasm export: lv_keyboard_get_mode');
  assert(typeof wasmExports['lv_keyboard_get_popovers'] != 'undefined', 'missing Wasm export: lv_keyboard_get_popovers');
  assert(typeof wasmExports['lv_textarea_add_char'] != 'undefined', 'missing Wasm export: lv_textarea_add_char');
  assert(typeof wasmExports['lv_textarea_get_one_line'] != 'undefined', 'missing Wasm export: lv_textarea_get_one_line');
  assert(typeof wasmExports['lv_textarea_cursor_left'] != 'undefined', 'missing Wasm export: lv_textarea_cursor_left');
  assert(typeof wasmExports['lv_textarea_cursor_right'] != 'undefined', 'missing Wasm export: lv_textarea_cursor_right');
  assert(typeof wasmExports['lv_textarea_delete_char'] != 'undefined', 'missing Wasm export: lv_textarea_delete_char');
  assert(typeof wasmExports['lv_textarea_get_cursor_pos'] != 'undefined', 'missing Wasm export: lv_textarea_get_cursor_pos');
  assert(typeof wasmExports['lv_textarea_set_cursor_pos'] != 'undefined', 'missing Wasm export: lv_textarea_set_cursor_pos');
  assert(typeof wasmExports['lv_textarea_add_text'] != 'undefined', 'missing Wasm export: lv_textarea_add_text');
  assert(typeof wasmExports['lv_keyboard_get_map_array'] != 'undefined', 'missing Wasm export: lv_keyboard_get_map_array');
  assert(typeof wasmExports['lv_keyboard_get_selected_button'] != 'undefined', 'missing Wasm export: lv_keyboard_get_selected_button');
  assert(typeof wasmExports['lv_keyboard_get_button_text'] != 'undefined', 'missing Wasm export: lv_keyboard_get_button_text');
  assert(typeof wasmExports['lv_label_set_text_vfmt'] != 'undefined', 'missing Wasm export: lv_label_set_text_vfmt');
  assert(typeof wasmExports['lv_label_get_letter_on'] != 'undefined', 'missing Wasm export: lv_label_get_letter_on');
  assert(typeof wasmExports['lv_label_set_text_selection_start'] != 'undefined', 'missing Wasm export: lv_label_set_text_selection_start');
  assert(typeof wasmExports['lv_label_set_text_selection_end'] != 'undefined', 'missing Wasm export: lv_label_set_text_selection_end');
  assert(typeof wasmExports['lv_label_set_recolor'] != 'undefined', 'missing Wasm export: lv_label_set_recolor');
  assert(typeof wasmExports['lv_label_get_long_mode'] != 'undefined', 'missing Wasm export: lv_label_get_long_mode');
  assert(typeof wasmExports['lv_label_get_letter_pos'] != 'undefined', 'missing Wasm export: lv_label_get_letter_pos');
  assert(typeof wasmExports['lv_label_is_char_under_pos'] != 'undefined', 'missing Wasm export: lv_label_is_char_under_pos');
  assert(typeof wasmExports['lv_label_get_text_selection_start'] != 'undefined', 'missing Wasm export: lv_label_get_text_selection_start');
  assert(typeof wasmExports['lv_label_get_text_selection_end'] != 'undefined', 'missing Wasm export: lv_label_get_text_selection_end');
  assert(typeof wasmExports['lv_label_get_recolor'] != 'undefined', 'missing Wasm export: lv_label_get_recolor');
  assert(typeof wasmExports['lv_label_bind_text'] != 'undefined', 'missing Wasm export: lv_label_bind_text');
  assert(typeof wasmExports['lv_label_ins_text'] != 'undefined', 'missing Wasm export: lv_label_ins_text');
  assert(typeof wasmExports['lv_label_cut_text'] != 'undefined', 'missing Wasm export: lv_label_cut_text');
  assert(typeof wasmExports['lv_led_on'] != 'undefined', 'missing Wasm export: lv_led_on');
  assert(typeof wasmExports['lv_led_off'] != 'undefined', 'missing Wasm export: lv_led_off');
  assert(typeof wasmExports['lv_led_toggle'] != 'undefined', 'missing Wasm export: lv_led_toggle');
  assert(typeof wasmExports['lv_line_set_points_mutable'] != 'undefined', 'missing Wasm export: lv_line_set_points_mutable');
  assert(typeof wasmExports['lv_line_get_points'] != 'undefined', 'missing Wasm export: lv_line_get_points');
  assert(typeof wasmExports['lv_line_get_point_count'] != 'undefined', 'missing Wasm export: lv_line_get_point_count');
  assert(typeof wasmExports['lv_line_is_point_array_mutable'] != 'undefined', 'missing Wasm export: lv_line_is_point_array_mutable');
  assert(typeof wasmExports['lv_line_get_points_mutable'] != 'undefined', 'missing Wasm export: lv_line_get_points_mutable');
  assert(typeof wasmExports['lv_line_get_y_invert'] != 'undefined', 'missing Wasm export: lv_line_get_y_invert');
  assert(typeof wasmExports['lv_list_add_text'] != 'undefined', 'missing Wasm export: lv_list_add_text');
  assert(typeof wasmExports['lv_list_add_button'] != 'undefined', 'missing Wasm export: lv_list_add_button');
  assert(typeof wasmExports['lv_list_get_button_text'] != 'undefined', 'missing Wasm export: lv_list_get_button_text');
  assert(typeof wasmExports['lv_list_set_button_text'] != 'undefined', 'missing Wasm export: lv_list_set_button_text');
  assert(typeof wasmExports['lv_menu_page_create'] != 'undefined', 'missing Wasm export: lv_menu_page_create');
  assert(typeof wasmExports['lv_menu_set_page_title'] != 'undefined', 'missing Wasm export: lv_menu_set_page_title');
  assert(typeof wasmExports['lv_menu_cont_create'] != 'undefined', 'missing Wasm export: lv_menu_cont_create');
  assert(typeof wasmExports['lv_menu_section_create'] != 'undefined', 'missing Wasm export: lv_menu_section_create');
  assert(typeof wasmExports['lv_menu_separator_create'] != 'undefined', 'missing Wasm export: lv_menu_separator_create');
  assert(typeof wasmExports['lv_menu_set_page'] != 'undefined', 'missing Wasm export: lv_menu_set_page');
  assert(typeof wasmExports['lv_menu_clear_history'] != 'undefined', 'missing Wasm export: lv_menu_clear_history');
  assert(typeof wasmExports['lv_menu_set_sidebar_page'] != 'undefined', 'missing Wasm export: lv_menu_set_sidebar_page');
  assert(typeof wasmExports['lv_menu_set_mode_header'] != 'undefined', 'missing Wasm export: lv_menu_set_mode_header');
  assert(typeof wasmExports['lv_menu_set_mode_root_back_button'] != 'undefined', 'missing Wasm export: lv_menu_set_mode_root_back_button');
  assert(typeof wasmExports['lv_menu_set_load_page_event'] != 'undefined', 'missing Wasm export: lv_menu_set_load_page_event');
  assert(typeof wasmExports['lv_menu_set_page_title_static'] != 'undefined', 'missing Wasm export: lv_menu_set_page_title_static');
  assert(typeof wasmExports['lv_menu_get_cur_main_page'] != 'undefined', 'missing Wasm export: lv_menu_get_cur_main_page');
  assert(typeof wasmExports['lv_menu_get_cur_sidebar_page'] != 'undefined', 'missing Wasm export: lv_menu_get_cur_sidebar_page');
  assert(typeof wasmExports['lv_menu_get_main_header'] != 'undefined', 'missing Wasm export: lv_menu_get_main_header');
  assert(typeof wasmExports['lv_menu_get_main_header_back_button'] != 'undefined', 'missing Wasm export: lv_menu_get_main_header_back_button');
  assert(typeof wasmExports['lv_menu_get_sidebar_header'] != 'undefined', 'missing Wasm export: lv_menu_get_sidebar_header');
  assert(typeof wasmExports['lv_menu_get_sidebar_header_back_button'] != 'undefined', 'missing Wasm export: lv_menu_get_sidebar_header_back_button');
  assert(typeof wasmExports['lv_menu_back_button_is_root'] != 'undefined', 'missing Wasm export: lv_menu_back_button_is_root');
  assert(typeof wasmExports['lv_msgbox_add_title'] != 'undefined', 'missing Wasm export: lv_msgbox_add_title');
  assert(typeof wasmExports['lv_msgbox_add_header_button'] != 'undefined', 'missing Wasm export: lv_msgbox_add_header_button');
  assert(typeof wasmExports['lv_msgbox_add_text'] != 'undefined', 'missing Wasm export: lv_msgbox_add_text');
  assert(typeof wasmExports['lv_msgbox_add_footer_button'] != 'undefined', 'missing Wasm export: lv_msgbox_add_footer_button');
  assert(typeof wasmExports['lv_msgbox_add_close_button'] != 'undefined', 'missing Wasm export: lv_msgbox_add_close_button');
  assert(typeof wasmExports['lv_msgbox_get_header'] != 'undefined', 'missing Wasm export: lv_msgbox_get_header');
  assert(typeof wasmExports['lv_msgbox_get_footer'] != 'undefined', 'missing Wasm export: lv_msgbox_get_footer');
  assert(typeof wasmExports['lv_msgbox_get_content'] != 'undefined', 'missing Wasm export: lv_msgbox_get_content');
  assert(typeof wasmExports['lv_msgbox_get_title'] != 'undefined', 'missing Wasm export: lv_msgbox_get_title');
  assert(typeof wasmExports['lv_msgbox_close'] != 'undefined', 'missing Wasm export: lv_msgbox_close');
  assert(typeof wasmExports['lv_msgbox_close_async'] != 'undefined', 'missing Wasm export: lv_msgbox_close_async');
  assert(typeof wasmExports['lv_roller_set_selected_str'] != 'undefined', 'missing Wasm export: lv_roller_set_selected_str');
  assert(typeof wasmExports['lv_roller_set_visible_row_count'] != 'undefined', 'missing Wasm export: lv_roller_set_visible_row_count');
  assert(typeof wasmExports['lv_roller_get_selected_str'] != 'undefined', 'missing Wasm export: lv_roller_get_selected_str');
  assert(typeof wasmExports['lv_roller_get_option_str'] != 'undefined', 'missing Wasm export: lv_roller_get_option_str');
  assert(typeof wasmExports['lv_roller_bind_value'] != 'undefined', 'missing Wasm export: lv_roller_bind_value');
  assert(typeof wasmExports['lv_scale_set_min_value'] != 'undefined', 'missing Wasm export: lv_scale_set_min_value');
  assert(typeof wasmExports['lv_scale_set_max_value'] != 'undefined', 'missing Wasm export: lv_scale_set_max_value');
  assert(typeof wasmExports['lv_scale_set_angle_range'] != 'undefined', 'missing Wasm export: lv_scale_set_angle_range');
  assert(typeof wasmExports['lv_scale_set_rotation'] != 'undefined', 'missing Wasm export: lv_scale_set_rotation');
  assert(typeof wasmExports['lv_scale_set_line_needle_value'] != 'undefined', 'missing Wasm export: lv_scale_set_line_needle_value');
  assert(typeof wasmExports['lv_scale_set_image_needle_value'] != 'undefined', 'missing Wasm export: lv_scale_set_image_needle_value');
  assert(typeof wasmExports['lv_scale_set_text_src'] != 'undefined', 'missing Wasm export: lv_scale_set_text_src');
  assert(typeof wasmExports['lv_scale_set_post_draw'] != 'undefined', 'missing Wasm export: lv_scale_set_post_draw');
  assert(typeof wasmExports['lv_scale_set_draw_ticks_on_top'] != 'undefined', 'missing Wasm export: lv_scale_set_draw_ticks_on_top');
  assert(typeof wasmExports['lv_scale_add_section'] != 'undefined', 'missing Wasm export: lv_scale_add_section');
  assert(typeof wasmExports['lv_scale_set_section_range'] != 'undefined', 'missing Wasm export: lv_scale_set_section_range');
  assert(typeof wasmExports['lv_scale_set_section_min_value'] != 'undefined', 'missing Wasm export: lv_scale_set_section_min_value');
  assert(typeof wasmExports['lv_scale_set_section_max_value'] != 'undefined', 'missing Wasm export: lv_scale_set_section_max_value');
  assert(typeof wasmExports['lv_scale_section_set_range'] != 'undefined', 'missing Wasm export: lv_scale_section_set_range');
  assert(typeof wasmExports['lv_scale_set_section_style_main'] != 'undefined', 'missing Wasm export: lv_scale_set_section_style_main');
  assert(typeof wasmExports['lv_scale_set_section_style_indicator'] != 'undefined', 'missing Wasm export: lv_scale_set_section_style_indicator');
  assert(typeof wasmExports['lv_scale_set_section_style_items'] != 'undefined', 'missing Wasm export: lv_scale_set_section_style_items');
  assert(typeof wasmExports['lv_scale_section_set_style'] != 'undefined', 'missing Wasm export: lv_scale_section_set_style');
  assert(typeof wasmExports['lv_scale_get_mode'] != 'undefined', 'missing Wasm export: lv_scale_get_mode');
  assert(typeof wasmExports['lv_scale_get_total_tick_count'] != 'undefined', 'missing Wasm export: lv_scale_get_total_tick_count');
  assert(typeof wasmExports['lv_scale_get_major_tick_every'] != 'undefined', 'missing Wasm export: lv_scale_get_major_tick_every');
  assert(typeof wasmExports['lv_scale_get_rotation'] != 'undefined', 'missing Wasm export: lv_scale_get_rotation');
  assert(typeof wasmExports['lv_scale_get_label_show'] != 'undefined', 'missing Wasm export: lv_scale_get_label_show');
  assert(typeof wasmExports['lv_scale_get_angle_range'] != 'undefined', 'missing Wasm export: lv_scale_get_angle_range');
  assert(typeof wasmExports['lv_scale_get_range_min_value'] != 'undefined', 'missing Wasm export: lv_scale_get_range_min_value');
  assert(typeof wasmExports['lv_scale_get_range_max_value'] != 'undefined', 'missing Wasm export: lv_scale_get_range_max_value');
  assert(typeof wasmExports['lv_scale_bind_section_min_value'] != 'undefined', 'missing Wasm export: lv_scale_bind_section_min_value');
  assert(typeof wasmExports['lv_scale_bind_section_max_value'] != 'undefined', 'missing Wasm export: lv_scale_bind_section_max_value');
  assert(typeof wasmExports['lv_slider_is_dragged'] != 'undefined', 'missing Wasm export: lv_slider_is_dragged');
  assert(typeof wasmExports['lv_slider_set_min_value'] != 'undefined', 'missing Wasm export: lv_slider_set_min_value');
  assert(typeof wasmExports['lv_slider_set_max_value'] != 'undefined', 'missing Wasm export: lv_slider_set_max_value');
  assert(typeof wasmExports['lv_slider_set_orientation'] != 'undefined', 'missing Wasm export: lv_slider_set_orientation');
  assert(typeof wasmExports['lv_slider_get_value'] != 'undefined', 'missing Wasm export: lv_slider_get_value');
  assert(typeof wasmExports['lv_slider_get_mode'] != 'undefined', 'missing Wasm export: lv_slider_get_mode');
  assert(typeof wasmExports['lv_slider_get_orientation'] != 'undefined', 'missing Wasm export: lv_slider_get_orientation');
  assert(typeof wasmExports['lv_slider_is_symmetrical'] != 'undefined', 'missing Wasm export: lv_slider_is_symmetrical');
  assert(typeof wasmExports['lv_slider_bind_value'] != 'undefined', 'missing Wasm export: lv_slider_bind_value');
  assert(typeof wasmExports['lv_spangroup_get_expand_height'] != 'undefined', 'missing Wasm export: lv_spangroup_get_expand_height');
  assert(typeof wasmExports['lv_spangroup_get_expand_width'] != 'undefined', 'missing Wasm export: lv_spangroup_get_expand_width');
  assert(typeof wasmExports['lv_spangroup_get_max_line_height'] != 'undefined', 'missing Wasm export: lv_spangroup_get_max_line_height');
  assert(typeof wasmExports['lv_spangroup_add_span'] != 'undefined', 'missing Wasm export: lv_spangroup_add_span');
  assert(typeof wasmExports['lv_spangroup_refresh'] != 'undefined', 'missing Wasm export: lv_spangroup_refresh');
  assert(typeof wasmExports['lv_spangroup_delete_span'] != 'undefined', 'missing Wasm export: lv_spangroup_delete_span');
  assert(typeof wasmExports['lv_span_set_text'] != 'undefined', 'missing Wasm export: lv_span_set_text');
  assert(typeof wasmExports['lv_span_set_text_fmt'] != 'undefined', 'missing Wasm export: lv_span_set_text_fmt');
  assert(typeof wasmExports['lv_spangroup_set_span_text'] != 'undefined', 'missing Wasm export: lv_spangroup_set_span_text');
  assert(typeof wasmExports['lv_span_set_text_static'] != 'undefined', 'missing Wasm export: lv_span_set_text_static');
  assert(typeof wasmExports['lv_spangroup_set_span_text_static'] != 'undefined', 'missing Wasm export: lv_spangroup_set_span_text_static');
  assert(typeof wasmExports['lv_spangroup_set_span_text_fmt'] != 'undefined', 'missing Wasm export: lv_spangroup_set_span_text_fmt');
  assert(typeof wasmExports['lv_spangroup_set_span_style'] != 'undefined', 'missing Wasm export: lv_spangroup_set_span_style');
  assert(typeof wasmExports['lv_spangroup_set_align'] != 'undefined', 'missing Wasm export: lv_spangroup_set_align');
  assert(typeof wasmExports['lv_spangroup_set_overflow'] != 'undefined', 'missing Wasm export: lv_spangroup_set_overflow');
  assert(typeof wasmExports['lv_spangroup_set_indent'] != 'undefined', 'missing Wasm export: lv_spangroup_set_indent');
  assert(typeof wasmExports['lv_spangroup_set_mode'] != 'undefined', 'missing Wasm export: lv_spangroup_set_mode');
  assert(typeof wasmExports['lv_spangroup_set_max_lines'] != 'undefined', 'missing Wasm export: lv_spangroup_set_max_lines');
  assert(typeof wasmExports['lv_span_get_style'] != 'undefined', 'missing Wasm export: lv_span_get_style');
  assert(typeof wasmExports['lv_span_get_text'] != 'undefined', 'missing Wasm export: lv_span_get_text');
  assert(typeof wasmExports['lv_spangroup_get_child'] != 'undefined', 'missing Wasm export: lv_spangroup_get_child');
  assert(typeof wasmExports['lv_spangroup_get_span_count'] != 'undefined', 'missing Wasm export: lv_spangroup_get_span_count');
  assert(typeof wasmExports['lv_spangroup_get_align'] != 'undefined', 'missing Wasm export: lv_spangroup_get_align');
  assert(typeof wasmExports['lv_spangroup_get_overflow'] != 'undefined', 'missing Wasm export: lv_spangroup_get_overflow');
  assert(typeof wasmExports['lv_spangroup_get_indent'] != 'undefined', 'missing Wasm export: lv_spangroup_get_indent');
  assert(typeof wasmExports['lv_spangroup_get_mode'] != 'undefined', 'missing Wasm export: lv_spangroup_get_mode');
  assert(typeof wasmExports['lv_spangroup_get_max_lines'] != 'undefined', 'missing Wasm export: lv_spangroup_get_max_lines');
  assert(typeof wasmExports['lv_spangroup_get_span_coords'] != 'undefined', 'missing Wasm export: lv_spangroup_get_span_coords');
  assert(typeof wasmExports['lv_spangroup_get_span_by_point'] != 'undefined', 'missing Wasm export: lv_spangroup_get_span_by_point');
  assert(typeof wasmExports['lv_spangroup_bind_span_text'] != 'undefined', 'missing Wasm export: lv_spangroup_bind_span_text');
  assert(typeof wasmExports['lv_textarea_set_cursor_click_pos'] != 'undefined', 'missing Wasm export: lv_textarea_set_cursor_click_pos');
  assert(typeof wasmExports['lv_spinbox_step_next'] != 'undefined', 'missing Wasm export: lv_spinbox_step_next');
  assert(typeof wasmExports['lv_spinbox_step_prev'] != 'undefined', 'missing Wasm export: lv_spinbox_step_prev');
  assert(typeof wasmExports['lv_spinbox_increment'] != 'undefined', 'missing Wasm export: lv_spinbox_increment');
  assert(typeof wasmExports['lv_spinbox_decrement'] != 'undefined', 'missing Wasm export: lv_spinbox_decrement');
  assert(typeof wasmExports['lv_spinbox_set_digit_count'] != 'undefined', 'missing Wasm export: lv_spinbox_set_digit_count');
  assert(typeof wasmExports['lv_spinbox_set_dec_point_pos'] != 'undefined', 'missing Wasm export: lv_spinbox_set_dec_point_pos');
  assert(typeof wasmExports['lv_spinbox_set_min_value'] != 'undefined', 'missing Wasm export: lv_spinbox_set_min_value');
  assert(typeof wasmExports['lv_spinbox_set_max_value'] != 'undefined', 'missing Wasm export: lv_spinbox_set_max_value');
  assert(typeof wasmExports['lv_spinbox_set_cursor_pos'] != 'undefined', 'missing Wasm export: lv_spinbox_set_cursor_pos');
  assert(typeof wasmExports['lv_spinbox_set_digit_step_direction'] != 'undefined', 'missing Wasm export: lv_spinbox_set_digit_step_direction');
  assert(typeof wasmExports['lv_spinbox_get_rollover'] != 'undefined', 'missing Wasm export: lv_spinbox_get_rollover');
  assert(typeof wasmExports['lv_spinbox_bind_value'] != 'undefined', 'missing Wasm export: lv_spinbox_bind_value');
  assert(typeof wasmExports['lv_switch_set_orientation'] != 'undefined', 'missing Wasm export: lv_switch_set_orientation');
  assert(typeof wasmExports['lv_switch_get_orientation'] != 'undefined', 'missing Wasm export: lv_switch_get_orientation');
  assert(typeof wasmExports['lv_table_set_cell_value'] != 'undefined', 'missing Wasm export: lv_table_set_cell_value');
  assert(typeof wasmExports['lv_table_set_column_count'] != 'undefined', 'missing Wasm export: lv_table_set_column_count');
  assert(typeof wasmExports['lv_table_set_row_count'] != 'undefined', 'missing Wasm export: lv_table_set_row_count');
  assert(typeof wasmExports['lv_table_set_cell_value_fmt'] != 'undefined', 'missing Wasm export: lv_table_set_cell_value_fmt');
  assert(typeof wasmExports['lv_table_set_column_width'] != 'undefined', 'missing Wasm export: lv_table_set_column_width');
  assert(typeof wasmExports['lv_table_set_cell_ctrl'] != 'undefined', 'missing Wasm export: lv_table_set_cell_ctrl');
  assert(typeof wasmExports['lv_table_clear_cell_ctrl'] != 'undefined', 'missing Wasm export: lv_table_clear_cell_ctrl');
  assert(typeof wasmExports['lv_table_set_cell_user_data'] != 'undefined', 'missing Wasm export: lv_table_set_cell_user_data');
  assert(typeof wasmExports['lv_table_set_selected_cell'] != 'undefined', 'missing Wasm export: lv_table_set_selected_cell');
  assert(typeof wasmExports['lv_table_get_cell_value'] != 'undefined', 'missing Wasm export: lv_table_get_cell_value');
  assert(typeof wasmExports['lv_table_get_row_count'] != 'undefined', 'missing Wasm export: lv_table_get_row_count');
  assert(typeof wasmExports['lv_table_get_column_count'] != 'undefined', 'missing Wasm export: lv_table_get_column_count');
  assert(typeof wasmExports['lv_table_get_column_width'] != 'undefined', 'missing Wasm export: lv_table_get_column_width');
  assert(typeof wasmExports['lv_table_has_cell_ctrl'] != 'undefined', 'missing Wasm export: lv_table_has_cell_ctrl');
  assert(typeof wasmExports['lv_table_get_selected_cell'] != 'undefined', 'missing Wasm export: lv_table_get_selected_cell');
  assert(typeof wasmExports['lv_table_get_cell_user_data'] != 'undefined', 'missing Wasm export: lv_table_get_cell_user_data');
  assert(typeof wasmExports['lv_tabview_get_content'] != 'undefined', 'missing Wasm export: lv_tabview_get_content');
  assert(typeof wasmExports['lv_tabview_rename_tab'] != 'undefined', 'missing Wasm export: lv_tabview_rename_tab');
  assert(typeof wasmExports['lv_tabview_get_tab_count'] != 'undefined', 'missing Wasm export: lv_tabview_get_tab_count');
  assert(typeof wasmExports['lv_tabview_get_tab_active'] != 'undefined', 'missing Wasm export: lv_tabview_get_tab_active');
  assert(typeof wasmExports['lv_tabview_get_tab_button'] != 'undefined', 'missing Wasm export: lv_tabview_get_tab_button');
  assert(typeof wasmExports['lv_textarea_cursor_up'] != 'undefined', 'missing Wasm export: lv_textarea_cursor_up');
  assert(typeof wasmExports['lv_textarea_cursor_down'] != 'undefined', 'missing Wasm export: lv_textarea_cursor_down');
  assert(typeof wasmExports['lv_textarea_delete_char_forward'] != 'undefined', 'missing Wasm export: lv_textarea_delete_char_forward');
  assert(typeof wasmExports['lv_textarea_clear_selection'] != 'undefined', 'missing Wasm export: lv_textarea_clear_selection');
  assert(typeof wasmExports['lv_textarea_get_accepted_chars'] != 'undefined', 'missing Wasm export: lv_textarea_get_accepted_chars');
  assert(typeof wasmExports['lv_textarea_set_password_bullet'] != 'undefined', 'missing Wasm export: lv_textarea_set_password_bullet');
  assert(typeof wasmExports['lv_textarea_set_insert_replace'] != 'undefined', 'missing Wasm export: lv_textarea_set_insert_replace');
  assert(typeof wasmExports['lv_textarea_set_text_selection'] != 'undefined', 'missing Wasm export: lv_textarea_set_text_selection');
  assert(typeof wasmExports['lv_textarea_set_password_show_time'] != 'undefined', 'missing Wasm export: lv_textarea_set_password_show_time');
  assert(typeof wasmExports['lv_textarea_set_align'] != 'undefined', 'missing Wasm export: lv_textarea_set_align');
  assert(typeof wasmExports['lv_textarea_get_label'] != 'undefined', 'missing Wasm export: lv_textarea_get_label');
  assert(typeof wasmExports['lv_textarea_get_placeholder_text'] != 'undefined', 'missing Wasm export: lv_textarea_get_placeholder_text');
  assert(typeof wasmExports['lv_textarea_get_cursor_click_pos'] != 'undefined', 'missing Wasm export: lv_textarea_get_cursor_click_pos');
  assert(typeof wasmExports['lv_textarea_get_password_mode'] != 'undefined', 'missing Wasm export: lv_textarea_get_password_mode');
  assert(typeof wasmExports['lv_textarea_get_password_bullet'] != 'undefined', 'missing Wasm export: lv_textarea_get_password_bullet');
  assert(typeof wasmExports['lv_textarea_text_is_selected'] != 'undefined', 'missing Wasm export: lv_textarea_text_is_selected');
  assert(typeof wasmExports['lv_textarea_get_text_selection'] != 'undefined', 'missing Wasm export: lv_textarea_get_text_selection');
  assert(typeof wasmExports['lv_textarea_get_password_show_time'] != 'undefined', 'missing Wasm export: lv_textarea_get_password_show_time');
  assert(typeof wasmExports['lv_textarea_get_current_char'] != 'undefined', 'missing Wasm export: lv_textarea_get_current_char');
  assert(typeof wasmExports['lv_tileview_add_tile'] != 'undefined', 'missing Wasm export: lv_tileview_add_tile');
  assert(typeof wasmExports['lv_tileview_set_tile'] != 'undefined', 'missing Wasm export: lv_tileview_set_tile');
  assert(typeof wasmExports['lv_tileview_set_tile_by_index'] != 'undefined', 'missing Wasm export: lv_tileview_set_tile_by_index');
  assert(typeof wasmExports['lv_tileview_get_tile_active'] != 'undefined', 'missing Wasm export: lv_tileview_get_tile_active');
  assert(typeof wasmExports['lv_win_add_title'] != 'undefined', 'missing Wasm export: lv_win_add_title');
  assert(typeof wasmExports['lv_win_get_header'] != 'undefined', 'missing Wasm export: lv_win_get_header');
  assert(typeof wasmExports['lv_win_add_button'] != 'undefined', 'missing Wasm export: lv_win_add_button');
  assert(typeof wasmExports['lv_win_get_content'] != 'undefined', 'missing Wasm export: lv_win_get_content');
  assert(typeof wasmExports['onMqttEvent'] != 'undefined', 'missing Wasm export: onMqttEvent');
  assert(typeof wasmExports['eez_flow_init_themes'] != 'undefined', 'missing Wasm export: eez_flow_init_themes');
  assert(typeof wasmExports['flowPropagateValueLVGLEvent'] != 'undefined', 'missing Wasm export: flowPropagateValueLVGLEvent');
  assert(typeof wasmExports['_evalTextProperty'] != 'undefined', 'missing Wasm export: _evalTextProperty');
  assert(typeof wasmExports['_evalIntegerProperty'] != 'undefined', 'missing Wasm export: _evalIntegerProperty');
  assert(typeof wasmExports['_evalUnsignedIntegerProperty'] != 'undefined', 'missing Wasm export: _evalUnsignedIntegerProperty');
  assert(typeof wasmExports['_evalBooleanProperty'] != 'undefined', 'missing Wasm export: _evalBooleanProperty');
  assert(typeof wasmExports['_evalStringArrayPropertyAndJoin'] != 'undefined', 'missing Wasm export: _evalStringArrayPropertyAndJoin');
  assert(typeof wasmExports['_assignStringProperty'] != 'undefined', 'missing Wasm export: _assignStringProperty');
  assert(typeof wasmExports['_assignIntegerProperty'] != 'undefined', 'missing Wasm export: _assignIntegerProperty');
  assert(typeof wasmExports['_assignBooleanProperty'] != 'undefined', 'missing Wasm export: _assignBooleanProperty');
  assert(typeof wasmExports['compareRollerOptions'] != 'undefined', 'missing Wasm export: compareRollerOptions');
  assert(typeof wasmExports['emscripten_stack_get_end'] != 'undefined', 'missing Wasm export: emscripten_stack_get_end');
  assert(typeof wasmExports['emscripten_stack_get_base'] != 'undefined', 'missing Wasm export: emscripten_stack_get_base');
  assert(typeof wasmExports['emscripten_builtin_memalign'] != 'undefined', 'missing Wasm export: emscripten_builtin_memalign');
  assert(typeof wasmExports['strerror'] != 'undefined', 'missing Wasm export: strerror');
  assert(typeof wasmExports['setThrew'] != 'undefined', 'missing Wasm export: setThrew');
  assert(typeof wasmExports['emscripten_stack_init'] != 'undefined', 'missing Wasm export: emscripten_stack_init');
  assert(typeof wasmExports['emscripten_stack_get_free'] != 'undefined', 'missing Wasm export: emscripten_stack_get_free');
  assert(typeof wasmExports['_emscripten_stack_restore'] != 'undefined', 'missing Wasm export: _emscripten_stack_restore');
  assert(typeof wasmExports['_emscripten_stack_alloc'] != 'undefined', 'missing Wasm export: _emscripten_stack_alloc');
  assert(typeof wasmExports['emscripten_stack_get_current'] != 'undefined', 'missing Wasm export: emscripten_stack_get_current');
  assert(typeof wasmExports['memory'] != 'undefined', 'missing Wasm export: memory');
  assert(typeof wasmExports['__indirect_function_table'] != 'undefined', 'missing Wasm export: __indirect_function_table');
  _lv_display_flush_ready = Module['_lv_display_flush_ready'] = createExportWrapper('lv_display_flush_ready', 1);
  _lv_area_get_width = Module['_lv_area_get_width'] = createExportWrapper('lv_area_get_width', 1);
  _lv_malloc = Module['_lv_malloc'] = createExportWrapper('lv_malloc', 1);
  _lv_free = Module['_lv_free'] = createExportWrapper('lv_free', 1);
  _lvglSetEncoderGroup = Module['_lvglSetEncoderGroup'] = createExportWrapper('lvglSetEncoderGroup', 1);
  _lv_indev_set_group = Module['_lv_indev_set_group'] = createExportWrapper('lv_indev_set_group', 2);
  _lvglSetKeyboardGroup = Module['_lvglSetKeyboardGroup'] = createExportWrapper('lvglSetKeyboardGroup', 1);
  _hal_init = Module['_hal_init'] = createExportWrapper('hal_init', 1);
  _malloc = Module['_malloc'] = createExportWrapper('malloc', 1);
  _lv_display_create = Module['_lv_display_create'] = createExportWrapper('lv_display_create', 2);
  _lv_display_set_flush_cb = Module['_lv_display_set_flush_cb'] = createExportWrapper('lv_display_set_flush_cb', 2);
  _lv_display_set_buffers = Module['_lv_display_set_buffers'] = createExportWrapper('lv_display_set_buffers', 5);
  _lv_indev_create = Module['_lv_indev_create'] = createExportWrapper('lv_indev_create', 0);
  _lv_indev_set_type = Module['_lv_indev_set_type'] = createExportWrapper('lv_indev_set_type', 2);
  _lv_indev_set_read_cb = Module['_lv_indev_set_read_cb'] = createExportWrapper('lv_indev_set_read_cb', 2);
  _lv_fs_drv_init = Module['_lv_fs_drv_init'] = createExportWrapper('lv_fs_drv_init', 1);
  _lv_fs_drv_register = Module['_lv_fs_drv_register'] = createExportWrapper('lv_fs_drv_register', 1);
  _init = Module['_init'] = createExportWrapper('init', 9);
  _lv_init = Module['_lv_init'] = createExportWrapper('lv_init', 0);
  _lv_display_get_default = Module['_lv_display_get_default'] = createExportWrapper('lv_display_get_default', 0);
  _lv_palette_main = Module['_lv_palette_main'] = createExportWrapper('lv_palette_main', 2);
  _lv_theme_default_init = Module['_lv_theme_default_init'] = createExportWrapper('lv_theme_default_init', 5);
  _lv_display_set_theme = Module['_lv_display_set_theme'] = createExportWrapper('lv_display_set_theme', 2);
  _mainLoop = Module['_mainLoop'] = createExportWrapper('mainLoop', 0);
  _lv_tick_inc = Module['_lv_tick_inc'] = createExportWrapper('lv_tick_inc', 1);
  _lv_timer_handler = Module['_lv_timer_handler'] = createExportWrapper('lv_timer_handler', 0);
  _getSyncedBuffer = Module['_getSyncedBuffer'] = createExportWrapper('getSyncedBuffer', 0);
  _isRTL = Module['_isRTL'] = createExportWrapper('isRTL', 0);
  _onPointerEvent = Module['_onPointerEvent'] = createExportWrapper('onPointerEvent', 3);
  _onMouseWheelEvent = Module['_onMouseWheelEvent'] = createExportWrapper('onMouseWheelEvent', 2);
  _onKeyPressed = Module['_onKeyPressed'] = createExportWrapper('onKeyPressed', 1);
  _lv_spinner_create = Module['_lv_spinner_create'] = createExportWrapper('lv_spinner_create', 1);
  _lv_qrcode_create = Module['_lv_qrcode_create'] = createExportWrapper('lv_qrcode_create', 1);
  _lv_obj_has_flag = Module['_lv_obj_has_flag'] = createExportWrapper('lv_obj_has_flag', 2);
  _lv_obj_delete = Module['_lv_obj_delete'] = createExportWrapper('lv_obj_delete', 1);
  _getStudioSymbols = Module['_getStudioSymbols'] = createExportWrapper('getStudioSymbols', 0);
  _lv_color_hex = Module['_lv_color_hex'] = createExportWrapper('lv_color_hex', 2);
  _lv_style_init = Module['_lv_style_init'] = createExportWrapper('lv_style_init', 1);
  _lv_animimg_set_duration = Module['_lv_animimg_set_duration'] = createExportWrapper('lv_animimg_set_duration', 2);
  _lv_animimg_set_repeat_count = Module['_lv_animimg_set_repeat_count'] = createExportWrapper('lv_animimg_set_repeat_count', 2);
  _lv_animimg_set_src = Module['_lv_animimg_set_src'] = createExportWrapper('lv_animimg_set_src', 3);
  _lv_animimg_start = Module['_lv_animimg_start'] = createExportWrapper('lv_animimg_start', 1);
  _lv_arc_set_bg_end_angle = Module['_lv_arc_set_bg_end_angle'] = createExportWrapper('lv_arc_set_bg_end_angle', 2);
  _lv_arc_set_bg_start_angle = Module['_lv_arc_set_bg_start_angle'] = createExportWrapper('lv_arc_set_bg_start_angle', 2);
  _lv_arc_set_mode = Module['_lv_arc_set_mode'] = createExportWrapper('lv_arc_set_mode', 2);
  _lv_arc_set_range = Module['_lv_arc_set_range'] = createExportWrapper('lv_arc_set_range', 3);
  _lv_arc_set_rotation = Module['_lv_arc_set_rotation'] = createExportWrapper('lv_arc_set_rotation', 2);
  _lv_arc_set_value = Module['_lv_arc_set_value'] = createExportWrapper('lv_arc_set_value', 2);
  _lv_bar_set_mode = Module['_lv_bar_set_mode'] = createExportWrapper('lv_bar_set_mode', 2);
  _lv_bar_set_range = Module['_lv_bar_set_range'] = createExportWrapper('lv_bar_set_range', 3);
  _lv_bar_set_start_value = Module['_lv_bar_set_start_value'] = createExportWrapper('lv_bar_set_start_value', 3);
  _lv_bar_set_value = Module['_lv_bar_set_value'] = createExportWrapper('lv_bar_set_value', 3);
  _lv_buttonmatrix_set_map = Module['_lv_buttonmatrix_set_map'] = createExportWrapper('lv_buttonmatrix_set_map', 2);
  _lv_buttonmatrix_set_ctrl_map = Module['_lv_buttonmatrix_set_ctrl_map'] = createExportWrapper('lv_buttonmatrix_set_ctrl_map', 2);
  _lv_buttonmatrix_set_one_checked = Module['_lv_buttonmatrix_set_one_checked'] = createExportWrapper('lv_buttonmatrix_set_one_checked', 2);
  _lv_dropdown_set_dir = Module['_lv_dropdown_set_dir'] = createExportWrapper('lv_dropdown_set_dir', 2);
  _lv_dropdown_set_options = Module['_lv_dropdown_set_options'] = createExportWrapper('lv_dropdown_set_options', 2);
  _lv_dropdown_set_selected = Module['_lv_dropdown_set_selected'] = createExportWrapper('lv_dropdown_set_selected', 2);
  _lv_dropdown_set_symbol = Module['_lv_dropdown_set_symbol'] = createExportWrapper('lv_dropdown_set_symbol', 2);
  _lv_event_get_code = Module['_lv_event_get_code'] = createExportWrapper('lv_event_get_code', 1);
  _lv_event_get_user_data = Module['_lv_event_get_user_data'] = createExportWrapper('lv_event_get_user_data', 1);
  _lv_label_set_text = Module['_lv_label_set_text'] = createExportWrapper('lv_label_set_text', 2);
  _lv_label_set_long_mode = Module['_lv_label_set_long_mode'] = createExportWrapper('lv_label_set_long_mode', 2);
  _lv_color_to_32 = Module['_lv_color_to_32'] = createExportWrapper('lv_color_to_32', 3);
  _lv_led_set_brightness = Module['_lv_led_set_brightness'] = createExportWrapper('lv_led_set_brightness', 2);
  _lv_led_get_brightness = Module['_lv_led_get_brightness'] = createExportWrapper('lv_led_get_brightness', 1);
  _lv_led_set_color = Module['_lv_led_set_color'] = createExportWrapper('lv_led_set_color', 2);
  _lv_obj_get_state = Module['_lv_obj_get_state'] = createExportWrapper('lv_obj_get_state', 1);
  _lv_obj_set_pos = Module['_lv_obj_set_pos'] = createExportWrapper('lv_obj_set_pos', 3);
  _lv_obj_set_size = Module['_lv_obj_set_size'] = createExportWrapper('lv_obj_set_size', 3);
  _lv_obj_update_layout = Module['_lv_obj_update_layout'] = createExportWrapper('lv_obj_update_layout', 1);
  _lv_qrcode_set_size = Module['_lv_qrcode_set_size'] = createExportWrapper('lv_qrcode_set_size', 2);
  _lv_spinbox_set_range = Module['_lv_spinbox_set_range'] = createExportWrapper('lv_spinbox_set_range', 3);
  _lv_spinbox_set_step = Module['_lv_spinbox_set_step'] = createExportWrapper('lv_spinbox_set_step', 2);
  _lv_spinbox_set_digit_format = Module['_lv_spinbox_set_digit_format'] = createExportWrapper('lv_spinbox_set_digit_format', 3);
  _lv_spinbox_set_rollover = Module['_lv_spinbox_set_rollover'] = createExportWrapper('lv_spinbox_set_rollover', 2);
  _lv_spinbox_set_value = Module['_lv_spinbox_set_value'] = createExportWrapper('lv_spinbox_set_value', 2);
  _lv_tabview_set_tab_bar_size = Module['_lv_tabview_set_tab_bar_size'] = createExportWrapper('lv_tabview_set_tab_bar_size', 2);
  _lv_textarea_set_one_line = Module['_lv_textarea_set_one_line'] = createExportWrapper('lv_textarea_set_one_line', 2);
  _lv_textarea_set_password_mode = Module['_lv_textarea_set_password_mode'] = createExportWrapper('lv_textarea_set_password_mode', 2);
  _lv_textarea_set_placeholder_text = Module['_lv_textarea_set_placeholder_text'] = createExportWrapper('lv_textarea_set_placeholder_text', 2);
  _lv_textarea_set_accepted_chars = Module['_lv_textarea_set_accepted_chars'] = createExportWrapper('lv_textarea_set_accepted_chars', 2);
  _lv_textarea_set_max_length = Module['_lv_textarea_set_max_length'] = createExportWrapper('lv_textarea_set_max_length', 2);
  _lv_textarea_set_text = Module['_lv_textarea_set_text'] = createExportWrapper('lv_textarea_set_text', 2);
  _lv_roller_set_options = Module['_lv_roller_set_options'] = createExportWrapper('lv_roller_set_options', 3);
  _lv_roller_set_selected = Module['_lv_roller_set_selected'] = createExportWrapper('lv_roller_set_selected', 3);
  _lv_roller_get_option_count = Module['_lv_roller_get_option_count'] = createExportWrapper('lv_roller_get_option_count', 1);
  _lv_slider_set_mode = Module['_lv_slider_set_mode'] = createExportWrapper('lv_slider_set_mode', 2);
  _lv_slider_set_range = Module['_lv_slider_set_range'] = createExportWrapper('lv_slider_set_range', 3);
  _lv_slider_set_start_value = Module['_lv_slider_set_start_value'] = createExportWrapper('lv_slider_set_start_value', 3);
  _lv_slider_set_value = Module['_lv_slider_set_value'] = createExportWrapper('lv_slider_set_value', 3);
  _lv_arc_get_max_value = Module['_lv_arc_get_max_value'] = createExportWrapper('lv_arc_get_max_value', 1);
  _lv_arc_get_min_value = Module['_lv_arc_get_min_value'] = createExportWrapper('lv_arc_get_min_value', 1);
  _lv_arc_get_value = Module['_lv_arc_get_value'] = createExportWrapper('lv_arc_get_value', 1);
  _lv_bar_get_start_value = Module['_lv_bar_get_start_value'] = createExportWrapper('lv_bar_get_start_value', 1);
  _lv_bar_get_value = Module['_lv_bar_get_value'] = createExportWrapper('lv_bar_get_value', 1);
  _lv_dropdown_get_options = Module['_lv_dropdown_get_options'] = createExportWrapper('lv_dropdown_get_options', 1);
  _lv_dropdown_get_selected = Module['_lv_dropdown_get_selected'] = createExportWrapper('lv_dropdown_get_selected', 1);
  _lv_event_get_draw_task = Module['_lv_event_get_draw_task'] = createExportWrapper('lv_event_get_draw_task', 1);
  _lv_label_get_text = Module['_lv_label_get_text'] = createExportWrapper('lv_label_get_text', 1);
  _lv_roller_get_options = Module['_lv_roller_get_options'] = createExportWrapper('lv_roller_get_options', 1);
  _lv_roller_get_selected = Module['_lv_roller_get_selected'] = createExportWrapper('lv_roller_get_selected', 1);
  _lv_slider_get_max_value = Module['_lv_slider_get_max_value'] = createExportWrapper('lv_slider_get_max_value', 1);
  _lv_slider_get_min_value = Module['_lv_slider_get_min_value'] = createExportWrapper('lv_slider_get_min_value', 1);
  _lv_slider_get_left_value = Module['_lv_slider_get_left_value'] = createExportWrapper('lv_slider_get_left_value', 1);
  _lv_spinbox_get_step = Module['_lv_spinbox_get_step'] = createExportWrapper('lv_spinbox_get_step', 1);
  _lv_spinbox_get_value = Module['_lv_spinbox_get_value'] = createExportWrapper('lv_spinbox_get_value', 1);
  _lv_textarea_get_max_length = Module['_lv_textarea_get_max_length'] = createExportWrapper('lv_textarea_get_max_length', 1);
  _lv_textarea_get_text = Module['_lv_textarea_get_text'] = createExportWrapper('lv_textarea_get_text', 1);
  _lv_obj_get_parent = Module['_lv_obj_get_parent'] = createExportWrapper('lv_obj_get_parent', 1);
  _to_lvgl_color = Module['_to_lvgl_color'] = createExportWrapper('to_lvgl_color', 1);
  _lv_obj_add_event_cb = Module['_lv_obj_add_event_cb'] = createExportWrapper('lv_obj_add_event_cb', 4);
  _lv_obj_add_flag = Module['_lv_obj_add_flag'] = createExportWrapper('lv_obj_add_flag', 2);
  _lv_obj_add_state = Module['_lv_obj_add_state'] = createExportWrapper('lv_obj_add_state', 2);
  _lv_obj_remove_flag = Module['_lv_obj_remove_flag'] = createExportWrapper('lv_obj_remove_flag', 2);
  _lv_obj_remove_state = Module['_lv_obj_remove_state'] = createExportWrapper('lv_obj_remove_state', 2);
  _lv_obj_has_state = Module['_lv_obj_has_state'] = createExportWrapper('lv_obj_has_state', 2);
  _lv_obj_remove_style = Module['_lv_obj_remove_style'] = createExportWrapper('lv_obj_remove_style', 3);
  _lv_obj_set_scroll_dir = Module['_lv_obj_set_scroll_dir'] = createExportWrapper('lv_obj_set_scroll_dir', 2);
  _lv_obj_set_scroll_snap_x = Module['_lv_obj_set_scroll_snap_x'] = createExportWrapper('lv_obj_set_scroll_snap_x', 2);
  _lv_obj_set_scroll_snap_y = Module['_lv_obj_set_scroll_snap_y'] = createExportWrapper('lv_obj_set_scroll_snap_y', 2);
  _lv_obj_set_scrollbar_mode = Module['_lv_obj_set_scrollbar_mode'] = createExportWrapper('lv_obj_set_scrollbar_mode', 2);
  _lv_event_get_target = Module['_lv_event_get_target'] = createExportWrapper('lv_event_get_target', 1);
  _lv_buttonmatrix_create = Module['_lv_buttonmatrix_create'] = createExportWrapper('lv_buttonmatrix_create', 1);
  _lv_button_create = Module['_lv_button_create'] = createExportWrapper('lv_button_create', 1);
  _lv_animimg_create = Module['_lv_animimg_create'] = createExportWrapper('lv_animimg_create', 1);
  _lv_arc_create = Module['_lv_arc_create'] = createExportWrapper('lv_arc_create', 1);
  _lv_bar_create = Module['_lv_bar_create'] = createExportWrapper('lv_bar_create', 1);
  _lv_calendar_create = Module['_lv_calendar_create'] = createExportWrapper('lv_calendar_create', 1);
  _lv_calendar_add_header_arrow = Module['_lv_calendar_add_header_arrow'] = createExportWrapper('lv_calendar_add_header_arrow', 1);
  _lv_calendar_set_month_shown = Module['_lv_calendar_set_month_shown'] = createExportWrapper('lv_calendar_set_month_shown', 3);
  _lv_calendar_set_today_date = Module['_lv_calendar_set_today_date'] = createExportWrapper('lv_calendar_set_today_date', 4);
  _lv_canvas_create = Module['_lv_canvas_create'] = createExportWrapper('lv_canvas_create', 1);
  _lv_chart_create = Module['_lv_chart_create'] = createExportWrapper('lv_chart_create', 1);
  _lv_checkbox_create = Module['_lv_checkbox_create'] = createExportWrapper('lv_checkbox_create', 1);
  _lv_checkbox_set_text = Module['_lv_checkbox_set_text'] = createExportWrapper('lv_checkbox_set_text', 2);
  _lv_label_create = Module['_lv_label_create'] = createExportWrapper('lv_label_create', 1);
  _lv_keyboard_create = Module['_lv_keyboard_create'] = createExportWrapper('lv_keyboard_create', 1);
  _lv_led_create = Module['_lv_led_create'] = createExportWrapper('lv_led_create', 1);
  _lv_line_create = Module['_lv_line_create'] = createExportWrapper('lv_line_create', 1);
  _lv_line_set_points = Module['_lv_line_set_points'] = createExportWrapper('lv_line_set_points', 3);
  _lv_line_set_y_invert = Module['_lv_line_set_y_invert'] = createExportWrapper('lv_line_set_y_invert', 2);
  _lv_list_create = Module['_lv_list_create'] = createExportWrapper('lv_list_create', 1);
  _lv_menu_create = Module['_lv_menu_create'] = createExportWrapper('lv_menu_create', 1);
  _lv_msgbox_create = Module['_lv_msgbox_create'] = createExportWrapper('lv_msgbox_create', 1);
  _lv_obj_create = Module['_lv_obj_create'] = createExportWrapper('lv_obj_create', 1);
  _lv_obj_add_style = Module['_lv_obj_add_style'] = createExportWrapper('lv_obj_add_style', 3);
  _lv_obj_get_style_prop = Module['_lv_obj_get_style_prop'] = createExportWrapper('lv_obj_get_style_prop', 4);
  _lv_obj_set_local_style_prop = Module['_lv_obj_set_local_style_prop'] = createExportWrapper('lv_obj_set_local_style_prop', 4);
  _lv_obj_set_style_bg_color = Module['_lv_obj_set_style_bg_color'] = createExportWrapper('lv_obj_set_style_bg_color', 3);
  _lv_obj_set_style_border_width = Module['_lv_obj_set_style_border_width'] = createExportWrapper('lv_obj_set_style_border_width', 3);
  _lv_spangroup_create = Module['_lv_spangroup_create'] = createExportWrapper('lv_spangroup_create', 1);
  _lv_table_create = Module['_lv_table_create'] = createExportWrapper('lv_table_create', 1);
  _lv_tabview_create = Module['_lv_tabview_create'] = createExportWrapper('lv_tabview_create', 1);
  _lv_tabview_set_active = Module['_lv_tabview_set_active'] = createExportWrapper('lv_tabview_set_active', 3);
  _lv_tabview_set_tab_bar_position = Module['_lv_tabview_set_tab_bar_position'] = createExportWrapper('lv_tabview_set_tab_bar_position', 2);
  _lv_tileview_create = Module['_lv_tileview_create'] = createExportWrapper('lv_tileview_create', 1);
  _lv_win_create = Module['_lv_win_create'] = createExportWrapper('lv_win_create', 1);
  _lv_dropdown_create = Module['_lv_dropdown_create'] = createExportWrapper('lv_dropdown_create', 1);
  _lv_image_create = Module['_lv_image_create'] = createExportWrapper('lv_image_create', 1);
  _lv_image_set_inner_align = Module['_lv_image_set_inner_align'] = createExportWrapper('lv_image_set_inner_align', 2);
  _lv_image_set_pivot = Module['_lv_image_set_pivot'] = createExportWrapper('lv_image_set_pivot', 3);
  _lv_image_set_rotation = Module['_lv_image_set_rotation'] = createExportWrapper('lv_image_set_rotation', 2);
  _lv_image_set_scale = Module['_lv_image_set_scale'] = createExportWrapper('lv_image_set_scale', 2);
  _lv_image_set_src = Module['_lv_image_set_src'] = createExportWrapper('lv_image_set_src', 2);
  _lv_imagebutton_create = Module['_lv_imagebutton_create'] = createExportWrapper('lv_imagebutton_create', 1);
  _lv_imagebutton_set_src = Module['_lv_imagebutton_set_src'] = createExportWrapper('lv_imagebutton_set_src', 5);
  _lv_keyboard_set_mode = Module['_lv_keyboard_set_mode'] = createExportWrapper('lv_keyboard_set_mode', 2);
  _lv_keyboard_set_textarea = Module['_lv_keyboard_set_textarea'] = createExportWrapper('lv_keyboard_set_textarea', 2);
  _lv_qrcode_set_dark_color = Module['_lv_qrcode_set_dark_color'] = createExportWrapper('lv_qrcode_set_dark_color', 2);
  _lv_qrcode_set_light_color = Module['_lv_qrcode_set_light_color'] = createExportWrapper('lv_qrcode_set_light_color', 2);
  _lv_qrcode_update = Module['_lv_qrcode_update'] = createExportWrapper('lv_qrcode_update', 3);
  _lv_roller_create = Module['_lv_roller_create'] = createExportWrapper('lv_roller_create', 1);
  _lv_scale_create = Module['_lv_scale_create'] = createExportWrapper('lv_scale_create', 1);
  _lv_scale_set_label_show = Module['_lv_scale_set_label_show'] = createExportWrapper('lv_scale_set_label_show', 2);
  _lv_scale_set_major_tick_every = Module['_lv_scale_set_major_tick_every'] = createExportWrapper('lv_scale_set_major_tick_every', 2);
  _lv_scale_set_mode = Module['_lv_scale_set_mode'] = createExportWrapper('lv_scale_set_mode', 2);
  _lv_scale_set_range = Module['_lv_scale_set_range'] = createExportWrapper('lv_scale_set_range', 3);
  _lv_scale_set_total_tick_count = Module['_lv_scale_set_total_tick_count'] = createExportWrapper('lv_scale_set_total_tick_count', 2);
  _lv_slider_create = Module['_lv_slider_create'] = createExportWrapper('lv_slider_create', 1);
  _lv_spinbox_create = Module['_lv_spinbox_create'] = createExportWrapper('lv_spinbox_create', 1);
  _lv_spinner_set_anim_params = Module['_lv_spinner_set_anim_params'] = createExportWrapper('lv_spinner_set_anim_params', 3);
  _lv_dropdown_get_list = Module['_lv_dropdown_get_list'] = createExportWrapper('lv_dropdown_get_list', 1);
  _lv_tabview_add_tab = Module['_lv_tabview_add_tab'] = createExportWrapper('lv_tabview_add_tab', 2);
  _lv_switch_create = Module['_lv_switch_create'] = createExportWrapper('lv_switch_create', 1);
  _lv_textarea_create = Module['_lv_textarea_create'] = createExportWrapper('lv_textarea_create', 1);
  _stopScript = Module['_stopScript'] = createExportWrapper('stopScript', 0);
  _onMessageFromDebugger = Module['_onMessageFromDebugger'] = createExportWrapper('onMessageFromDebugger', 2);
  _lvglGetFlowState = Module['_lvglGetFlowState'] = createExportWrapper('lvglGetFlowState', 2);
  _setDebuggerMessageSubsciptionFilter = Module['_setDebuggerMessageSubsciptionFilter'] = createExportWrapper('setDebuggerMessageSubsciptionFilter', 1);
  _setObjectIndex = Module['_setObjectIndex'] = createExportWrapper('setObjectIndex', 2);
  _getLvglObjectFromIndex = Module['_getLvglObjectFromIndex'] = createExportWrapper('getLvglObjectFromIndex', 1);
  _lv_group_remove_all_objs = Module['_lv_group_remove_all_objs'] = createExportWrapper('lv_group_remove_all_objs', 1);
  _lv_group_add_obj = Module['_lv_group_add_obj'] = createExportWrapper('lv_group_add_obj', 2);
  _lvglCreateGroup = Module['_lvglCreateGroup'] = createExportWrapper('lvglCreateGroup', 0);
  _lv_group_create = Module['_lv_group_create'] = createExportWrapper('lv_group_create', 0);
  _lvglAddScreenLoadedEventHandler = Module['_lvglAddScreenLoadedEventHandler'] = createExportWrapper('lvglAddScreenLoadedEventHandler', 1);
  _lvglGroupAddObject = Module['_lvglGroupAddObject'] = createExportWrapper('lvglGroupAddObject', 3);
  _lvglGroupRemoveObjectsForScreen = Module['_lvglGroupRemoveObjectsForScreen'] = createExportWrapper('lvglGroupRemoveObjectsForScreen', 1);
  _lvglAddEventHandler = Module['_lvglAddEventHandler'] = createExportWrapper('lvglAddEventHandler', 1);
  _lvglSetEventUserData = Module['_lvglSetEventUserData'] = createExportWrapper('lvglSetEventUserData', 2);
  _lvglCreateScreen = Module['_lvglCreateScreen'] = createExportWrapper('lvglCreateScreen', 6);
  _lvglCreateUserWidget = Module['_lvglCreateUserWidget'] = createExportWrapper('lvglCreateUserWidget', 6);
  _lvglScreenLoad = Module['_lvglScreenLoad'] = createExportWrapper('lvglScreenLoad', 2);
  _lv_screen_load_anim = Module['_lv_screen_load_anim'] = createExportWrapper('lv_screen_load_anim', 5);
  _lvglDeleteObject = Module['_lvglDeleteObject'] = createExportWrapper('lvglDeleteObject', 1);
  _lv_screen_active = Module['_lv_screen_active'] = createExportWrapper('lv_screen_active', 0);
  _lv_screen_load = Module['_lv_screen_load'] = createExportWrapper('lv_screen_load', 1);
  _lvglDeleteObjectIndex = Module['_lvglDeleteObjectIndex'] = createExportWrapper('lvglDeleteObjectIndex', 1);
  _lvglDeletePageFlowState = Module['_lvglDeletePageFlowState'] = createExportWrapper('lvglDeletePageFlowState', 1);
  _lvglObjGetStylePropColor = Module['_lvglObjGetStylePropColor'] = createExportWrapper('lvglObjGetStylePropColor', 4);
  _lvglObjGetStylePropNum = Module['_lvglObjGetStylePropNum'] = createExportWrapper('lvglObjGetStylePropNum', 4);
  _lvglObjSetLocalStylePropColor = Module['_lvglObjSetLocalStylePropColor'] = createExportWrapper('lvglObjSetLocalStylePropColor', 4);
  _lvglObjSetLocalStylePropNum = Module['_lvglObjSetLocalStylePropNum'] = createExportWrapper('lvglObjSetLocalStylePropNum', 4);
  _lvglObjSetLocalStylePropPtr = Module['_lvglObjSetLocalStylePropPtr'] = createExportWrapper('lvglObjSetLocalStylePropPtr', 4);
  _lvglGetBuiltinFontPtr = Module['_lvglGetBuiltinFontPtr'] = createExportWrapper('lvglGetBuiltinFontPtr', 1);
  _strcmp = Module['_strcmp'] = createExportWrapper('strcmp', 2);
  _lvglObjGetStylePropBuiltInFont = Module['_lvglObjGetStylePropBuiltInFont'] = createExportWrapper('lvglObjGetStylePropBuiltInFont', 4);
  _lvglObjGetStylePropFontAddr = Module['_lvglObjGetStylePropFontAddr'] = createExportWrapper('lvglObjGetStylePropFontAddr', 4);
  _lvglObjSetLocalStylePropBuiltInFont = Module['_lvglObjSetLocalStylePropBuiltInFont'] = createExportWrapper('lvglObjSetLocalStylePropBuiltInFont', 4);
  _lvglSetObjStylePropBuiltInFont = Module['_lvglSetObjStylePropBuiltInFont'] = createExportWrapper('lvglSetObjStylePropBuiltInFont', 4);
  _lv_style_set_prop = Module['_lv_style_set_prop'] = createExportWrapper('lv_style_set_prop', 3);
  _lvglSetObjStylePropPtr = Module['_lvglSetObjStylePropPtr'] = createExportWrapper('lvglSetObjStylePropPtr', 4);
  _lvglStyleCreate = Module['_lvglStyleCreate'] = createExportWrapper('lvglStyleCreate', 0);
  _lvglStyleSetPropColor = Module['_lvglStyleSetPropColor'] = createExportWrapper('lvglStyleSetPropColor', 3);
  _lvglSetStylePropBuiltInFont = Module['_lvglSetStylePropBuiltInFont'] = createExportWrapper('lvglSetStylePropBuiltInFont', 3);
  _lvglSetStylePropPtr = Module['_lvglSetStylePropPtr'] = createExportWrapper('lvglSetStylePropPtr', 3);
  _lvglSetStylePropNum = Module['_lvglSetStylePropNum'] = createExportWrapper('lvglSetStylePropNum', 3);
  _lvglStyleDelete = Module['_lvglStyleDelete'] = createExportWrapper('lvglStyleDelete', 1);
  _lvglObjAddStyle = Module['_lvglObjAddStyle'] = createExportWrapper('lvglObjAddStyle', 3);
  _lvglObjRemoveStyle = Module['_lvglObjRemoveStyle'] = createExportWrapper('lvglObjRemoveStyle', 3);
  _lvglGetObjRelX = Module['_lvglGetObjRelX'] = createExportWrapper('lvglGetObjRelX', 1);
  _lvglGetObjRelY = Module['_lvglGetObjRelY'] = createExportWrapper('lvglGetObjRelY', 1);
  _lvglGetObjWidth = Module['_lvglGetObjWidth'] = createExportWrapper('lvglGetObjWidth', 1);
  _lv_obj_get_width = Module['_lv_obj_get_width'] = createExportWrapper('lv_obj_get_width', 1);
  _lvglGetObjHeight = Module['_lvglGetObjHeight'] = createExportWrapper('lvglGetObjHeight', 1);
  _lv_obj_get_height = Module['_lv_obj_get_height'] = createExportWrapper('lv_obj_get_height', 1);
  _lvglLoadFont = Module['_lvglLoadFont'] = createExportWrapper('lvglLoadFont', 3);
  _lv_binfont_create = Module['_lv_binfont_create'] = createExportWrapper('lv_binfont_create', 1);
  _lvglFreeFont = Module['_lvglFreeFont'] = createExportWrapper('lvglFreeFont', 1);
  _lv_binfont_destroy = Module['_lv_binfont_destroy'] = createExportWrapper('lv_binfont_destroy', 1);
  _lvglLedGetColor = Module['_lvglLedGetColor'] = createExportWrapper('lvglLedGetColor', 1);
  _lv_color_to_u32 = Module['_lv_color_to_u32'] = createExportWrapper('lv_color_to_u32', 1);
  _lvglMeterIndicatorNeedleLineSetColor = Module['_lvglMeterIndicatorNeedleLineSetColor'] = createExportWrapper('lvglMeterIndicatorNeedleLineSetColor', 3);
  _lvglMeterIndicatorScaleLinesSetColorStart = Module['_lvglMeterIndicatorScaleLinesSetColorStart'] = createExportWrapper('lvglMeterIndicatorScaleLinesSetColorStart', 3);
  _lvglMeterIndicatorScaleLinesSetColorEnd = Module['_lvglMeterIndicatorScaleLinesSetColorEnd'] = createExportWrapper('lvglMeterIndicatorScaleLinesSetColorEnd', 3);
  _lvglMeterIndicatorArcSetColor = Module['_lvglMeterIndicatorArcSetColor'] = createExportWrapper('lvglMeterIndicatorArcSetColor', 3);
  _lvglMeterScaleSetMinorTickColor = Module['_lvglMeterScaleSetMinorTickColor'] = createExportWrapper('lvglMeterScaleSetMinorTickColor', 3);
  _lvglMeterScaleSetMajorTickColor = Module['_lvglMeterScaleSetMajorTickColor'] = createExportWrapper('lvglMeterScaleSetMajorTickColor', 3);
  _lvglGetIndicator_start_value = Module['_lvglGetIndicator_start_value'] = createExportWrapper('lvglGetIndicator_start_value', 1);
  _lvglGetIndicator_end_value = Module['_lvglGetIndicator_end_value'] = createExportWrapper('lvglGetIndicator_end_value', 1);
  _lvglAddTimelineKeyframe = Module['_lvglAddTimelineKeyframe'] = createExportWrapper('lvglAddTimelineKeyframe', 23);
  _lvglSetTimelinePosition = Module['_lvglSetTimelinePosition'] = createExportWrapper('lvglSetTimelinePosition', 1);
  _lvglClearTimeline = Module['_lvglClearTimeline'] = createExportWrapper('lvglClearTimeline', 0);
  _lvglLineSetPoints = Module['_lvglLineSetPoints'] = createExportWrapper('lvglLineSetPoints', 3);
  _lvglScrollTo = Module['_lvglScrollTo'] = createExportWrapper('lvglScrollTo', 4);
  _lv_obj_scroll_to = Module['_lv_obj_scroll_to'] = createExportWrapper('lv_obj_scroll_to', 4);
  _lvglGetScrollX = Module['_lvglGetScrollX'] = createExportWrapper('lvglGetScrollX', 1);
  _lv_obj_get_scroll_x = Module['_lv_obj_get_scroll_x'] = createExportWrapper('lv_obj_get_scroll_x', 1);
  _lvglGetScrollY = Module['_lvglGetScrollY'] = createExportWrapper('lvglGetScrollY', 1);
  _lv_obj_get_scroll_y = Module['_lv_obj_get_scroll_y'] = createExportWrapper('lv_obj_get_scroll_y', 1);
  _lvglObjInvalidate = Module['_lvglObjInvalidate'] = createExportWrapper('lvglObjInvalidate', 1);
  _lv_obj_invalidate = Module['_lv_obj_invalidate'] = createExportWrapper('lv_obj_invalidate', 1);
  _lvglDeleteScreenOnUnload = Module['_lvglDeleteScreenOnUnload'] = createExportWrapper('lvglDeleteScreenOnUnload', 1);
  _lvglGetTabName = Module['_lvglGetTabName'] = createExportWrapper('lvglGetTabName', 3);
  _lv_tabview_get_tab_bar = Module['_lv_tabview_get_tab_bar'] = createExportWrapper('lv_tabview_get_tab_bar', 1);
  _lv_obj_get_child_by_type = Module['_lv_obj_get_child_by_type'] = createExportWrapper('lv_obj_get_child_by_type', 3);
  _lvglCreateFreeTypeFont = Module['_lvglCreateFreeTypeFont'] = createExportWrapper('lvglCreateFreeTypeFont', 4);
  _lv_log_add = Module['_lv_log_add'] = createExportWrapper('lv_log_add', 6);
  _lvglCreateAnim = Module['_lvglCreateAnim'] = createExportWrapper('lvglCreateAnim', 6);
  _lv_anim_init = Module['_lv_anim_init'] = createExportWrapper('lv_anim_init', 1);
  _lv_anim_set_delay = Module['_lv_anim_set_delay'] = createExportWrapper('lv_anim_set_delay', 2);
  _lv_anim_set_repeat_delay = Module['_lv_anim_set_repeat_delay'] = createExportWrapper('lv_anim_set_repeat_delay', 2);
  _lv_anim_set_repeat_count = Module['_lv_anim_set_repeat_count'] = createExportWrapper('lv_anim_set_repeat_count', 2);
  _lv_group_init = Module['_lv_group_init'] = createExportWrapper('lv_group_init', 0);
  _lv_group_deinit = Module['_lv_group_deinit'] = createExportWrapper('lv_group_deinit', 0);
  _lv_ll_init = Module['_lv_ll_init'] = createExportWrapper('lv_ll_init', 2);
  _lv_ll_clear = Module['_lv_ll_clear'] = createExportWrapper('lv_ll_clear', 1);
  _lv_ll_ins_head = Module['_lv_ll_ins_head'] = createExportWrapper('lv_ll_ins_head', 1);
  _lv_group_delete = Module['_lv_group_delete'] = createExportWrapper('lv_group_delete', 1);
  _lv_indev_get_next = Module['_lv_indev_get_next'] = createExportWrapper('lv_indev_get_next', 1);
  _lv_indev_get_type = Module['_lv_indev_get_type'] = createExportWrapper('lv_indev_get_type', 1);
  _lv_indev_get_group = Module['_lv_indev_get_group'] = createExportWrapper('lv_indev_get_group', 1);
  _lv_obj_send_event = Module['_lv_obj_send_event'] = createExportWrapper('lv_obj_send_event', 3);
  _lv_ll_get_head = Module['_lv_ll_get_head'] = createExportWrapper('lv_ll_get_head', 1);
  _lv_ll_get_next = Module['_lv_ll_get_next'] = createExportWrapper('lv_ll_get_next', 2);
  _lv_ll_remove = Module['_lv_ll_remove'] = createExportWrapper('lv_ll_remove', 2);
  _lv_group_get_default = Module['_lv_group_get_default'] = createExportWrapper('lv_group_get_default', 0);
  _lv_group_set_default = Module['_lv_group_set_default'] = createExportWrapper('lv_group_set_default', 1);
  _lv_group_remove_obj = Module['_lv_group_remove_obj'] = createExportWrapper('lv_group_remove_obj', 1);
  _lv_obj_allocate_spec_attr = Module['_lv_obj_allocate_spec_attr'] = createExportWrapper('lv_obj_allocate_spec_attr', 1);
  _lv_ll_ins_tail = Module['_lv_ll_ins_tail'] = createExportWrapper('lv_ll_ins_tail', 1);
  _lv_ll_get_tail = Module['_lv_ll_get_tail'] = createExportWrapper('lv_ll_get_tail', 1);
  _lv_ll_get_prev = Module['_lv_ll_get_prev'] = createExportWrapper('lv_ll_get_prev', 2);
  _lv_obj_get_group = Module['_lv_obj_get_group'] = createExportWrapper('lv_obj_get_group', 1);
  _lv_group_swap_obj = Module['_lv_group_swap_obj'] = createExportWrapper('lv_group_swap_obj', 2);
  _lv_group_focus_obj = Module['_lv_group_focus_obj'] = createExportWrapper('lv_group_focus_obj', 1);
  _lv_group_get_focused = Module['_lv_group_get_focused'] = createExportWrapper('lv_group_get_focused', 1);
  _lv_group_set_editing = Module['_lv_group_set_editing'] = createExportWrapper('lv_group_set_editing', 2);
  _lv_group_focus_next = Module['_lv_group_focus_next'] = createExportWrapper('lv_group_focus_next', 1);
  _lv_group_focus_prev = Module['_lv_group_focus_prev'] = createExportWrapper('lv_group_focus_prev', 1);
  _lv_group_focus_freeze = Module['_lv_group_focus_freeze'] = createExportWrapper('lv_group_focus_freeze', 2);
  _lv_group_send_data = Module['_lv_group_send_data'] = createExportWrapper('lv_group_send_data', 2);
  _lv_group_set_focus_cb = Module['_lv_group_set_focus_cb'] = createExportWrapper('lv_group_set_focus_cb', 2);
  _lv_group_set_edge_cb = Module['_lv_group_set_edge_cb'] = createExportWrapper('lv_group_set_edge_cb', 2);
  _lv_group_set_refocus_policy = Module['_lv_group_set_refocus_policy'] = createExportWrapper('lv_group_set_refocus_policy', 2);
  _lv_group_set_wrap = Module['_lv_group_set_wrap'] = createExportWrapper('lv_group_set_wrap', 2);
  _lv_group_get_focus_cb = Module['_lv_group_get_focus_cb'] = createExportWrapper('lv_group_get_focus_cb', 1);
  _lv_group_get_edge_cb = Module['_lv_group_get_edge_cb'] = createExportWrapper('lv_group_get_edge_cb', 1);
  _lv_group_get_editing = Module['_lv_group_get_editing'] = createExportWrapper('lv_group_get_editing', 1);
  _lv_group_get_wrap = Module['_lv_group_get_wrap'] = createExportWrapper('lv_group_get_wrap', 1);
  _lv_group_get_obj_count = Module['_lv_group_get_obj_count'] = createExportWrapper('lv_group_get_obj_count', 1);
  _lv_ll_get_len = Module['_lv_ll_get_len'] = createExportWrapper('lv_ll_get_len', 1);
  _lv_group_get_obj_by_index = Module['_lv_group_get_obj_by_index'] = createExportWrapper('lv_group_get_obj_by_index', 2);
  _lv_group_get_count = Module['_lv_group_get_count'] = createExportWrapper('lv_group_get_count', 0);
  _lv_group_by_index = Module['_lv_group_by_index'] = createExportWrapper('lv_group_by_index', 1);
  _lv_obj_get_scroll_left = Module['_lv_obj_get_scroll_left'] = createExportWrapper('lv_obj_get_scroll_left', 1);
  _lv_obj_get_scroll_top = Module['_lv_obj_get_scroll_top'] = createExportWrapper('lv_obj_get_scroll_top', 1);
  _lv_event_mark_deleted = Module['_lv_event_mark_deleted'] = createExportWrapper('lv_event_mark_deleted', 1);
  _lv_obj_enable_style_refresh = Module['_lv_obj_enable_style_refresh'] = createExportWrapper('lv_obj_enable_style_refresh', 1);
  _lv_obj_remove_style_all = Module['_lv_obj_remove_style_all'] = createExportWrapper('lv_obj_remove_style_all', 1);
  _lv_anim_delete = Module['_lv_anim_delete'] = createExportWrapper('lv_anim_delete', 2);
  _lv_event_remove_all = Module['_lv_event_remove_all'] = createExportWrapper('lv_event_remove_all', 1);
  _lv_event_get_current_target = Module['_lv_event_get_current_target'] = createExportWrapper('lv_event_get_current_target', 1);
  _lv_event_get_param = Module['_lv_event_get_param'] = createExportWrapper('lv_event_get_param', 1);
  _lv_indev_get_scroll_obj = Module['_lv_indev_get_scroll_obj'] = createExportWrapper('lv_indev_get_scroll_obj', 1);
  _lv_obj_get_child_count = Module['_lv_obj_get_child_count'] = createExportWrapper('lv_obj_get_child_count', 1);
  _lv_obj_mark_layout_as_dirty = Module['_lv_obj_mark_layout_as_dirty'] = createExportWrapper('lv_obj_mark_layout_as_dirty', 1);
  _lv_event_get_key = Module['_lv_event_get_key'] = createExportWrapper('lv_event_get_key', 1);
  _lv_obj_is_editable = Module['_lv_obj_is_editable'] = createExportWrapper('lv_obj_is_editable', 1);
  _lv_obj_get_scroll_right = Module['_lv_obj_get_scroll_right'] = createExportWrapper('lv_obj_get_scroll_right', 1);
  _lv_obj_scroll_to_y = Module['_lv_obj_scroll_to_y'] = createExportWrapper('lv_obj_scroll_to_y', 3);
  _lv_obj_get_scroll_dir = Module['_lv_obj_get_scroll_dir'] = createExportWrapper('lv_obj_get_scroll_dir', 1);
  _lv_obj_scroll_to_x = Module['_lv_obj_scroll_to_x'] = createExportWrapper('lv_obj_scroll_to_x', 3);
  _lv_obj_scroll_to_view_recursive = Module['_lv_obj_scroll_to_view_recursive'] = createExportWrapper('lv_obj_scroll_to_view_recursive', 2);
  _lv_indev_active = Module['_lv_indev_active'] = createExportWrapper('lv_indev_active', 0);
  _lv_event_get_indev = Module['_lv_event_get_indev'] = createExportWrapper('lv_event_get_indev', 1);
  _lv_obj_get_scrollbar_mode = Module['_lv_obj_get_scrollbar_mode'] = createExportWrapper('lv_obj_get_scrollbar_mode', 1);
  _lv_obj_get_scrollbar_area = Module['_lv_obj_get_scrollbar_area'] = createExportWrapper('lv_obj_get_scrollbar_area', 3);
  _lv_obj_invalidate_area = Module['_lv_obj_invalidate_area'] = createExportWrapper('lv_obj_invalidate_area', 2);
  _lv_obj_calculate_ext_draw_size = Module['_lv_obj_calculate_ext_draw_size'] = createExportWrapper('lv_obj_calculate_ext_draw_size', 2);
  _lv_event_set_ext_draw_size = Module['_lv_event_set_ext_draw_size'] = createExportWrapper('lv_event_set_ext_draw_size', 2);
  _lv_area_increase = Module['_lv_area_increase'] = createExportWrapper('lv_area_increase', 3);
  _lv_area_is_in = Module['_lv_area_is_in'] = createExportWrapper('lv_area_is_in', 3);
  _lv_event_get_layer = Module['_lv_event_get_layer'] = createExportWrapper('lv_event_get_layer', 1);
  _lv_draw_rect_dsc_init = Module['_lv_draw_rect_dsc_init'] = createExportWrapper('lv_draw_rect_dsc_init', 1);
  _lv_obj_init_draw_rect_dsc = Module['_lv_obj_init_draw_rect_dsc'] = createExportWrapper('lv_obj_init_draw_rect_dsc', 3);
  _lv_draw_rect = Module['_lv_draw_rect'] = createExportWrapper('lv_draw_rect', 3);
  _lv_area_get_size = Module['_lv_area_get_size'] = createExportWrapper('lv_area_get_size', 1);
  _lv_obj_get_style_opa_recursive = Module['_lv_obj_get_style_opa_recursive'] = createExportWrapper('lv_obj_get_style_opa_recursive', 2);
  _lv_obj_class_create_obj = Module['_lv_obj_class_create_obj'] = createExportWrapper('lv_obj_class_create_obj', 2);
  _lv_obj_class_init_obj = Module['_lv_obj_class_init_obj'] = createExportWrapper('lv_obj_class_init_obj', 1);
  _lv_obj_is_layout_positioned = Module['_lv_obj_is_layout_positioned'] = createExportWrapper('lv_obj_is_layout_positioned', 1);
  _lv_obj_has_flag_any = Module['_lv_obj_has_flag_any'] = createExportWrapper('lv_obj_has_flag_any', 2);
  _lv_obj_set_flag = Module['_lv_obj_set_flag'] = createExportWrapper('lv_obj_set_flag', 3);
  _lv_obj_get_child = Module['_lv_obj_get_child'] = createExportWrapper('lv_obj_get_child', 2);
  _lv_obj_style_state_compare = Module['_lv_obj_style_state_compare'] = createExportWrapper('lv_obj_style_state_compare', 3);
  _lv_obj_update_layer_type = Module['_lv_obj_update_layer_type'] = createExportWrapper('lv_obj_update_layer_type', 1);
  _lv_malloc_zeroed = Module['_lv_malloc_zeroed'] = createExportWrapper('lv_malloc_zeroed', 1);
  _lv_obj_style_create_transition = Module['_lv_obj_style_create_transition'] = createExportWrapper('lv_obj_style_create_transition', 5);
  _lv_obj_refresh_style = Module['_lv_obj_refresh_style'] = createExportWrapper('lv_obj_refresh_style', 3);
  _lv_obj_refresh_ext_draw_size = Module['_lv_obj_refresh_ext_draw_size'] = createExportWrapper('lv_obj_refresh_ext_draw_size', 1);
  _lv_obj_set_state = Module['_lv_obj_set_state'] = createExportWrapper('lv_obj_set_state', 3);
  _lv_obj_check_type = Module['_lv_obj_check_type'] = createExportWrapper('lv_obj_check_type', 2);
  _lv_obj_has_class = Module['_lv_obj_has_class'] = createExportWrapper('lv_obj_has_class', 2);
  _lv_obj_get_class = Module['_lv_obj_get_class'] = createExportWrapper('lv_obj_get_class', 1);
  _lv_obj_is_valid = Module['_lv_obj_is_valid'] = createExportWrapper('lv_obj_is_valid', 1);
  _lv_display_get_next = Module['_lv_display_get_next'] = createExportWrapper('lv_display_get_next', 1);
  _lv_obj_null_on_delete = Module['_lv_obj_null_on_delete'] = createExportWrapper('lv_obj_null_on_delete', 1);
  _lv_obj_add_screen_load_event = Module['_lv_obj_add_screen_load_event'] = createExportWrapper('lv_obj_add_screen_load_event', 6);
  _lv_memset = Module['_lv_memset'] = createExportWrapper('lv_memset', 3);
  _lv_event_free_user_data_cb = Module['_lv_event_free_user_data_cb'] = createExportWrapper('lv_event_free_user_data_cb', 1);
  _lv_obj_add_screen_create_event = Module['_lv_obj_add_screen_create_event'] = createExportWrapper('lv_obj_add_screen_create_event', 6);
  _lv_obj_add_play_timeline_event = Module['_lv_obj_add_play_timeline_event'] = createExportWrapper('lv_obj_add_play_timeline_event', 5);
  _lv_anim_timeline_get_progress = Module['_lv_anim_timeline_get_progress'] = createExportWrapper('lv_anim_timeline_get_progress', 1);
  _lv_anim_timeline_set_progress = Module['_lv_anim_timeline_set_progress'] = createExportWrapper('lv_anim_timeline_set_progress', 2);
  _lv_anim_timeline_set_delay = Module['_lv_anim_timeline_set_delay'] = createExportWrapper('lv_anim_timeline_set_delay', 2);
  _lv_anim_timeline_set_reverse = Module['_lv_anim_timeline_set_reverse'] = createExportWrapper('lv_anim_timeline_set_reverse', 2);
  _lv_anim_timeline_start = Module['_lv_anim_timeline_start'] = createExportWrapper('lv_anim_timeline_start', 1);
  _lv_obj_set_user_data = Module['_lv_obj_set_user_data'] = createExportWrapper('lv_obj_set_user_data', 2);
  _lv_obj_get_user_data = Module['_lv_obj_get_user_data'] = createExportWrapper('lv_obj_get_user_data', 1);
  _lv_event_get_target_obj = Module['_lv_event_get_target_obj'] = createExportWrapper('lv_event_get_target_obj', 1);
  _lv_realloc = Module['_lv_realloc'] = createExportWrapper('lv_realloc', 2);
  _lv_display_get_horizontal_resolution = Module['_lv_display_get_horizontal_resolution'] = createExportWrapper('lv_display_get_horizontal_resolution', 1);
  _lv_display_get_vertical_resolution = Module['_lv_display_get_vertical_resolution'] = createExportWrapper('lv_display_get_vertical_resolution', 1);
  _lv_theme_apply = Module['_lv_theme_apply'] = createExportWrapper('lv_theme_apply', 1);
  _lv_obj_refresh_self_size = Module['_lv_obj_refresh_self_size'] = createExportWrapper('lv_obj_refresh_self_size', 1);
  _lv_obj_is_group_def = Module['_lv_obj_is_group_def'] = createExportWrapper('lv_obj_is_group_def', 1);
  _lv_obj_destruct = Module['_lv_obj_destruct'] = createExportWrapper('lv_obj_destruct', 1);
  _lv_obj_style_apply_color_filter = Module['_lv_obj_style_apply_color_filter'] = createExportWrapper('lv_obj_style_apply_color_filter', 4);
  _lv_obj_style_apply_recolor = Module['_lv_obj_style_apply_recolor'] = createExportWrapper('lv_obj_style_apply_recolor', 4);
  _lv_obj_get_style_recolor_recursive = Module['_lv_obj_get_style_recolor_recursive'] = createExportWrapper('lv_obj_get_style_recolor_recursive', 3);
  _lv_color_make = Module['_lv_color_make'] = createExportWrapper('lv_color_make', 4);
  _lv_color_mix = Module['_lv_color_mix'] = createExportWrapper('lv_color_mix', 4);
  _lv_memcpy = Module['_lv_memcpy'] = createExportWrapper('lv_memcpy', 3);
  _lv_image_src_get_type = Module['_lv_image_src_get_type'] = createExportWrapper('lv_image_src_get_type', 1);
  _lv_color_over32 = Module['_lv_color_over32'] = createExportWrapper('lv_color_over32', 3);
  _lv_obj_init_draw_label_dsc = Module['_lv_obj_init_draw_label_dsc'] = createExportWrapper('lv_obj_init_draw_label_dsc', 3);
  _lv_obj_init_draw_image_dsc = Module['_lv_obj_init_draw_image_dsc'] = createExportWrapper('lv_obj_init_draw_image_dsc', 3);
  _lv_area_get_height = Module['_lv_area_get_height'] = createExportWrapper('lv_area_get_height', 1);
  _lv_obj_init_draw_line_dsc = Module['_lv_obj_init_draw_line_dsc'] = createExportWrapper('lv_obj_init_draw_line_dsc', 3);
  _lv_obj_init_draw_arc_dsc = Module['_lv_obj_init_draw_arc_dsc'] = createExportWrapper('lv_obj_init_draw_arc_dsc', 3);
  _lv_obj_get_ext_draw_size = Module['_lv_obj_get_ext_draw_size'] = createExportWrapper('lv_obj_get_ext_draw_size', 1);
  _lv_obj_get_layer_type = Module['_lv_obj_get_layer_type'] = createExportWrapper('lv_obj_get_layer_type', 1);
  _lv_event_push = Module['_lv_event_push'] = createExportWrapper('lv_event_push', 1);
  _lv_event_pop = Module['_lv_event_pop'] = createExportWrapper('lv_event_pop', 1);
  _lv_event_send = Module['_lv_event_send'] = createExportWrapper('lv_event_send', 3);
  _lv_obj_event_base = Module['_lv_obj_event_base'] = createExportWrapper('lv_obj_event_base', 2);
  _lv_event_add = Module['_lv_event_add'] = createExportWrapper('lv_event_add', 4);
  _lv_obj_get_event_count = Module['_lv_obj_get_event_count'] = createExportWrapper('lv_obj_get_event_count', 1);
  _lv_event_get_count = Module['_lv_event_get_count'] = createExportWrapper('lv_event_get_count', 1);
  _lv_obj_get_event_dsc = Module['_lv_obj_get_event_dsc'] = createExportWrapper('lv_obj_get_event_dsc', 2);
  _lv_event_get_dsc = Module['_lv_event_get_dsc'] = createExportWrapper('lv_event_get_dsc', 2);
  _lv_obj_remove_event = Module['_lv_obj_remove_event'] = createExportWrapper('lv_obj_remove_event', 2);
  _lv_event_remove = Module['_lv_event_remove'] = createExportWrapper('lv_event_remove', 2);
  _lv_obj_remove_event_dsc = Module['_lv_obj_remove_event_dsc'] = createExportWrapper('lv_obj_remove_event_dsc', 2);
  _lv_event_remove_dsc = Module['_lv_event_remove_dsc'] = createExportWrapper('lv_event_remove_dsc', 2);
  _lv_obj_remove_event_cb = Module['_lv_obj_remove_event_cb'] = createExportWrapper('lv_obj_remove_event_cb', 2);
  _lv_obj_remove_event_cb_with_user_data = Module['_lv_obj_remove_event_cb_with_user_data'] = createExportWrapper('lv_obj_remove_event_cb_with_user_data', 3);
  _lv_event_get_current_target_obj = Module['_lv_event_get_current_target_obj'] = createExportWrapper('lv_event_get_current_target_obj', 1);
  _lv_event_get_old_size = Module['_lv_event_get_old_size'] = createExportWrapper('lv_event_get_old_size', 1);
  _lv_event_get_rotary_diff = Module['_lv_event_get_rotary_diff'] = createExportWrapper('lv_event_get_rotary_diff', 1);
  _lv_event_get_scroll_anim = Module['_lv_event_get_scroll_anim'] = createExportWrapper('lv_event_get_scroll_anim', 1);
  _lv_event_get_self_size_info = Module['_lv_event_get_self_size_info'] = createExportWrapper('lv_event_get_self_size_info', 1);
  _lv_event_get_hit_test_info = Module['_lv_event_get_hit_test_info'] = createExportWrapper('lv_event_get_hit_test_info', 1);
  _lv_event_get_cover_area = Module['_lv_event_get_cover_area'] = createExportWrapper('lv_event_get_cover_area', 1);
  _lv_event_set_cover_res = Module['_lv_event_set_cover_res'] = createExportWrapper('lv_event_set_cover_res', 2);
  _lv_obj_get_local_style_prop = Module['_lv_obj_get_local_style_prop'] = createExportWrapper('lv_obj_get_local_style_prop', 4);
  _lv_obj_set_style_x = Module['_lv_obj_set_style_x'] = createExportWrapper('lv_obj_set_style_x', 3);
  _lv_obj_set_style_y = Module['_lv_obj_set_style_y'] = createExportWrapper('lv_obj_set_style_y', 3);
  _lv_obj_set_x = Module['_lv_obj_set_x'] = createExportWrapper('lv_obj_set_x', 2);
  _lv_obj_set_y = Module['_lv_obj_set_y'] = createExportWrapper('lv_obj_set_y', 2);
  _lv_obj_refr_size = Module['_lv_obj_refr_size'] = createExportWrapper('lv_obj_refr_size', 1);
  _lv_obj_get_content_coords = Module['_lv_obj_get_content_coords'] = createExportWrapper('lv_obj_get_content_coords', 2);
  _lv_obj_scrollbar_invalidate = Module['_lv_obj_scrollbar_invalidate'] = createExportWrapper('lv_obj_scrollbar_invalidate', 1);
  _lv_obj_get_content_width = Module['_lv_obj_get_content_width'] = createExportWrapper('lv_obj_get_content_width', 1);
  _lv_obj_get_content_height = Module['_lv_obj_get_content_height'] = createExportWrapper('lv_obj_get_content_height', 1);
  _lv_obj_get_coords = Module['_lv_obj_get_coords'] = createExportWrapper('lv_obj_get_coords', 2);
  _lv_obj_set_style_width = Module['_lv_obj_set_style_width'] = createExportWrapper('lv_obj_set_style_width', 3);
  _lv_obj_set_style_height = Module['_lv_obj_set_style_height'] = createExportWrapper('lv_obj_set_style_height', 3);
  _lv_obj_set_width = Module['_lv_obj_set_width'] = createExportWrapper('lv_obj_set_width', 2);
  _lv_obj_set_height = Module['_lv_obj_set_height'] = createExportWrapper('lv_obj_set_height', 2);
  _lv_obj_set_content_width = Module['_lv_obj_set_content_width'] = createExportWrapper('lv_obj_set_content_width', 2);
  _lv_obj_set_content_height = Module['_lv_obj_set_content_height'] = createExportWrapper('lv_obj_set_content_height', 2);
  _lv_obj_set_layout = Module['_lv_obj_set_layout'] = createExportWrapper('lv_obj_set_layout', 2);
  _lv_obj_set_style_layout = Module['_lv_obj_set_style_layout'] = createExportWrapper('lv_obj_set_style_layout', 3);
  _lv_obj_get_screen = Module['_lv_obj_get_screen'] = createExportWrapper('lv_obj_get_screen', 1);
  _lv_obj_get_display = Module['_lv_obj_get_display'] = createExportWrapper('lv_obj_get_display', 1);
  _lv_display_send_event = Module['_lv_display_send_event'] = createExportWrapper('lv_display_send_event', 3);
  _lv_obj_refr_pos = Module['_lv_obj_refr_pos'] = createExportWrapper('lv_obj_refr_pos', 1);
  _lv_layout_apply = Module['_lv_layout_apply'] = createExportWrapper('lv_layout_apply', 1);
  _lv_obj_readjust_scroll = Module['_lv_obj_readjust_scroll'] = createExportWrapper('lv_obj_readjust_scroll', 2);
  _lv_obj_set_align = Module['_lv_obj_set_align'] = createExportWrapper('lv_obj_set_align', 2);
  _lv_obj_set_style_align = Module['_lv_obj_set_style_align'] = createExportWrapper('lv_obj_set_style_align', 3);
  _lv_obj_align = Module['_lv_obj_align'] = createExportWrapper('lv_obj_align', 4);
  _lv_obj_align_to = Module['_lv_obj_align_to'] = createExportWrapper('lv_obj_align_to', 5);
  _lv_obj_get_x = Module['_lv_obj_get_x'] = createExportWrapper('lv_obj_get_x', 1);
  _lv_obj_get_x2 = Module['_lv_obj_get_x2'] = createExportWrapper('lv_obj_get_x2', 1);
  _lv_obj_get_y = Module['_lv_obj_get_y'] = createExportWrapper('lv_obj_get_y', 1);
  _lv_obj_get_y2 = Module['_lv_obj_get_y2'] = createExportWrapper('lv_obj_get_y2', 1);
  _lv_obj_get_x_aligned = Module['_lv_obj_get_x_aligned'] = createExportWrapper('lv_obj_get_x_aligned', 1);
  _lv_obj_get_y_aligned = Module['_lv_obj_get_y_aligned'] = createExportWrapper('lv_obj_get_y_aligned', 1);
  _lv_obj_get_self_width = Module['_lv_obj_get_self_width'] = createExportWrapper('lv_obj_get_self_width', 1);
  _lv_obj_get_self_height = Module['_lv_obj_get_self_height'] = createExportWrapper('lv_obj_get_self_height', 1);
  _lv_obj_move_to = Module['_lv_obj_move_to'] = createExportWrapper('lv_obj_move_to', 3);
  _lv_obj_move_children_by = Module['_lv_obj_move_children_by'] = createExportWrapper('lv_obj_move_children_by', 4);
  _lv_obj_transform_point = Module['_lv_obj_transform_point'] = createExportWrapper('lv_obj_transform_point', 3);
  _lv_obj_transform_point_array = Module['_lv_obj_transform_point_array'] = createExportWrapper('lv_obj_transform_point_array', 4);
  _lv_point_array_transform = Module['_lv_point_array_transform'] = createExportWrapper('lv_point_array_transform', 7);
  _lv_obj_get_transformed_area = Module['_lv_obj_get_transformed_area'] = createExportWrapper('lv_obj_get_transformed_area', 3);
  _lv_display_is_invalidation_enabled = Module['_lv_display_is_invalidation_enabled'] = createExportWrapper('lv_display_is_invalidation_enabled', 1);
  _lv_obj_area_is_visible = Module['_lv_obj_area_is_visible'] = createExportWrapper('lv_obj_area_is_visible', 2);
  _lv_inv_area = Module['_lv_inv_area'] = createExportWrapper('lv_inv_area', 2);
  _lv_display_get_screen_active = Module['_lv_display_get_screen_active'] = createExportWrapper('lv_display_get_screen_active', 1);
  _lv_display_get_screen_prev = Module['_lv_display_get_screen_prev'] = createExportWrapper('lv_display_get_screen_prev', 1);
  _lv_display_get_layer_bottom = Module['_lv_display_get_layer_bottom'] = createExportWrapper('lv_display_get_layer_bottom', 1);
  _lv_display_get_layer_top = Module['_lv_display_get_layer_top'] = createExportWrapper('lv_display_get_layer_top', 1);
  _lv_display_get_layer_sys = Module['_lv_display_get_layer_sys'] = createExportWrapper('lv_display_get_layer_sys', 1);
  _lv_area_intersect = Module['_lv_area_intersect'] = createExportWrapper('lv_area_intersect', 3);
  _lv_obj_is_visible = Module['_lv_obj_is_visible'] = createExportWrapper('lv_obj_is_visible', 1);
  _lv_obj_set_ext_click_area = Module['_lv_obj_set_ext_click_area'] = createExportWrapper('lv_obj_set_ext_click_area', 2);
  _lv_obj_get_click_area = Module['_lv_obj_get_click_area'] = createExportWrapper('lv_obj_get_click_area', 2);
  _lv_obj_hit_test = Module['_lv_obj_hit_test'] = createExportWrapper('lv_obj_hit_test', 2);
  _lv_area_is_point_on = Module['_lv_area_is_point_on'] = createExportWrapper('lv_area_is_point_on', 3);
  _lv_clamp_width = Module['_lv_clamp_width'] = createExportWrapper('lv_clamp_width', 4);
  _lv_clamp_height = Module['_lv_clamp_height'] = createExportWrapper('lv_clamp_height', 4);
  _lv_obj_center = Module['_lv_obj_center'] = createExportWrapper('lv_obj_center', 1);
  _lv_obj_set_transform = Module['_lv_obj_set_transform'] = createExportWrapper('lv_obj_set_transform', 2);
  _lv_obj_reset_transform = Module['_lv_obj_reset_transform'] = createExportWrapper('lv_obj_reset_transform', 1);
  _lv_obj_get_transform = Module['_lv_obj_get_transform'] = createExportWrapper('lv_obj_get_transform', 1);
  _lv_obj_get_scroll_snap_x = Module['_lv_obj_get_scroll_snap_x'] = createExportWrapper('lv_obj_get_scroll_snap_x', 1);
  _lv_obj_get_scroll_snap_y = Module['_lv_obj_get_scroll_snap_y'] = createExportWrapper('lv_obj_get_scroll_snap_y', 1);
  _lv_obj_get_scroll_bottom = Module['_lv_obj_get_scroll_bottom'] = createExportWrapper('lv_obj_get_scroll_bottom', 1);
  _lv_obj_get_scroll_end = Module['_lv_obj_get_scroll_end'] = createExportWrapper('lv_obj_get_scroll_end', 2);
  _lv_anim_get = Module['_lv_anim_get'] = createExportWrapper('lv_anim_get', 2);
  _lv_obj_scroll_by_bounded = Module['_lv_obj_scroll_by_bounded'] = createExportWrapper('lv_obj_scroll_by_bounded', 4);
  _lv_obj_scroll_by = Module['_lv_obj_scroll_by'] = createExportWrapper('lv_obj_scroll_by', 4);
  _lv_anim_set_var = Module['_lv_anim_set_var'] = createExportWrapper('lv_anim_set_var', 2);
  _lv_anim_set_deleted_cb = Module['_lv_anim_set_deleted_cb'] = createExportWrapper('lv_anim_set_deleted_cb', 2);
  _lv_anim_speed_clamped = Module['_lv_anim_speed_clamped'] = createExportWrapper('lv_anim_speed_clamped', 3);
  _lv_anim_set_duration = Module['_lv_anim_set_duration'] = createExportWrapper('lv_anim_set_duration', 2);
  _lv_anim_set_values = Module['_lv_anim_set_values'] = createExportWrapper('lv_anim_set_values', 3);
  _lv_anim_set_exec_cb = Module['_lv_anim_set_exec_cb'] = createExportWrapper('lv_anim_set_exec_cb', 2);
  _lv_anim_path_ease_out = Module['_lv_anim_path_ease_out'] = createExportWrapper('lv_anim_path_ease_out', 1);
  _lv_anim_set_path_cb = Module['_lv_anim_set_path_cb'] = createExportWrapper('lv_anim_set_path_cb', 2);
  _lv_anim_start = Module['_lv_anim_start'] = createExportWrapper('lv_anim_start', 1);
  _lv_obj_scroll_by_raw = Module['_lv_obj_scroll_by_raw'] = createExportWrapper('lv_obj_scroll_by_raw', 3);
  _lv_obj_scroll_to_view = Module['_lv_obj_scroll_to_view'] = createExportWrapper('lv_obj_scroll_to_view', 2);
  _lv_obj_is_scrolling = Module['_lv_obj_is_scrolling'] = createExportWrapper('lv_obj_is_scrolling', 1);
  _lv_obj_stop_scroll_anim = Module['_lv_obj_stop_scroll_anim'] = createExportWrapper('lv_obj_stop_scroll_anim', 1);
  _lv_obj_update_snap = Module['_lv_obj_update_snap'] = createExportWrapper('lv_obj_update_snap', 2);
  _lv_indev_scroll_get_snap_dist = Module['_lv_indev_scroll_get_snap_dist'] = createExportWrapper('lv_indev_scroll_get_snap_dist', 2);
  _lv_area_set = Module['_lv_area_set'] = createExportWrapper('lv_area_set', 5);
  _lv_indev_get_scroll_dir = Module['_lv_indev_get_scroll_dir'] = createExportWrapper('lv_indev_get_scroll_dir', 1);
  _lv_display_get_dpi = Module['_lv_display_get_dpi'] = createExportWrapper('lv_display_get_dpi', 1);
  _lv_obj_style_init = Module['_lv_obj_style_init'] = createExportWrapper('lv_obj_style_init', 0);
  _lv_obj_style_deinit = Module['_lv_obj_style_deinit'] = createExportWrapper('lv_obj_style_deinit', 0);
  _lv_style_prop_lookup_flags = Module['_lv_style_prop_lookup_flags'] = createExportWrapper('lv_style_prop_lookup_flags', 1);
  _lv_style_remove_prop = Module['_lv_style_remove_prop'] = createExportWrapper('lv_style_remove_prop', 2);
  _lv_style_reset = Module['_lv_style_reset'] = createExportWrapper('lv_style_reset', 1);
  _lv_style_prop_get_default = Module['_lv_style_prop_get_default'] = createExportWrapper('lv_style_prop_get_default', 2);
  _lv_obj_replace_style = Module['_lv_obj_replace_style'] = createExportWrapper('lv_obj_replace_style', 4);
  _lv_obj_report_style_change = Module['_lv_obj_report_style_change'] = createExportWrapper('lv_obj_report_style_change', 1);
  _lv_obj_style_set_disabled = Module['_lv_obj_style_set_disabled'] = createExportWrapper('lv_obj_style_set_disabled', 4);
  _lv_obj_style_get_disabled = Module['_lv_obj_style_get_disabled'] = createExportWrapper('lv_obj_style_get_disabled', 3);
  _lv_obj_has_style_prop = Module['_lv_obj_has_style_prop'] = createExportWrapper('lv_obj_has_style_prop', 3);
  _lv_style_get_prop = Module['_lv_style_get_prop'] = createExportWrapper('lv_style_get_prop', 3);
  _lv_obj_remove_local_style_prop = Module['_lv_obj_remove_local_style_prop'] = createExportWrapper('lv_obj_remove_local_style_prop', 3);
  _lv_color_eq = Module['_lv_color_eq'] = createExportWrapper('lv_color_eq', 2);
  _lv_anim_set_start_cb = Module['_lv_anim_set_start_cb'] = createExportWrapper('lv_anim_set_start_cb', 2);
  _lv_anim_set_completed_cb = Module['_lv_anim_set_completed_cb'] = createExportWrapper('lv_anim_set_completed_cb', 2);
  _lv_anim_set_early_apply = Module['_lv_anim_set_early_apply'] = createExportWrapper('lv_anim_set_early_apply', 2);
  _lv_anim_set_user_data = Module['_lv_anim_set_user_data'] = createExportWrapper('lv_anim_set_user_data', 2);
  _lv_style_is_empty = Module['_lv_style_is_empty'] = createExportWrapper('lv_style_is_empty', 1);
  _lv_obj_fade_in = Module['_lv_obj_fade_in'] = createExportWrapper('lv_obj_fade_in', 3);
  _lv_obj_set_style_opa = Module['_lv_obj_set_style_opa'] = createExportWrapper('lv_obj_set_style_opa', 3);
  _lv_obj_fade_out = Module['_lv_obj_fade_out'] = createExportWrapper('lv_obj_fade_out', 3);
  _lv_obj_calculate_style_text_align = Module['_lv_obj_calculate_style_text_align'] = createExportWrapper('lv_obj_calculate_style_text_align', 3);
  _lv_bidi_calculate_align = Module['_lv_bidi_calculate_align'] = createExportWrapper('lv_bidi_calculate_align', 3);
  _lv_obj_set_style_min_width = Module['_lv_obj_set_style_min_width'] = createExportWrapper('lv_obj_set_style_min_width', 3);
  _lv_obj_set_style_max_width = Module['_lv_obj_set_style_max_width'] = createExportWrapper('lv_obj_set_style_max_width', 3);
  _lv_obj_set_style_min_height = Module['_lv_obj_set_style_min_height'] = createExportWrapper('lv_obj_set_style_min_height', 3);
  _lv_obj_set_style_max_height = Module['_lv_obj_set_style_max_height'] = createExportWrapper('lv_obj_set_style_max_height', 3);
  _lv_obj_set_style_length = Module['_lv_obj_set_style_length'] = createExportWrapper('lv_obj_set_style_length', 3);
  _lv_obj_set_style_transform_width = Module['_lv_obj_set_style_transform_width'] = createExportWrapper('lv_obj_set_style_transform_width', 3);
  _lv_obj_set_style_transform_height = Module['_lv_obj_set_style_transform_height'] = createExportWrapper('lv_obj_set_style_transform_height', 3);
  _lv_obj_set_style_translate_x = Module['_lv_obj_set_style_translate_x'] = createExportWrapper('lv_obj_set_style_translate_x', 3);
  _lv_obj_set_style_translate_y = Module['_lv_obj_set_style_translate_y'] = createExportWrapper('lv_obj_set_style_translate_y', 3);
  _lv_obj_set_style_translate_radial = Module['_lv_obj_set_style_translate_radial'] = createExportWrapper('lv_obj_set_style_translate_radial', 3);
  _lv_obj_set_style_transform_scale_x = Module['_lv_obj_set_style_transform_scale_x'] = createExportWrapper('lv_obj_set_style_transform_scale_x', 3);
  _lv_obj_set_style_transform_scale_y = Module['_lv_obj_set_style_transform_scale_y'] = createExportWrapper('lv_obj_set_style_transform_scale_y', 3);
  _lv_obj_set_style_transform_rotation = Module['_lv_obj_set_style_transform_rotation'] = createExportWrapper('lv_obj_set_style_transform_rotation', 3);
  _lv_obj_set_style_transform_pivot_x = Module['_lv_obj_set_style_transform_pivot_x'] = createExportWrapper('lv_obj_set_style_transform_pivot_x', 3);
  _lv_obj_set_style_transform_pivot_y = Module['_lv_obj_set_style_transform_pivot_y'] = createExportWrapper('lv_obj_set_style_transform_pivot_y', 3);
  _lv_obj_set_style_transform_skew_x = Module['_lv_obj_set_style_transform_skew_x'] = createExportWrapper('lv_obj_set_style_transform_skew_x', 3);
  _lv_obj_set_style_transform_skew_y = Module['_lv_obj_set_style_transform_skew_y'] = createExportWrapper('lv_obj_set_style_transform_skew_y', 3);
  _lv_obj_set_style_pad_top = Module['_lv_obj_set_style_pad_top'] = createExportWrapper('lv_obj_set_style_pad_top', 3);
  _lv_obj_set_style_pad_bottom = Module['_lv_obj_set_style_pad_bottom'] = createExportWrapper('lv_obj_set_style_pad_bottom', 3);
  _lv_obj_set_style_pad_left = Module['_lv_obj_set_style_pad_left'] = createExportWrapper('lv_obj_set_style_pad_left', 3);
  _lv_obj_set_style_pad_right = Module['_lv_obj_set_style_pad_right'] = createExportWrapper('lv_obj_set_style_pad_right', 3);
  _lv_obj_set_style_pad_row = Module['_lv_obj_set_style_pad_row'] = createExportWrapper('lv_obj_set_style_pad_row', 3);
  _lv_obj_set_style_pad_column = Module['_lv_obj_set_style_pad_column'] = createExportWrapper('lv_obj_set_style_pad_column', 3);
  _lv_obj_set_style_pad_radial = Module['_lv_obj_set_style_pad_radial'] = createExportWrapper('lv_obj_set_style_pad_radial', 3);
  _lv_obj_set_style_margin_top = Module['_lv_obj_set_style_margin_top'] = createExportWrapper('lv_obj_set_style_margin_top', 3);
  _lv_obj_set_style_margin_bottom = Module['_lv_obj_set_style_margin_bottom'] = createExportWrapper('lv_obj_set_style_margin_bottom', 3);
  _lv_obj_set_style_margin_left = Module['_lv_obj_set_style_margin_left'] = createExportWrapper('lv_obj_set_style_margin_left', 3);
  _lv_obj_set_style_margin_right = Module['_lv_obj_set_style_margin_right'] = createExportWrapper('lv_obj_set_style_margin_right', 3);
  _lv_obj_set_style_bg_opa = Module['_lv_obj_set_style_bg_opa'] = createExportWrapper('lv_obj_set_style_bg_opa', 3);
  _lv_obj_set_style_bg_grad_color = Module['_lv_obj_set_style_bg_grad_color'] = createExportWrapper('lv_obj_set_style_bg_grad_color', 3);
  _lv_obj_set_style_bg_grad_dir = Module['_lv_obj_set_style_bg_grad_dir'] = createExportWrapper('lv_obj_set_style_bg_grad_dir', 3);
  _lv_obj_set_style_bg_main_stop = Module['_lv_obj_set_style_bg_main_stop'] = createExportWrapper('lv_obj_set_style_bg_main_stop', 3);
  _lv_obj_set_style_bg_grad_stop = Module['_lv_obj_set_style_bg_grad_stop'] = createExportWrapper('lv_obj_set_style_bg_grad_stop', 3);
  _lv_obj_set_style_bg_main_opa = Module['_lv_obj_set_style_bg_main_opa'] = createExportWrapper('lv_obj_set_style_bg_main_opa', 3);
  _lv_obj_set_style_bg_grad_opa = Module['_lv_obj_set_style_bg_grad_opa'] = createExportWrapper('lv_obj_set_style_bg_grad_opa', 3);
  _lv_obj_set_style_bg_grad = Module['_lv_obj_set_style_bg_grad'] = createExportWrapper('lv_obj_set_style_bg_grad', 3);
  _lv_obj_set_style_bg_image_src = Module['_lv_obj_set_style_bg_image_src'] = createExportWrapper('lv_obj_set_style_bg_image_src', 3);
  _lv_obj_set_style_bg_image_opa = Module['_lv_obj_set_style_bg_image_opa'] = createExportWrapper('lv_obj_set_style_bg_image_opa', 3);
  _lv_obj_set_style_bg_image_recolor = Module['_lv_obj_set_style_bg_image_recolor'] = createExportWrapper('lv_obj_set_style_bg_image_recolor', 3);
  _lv_obj_set_style_bg_image_recolor_opa = Module['_lv_obj_set_style_bg_image_recolor_opa'] = createExportWrapper('lv_obj_set_style_bg_image_recolor_opa', 3);
  _lv_obj_set_style_bg_image_tiled = Module['_lv_obj_set_style_bg_image_tiled'] = createExportWrapper('lv_obj_set_style_bg_image_tiled', 3);
  _lv_obj_set_style_border_color = Module['_lv_obj_set_style_border_color'] = createExportWrapper('lv_obj_set_style_border_color', 3);
  _lv_obj_set_style_border_opa = Module['_lv_obj_set_style_border_opa'] = createExportWrapper('lv_obj_set_style_border_opa', 3);
  _lv_obj_set_style_border_side = Module['_lv_obj_set_style_border_side'] = createExportWrapper('lv_obj_set_style_border_side', 3);
  _lv_obj_set_style_border_post = Module['_lv_obj_set_style_border_post'] = createExportWrapper('lv_obj_set_style_border_post', 3);
  _lv_obj_set_style_outline_width = Module['_lv_obj_set_style_outline_width'] = createExportWrapper('lv_obj_set_style_outline_width', 3);
  _lv_obj_set_style_outline_color = Module['_lv_obj_set_style_outline_color'] = createExportWrapper('lv_obj_set_style_outline_color', 3);
  _lv_obj_set_style_outline_opa = Module['_lv_obj_set_style_outline_opa'] = createExportWrapper('lv_obj_set_style_outline_opa', 3);
  _lv_obj_set_style_outline_pad = Module['_lv_obj_set_style_outline_pad'] = createExportWrapper('lv_obj_set_style_outline_pad', 3);
  _lv_obj_set_style_shadow_width = Module['_lv_obj_set_style_shadow_width'] = createExportWrapper('lv_obj_set_style_shadow_width', 3);
  _lv_obj_set_style_shadow_offset_x = Module['_lv_obj_set_style_shadow_offset_x'] = createExportWrapper('lv_obj_set_style_shadow_offset_x', 3);
  _lv_obj_set_style_shadow_offset_y = Module['_lv_obj_set_style_shadow_offset_y'] = createExportWrapper('lv_obj_set_style_shadow_offset_y', 3);
  _lv_obj_set_style_shadow_spread = Module['_lv_obj_set_style_shadow_spread'] = createExportWrapper('lv_obj_set_style_shadow_spread', 3);
  _lv_obj_set_style_shadow_color = Module['_lv_obj_set_style_shadow_color'] = createExportWrapper('lv_obj_set_style_shadow_color', 3);
  _lv_obj_set_style_shadow_opa = Module['_lv_obj_set_style_shadow_opa'] = createExportWrapper('lv_obj_set_style_shadow_opa', 3);
  _lv_obj_set_style_image_opa = Module['_lv_obj_set_style_image_opa'] = createExportWrapper('lv_obj_set_style_image_opa', 3);
  _lv_obj_set_style_image_recolor = Module['_lv_obj_set_style_image_recolor'] = createExportWrapper('lv_obj_set_style_image_recolor', 3);
  _lv_obj_set_style_image_recolor_opa = Module['_lv_obj_set_style_image_recolor_opa'] = createExportWrapper('lv_obj_set_style_image_recolor_opa', 3);
  _lv_obj_set_style_image_colorkey = Module['_lv_obj_set_style_image_colorkey'] = createExportWrapper('lv_obj_set_style_image_colorkey', 3);
  _lv_obj_set_style_line_width = Module['_lv_obj_set_style_line_width'] = createExportWrapper('lv_obj_set_style_line_width', 3);
  _lv_obj_set_style_line_dash_width = Module['_lv_obj_set_style_line_dash_width'] = createExportWrapper('lv_obj_set_style_line_dash_width', 3);
  _lv_obj_set_style_line_dash_gap = Module['_lv_obj_set_style_line_dash_gap'] = createExportWrapper('lv_obj_set_style_line_dash_gap', 3);
  _lv_obj_set_style_line_rounded = Module['_lv_obj_set_style_line_rounded'] = createExportWrapper('lv_obj_set_style_line_rounded', 3);
  _lv_obj_set_style_line_color = Module['_lv_obj_set_style_line_color'] = createExportWrapper('lv_obj_set_style_line_color', 3);
  _lv_obj_set_style_line_opa = Module['_lv_obj_set_style_line_opa'] = createExportWrapper('lv_obj_set_style_line_opa', 3);
  _lv_obj_set_style_arc_width = Module['_lv_obj_set_style_arc_width'] = createExportWrapper('lv_obj_set_style_arc_width', 3);
  _lv_obj_set_style_arc_rounded = Module['_lv_obj_set_style_arc_rounded'] = createExportWrapper('lv_obj_set_style_arc_rounded', 3);
  _lv_obj_set_style_arc_color = Module['_lv_obj_set_style_arc_color'] = createExportWrapper('lv_obj_set_style_arc_color', 3);
  _lv_obj_set_style_arc_opa = Module['_lv_obj_set_style_arc_opa'] = createExportWrapper('lv_obj_set_style_arc_opa', 3);
  _lv_obj_set_style_arc_image_src = Module['_lv_obj_set_style_arc_image_src'] = createExportWrapper('lv_obj_set_style_arc_image_src', 3);
  _lv_obj_set_style_text_color = Module['_lv_obj_set_style_text_color'] = createExportWrapper('lv_obj_set_style_text_color', 3);
  _lv_obj_set_style_text_opa = Module['_lv_obj_set_style_text_opa'] = createExportWrapper('lv_obj_set_style_text_opa', 3);
  _lv_obj_set_style_text_font = Module['_lv_obj_set_style_text_font'] = createExportWrapper('lv_obj_set_style_text_font', 3);
  _lv_obj_set_style_text_letter_space = Module['_lv_obj_set_style_text_letter_space'] = createExportWrapper('lv_obj_set_style_text_letter_space', 3);
  _lv_obj_set_style_text_line_space = Module['_lv_obj_set_style_text_line_space'] = createExportWrapper('lv_obj_set_style_text_line_space', 3);
  _lv_obj_set_style_text_decor = Module['_lv_obj_set_style_text_decor'] = createExportWrapper('lv_obj_set_style_text_decor', 3);
  _lv_obj_set_style_text_align = Module['_lv_obj_set_style_text_align'] = createExportWrapper('lv_obj_set_style_text_align', 3);
  _lv_obj_set_style_text_outline_stroke_color = Module['_lv_obj_set_style_text_outline_stroke_color'] = createExportWrapper('lv_obj_set_style_text_outline_stroke_color', 3);
  _lv_obj_set_style_text_outline_stroke_width = Module['_lv_obj_set_style_text_outline_stroke_width'] = createExportWrapper('lv_obj_set_style_text_outline_stroke_width', 3);
  _lv_obj_set_style_text_outline_stroke_opa = Module['_lv_obj_set_style_text_outline_stroke_opa'] = createExportWrapper('lv_obj_set_style_text_outline_stroke_opa', 3);
  _lv_obj_set_style_radius = Module['_lv_obj_set_style_radius'] = createExportWrapper('lv_obj_set_style_radius', 3);
  _lv_obj_set_style_radial_offset = Module['_lv_obj_set_style_radial_offset'] = createExportWrapper('lv_obj_set_style_radial_offset', 3);
  _lv_obj_set_style_clip_corner = Module['_lv_obj_set_style_clip_corner'] = createExportWrapper('lv_obj_set_style_clip_corner', 3);
  _lv_obj_set_style_opa_layered = Module['_lv_obj_set_style_opa_layered'] = createExportWrapper('lv_obj_set_style_opa_layered', 3);
  _lv_obj_set_style_color_filter_dsc = Module['_lv_obj_set_style_color_filter_dsc'] = createExportWrapper('lv_obj_set_style_color_filter_dsc', 3);
  _lv_obj_set_style_color_filter_opa = Module['_lv_obj_set_style_color_filter_opa'] = createExportWrapper('lv_obj_set_style_color_filter_opa', 3);
  _lv_obj_set_style_recolor = Module['_lv_obj_set_style_recolor'] = createExportWrapper('lv_obj_set_style_recolor', 3);
  _lv_obj_set_style_recolor_opa = Module['_lv_obj_set_style_recolor_opa'] = createExportWrapper('lv_obj_set_style_recolor_opa', 3);
  _lv_obj_set_style_anim = Module['_lv_obj_set_style_anim'] = createExportWrapper('lv_obj_set_style_anim', 3);
  _lv_obj_set_style_anim_duration = Module['_lv_obj_set_style_anim_duration'] = createExportWrapper('lv_obj_set_style_anim_duration', 3);
  _lv_obj_set_style_transition = Module['_lv_obj_set_style_transition'] = createExportWrapper('lv_obj_set_style_transition', 3);
  _lv_obj_set_style_blend_mode = Module['_lv_obj_set_style_blend_mode'] = createExportWrapper('lv_obj_set_style_blend_mode', 3);
  _lv_obj_set_style_base_dir = Module['_lv_obj_set_style_base_dir'] = createExportWrapper('lv_obj_set_style_base_dir', 3);
  _lv_obj_set_style_bitmap_mask_src = Module['_lv_obj_set_style_bitmap_mask_src'] = createExportWrapper('lv_obj_set_style_bitmap_mask_src', 3);
  _lv_obj_set_style_rotary_sensitivity = Module['_lv_obj_set_style_rotary_sensitivity'] = createExportWrapper('lv_obj_set_style_rotary_sensitivity', 3);
  _lv_obj_set_style_flex_flow = Module['_lv_obj_set_style_flex_flow'] = createExportWrapper('lv_obj_set_style_flex_flow', 3);
  _lv_obj_set_style_flex_main_place = Module['_lv_obj_set_style_flex_main_place'] = createExportWrapper('lv_obj_set_style_flex_main_place', 3);
  _lv_obj_set_style_flex_cross_place = Module['_lv_obj_set_style_flex_cross_place'] = createExportWrapper('lv_obj_set_style_flex_cross_place', 3);
  _lv_obj_set_style_flex_track_place = Module['_lv_obj_set_style_flex_track_place'] = createExportWrapper('lv_obj_set_style_flex_track_place', 3);
  _lv_obj_set_style_flex_grow = Module['_lv_obj_set_style_flex_grow'] = createExportWrapper('lv_obj_set_style_flex_grow', 3);
  _lv_obj_set_style_grid_column_dsc_array = Module['_lv_obj_set_style_grid_column_dsc_array'] = createExportWrapper('lv_obj_set_style_grid_column_dsc_array', 3);
  _lv_obj_set_style_grid_column_align = Module['_lv_obj_set_style_grid_column_align'] = createExportWrapper('lv_obj_set_style_grid_column_align', 3);
  _lv_obj_set_style_grid_row_dsc_array = Module['_lv_obj_set_style_grid_row_dsc_array'] = createExportWrapper('lv_obj_set_style_grid_row_dsc_array', 3);
  _lv_obj_set_style_grid_row_align = Module['_lv_obj_set_style_grid_row_align'] = createExportWrapper('lv_obj_set_style_grid_row_align', 3);
  _lv_obj_set_style_grid_cell_column_pos = Module['_lv_obj_set_style_grid_cell_column_pos'] = createExportWrapper('lv_obj_set_style_grid_cell_column_pos', 3);
  _lv_obj_set_style_grid_cell_x_align = Module['_lv_obj_set_style_grid_cell_x_align'] = createExportWrapper('lv_obj_set_style_grid_cell_x_align', 3);
  _lv_obj_set_style_grid_cell_column_span = Module['_lv_obj_set_style_grid_cell_column_span'] = createExportWrapper('lv_obj_set_style_grid_cell_column_span', 3);
  _lv_obj_set_style_grid_cell_row_pos = Module['_lv_obj_set_style_grid_cell_row_pos'] = createExportWrapper('lv_obj_set_style_grid_cell_row_pos', 3);
  _lv_obj_set_style_grid_cell_y_align = Module['_lv_obj_set_style_grid_cell_y_align'] = createExportWrapper('lv_obj_set_style_grid_cell_y_align', 3);
  _lv_obj_set_style_grid_cell_row_span = Module['_lv_obj_set_style_grid_cell_row_span'] = createExportWrapper('lv_obj_set_style_grid_cell_row_span', 3);
  _lv_indev_get_state = Module['_lv_indev_get_state'] = createExportWrapper('lv_indev_get_state', 1);
  _lv_indev_wait_release = Module['_lv_indev_wait_release'] = createExportWrapper('lv_indev_wait_release', 1);
  _lv_indev_reset = Module['_lv_indev_reset'] = createExportWrapper('lv_indev_reset', 2);
  _lv_indev_get_active_obj = Module['_lv_indev_get_active_obj'] = createExportWrapper('lv_indev_get_active_obj', 0);
  _lv_async_call_cancel = Module['_lv_async_call_cancel'] = createExportWrapper('lv_async_call_cancel', 2);
  _lv_obj_clean = Module['_lv_obj_clean'] = createExportWrapper('lv_obj_clean', 1);
  _lv_obj_delete_delayed = Module['_lv_obj_delete_delayed'] = createExportWrapper('lv_obj_delete_delayed', 2);
  _lv_obj_delete_anim_completed_cb = Module['_lv_obj_delete_anim_completed_cb'] = createExportWrapper('lv_obj_delete_anim_completed_cb', 1);
  _lv_obj_delete_async = Module['_lv_obj_delete_async'] = createExportWrapper('lv_obj_delete_async', 1);
  _lv_async_call = Module['_lv_async_call'] = createExportWrapper('lv_async_call', 2);
  _lv_obj_set_parent = Module['_lv_obj_set_parent'] = createExportWrapper('lv_obj_set_parent', 2);
  _lv_obj_get_index = Module['_lv_obj_get_index'] = createExportWrapper('lv_obj_get_index', 1);
  _lv_obj_move_to_index = Module['_lv_obj_move_to_index'] = createExportWrapper('lv_obj_move_to_index', 2);
  _lv_obj_swap = Module['_lv_obj_swap'] = createExportWrapper('lv_obj_swap', 2);
  _lv_obj_get_sibling = Module['_lv_obj_get_sibling'] = createExportWrapper('lv_obj_get_sibling', 2);
  _lv_obj_get_sibling_by_type = Module['_lv_obj_get_sibling_by_type'] = createExportWrapper('lv_obj_get_sibling_by_type', 3);
  _lv_obj_get_index_by_type = Module['_lv_obj_get_index_by_type'] = createExportWrapper('lv_obj_get_index_by_type', 2);
  _lv_obj_get_child_count_by_type = Module['_lv_obj_get_child_count_by_type'] = createExportWrapper('lv_obj_get_child_count_by_type', 2);
  _lv_obj_tree_walk = Module['_lv_obj_tree_walk'] = createExportWrapper('lv_obj_tree_walk', 3);
  _lv_obj_dump_tree = Module['_lv_obj_dump_tree'] = createExportWrapper('lv_obj_dump_tree', 1);
  _lv_refr_init = Module['_lv_refr_init'] = createExportWrapper('lv_refr_init', 0);
  _lv_refr_deinit = Module['_lv_refr_deinit'] = createExportWrapper('lv_refr_deinit', 0);
  _lv_refr_now = Module['_lv_refr_now'] = createExportWrapper('lv_refr_now', 1);
  _lv_display_refr_timer = Module['_lv_display_refr_timer'] = createExportWrapper('lv_display_refr_timer', 1);
  _lv_obj_redraw = Module['_lv_obj_redraw'] = createExportWrapper('lv_obj_redraw', 2);
  _lv_obj_refr = Module['_lv_obj_refr'] = createExportWrapper('lv_obj_refr', 2);
  _lv_anim_refr_now = Module['_lv_anim_refr_now'] = createExportWrapper('lv_anim_refr_now', 0);
  _lv_timer_pause = Module['_lv_timer_pause'] = createExportWrapper('lv_timer_pause', 1);
  _lv_area_is_on = Module['_lv_area_is_on'] = createExportWrapper('lv_area_is_on', 2);
  _lv_area_join = Module['_lv_area_join'] = createExportWrapper('lv_area_join', 3);
  _lv_display_is_double_buffered = Module['_lv_display_is_double_buffered'] = createExportWrapper('lv_display_is_double_buffered', 1);
  _lv_ll_is_empty = Module['_lv_ll_is_empty'] = createExportWrapper('lv_ll_is_empty', 1);
  _lv_area_diff = Module['_lv_area_diff'] = createExportWrapper('lv_area_diff', 3);
  _lv_ll_ins_prev = Module['_lv_ll_ins_prev'] = createExportWrapper('lv_ll_ins_prev', 2);
  _lv_draw_buf_copy = Module['_lv_draw_buf_copy'] = createExportWrapper('lv_draw_buf_copy', 4);
  _lv_draw_buf_width_to_stride = Module['_lv_draw_buf_width_to_stride'] = createExportWrapper('lv_draw_buf_width_to_stride', 2);
  _lv_draw_sw_mask_cleanup = Module['_lv_draw_sw_mask_cleanup'] = createExportWrapper('lv_draw_sw_mask_cleanup', 0);
  _lv_draw_mask_rect_dsc_init = Module['_lv_draw_mask_rect_dsc_init'] = createExportWrapper('lv_draw_mask_rect_dsc_init', 1);
  _lv_draw_image_dsc_init = Module['_lv_draw_image_dsc_init'] = createExportWrapper('lv_draw_image_dsc_init', 1);
  _lv_draw_layer_create = Module['_lv_draw_layer_create'] = createExportWrapper('lv_draw_layer_create', 3);
  _lv_draw_mask_rect = Module['_lv_draw_mask_rect'] = createExportWrapper('lv_draw_mask_rect', 2);
  _lv_draw_layer = Module['_lv_draw_layer'] = createExportWrapper('lv_draw_layer', 3);
  _lv_color_format_get_size = Module['_lv_color_format_get_size'] = createExportWrapper('lv_color_format_get_size', 1);
  _lv_refr_get_disp_refreshing = Module['_lv_refr_get_disp_refreshing'] = createExportWrapper('lv_refr_get_disp_refreshing', 0);
  _lv_refr_set_disp_refreshing = Module['_lv_refr_set_disp_refreshing'] = createExportWrapper('lv_refr_set_disp_refreshing', 1);
  _lv_refr_get_top_obj = Module['_lv_refr_get_top_obj'] = createExportWrapper('lv_refr_get_top_obj', 2);
  _lv_draw_buf_reshape = Module['_lv_draw_buf_reshape'] = createExportWrapper('lv_draw_buf_reshape', 5);
  _lv_display_get_matrix_rotation = Module['_lv_display_get_matrix_rotation'] = createExportWrapper('lv_display_get_matrix_rotation', 1);
  _lv_display_get_original_horizontal_resolution = Module['_lv_display_get_original_horizontal_resolution'] = createExportWrapper('lv_display_get_original_horizontal_resolution', 1);
  _lv_display_get_original_vertical_resolution = Module['_lv_display_get_original_vertical_resolution'] = createExportWrapper('lv_display_get_original_vertical_resolution', 1);
  _lv_draw_layer_init = Module['_lv_draw_layer_init'] = createExportWrapper('lv_draw_layer_init', 4);
  _lv_draw_dispatch_wait_for_request = Module['_lv_draw_dispatch_wait_for_request'] = createExportWrapper('lv_draw_dispatch_wait_for_request', 0);
  _lv_draw_dispatch = Module['_lv_draw_dispatch'] = createExportWrapper('lv_draw_dispatch', 0);
  _lv_layer_reset = Module['_lv_layer_reset'] = createExportWrapper('lv_layer_reset', 1);
  _lv_color_format_has_alpha = Module['_lv_color_format_has_alpha'] = createExportWrapper('lv_color_format_has_alpha', 1);
  _lv_area_move = Module['_lv_area_move'] = createExportWrapper('lv_area_move', 3);
  _lv_draw_buf_clear = Module['_lv_draw_buf_clear'] = createExportWrapper('lv_draw_buf_clear', 2);
  _lv_layer_init = Module['_lv_layer_init'] = createExportWrapper('lv_layer_init', 1);
  _lv_tick_get = Module['_lv_tick_get'] = createExportWrapper('lv_tick_get', 0);
  _lv_timer_create = Module['_lv_timer_create'] = createExportWrapper('lv_timer_create', 3);
  _lv_theme_default_is_inited = Module['_lv_theme_default_is_inited'] = createExportWrapper('lv_theme_default_is_inited', 0);
  _lv_theme_default_get = Module['_lv_theme_default_get'] = createExportWrapper('lv_theme_default_get', 0);
  _lv_timer_ready = Module['_lv_timer_ready'] = createExportWrapper('lv_timer_ready', 1);
  _lv_display_add_event_cb = Module['_lv_display_add_event_cb'] = createExportWrapper('lv_display_add_event_cb', 4);
  _lv_timer_resume = Module['_lv_timer_resume'] = createExportWrapper('lv_timer_resume', 1);
  _lv_display_delete = Module['_lv_display_delete'] = createExportWrapper('lv_display_delete', 1);
  _lv_event_push_and_send = Module['_lv_event_push_and_send'] = createExportWrapper('lv_event_push_and_send', 4);
  _lv_indev_get_display = Module['_lv_indev_get_display'] = createExportWrapper('lv_indev_get_display', 1);
  _lv_indev_set_display = Module['_lv_indev_set_display'] = createExportWrapper('lv_indev_set_display', 2);
  _lv_timer_delete = Module['_lv_timer_delete'] = createExportWrapper('lv_timer_delete', 1);
  _lv_display_set_default = Module['_lv_display_set_default'] = createExportWrapper('lv_display_set_default', 1);
  _lv_display_set_resolution = Module['_lv_display_set_resolution'] = createExportWrapper('lv_display_set_resolution', 3);
  _lv_area_set_width = Module['_lv_area_set_width'] = createExportWrapper('lv_area_set_width', 2);
  _lv_area_set_height = Module['_lv_area_set_height'] = createExportWrapper('lv_area_set_height', 2);
  _lv_display_set_physical_resolution = Module['_lv_display_set_physical_resolution'] = createExportWrapper('lv_display_set_physical_resolution', 3);
  _lv_display_set_offset = Module['_lv_display_set_offset'] = createExportWrapper('lv_display_set_offset', 3);
  _lv_display_set_dpi = Module['_lv_display_set_dpi'] = createExportWrapper('lv_display_set_dpi', 2);
  _lv_display_get_physical_horizontal_resolution = Module['_lv_display_get_physical_horizontal_resolution'] = createExportWrapper('lv_display_get_physical_horizontal_resolution', 1);
  _lv_display_get_physical_vertical_resolution = Module['_lv_display_get_physical_vertical_resolution'] = createExportWrapper('lv_display_get_physical_vertical_resolution', 1);
  _lv_display_get_offset_x = Module['_lv_display_get_offset_x'] = createExportWrapper('lv_display_get_offset_x', 1);
  _lv_display_get_offset_y = Module['_lv_display_get_offset_y'] = createExportWrapper('lv_display_get_offset_y', 1);
  _lv_display_set_draw_buffers = Module['_lv_display_set_draw_buffers'] = createExportWrapper('lv_display_set_draw_buffers', 3);
  _lv_display_set_3rd_draw_buffer = Module['_lv_display_set_3rd_draw_buffer'] = createExportWrapper('lv_display_set_3rd_draw_buffer', 2);
  _lv_draw_buf_align = Module['_lv_draw_buf_align'] = createExportWrapper('lv_draw_buf_align', 2);
  _lv_draw_buf_init = Module['_lv_draw_buf_init'] = createExportWrapper('lv_draw_buf_init', 7);
  _lv_display_get_color_format = Module['_lv_display_get_color_format'] = createExportWrapper('lv_display_get_color_format', 1);
  _lv_display_set_render_mode = Module['_lv_display_set_render_mode'] = createExportWrapper('lv_display_set_render_mode', 2);
  _lv_display_set_buffers_with_stride = Module['_lv_display_set_buffers_with_stride'] = createExportWrapper('lv_display_set_buffers_with_stride', 6);
  _lv_display_set_flush_wait_cb = Module['_lv_display_set_flush_wait_cb'] = createExportWrapper('lv_display_set_flush_wait_cb', 2);
  _lv_display_set_color_format = Module['_lv_display_set_color_format'] = createExportWrapper('lv_display_set_color_format', 2);
  _lv_display_set_tile_cnt = Module['_lv_display_set_tile_cnt'] = createExportWrapper('lv_display_set_tile_cnt', 2);
  _lv_display_get_tile_cnt = Module['_lv_display_get_tile_cnt'] = createExportWrapper('lv_display_get_tile_cnt', 1);
  _lv_display_set_antialiasing = Module['_lv_display_set_antialiasing'] = createExportWrapper('lv_display_set_antialiasing', 2);
  _lv_display_get_antialiasing = Module['_lv_display_get_antialiasing'] = createExportWrapper('lv_display_get_antialiasing', 1);
  _lv_display_flush_is_last = Module['_lv_display_flush_is_last'] = createExportWrapper('lv_display_flush_is_last', 1);
  _lv_display_get_screen_loading = Module['_lv_display_get_screen_loading'] = createExportWrapper('lv_display_get_screen_loading', 1);
  _lv_display_get_event_count = Module['_lv_display_get_event_count'] = createExportWrapper('lv_display_get_event_count', 1);
  _lv_display_get_event_dsc = Module['_lv_display_get_event_dsc'] = createExportWrapper('lv_display_get_event_dsc', 2);
  _lv_display_delete_event = Module['_lv_display_delete_event'] = createExportWrapper('lv_display_delete_event', 2);
  _lv_display_remove_event_cb_with_user_data = Module['_lv_display_remove_event_cb_with_user_data'] = createExportWrapper('lv_display_remove_event_cb_with_user_data', 3);
  _lv_event_get_invalidated_area = Module['_lv_event_get_invalidated_area'] = createExportWrapper('lv_event_get_invalidated_area', 1);
  _lv_display_set_rotation = Module['_lv_display_set_rotation'] = createExportWrapper('lv_display_set_rotation', 2);
  _lv_display_get_rotation = Module['_lv_display_get_rotation'] = createExportWrapper('lv_display_get_rotation', 1);
  _lv_display_set_matrix_rotation = Module['_lv_display_set_matrix_rotation'] = createExportWrapper('lv_display_set_matrix_rotation', 2);
  _lv_display_get_theme = Module['_lv_display_get_theme'] = createExportWrapper('lv_display_get_theme', 1);
  _lv_display_get_inactive_time = Module['_lv_display_get_inactive_time'] = createExportWrapper('lv_display_get_inactive_time', 1);
  _lv_tick_elaps = Module['_lv_tick_elaps'] = createExportWrapper('lv_tick_elaps', 1);
  _lv_display_trigger_activity = Module['_lv_display_trigger_activity'] = createExportWrapper('lv_display_trigger_activity', 1);
  _lv_display_enable_invalidation = Module['_lv_display_enable_invalidation'] = createExportWrapper('lv_display_enable_invalidation', 2);
  _lv_display_get_refr_timer = Module['_lv_display_get_refr_timer'] = createExportWrapper('lv_display_get_refr_timer', 1);
  _lv_display_delete_refr_timer = Module['_lv_display_delete_refr_timer'] = createExportWrapper('lv_display_delete_refr_timer', 1);
  _lv_display_send_vsync_event = Module['_lv_display_send_vsync_event'] = createExportWrapper('lv_display_send_vsync_event', 2);
  _lv_display_register_vsync_event = Module['_lv_display_register_vsync_event'] = createExportWrapper('lv_display_register_vsync_event', 3);
  _lv_display_unregister_vsync_event = Module['_lv_display_unregister_vsync_event'] = createExportWrapper('lv_display_unregister_vsync_event', 3);
  _lv_display_set_user_data = Module['_lv_display_set_user_data'] = createExportWrapper('lv_display_set_user_data', 2);
  _lv_display_set_driver_data = Module['_lv_display_set_driver_data'] = createExportWrapper('lv_display_set_driver_data', 2);
  _lv_display_get_user_data = Module['_lv_display_get_user_data'] = createExportWrapper('lv_display_get_user_data', 1);
  _lv_display_get_driver_data = Module['_lv_display_get_driver_data'] = createExportWrapper('lv_display_get_driver_data', 1);
  _lv_display_get_buf_active = Module['_lv_display_get_buf_active'] = createExportWrapper('lv_display_get_buf_active', 1);
  _lv_display_rotate_area = Module['_lv_display_rotate_area'] = createExportWrapper('lv_display_rotate_area', 2);
  _lv_display_get_draw_buf_size = Module['_lv_display_get_draw_buf_size'] = createExportWrapper('lv_display_get_draw_buf_size', 1);
  _lv_display_get_invalidated_draw_buf_size = Module['_lv_display_get_invalidated_draw_buf_size'] = createExportWrapper('lv_display_get_invalidated_draw_buf_size', 3);
  _lv_layer_top = Module['_lv_layer_top'] = createExportWrapper('lv_layer_top', 0);
  _lv_layer_sys = Module['_lv_layer_sys'] = createExportWrapper('lv_layer_sys', 0);
  _lv_layer_bottom = Module['_lv_layer_bottom'] = createExportWrapper('lv_layer_bottom', 0);
  _lv_dpx = Module['_lv_dpx'] = createExportWrapper('lv_dpx', 1);
  _lv_display_dpx = Module['_lv_display_dpx'] = createExportWrapper('lv_display_dpx', 2);
  _lv_draw_buf_convert_premultiply = Module['_lv_draw_buf_convert_premultiply'] = createExportWrapper('lv_draw_buf_convert_premultiply', 1);
  _lv_draw_init = Module['_lv_draw_init'] = createExportWrapper('lv_draw_init', 0);
  _lv_draw_deinit = Module['_lv_draw_deinit'] = createExportWrapper('lv_draw_deinit', 0);
  _lv_draw_create_unit = Module['_lv_draw_create_unit'] = createExportWrapper('lv_draw_create_unit', 1);
  _lv_draw_add_task = Module['_lv_draw_add_task'] = createExportWrapper('lv_draw_add_task', 3);
  _lv_draw_finalize_task_creation = Module['_lv_draw_finalize_task_creation'] = createExportWrapper('lv_draw_finalize_task_creation', 2);
  _lv_draw_dispatch_layer = Module['_lv_draw_dispatch_layer'] = createExportWrapper('lv_draw_dispatch_layer', 2);
  _lv_draw_wait_for_finish = Module['_lv_draw_wait_for_finish'] = createExportWrapper('lv_draw_wait_for_finish', 0);
  _lv_draw_buf_destroy = Module['_lv_draw_buf_destroy'] = createExportWrapper('lv_draw_buf_destroy', 1);
  _lv_draw_task_get_label_dsc = Module['_lv_draw_task_get_label_dsc'] = createExportWrapper('lv_draw_task_get_label_dsc', 1);
  _lv_draw_dispatch_request = Module['_lv_draw_dispatch_request'] = createExportWrapper('lv_draw_dispatch_request', 0);
  _lv_draw_get_unit_count = Module['_lv_draw_get_unit_count'] = createExportWrapper('lv_draw_get_unit_count', 0);
  _lv_draw_get_available_task = Module['_lv_draw_get_available_task'] = createExportWrapper('lv_draw_get_available_task', 3);
  _lv_draw_get_next_available_task = Module['_lv_draw_get_next_available_task'] = createExportWrapper('lv_draw_get_next_available_task', 3);
  _lv_draw_get_dependent_count = Module['_lv_draw_get_dependent_count'] = createExportWrapper('lv_draw_get_dependent_count', 1);
  _lv_draw_unit_send_event = Module['_lv_draw_unit_send_event'] = createExportWrapper('lv_draw_unit_send_event', 3);
  _lv_strcmp = Module['_lv_strcmp'] = createExportWrapper('lv_strcmp', 2);
  _lv_color32_make = Module['_lv_color32_make'] = createExportWrapper('lv_color32_make', 5);
  _lv_draw_layer_alloc_buf = Module['_lv_draw_layer_alloc_buf'] = createExportWrapper('lv_draw_layer_alloc_buf', 1);
  _lv_draw_buf_create = Module['_lv_draw_buf_create'] = createExportWrapper('lv_draw_buf_create', 4);
  _lv_draw_layer_go_to_xy = Module['_lv_draw_layer_go_to_xy'] = createExportWrapper('lv_draw_layer_go_to_xy', 3);
  _lv_draw_buf_goto_xy = Module['_lv_draw_buf_goto_xy'] = createExportWrapper('lv_draw_buf_goto_xy', 3);
  _lv_draw_task_get_type = Module['_lv_draw_task_get_type'] = createExportWrapper('lv_draw_task_get_type', 1);
  _lv_draw_task_get_draw_dsc = Module['_lv_draw_task_get_draw_dsc'] = createExportWrapper('lv_draw_task_get_draw_dsc', 1);
  _lv_draw_task_get_area = Module['_lv_draw_task_get_area'] = createExportWrapper('lv_draw_task_get_area', 2);
  _lv_draw_arc_dsc_init = Module['_lv_draw_arc_dsc_init'] = createExportWrapper('lv_draw_arc_dsc_init', 1);
  _lv_draw_task_get_arc_dsc = Module['_lv_draw_task_get_arc_dsc'] = createExportWrapper('lv_draw_task_get_arc_dsc', 1);
  _lv_draw_arc = Module['_lv_draw_arc'] = createExportWrapper('lv_draw_arc', 2);
  _lv_draw_arc_get_area = Module['_lv_draw_arc_get_area'] = createExportWrapper('lv_draw_arc_get_area', 8);
  _lv_draw_buf_init_handlers = Module['_lv_draw_buf_init_handlers'] = createExportWrapper('lv_draw_buf_init_handlers', 0);
  _lv_draw_buf_init_with_default_handlers = Module['_lv_draw_buf_init_with_default_handlers'] = createExportWrapper('lv_draw_buf_init_with_default_handlers', 1);
  _lv_draw_buf_handlers_init = Module['_lv_draw_buf_handlers_init'] = createExportWrapper('lv_draw_buf_handlers_init', 8);
  _lv_draw_buf_get_handlers = Module['_lv_draw_buf_get_handlers'] = createExportWrapper('lv_draw_buf_get_handlers', 0);
  _lv_draw_buf_get_font_handlers = Module['_lv_draw_buf_get_font_handlers'] = createExportWrapper('lv_draw_buf_get_font_handlers', 0);
  _lv_draw_buf_get_image_handlers = Module['_lv_draw_buf_get_image_handlers'] = createExportWrapper('lv_draw_buf_get_image_handlers', 0);
  _lv_color_format_get_bpp = Module['_lv_color_format_get_bpp'] = createExportWrapper('lv_color_format_get_bpp', 1);
  _lv_draw_buf_width_to_stride_ex = Module['_lv_draw_buf_width_to_stride_ex'] = createExportWrapper('lv_draw_buf_width_to_stride_ex', 3);
  _lv_draw_buf_align_ex = Module['_lv_draw_buf_align_ex'] = createExportWrapper('lv_draw_buf_align_ex', 3);
  _lv_draw_buf_invalidate_cache = Module['_lv_draw_buf_invalidate_cache'] = createExportWrapper('lv_draw_buf_invalidate_cache', 2);
  _lv_draw_buf_flush_cache = Module['_lv_draw_buf_flush_cache'] = createExportWrapper('lv_draw_buf_flush_cache', 2);
  _lv_draw_buf_create_ex = Module['_lv_draw_buf_create_ex'] = createExportWrapper('lv_draw_buf_create_ex', 5);
  _lv_draw_buf_dup = Module['_lv_draw_buf_dup'] = createExportWrapper('lv_draw_buf_dup', 1);
  _lv_draw_buf_dup_ex = Module['_lv_draw_buf_dup_ex'] = createExportWrapper('lv_draw_buf_dup_ex', 2);
  _lv_draw_buf_adjust_stride = Module['_lv_draw_buf_adjust_stride'] = createExportWrapper('lv_draw_buf_adjust_stride', 2);
  _lv_memmove = Module['_lv_memmove'] = createExportWrapper('lv_memmove', 3);
  _lv_draw_buf_has_flag = Module['_lv_draw_buf_has_flag'] = createExportWrapper('lv_draw_buf_has_flag', 2);
  _lv_draw_buf_premultiply = Module['_lv_draw_buf_premultiply'] = createExportWrapper('lv_draw_buf_premultiply', 1);
  _lv_color_premultiply = Module['_lv_color_premultiply'] = createExportWrapper('lv_color_premultiply', 1);
  _lv_color16_premultiply = Module['_lv_color16_premultiply'] = createExportWrapper('lv_color16_premultiply', 2);
  _lv_draw_buf_set_palette = Module['_lv_draw_buf_set_palette'] = createExportWrapper('lv_draw_buf_set_palette', 3);
  _lv_draw_buf_set_flag = Module['_lv_draw_buf_set_flag'] = createExportWrapper('lv_draw_buf_set_flag', 2);
  _lv_draw_buf_clear_flag = Module['_lv_draw_buf_clear_flag'] = createExportWrapper('lv_draw_buf_clear_flag', 2);
  _lv_draw_buf_from_image = Module['_lv_draw_buf_from_image'] = createExportWrapper('lv_draw_buf_from_image', 2);
  _lv_draw_buf_to_image = Module['_lv_draw_buf_to_image'] = createExportWrapper('lv_draw_buf_to_image', 2);
  _lv_image_buf_set_palette = Module['_lv_image_buf_set_palette'] = createExportWrapper('lv_image_buf_set_palette', 3);
  _lv_image_buf_free = Module['_lv_image_buf_free'] = createExportWrapper('lv_image_buf_free', 1);
  _lv_color_black = Module['_lv_color_black'] = createExportWrapper('lv_color_black', 1);
  _lv_draw_task_get_image_dsc = Module['_lv_draw_task_get_image_dsc'] = createExportWrapper('lv_draw_task_get_image_dsc', 1);
  _lv_image_buf_get_transformed_area = Module['_lv_image_buf_get_transformed_area'] = createExportWrapper('lv_image_buf_get_transformed_area', 7);
  _lv_point_transform = Module['_lv_point_transform'] = createExportWrapper('lv_point_transform', 6);
  _lv_draw_image = Module['_lv_draw_image'] = createExportWrapper('lv_draw_image', 3);
  _lv_image_decoder_get_info = Module['_lv_image_decoder_get_info'] = createExportWrapper('lv_image_decoder_get_info', 2);
  _lv_image_decoder_open = Module['_lv_image_decoder_open'] = createExportWrapper('lv_image_decoder_open', 3);
  _lv_image_decoder_close = Module['_lv_image_decoder_close'] = createExportWrapper('lv_image_decoder_close', 1);
  _lv_draw_image_normal_helper = Module['_lv_draw_image_normal_helper'] = createExportWrapper('lv_draw_image_normal_helper', 4);
  _lv_image_decoder_get_area = Module['_lv_image_decoder_get_area'] = createExportWrapper('lv_image_decoder_get_area', 3);
  _lv_draw_image_tiled_helper = Module['_lv_draw_image_tiled_helper'] = createExportWrapper('lv_draw_image_tiled_helper', 4);
  _lv_draw_letter_dsc_init = Module['_lv_draw_letter_dsc_init'] = createExportWrapper('lv_draw_letter_dsc_init', 1);
  _lv_draw_label_dsc_init = Module['_lv_draw_label_dsc_init'] = createExportWrapper('lv_draw_label_dsc_init', 1);
  _lv_draw_glyph_dsc_init = Module['_lv_draw_glyph_dsc_init'] = createExportWrapper('lv_draw_glyph_dsc_init', 1);
  _lv_draw_label = Module['_lv_draw_label'] = createExportWrapper('lv_draw_label', 3);
  _lv_strndup = Module['_lv_strndup'] = createExportWrapper('lv_strndup', 2);
  _lv_draw_character = Module['_lv_draw_character'] = createExportWrapper('lv_draw_character', 4);
  _lv_font_get_glyph_dsc = Module['_lv_font_get_glyph_dsc'] = createExportWrapper('lv_font_get_glyph_dsc', 4);
  _lv_font_get_line_height = Module['_lv_font_get_line_height'] = createExportWrapper('lv_font_get_line_height', 1);
  _lv_draw_letter = Module['_lv_draw_letter'] = createExportWrapper('lv_draw_letter', 3);
  _lv_draw_label_iterate_characters = Module['_lv_draw_label_iterate_characters'] = createExportWrapper('lv_draw_label_iterate_characters', 4);
  _lv_text_get_size_attributes = Module['_lv_text_get_size_attributes'] = createExportWrapper('lv_text_get_size_attributes', 4);
  _lv_point_set = Module['_lv_point_set'] = createExportWrapper('lv_point_set', 3);
  _lv_text_get_next_line = Module['_lv_text_get_next_line'] = createExportWrapper('lv_text_get_next_line', 5);
  _lv_text_get_width = Module['_lv_text_get_width'] = createExportWrapper('lv_text_get_width', 4);
  _lv_draw_fill_dsc_init = Module['_lv_draw_fill_dsc_init'] = createExportWrapper('lv_draw_fill_dsc_init', 1);
  _lv_bidi_process_paragraph = Module['_lv_bidi_process_paragraph'] = createExportWrapper('lv_bidi_process_paragraph', 6);
  _lv_bidi_get_logical_pos = Module['_lv_bidi_get_logical_pos'] = createExportWrapper('lv_bidi_get_logical_pos', 6);
  _lv_text_encoded_letter_next_2 = Module['_lv_text_encoded_letter_next_2'] = createExportWrapper('lv_text_encoded_letter_next_2', 4);
  _lv_draw_unit_draw_letter = Module['_lv_draw_unit_draw_letter'] = createExportWrapper('lv_draw_unit_draw_letter', 6);
  _lv_area_is_out = Module['_lv_area_is_out'] = createExportWrapper('lv_area_is_out', 3);
  _lv_font_get_glyph_bitmap = Module['_lv_font_get_glyph_bitmap'] = createExportWrapper('lv_font_get_glyph_bitmap', 2);
  _lv_font_glyph_release_draw_data = Module['_lv_font_glyph_release_draw_data'] = createExportWrapper('lv_font_glyph_release_draw_data', 1);
  _lv_draw_line_dsc_init = Module['_lv_draw_line_dsc_init'] = createExportWrapper('lv_draw_line_dsc_init', 1);
  _lv_draw_task_get_line_dsc = Module['_lv_draw_task_get_line_dsc'] = createExportWrapper('lv_draw_task_get_line_dsc', 1);
  _lv_draw_line = Module['_lv_draw_line'] = createExportWrapper('lv_draw_line', 2);
  _lv_draw_task_get_mask_rect_dsc = Module['_lv_draw_task_get_mask_rect_dsc'] = createExportWrapper('lv_draw_task_get_mask_rect_dsc', 1);
  _lv_color_white = Module['_lv_color_white'] = createExportWrapper('lv_color_white', 1);
  _lv_draw_task_get_fill_dsc = Module['_lv_draw_task_get_fill_dsc'] = createExportWrapper('lv_draw_task_get_fill_dsc', 1);
  _lv_draw_fill = Module['_lv_draw_fill'] = createExportWrapper('lv_draw_fill', 3);
  _lv_draw_border_dsc_init = Module['_lv_draw_border_dsc_init'] = createExportWrapper('lv_draw_border_dsc_init', 1);
  _lv_draw_task_get_border_dsc = Module['_lv_draw_task_get_border_dsc'] = createExportWrapper('lv_draw_task_get_border_dsc', 1);
  _lv_draw_border = Module['_lv_draw_border'] = createExportWrapper('lv_draw_border', 3);
  _lv_draw_box_shadow_dsc_init = Module['_lv_draw_box_shadow_dsc_init'] = createExportWrapper('lv_draw_box_shadow_dsc_init', 1);
  _lv_draw_task_get_box_shadow_dsc = Module['_lv_draw_task_get_box_shadow_dsc'] = createExportWrapper('lv_draw_task_get_box_shadow_dsc', 1);
  _lv_draw_box_shadow = Module['_lv_draw_box_shadow'] = createExportWrapper('lv_draw_box_shadow', 3);
  _lv_area_align = Module['_lv_area_align'] = createExportWrapper('lv_area_align', 5);
  _lv_draw_triangle_dsc_init = Module['_lv_draw_triangle_dsc_init'] = createExportWrapper('lv_draw_triangle_dsc_init', 1);
  _lv_draw_task_get_triangle_dsc = Module['_lv_draw_task_get_triangle_dsc'] = createExportWrapper('lv_draw_task_get_triangle_dsc', 1);
  _lv_draw_triangle = Module['_lv_draw_triangle'] = createExportWrapper('lv_draw_triangle', 2);
  _lv_image_decoder_init = Module['_lv_image_decoder_init'] = createExportWrapper('lv_image_decoder_init', 2);
  _lv_image_decoder_deinit = Module['_lv_image_decoder_deinit'] = createExportWrapper('lv_image_decoder_deinit', 0);
  _lv_image_cache_init = Module['_lv_image_cache_init'] = createExportWrapper('lv_image_cache_init', 1);
  _lv_image_header_cache_init = Module['_lv_image_header_cache_init'] = createExportWrapper('lv_image_header_cache_init', 1);
  _lv_cache_destroy = Module['_lv_cache_destroy'] = createExportWrapper('lv_cache_destroy', 2);
  _lv_image_header_cache_is_enabled = Module['_lv_image_header_cache_is_enabled'] = createExportWrapper('lv_image_header_cache_is_enabled', 0);
  _lv_cache_acquire = Module['_lv_cache_acquire'] = createExportWrapper('lv_cache_acquire', 3);
  _lv_cache_entry_get_data = Module['_lv_cache_entry_get_data'] = createExportWrapper('lv_cache_entry_get_data', 1);
  _lv_cache_release = Module['_lv_cache_release'] = createExportWrapper('lv_cache_release', 3);
  _lv_fs_open = Module['_lv_fs_open'] = createExportWrapper('lv_fs_open', 3);
  _lv_fs_seek = Module['_lv_fs_seek'] = createExportWrapper('lv_fs_seek', 3);
  _lv_fs_close = Module['_lv_fs_close'] = createExportWrapper('lv_fs_close', 1);
  _lv_strdup = Module['_lv_strdup'] = createExportWrapper('lv_strdup', 1);
  _lv_cache_add = Module['_lv_cache_add'] = createExportWrapper('lv_cache_add', 3);
  _lv_image_cache_is_enabled = Module['_lv_image_cache_is_enabled'] = createExportWrapper('lv_image_cache_is_enabled', 0);
  _lv_image_decoder_create = Module['_lv_image_decoder_create'] = createExportWrapper('lv_image_decoder_create', 0);
  _lv_image_decoder_delete = Module['_lv_image_decoder_delete'] = createExportWrapper('lv_image_decoder_delete', 1);
  _lv_image_decoder_get_next = Module['_lv_image_decoder_get_next'] = createExportWrapper('lv_image_decoder_get_next', 1);
  _lv_image_decoder_set_info_cb = Module['_lv_image_decoder_set_info_cb'] = createExportWrapper('lv_image_decoder_set_info_cb', 2);
  _lv_image_decoder_set_open_cb = Module['_lv_image_decoder_set_open_cb'] = createExportWrapper('lv_image_decoder_set_open_cb', 2);
  _lv_image_decoder_set_get_area_cb = Module['_lv_image_decoder_set_get_area_cb'] = createExportWrapper('lv_image_decoder_set_get_area_cb', 2);
  _lv_image_decoder_set_close_cb = Module['_lv_image_decoder_set_close_cb'] = createExportWrapper('lv_image_decoder_set_close_cb', 2);
  _lv_image_decoder_add_to_cache = Module['_lv_image_decoder_add_to_cache'] = createExportWrapper('lv_image_decoder_add_to_cache', 4);
  _lv_image_decoder_post_process = Module['_lv_image_decoder_post_process'] = createExportWrapper('lv_image_decoder_post_process', 2);
  _lv_draw_sw_blend = Module['_lv_draw_sw_blend'] = createExportWrapper('lv_draw_sw_blend', 2);
  _lv_draw_sw_blend_color_to_al88 = Module['_lv_draw_sw_blend_color_to_al88'] = createExportWrapper('lv_draw_sw_blend_color_to_al88', 1);
  _lv_draw_sw_blend_image_to_al88 = Module['_lv_draw_sw_blend_image_to_al88'] = createExportWrapper('lv_draw_sw_blend_image_to_al88', 1);
  _lv_draw_sw_blend_color_to_argb8888 = Module['_lv_draw_sw_blend_color_to_argb8888'] = createExportWrapper('lv_draw_sw_blend_color_to_argb8888', 1);
  _lv_draw_sw_blend_image_to_argb8888 = Module['_lv_draw_sw_blend_image_to_argb8888'] = createExportWrapper('lv_draw_sw_blend_image_to_argb8888', 1);
  _lv_draw_sw_blend_color_to_argb8888_premultiplied = Module['_lv_draw_sw_blend_color_to_argb8888_premultiplied'] = createExportWrapper('lv_draw_sw_blend_color_to_argb8888_premultiplied', 1);
  _lv_draw_sw_blend_image_to_argb8888_premultiplied = Module['_lv_draw_sw_blend_image_to_argb8888_premultiplied'] = createExportWrapper('lv_draw_sw_blend_image_to_argb8888_premultiplied', 1);
  _lv_draw_sw_blend_color_to_i1 = Module['_lv_draw_sw_blend_color_to_i1'] = createExportWrapper('lv_draw_sw_blend_color_to_i1', 1);
  _lv_draw_sw_blend_image_to_i1 = Module['_lv_draw_sw_blend_image_to_i1'] = createExportWrapper('lv_draw_sw_blend_image_to_i1', 1);
  _lv_draw_sw_blend_color_to_l8 = Module['_lv_draw_sw_blend_color_to_l8'] = createExportWrapper('lv_draw_sw_blend_color_to_l8', 1);
  _lv_draw_sw_blend_image_to_l8 = Module['_lv_draw_sw_blend_image_to_l8'] = createExportWrapper('lv_draw_sw_blend_image_to_l8', 1);
  _lv_draw_sw_blend_color_to_rgb565 = Module['_lv_draw_sw_blend_color_to_rgb565'] = createExportWrapper('lv_draw_sw_blend_color_to_rgb565', 1);
  _lv_draw_sw_blend_image_to_rgb565 = Module['_lv_draw_sw_blend_image_to_rgb565'] = createExportWrapper('lv_draw_sw_blend_image_to_rgb565', 1);
  _lv_draw_sw_blend_color_to_rgb565_swapped = Module['_lv_draw_sw_blend_color_to_rgb565_swapped'] = createExportWrapper('lv_draw_sw_blend_color_to_rgb565_swapped', 1);
  _lv_draw_sw_blend_image_to_rgb565_swapped = Module['_lv_draw_sw_blend_image_to_rgb565_swapped'] = createExportWrapper('lv_draw_sw_blend_image_to_rgb565_swapped', 1);
  _lv_draw_sw_blend_color_to_rgb888 = Module['_lv_draw_sw_blend_color_to_rgb888'] = createExportWrapper('lv_draw_sw_blend_color_to_rgb888', 2);
  _lv_draw_sw_blend_image_to_rgb888 = Module['_lv_draw_sw_blend_image_to_rgb888'] = createExportWrapper('lv_draw_sw_blend_image_to_rgb888', 2);
  _lv_draw_sw_init = Module['_lv_draw_sw_init'] = createExportWrapper('lv_draw_sw_init', 0);
  _lv_draw_sw_deinit = Module['_lv_draw_sw_deinit'] = createExportWrapper('lv_draw_sw_deinit', 0);
  _lv_draw_sw_register_blend_handler = Module['_lv_draw_sw_register_blend_handler'] = createExportWrapper('lv_draw_sw_register_blend_handler', 1);
  _lv_draw_sw_unregister_blend_handler = Module['_lv_draw_sw_unregister_blend_handler'] = createExportWrapper('lv_draw_sw_unregister_blend_handler', 1);
  _lv_draw_sw_get_blend_handler = Module['_lv_draw_sw_get_blend_handler'] = createExportWrapper('lv_draw_sw_get_blend_handler', 1);
  _lv_draw_sw_arc = Module['_lv_draw_sw_arc'] = createExportWrapper('lv_draw_sw_arc', 3);
  _lv_draw_sw_border = Module['_lv_draw_sw_border'] = createExportWrapper('lv_draw_sw_border', 3);
  _lv_draw_sw_box_shadow = Module['_lv_draw_sw_box_shadow'] = createExportWrapper('lv_draw_sw_box_shadow', 3);
  _lv_draw_sw_fill = Module['_lv_draw_sw_fill'] = createExportWrapper('lv_draw_sw_fill', 3);
  _lv_draw_sw_grad_get = Module['_lv_draw_sw_grad_get'] = createExportWrapper('lv_draw_sw_grad_get', 3);
  _lv_draw_sw_grad_color_calculate = Module['_lv_draw_sw_grad_color_calculate'] = createExportWrapper('lv_draw_sw_grad_color_calculate', 5);
  _lv_draw_sw_grad_cleanup = Module['_lv_draw_sw_grad_cleanup'] = createExportWrapper('lv_draw_sw_grad_cleanup', 1);
  _lv_draw_sw_layer = Module['_lv_draw_sw_layer'] = createExportWrapper('lv_draw_sw_layer', 3);
  _lv_draw_sw_image = Module['_lv_draw_sw_image'] = createExportWrapper('lv_draw_sw_image', 3);
  _lv_draw_sw_letter = Module['_lv_draw_sw_letter'] = createExportWrapper('lv_draw_sw_letter', 3);
  _lv_draw_sw_label = Module['_lv_draw_sw_label'] = createExportWrapper('lv_draw_sw_label', 3);
  _lv_draw_sw_line = Module['_lv_draw_sw_line'] = createExportWrapper('lv_draw_sw_line', 2);
  _lv_draw_sw_mask_init = Module['_lv_draw_sw_mask_init'] = createExportWrapper('lv_draw_sw_mask_init', 0);
  _lv_draw_sw_mask_deinit = Module['_lv_draw_sw_mask_deinit'] = createExportWrapper('lv_draw_sw_mask_deinit', 0);
  _lv_draw_sw_mask_apply = Module['_lv_draw_sw_mask_apply'] = createExportWrapper('lv_draw_sw_mask_apply', 5);
  _lv_draw_sw_mask_free_param = Module['_lv_draw_sw_mask_free_param'] = createExportWrapper('lv_draw_sw_mask_free_param', 1);
  _lv_draw_sw_mask_line_points_init = Module['_lv_draw_sw_mask_line_points_init'] = createExportWrapper('lv_draw_sw_mask_line_points_init', 6);
  _lv_draw_sw_mask_line_angle_init = Module['_lv_draw_sw_mask_line_angle_init'] = createExportWrapper('lv_draw_sw_mask_line_angle_init', 5);
  _lv_trigo_sin = Module['_lv_trigo_sin'] = createExportWrapper('lv_trigo_sin', 1);
  _lv_draw_sw_mask_angle_init = Module['_lv_draw_sw_mask_angle_init'] = createExportWrapper('lv_draw_sw_mask_angle_init', 5);
  _lv_draw_sw_mask_radius_init = Module['_lv_draw_sw_mask_radius_init'] = createExportWrapper('lv_draw_sw_mask_radius_init', 4);
  _lv_draw_sw_mask_fade_init = Module['_lv_draw_sw_mask_fade_init'] = createExportWrapper('lv_draw_sw_mask_fade_init', 6);
  _lv_draw_sw_mask_map_init = Module['_lv_draw_sw_mask_map_init'] = createExportWrapper('lv_draw_sw_mask_map_init', 3);
  _lv_draw_sw_mask_rect = Module['_lv_draw_sw_mask_rect'] = createExportWrapper('lv_draw_sw_mask_rect', 2);
  _lv_draw_sw_transform = Module['_lv_draw_sw_transform'] = createExportWrapper('lv_draw_sw_transform', 9);
  _lv_draw_sw_triangle = Module['_lv_draw_sw_triangle'] = createExportWrapper('lv_draw_sw_triangle', 2);
  _lv_draw_sw_i1_to_argb8888 = Module['_lv_draw_sw_i1_to_argb8888'] = createExportWrapper('lv_draw_sw_i1_to_argb8888', 8);
  _lv_draw_sw_rgb565_swap = Module['_lv_draw_sw_rgb565_swap'] = createExportWrapper('lv_draw_sw_rgb565_swap', 2);
  _lv_draw_sw_i1_invert = Module['_lv_draw_sw_i1_invert'] = createExportWrapper('lv_draw_sw_i1_invert', 2);
  _lv_draw_sw_i1_convert_to_vtiled = Module['_lv_draw_sw_i1_convert_to_vtiled'] = createExportWrapper('lv_draw_sw_i1_convert_to_vtiled', 7);
  _lv_draw_sw_rotate = Module['_lv_draw_sw_rotate'] = createExportWrapper('lv_draw_sw_rotate', 8);
  _lv_fs_read = Module['_lv_fs_read'] = createExportWrapper('lv_fs_read', 4);
  _lv_font_get_bitmap_fmt_txt = Module['_lv_font_get_bitmap_fmt_txt'] = createExportWrapper('lv_font_get_bitmap_fmt_txt', 2);
  _lv_font_get_glyph_dsc_fmt_txt = Module['_lv_font_get_glyph_dsc_fmt_txt'] = createExportWrapper('lv_font_get_glyph_dsc_fmt_txt', 4);
  _lv_memcmp = Module['_lv_memcmp'] = createExportWrapper('lv_memcmp', 3);
  _lv_font_get_glyph_static_bitmap = Module['_lv_font_get_glyph_static_bitmap'] = createExportWrapper('lv_font_get_glyph_static_bitmap', 1);
  _lv_font_get_glyph_width = Module['_lv_font_get_glyph_width'] = createExportWrapper('lv_font_get_glyph_width', 3);
  _lv_font_set_kerning = Module['_lv_font_set_kerning'] = createExportWrapper('lv_font_set_kerning', 2);
  _lv_font_get_default = Module['_lv_font_get_default'] = createExportWrapper('lv_font_get_default', 0);
  _lv_font_info_is_equal = Module['_lv_font_info_is_equal'] = createExportWrapper('lv_font_info_is_equal', 2);
  _lv_font_has_static_bitmap = Module['_lv_font_has_static_bitmap'] = createExportWrapper('lv_font_has_static_bitmap', 1);
  _lv_utils_bsearch = Module['_lv_utils_bsearch'] = createExportWrapper('lv_utils_bsearch', 5);
  _lv_indev_read_timer_cb = Module['_lv_indev_read_timer_cb'] = createExportWrapper('lv_indev_read_timer_cb', 1);
  _lv_indev_read = Module['_lv_indev_read'] = createExportWrapper('lv_indev_read', 1);
  _lv_indev_delete = Module['_lv_indev_delete'] = createExportWrapper('lv_indev_delete', 1);
  _lv_indev_send_event = Module['_lv_indev_send_event'] = createExportWrapper('lv_indev_send_event', 3);
  _lv_indev_find_scroll_obj = Module['_lv_indev_find_scroll_obj'] = createExportWrapper('lv_indev_find_scroll_obj', 1);
  _lv_indev_scroll_handler = Module['_lv_indev_scroll_handler'] = createExportWrapper('lv_indev_scroll_handler', 1);
  _lv_tick_diff = Module['_lv_tick_diff'] = createExportWrapper('lv_tick_diff', 2);
  _lv_indev_enable = Module['_lv_indev_enable'] = createExportWrapper('lv_indev_enable', 2);
  _lv_indev_set_user_data = Module['_lv_indev_set_user_data'] = createExportWrapper('lv_indev_set_user_data', 2);
  _lv_indev_set_driver_data = Module['_lv_indev_set_driver_data'] = createExportWrapper('lv_indev_set_driver_data', 2);
  _lv_indev_get_read_cb = Module['_lv_indev_get_read_cb'] = createExportWrapper('lv_indev_get_read_cb', 1);
  _lv_indev_set_long_press_time = Module['_lv_indev_set_long_press_time'] = createExportWrapper('lv_indev_set_long_press_time', 2);
  _lv_indev_set_long_press_repeat_time = Module['_lv_indev_set_long_press_repeat_time'] = createExportWrapper('lv_indev_set_long_press_repeat_time', 2);
  _lv_indev_set_scroll_limit = Module['_lv_indev_set_scroll_limit'] = createExportWrapper('lv_indev_set_scroll_limit', 2);
  _lv_indev_set_scroll_throw = Module['_lv_indev_set_scroll_throw'] = createExportWrapper('lv_indev_set_scroll_throw', 2);
  _lv_indev_get_user_data = Module['_lv_indev_get_user_data'] = createExportWrapper('lv_indev_get_user_data', 1);
  _lv_indev_get_driver_data = Module['_lv_indev_get_driver_data'] = createExportWrapper('lv_indev_get_driver_data', 1);
  _lv_indev_get_press_moved = Module['_lv_indev_get_press_moved'] = createExportWrapper('lv_indev_get_press_moved', 1);
  _lv_indev_stop_processing = Module['_lv_indev_stop_processing'] = createExportWrapper('lv_indev_stop_processing', 1);
  _lv_indev_reset_long_press = Module['_lv_indev_reset_long_press'] = createExportWrapper('lv_indev_reset_long_press', 1);
  _lv_indev_set_cursor = Module['_lv_indev_set_cursor'] = createExportWrapper('lv_indev_set_cursor', 2);
  _lv_indev_set_button_points = Module['_lv_indev_set_button_points'] = createExportWrapper('lv_indev_set_button_points', 2);
  _lv_indev_get_point = Module['_lv_indev_get_point'] = createExportWrapper('lv_indev_get_point', 2);
  _lv_indev_get_gesture_dir = Module['_lv_indev_get_gesture_dir'] = createExportWrapper('lv_indev_get_gesture_dir', 1);
  _lv_indev_get_key = Module['_lv_indev_get_key'] = createExportWrapper('lv_indev_get_key', 1);
  _lv_indev_get_short_click_streak = Module['_lv_indev_get_short_click_streak'] = createExportWrapper('lv_indev_get_short_click_streak', 1);
  _lv_indev_get_vect = Module['_lv_indev_get_vect'] = createExportWrapper('lv_indev_get_vect', 2);
  _lv_indev_get_cursor = Module['_lv_indev_get_cursor'] = createExportWrapper('lv_indev_get_cursor', 1);
  _lv_indev_get_read_timer = Module['_lv_indev_get_read_timer'] = createExportWrapper('lv_indev_get_read_timer', 1);
  _lv_indev_get_mode = Module['_lv_indev_get_mode'] = createExportWrapper('lv_indev_get_mode', 1);
  _lv_indev_set_mode = Module['_lv_indev_set_mode'] = createExportWrapper('lv_indev_set_mode', 2);
  _lv_timer_set_cb = Module['_lv_timer_set_cb'] = createExportWrapper('lv_timer_set_cb', 2);
  _lv_indev_search_obj = Module['_lv_indev_search_obj'] = createExportWrapper('lv_indev_search_obj', 2);
  _lv_indev_add_event_cb = Module['_lv_indev_add_event_cb'] = createExportWrapper('lv_indev_add_event_cb', 4);
  _lv_indev_get_event_count = Module['_lv_indev_get_event_count'] = createExportWrapper('lv_indev_get_event_count', 1);
  _lv_indev_get_event_dsc = Module['_lv_indev_get_event_dsc'] = createExportWrapper('lv_indev_get_event_dsc', 2);
  _lv_indev_remove_event = Module['_lv_indev_remove_event'] = createExportWrapper('lv_indev_remove_event', 2);
  _lv_indev_remove_event_cb_with_user_data = Module['_lv_indev_remove_event_cb_with_user_data'] = createExportWrapper('lv_indev_remove_event_cb_with_user_data', 3);
  _lv_indev_scroll_throw_handler = Module['_lv_indev_scroll_throw_handler'] = createExportWrapper('lv_indev_scroll_throw_handler', 1);
  _lv_timer_get_paused = Module['_lv_timer_get_paused'] = createExportWrapper('lv_timer_get_paused', 1);
  _lv_indev_scroll_throw_predict = Module['_lv_indev_scroll_throw_predict'] = createExportWrapper('lv_indev_scroll_throw_predict', 2);
  _lv_flex_init = Module['_lv_flex_init'] = createExportWrapper('lv_flex_init', 0);
  _lv_obj_set_flex_flow = Module['_lv_obj_set_flex_flow'] = createExportWrapper('lv_obj_set_flex_flow', 2);
  _lv_obj_set_flex_align = Module['_lv_obj_set_flex_align'] = createExportWrapper('lv_obj_set_flex_align', 4);
  _lv_obj_set_flex_grow = Module['_lv_obj_set_flex_grow'] = createExportWrapper('lv_obj_set_flex_grow', 2);
  _lv_grid_init = Module['_lv_grid_init'] = createExportWrapper('lv_grid_init', 0);
  _lv_obj_set_grid_dsc_array = Module['_lv_obj_set_grid_dsc_array'] = createExportWrapper('lv_obj_set_grid_dsc_array', 3);
  _lv_obj_set_grid_align = Module['_lv_obj_set_grid_align'] = createExportWrapper('lv_obj_set_grid_align', 3);
  _lv_obj_set_grid_cell = Module['_lv_obj_set_grid_cell'] = createExportWrapper('lv_obj_set_grid_cell', 7);
  _lv_grid_fr = Module['_lv_grid_fr'] = createExportWrapper('lv_grid_fr', 1);
  _lv_layout_init = Module['_lv_layout_init'] = createExportWrapper('lv_layout_init', 0);
  _lv_layout_deinit = Module['_lv_layout_deinit'] = createExportWrapper('lv_layout_deinit', 0);
  _lv_layout_register = Module['_lv_layout_register'] = createExportWrapper('lv_layout_register', 2);
  _lv_bin_decoder_init = Module['_lv_bin_decoder_init'] = createExportWrapper('lv_bin_decoder_init', 0);
  _lv_bin_decoder_info = Module['_lv_bin_decoder_info'] = createExportWrapper('lv_bin_decoder_info', 3);
  _lv_bin_decoder_open = Module['_lv_bin_decoder_open'] = createExportWrapper('lv_bin_decoder_open', 2);
  _lv_bin_decoder_get_area = Module['_lv_bin_decoder_get_area'] = createExportWrapper('lv_bin_decoder_get_area', 4);
  _lv_bin_decoder_close = Module['_lv_bin_decoder_close'] = createExportWrapper('lv_bin_decoder_close', 2);
  _free = Module['_free'] = createExportWrapper('free', 1);
  _strncmp = Module['_strncmp'] = createExportWrapper('strncmp', 3);
  _lv_cache_create = Module['_lv_cache_create'] = createExportWrapper('lv_cache_create', 4);
  _lv_cache_set_name = Module['_lv_cache_set_name'] = createExportWrapper('lv_cache_set_name', 2);
  _lv_strlen = Module['_lv_strlen'] = createExportWrapper('lv_strlen', 1);
  _lv_cache_acquire_or_create = Module['_lv_cache_acquire_or_create'] = createExportWrapper('lv_cache_acquire_or_create', 3);
  _lv_cache_entry_get_ref = Module['_lv_cache_entry_get_ref'] = createExportWrapper('lv_cache_entry_get_ref', 1);
  _lv_cache_drop = Module['_lv_cache_drop'] = createExportWrapper('lv_cache_drop', 3);
  _lv_fs_stdio_init = Module['_lv_fs_stdio_init'] = createExportWrapper('lv_fs_stdio_init', 0);
  _lv_canvas_get_draw_buf = Module['_lv_canvas_get_draw_buf'] = createExportWrapper('lv_canvas_get_draw_buf', 1);
  _lv_image_cache_drop = Module['_lv_image_cache_drop'] = createExportWrapper('lv_image_cache_drop', 1);
  _lv_canvas_set_draw_buf = Module['_lv_canvas_set_draw_buf'] = createExportWrapper('lv_canvas_set_draw_buf', 2);
  _lv_canvas_set_palette = Module['_lv_canvas_set_palette'] = createExportWrapper('lv_canvas_set_palette', 3);
  _lv_canvas_set_px = Module['_lv_canvas_set_px'] = createExportWrapper('lv_canvas_set_px', 5);
  _lv_qrcode_set_data = Module['_lv_qrcode_set_data'] = createExportWrapper('lv_qrcode_set_data', 2);
  _lv_qrcode_set_quiet_zone = Module['_lv_qrcode_set_quiet_zone'] = createExportWrapper('lv_qrcode_set_quiet_zone', 2);
  _lv_is_initialized = Module['_lv_is_initialized'] = createExportWrapper('lv_is_initialized', 0);
  _lv_rand_set_seed = Module['_lv_rand_set_seed'] = createExportWrapper('lv_rand_set_seed', 1);
  _lv_mem_init = Module['_lv_mem_init'] = createExportWrapper('lv_mem_init', 0);
  _lv_span_stack_init = Module['_lv_span_stack_init'] = createExportWrapper('lv_span_stack_init', 0);
  _lv_os_init = Module['_lv_os_init'] = createExportWrapper('lv_os_init', 0);
  _lv_timer_core_init = Module['_lv_timer_core_init'] = createExportWrapper('lv_timer_core_init', 0);
  _lv_fs_init = Module['_lv_fs_init'] = createExportWrapper('lv_fs_init', 0);
  _lv_anim_core_init = Module['_lv_anim_core_init'] = createExportWrapper('lv_anim_core_init', 0);
  _lv_color_to_u16 = Module['_lv_color_to_u16'] = createExportWrapper('lv_color_to_u16', 1);
  _lv_color_16_16_mix = Module['_lv_color_16_16_mix'] = createExportWrapper('lv_color_16_16_mix', 3);
  _lv_color_mix32 = Module['_lv_color_mix32'] = createExportWrapper('lv_color_mix32', 3);
  _lv_color32_eq = Module['_lv_color32_eq'] = createExportWrapper('lv_color32_eq', 2);
  _lv_color_mix32_premultiplied = Module['_lv_color_mix32_premultiplied'] = createExportWrapper('lv_color_mix32_premultiplied', 3);
  _lv_color_luminance = Module['_lv_color_luminance'] = createExportWrapper('lv_color_luminance', 1);
  _lv_color32_luminance = Module['_lv_color32_luminance'] = createExportWrapper('lv_color32_luminance', 1);
  _lv_color16_luminance = Module['_lv_color16_luminance'] = createExportWrapper('lv_color16_luminance', 1);
  _lv_color24_luminance = Module['_lv_color24_luminance'] = createExportWrapper('lv_color24_luminance', 1);
  _lv_trigo_cos = Module['_lv_trigo_cos'] = createExportWrapper('lv_trigo_cos', 1);
  _lv_point_from_precise = Module['_lv_point_from_precise'] = createExportWrapper('lv_point_from_precise', 2);
  _lv_point_swap = Module['_lv_point_swap'] = createExportWrapper('lv_point_swap', 2);
  _lv_fs_get_ext = Module['_lv_fs_get_ext'] = createExportWrapper('lv_fs_get_ext', 1);
  _lv_snprintf = Module['_lv_snprintf'] = createExportWrapper('lv_snprintf', 4);
  _lv_strlcpy = Module['_lv_strlcpy'] = createExportWrapper('lv_strlcpy', 3);
  _lv_ll_clear_custom = Module['_lv_ll_clear_custom'] = createExportWrapper('lv_ll_clear_custom', 2);
  _lv_span_stack_deinit = Module['_lv_span_stack_deinit'] = createExportWrapper('lv_span_stack_deinit', 0);
  _lv_theme_default_deinit = Module['_lv_theme_default_deinit'] = createExportWrapper('lv_theme_default_deinit', 0);
  _lv_theme_simple_deinit = Module['_lv_theme_simple_deinit'] = createExportWrapper('lv_theme_simple_deinit', 0);
  _lv_theme_mono_deinit = Module['_lv_theme_mono_deinit'] = createExportWrapper('lv_theme_mono_deinit', 0);
  _lv_anim_core_deinit = Module['_lv_anim_core_deinit'] = createExportWrapper('lv_anim_core_deinit', 0);
  _lv_timer_core_deinit = Module['_lv_timer_core_deinit'] = createExportWrapper('lv_timer_core_deinit', 0);
  _lv_fs_deinit = Module['_lv_fs_deinit'] = createExportWrapper('lv_fs_deinit', 0);
  _lv_mem_deinit = Module['_lv_mem_deinit'] = createExportWrapper('lv_mem_deinit', 0);
  _lv_log_register_print_cb = Module['_lv_log_register_print_cb'] = createExportWrapper('lv_log_register_print_cb', 1);
  _lv_cache_entry_get_size = Module['_lv_cache_entry_get_size'] = createExportWrapper('lv_cache_entry_get_size', 1);
  _lv_rb_init = Module['_lv_rb_init'] = createExportWrapper('lv_rb_init', 3);
  _lv_cache_entry_get_entry = Module['_lv_cache_entry_get_entry'] = createExportWrapper('lv_cache_entry_get_entry', 2);
  _lv_rb_find = Module['_lv_rb_find'] = createExportWrapper('lv_rb_find', 2);
  _lv_ll_move_before = Module['_lv_ll_move_before'] = createExportWrapper('lv_ll_move_before', 3);
  _lv_rb_insert = Module['_lv_rb_insert'] = createExportWrapper('lv_rb_insert', 2);
  _lv_rb_drop_node = Module['_lv_rb_drop_node'] = createExportWrapper('lv_rb_drop_node', 2);
  _lv_cache_entry_init = Module['_lv_cache_entry_init'] = createExportWrapper('lv_cache_entry_init', 3);
  _lv_rb_remove_node = Module['_lv_rb_remove_node'] = createExportWrapper('lv_rb_remove_node', 2);
  _lv_cache_entry_delete = Module['_lv_cache_entry_delete'] = createExportWrapper('lv_cache_entry_delete', 1);
  _lv_rb_destroy = Module['_lv_rb_destroy'] = createExportWrapper('lv_rb_destroy', 1);
  _lv_iter_create = Module['_lv_iter_create'] = createExportWrapper('lv_iter_create', 4);
  _lv_image_cache_resize = Module['_lv_image_cache_resize'] = createExportWrapper('lv_image_cache_resize', 2);
  _lv_cache_set_max_size = Module['_lv_cache_set_max_size'] = createExportWrapper('lv_cache_set_max_size', 3);
  _lv_cache_reserve = Module['_lv_cache_reserve'] = createExportWrapper('lv_cache_reserve', 3);
  _lv_image_header_cache_drop = Module['_lv_image_header_cache_drop'] = createExportWrapper('lv_image_header_cache_drop', 1);
  _lv_cache_drop_all = Module['_lv_cache_drop_all'] = createExportWrapper('lv_cache_drop_all', 2);
  _lv_cache_is_enabled = Module['_lv_cache_is_enabled'] = createExportWrapper('lv_cache_is_enabled', 1);
  _lv_image_cache_iter_create = Module['_lv_image_cache_iter_create'] = createExportWrapper('lv_image_cache_iter_create', 0);
  _lv_cache_iter_create = Module['_lv_cache_iter_create'] = createExportWrapper('lv_cache_iter_create', 1);
  _lv_image_cache_dump = Module['_lv_image_cache_dump'] = createExportWrapper('lv_image_cache_dump', 0);
  _lv_iter_inspect = Module['_lv_iter_inspect'] = createExportWrapper('lv_iter_inspect', 2);
  _lv_image_header_cache_resize = Module['_lv_image_header_cache_resize'] = createExportWrapper('lv_image_header_cache_resize', 2);
  _lv_image_header_cache_iter_create = Module['_lv_image_header_cache_iter_create'] = createExportWrapper('lv_image_header_cache_iter_create', 0);
  _lv_image_header_cache_dump = Module['_lv_image_header_cache_dump'] = createExportWrapper('lv_image_header_cache_dump', 0);
  _lv_cache_entry_acquire_data = Module['_lv_cache_entry_acquire_data'] = createExportWrapper('lv_cache_entry_acquire_data', 1);
  _lv_cache_entry_release_data = Module['_lv_cache_entry_release_data'] = createExportWrapper('lv_cache_entry_release_data', 2);
  _lv_cache_entry_is_invalid = Module['_lv_cache_entry_is_invalid'] = createExportWrapper('lv_cache_entry_is_invalid', 1);
  _lv_cache_entry_set_flag = Module['_lv_cache_entry_set_flag'] = createExportWrapper('lv_cache_entry_set_flag', 2);
  _lv_cache_evict_one = Module['_lv_cache_evict_one'] = createExportWrapper('lv_cache_evict_one', 2);
  _lv_cache_get_max_size = Module['_lv_cache_get_max_size'] = createExportWrapper('lv_cache_get_max_size', 2);
  _lv_cache_get_size = Module['_lv_cache_get_size'] = createExportWrapper('lv_cache_get_size', 2);
  _lv_cache_get_free_size = Module['_lv_cache_get_free_size'] = createExportWrapper('lv_cache_get_free_size', 2);
  _lv_cache_set_compare_cb = Module['_lv_cache_set_compare_cb'] = createExportWrapper('lv_cache_set_compare_cb', 3);
  _lv_cache_set_create_cb = Module['_lv_cache_set_create_cb'] = createExportWrapper('lv_cache_set_create_cb', 3);
  _lv_cache_set_free_cb = Module['_lv_cache_set_free_cb'] = createExportWrapper('lv_cache_set_free_cb', 3);
  _lv_cache_get_name = Module['_lv_cache_get_name'] = createExportWrapper('lv_cache_get_name', 1);
  _lv_cache_entry_reset_ref = Module['_lv_cache_entry_reset_ref'] = createExportWrapper('lv_cache_entry_reset_ref', 1);
  _lv_cache_entry_inc_ref = Module['_lv_cache_entry_inc_ref'] = createExportWrapper('lv_cache_entry_inc_ref', 1);
  _lv_cache_entry_dec_ref = Module['_lv_cache_entry_dec_ref'] = createExportWrapper('lv_cache_entry_dec_ref', 1);
  _lv_cache_entry_get_node_size = Module['_lv_cache_entry_get_node_size'] = createExportWrapper('lv_cache_entry_get_node_size', 1);
  _lv_cache_entry_set_node_size = Module['_lv_cache_entry_set_node_size'] = createExportWrapper('lv_cache_entry_set_node_size', 2);
  _lv_cache_entry_set_cache = Module['_lv_cache_entry_set_cache'] = createExportWrapper('lv_cache_entry_set_cache', 2);
  _lv_cache_entry_get_cache = Module['_lv_cache_entry_get_cache'] = createExportWrapper('lv_cache_entry_get_cache', 1);
  _lv_cache_entry_alloc = Module['_lv_cache_entry_alloc'] = createExportWrapper('lv_cache_entry_alloc', 2);
  _lv_cache_entry_remove_flag = Module['_lv_cache_entry_remove_flag'] = createExportWrapper('lv_cache_entry_remove_flag', 2);
  _lv_cache_entry_has_flag = Module['_lv_cache_entry_has_flag'] = createExportWrapper('lv_cache_entry_has_flag', 2);
  _lv_anim_delete_all = Module['_lv_anim_delete_all'] = createExportWrapper('lv_anim_delete_all', 0);
  _lv_anim_enable_vsync_mode = Module['_lv_anim_enable_vsync_mode'] = createExportWrapper('lv_anim_enable_vsync_mode', 1);
  _lv_anim_path_linear = Module['_lv_anim_path_linear'] = createExportWrapper('lv_anim_path_linear', 1);
  _lv_map = Module['_lv_map'] = createExportWrapper('lv_map', 5);
  _lv_anim_get_playtime = Module['_lv_anim_get_playtime'] = createExportWrapper('lv_anim_get_playtime', 1);
  _lv_anim_get_timer = Module['_lv_anim_get_timer'] = createExportWrapper('lv_anim_get_timer', 0);
  _lv_anim_count_running = Module['_lv_anim_count_running'] = createExportWrapper('lv_anim_count_running', 0);
  _lv_anim_speed = Module['_lv_anim_speed'] = createExportWrapper('lv_anim_speed', 1);
  _lv_anim_speed_to_time = Module['_lv_anim_speed_to_time'] = createExportWrapper('lv_anim_speed_to_time', 3);
  _lv_anim_path_ease_in = Module['_lv_anim_path_ease_in'] = createExportWrapper('lv_anim_path_ease_in', 1);
  _lv_cubic_bezier = Module['_lv_cubic_bezier'] = createExportWrapper('lv_cubic_bezier', 5);
  _lv_anim_path_ease_in_out = Module['_lv_anim_path_ease_in_out'] = createExportWrapper('lv_anim_path_ease_in_out', 1);
  _lv_anim_path_overshoot = Module['_lv_anim_path_overshoot'] = createExportWrapper('lv_anim_path_overshoot', 1);
  _lv_anim_path_bounce = Module['_lv_anim_path_bounce'] = createExportWrapper('lv_anim_path_bounce', 1);
  _lv_bezier3 = Module['_lv_bezier3'] = createExportWrapper('lv_bezier3', 5);
  _lv_anim_path_step = Module['_lv_anim_path_step'] = createExportWrapper('lv_anim_path_step', 1);
  _lv_anim_path_custom_bezier3 = Module['_lv_anim_path_custom_bezier3'] = createExportWrapper('lv_anim_path_custom_bezier3', 1);
  _lv_anim_set_custom_exec_cb = Module['_lv_anim_set_custom_exec_cb'] = createExportWrapper('lv_anim_set_custom_exec_cb', 2);
  _lv_anim_set_get_value_cb = Module['_lv_anim_set_get_value_cb'] = createExportWrapper('lv_anim_set_get_value_cb', 2);
  _lv_anim_set_reverse_duration = Module['_lv_anim_set_reverse_duration'] = createExportWrapper('lv_anim_set_reverse_duration', 2);
  _lv_anim_set_reverse_time = Module['_lv_anim_set_reverse_time'] = createExportWrapper('lv_anim_set_reverse_time', 2);
  _lv_anim_set_reverse_delay = Module['_lv_anim_set_reverse_delay'] = createExportWrapper('lv_anim_set_reverse_delay', 2);
  _lv_anim_set_bezier3_param = Module['_lv_anim_set_bezier3_param'] = createExportWrapper('lv_anim_set_bezier3_param', 5);
  _lv_anim_get_delay = Module['_lv_anim_get_delay'] = createExportWrapper('lv_anim_get_delay', 1);
  _lv_anim_get_time = Module['_lv_anim_get_time'] = createExportWrapper('lv_anim_get_time', 1);
  _lv_anim_get_repeat_count = Module['_lv_anim_get_repeat_count'] = createExportWrapper('lv_anim_get_repeat_count', 1);
  _lv_anim_get_user_data = Module['_lv_anim_get_user_data'] = createExportWrapper('lv_anim_get_user_data', 1);
  _lv_anim_custom_delete = Module['_lv_anim_custom_delete'] = createExportWrapper('lv_anim_custom_delete', 2);
  _lv_anim_custom_get = Module['_lv_anim_custom_get'] = createExportWrapper('lv_anim_custom_get', 2);
  _lv_anim_resolve_speed = Module['_lv_anim_resolve_speed'] = createExportWrapper('lv_anim_resolve_speed', 3);
  _lv_anim_is_paused = Module['_lv_anim_is_paused'] = createExportWrapper('lv_anim_is_paused', 1);
  _lv_anim_pause = Module['_lv_anim_pause'] = createExportWrapper('lv_anim_pause', 1);
  _lv_anim_pause_for = Module['_lv_anim_pause_for'] = createExportWrapper('lv_anim_pause_for', 2);
  _lv_anim_resume = Module['_lv_anim_resume'] = createExportWrapper('lv_anim_resume', 1);
  _lv_anim_timeline_create = Module['_lv_anim_timeline_create'] = createExportWrapper('lv_anim_timeline_create', 0);
  _lv_anim_timeline_delete = Module['_lv_anim_timeline_delete'] = createExportWrapper('lv_anim_timeline_delete', 1);
  _lv_anim_timeline_pause = Module['_lv_anim_timeline_pause'] = createExportWrapper('lv_anim_timeline_pause', 1);
  _lv_anim_timeline_add = Module['_lv_anim_timeline_add'] = createExportWrapper('lv_anim_timeline_add', 3);
  _lv_anim_timeline_get_playtime = Module['_lv_anim_timeline_get_playtime'] = createExportWrapper('lv_anim_timeline_get_playtime', 1);
  _lv_anim_timeline_set_repeat_count = Module['_lv_anim_timeline_set_repeat_count'] = createExportWrapper('lv_anim_timeline_set_repeat_count', 2);
  _lv_anim_timeline_set_repeat_delay = Module['_lv_anim_timeline_set_repeat_delay'] = createExportWrapper('lv_anim_timeline_set_repeat_delay', 2);
  _lv_anim_timeline_set_user_data = Module['_lv_anim_timeline_set_user_data'] = createExportWrapper('lv_anim_timeline_set_user_data', 2);
  _lv_anim_timeline_get_reverse = Module['_lv_anim_timeline_get_reverse'] = createExportWrapper('lv_anim_timeline_get_reverse', 1);
  _lv_anim_timeline_get_delay = Module['_lv_anim_timeline_get_delay'] = createExportWrapper('lv_anim_timeline_get_delay', 1);
  _lv_anim_timeline_get_repeat_count = Module['_lv_anim_timeline_get_repeat_count'] = createExportWrapper('lv_anim_timeline_get_repeat_count', 1);
  _lv_anim_timeline_get_repeat_delay = Module['_lv_anim_timeline_get_repeat_delay'] = createExportWrapper('lv_anim_timeline_get_repeat_delay', 1);
  _lv_anim_timeline_get_user_data = Module['_lv_anim_timeline_get_user_data'] = createExportWrapper('lv_anim_timeline_get_user_data', 1);
  _lv_anim_timeline_merge = Module['_lv_anim_timeline_merge'] = createExportWrapper('lv_anim_timeline_merge', 3);
  _lv_area_set_pos = Module['_lv_area_set_pos'] = createExportWrapper('lv_area_set_pos', 3);
  _lv_area_is_equal = Module['_lv_area_is_equal'] = createExportWrapper('lv_area_is_equal', 2);
  _lv_point_to_precise = Module['_lv_point_to_precise'] = createExportWrapper('lv_point_to_precise', 2);
  _lv_point_precise_set = Module['_lv_point_precise_set'] = createExportWrapper('lv_point_precise_set', 3);
  _lv_point_precise_swap = Module['_lv_point_precise_swap'] = createExportWrapper('lv_point_precise_swap', 2);
  _lv_pct = Module['_lv_pct'] = createExportWrapper('lv_pct', 1);
  _lv_pct_to_px = Module['_lv_pct_to_px'] = createExportWrapper('lv_pct_to_px', 2);
  _lv_array_init = Module['_lv_array_init'] = createExportWrapper('lv_array_init', 3);
  _lv_array_init_from_buf = Module['_lv_array_init_from_buf'] = createExportWrapper('lv_array_init_from_buf', 4);
  _lv_array_deinit = Module['_lv_array_deinit'] = createExportWrapper('lv_array_deinit', 1);
  _lv_array_copy = Module['_lv_array_copy'] = createExportWrapper('lv_array_copy', 2);
  _lv_array_shrink = Module['_lv_array_shrink'] = createExportWrapper('lv_array_shrink', 1);
  _lv_array_resize = Module['_lv_array_resize'] = createExportWrapper('lv_array_resize', 2);
  _lv_array_remove = Module['_lv_array_remove'] = createExportWrapper('lv_array_remove', 2);
  _lv_array_at = Module['_lv_array_at'] = createExportWrapper('lv_array_at', 2);
  _lv_array_erase = Module['_lv_array_erase'] = createExportWrapper('lv_array_erase', 3);
  _lv_array_concat = Module['_lv_array_concat'] = createExportWrapper('lv_array_concat', 2);
  _lv_array_push_back = Module['_lv_array_push_back'] = createExportWrapper('lv_array_push_back', 2);
  _lv_array_assign = Module['_lv_array_assign'] = createExportWrapper('lv_array_assign', 3);
  _lv_timer_set_repeat_count = Module['_lv_timer_set_repeat_count'] = createExportWrapper('lv_timer_set_repeat_count', 2);
  _lv_timer_get_next = Module['_lv_timer_get_next'] = createExportWrapper('lv_timer_get_next', 1);
  _lv_bidi_process = Module['_lv_bidi_process'] = createExportWrapper('lv_bidi_process', 3);
  _lv_bidi_detect_base_dir = Module['_lv_bidi_detect_base_dir'] = createExportWrapper('lv_bidi_detect_base_dir', 1);
  _lv_bidi_get_visual_pos = Module['_lv_bidi_get_visual_pos'] = createExportWrapper('lv_bidi_get_visual_pos', 6);
  _lv_bidi_set_custom_neutrals_static = Module['_lv_bidi_set_custom_neutrals_static'] = createExportWrapper('lv_bidi_set_custom_neutrals_static', 1);
  _lv_circle_buf_create = Module['_lv_circle_buf_create'] = createExportWrapper('lv_circle_buf_create', 2);
  _lv_circle_buf_create_from_buf = Module['_lv_circle_buf_create_from_buf'] = createExportWrapper('lv_circle_buf_create_from_buf', 3);
  _lv_circle_buf_create_from_array = Module['_lv_circle_buf_create_from_array'] = createExportWrapper('lv_circle_buf_create_from_array', 1);
  _lv_circle_buf_resize = Module['_lv_circle_buf_resize'] = createExportWrapper('lv_circle_buf_resize', 2);
  _lv_circle_buf_destroy = Module['_lv_circle_buf_destroy'] = createExportWrapper('lv_circle_buf_destroy', 1);
  _lv_circle_buf_size = Module['_lv_circle_buf_size'] = createExportWrapper('lv_circle_buf_size', 1);
  _lv_circle_buf_capacity = Module['_lv_circle_buf_capacity'] = createExportWrapper('lv_circle_buf_capacity', 1);
  _lv_circle_buf_remain = Module['_lv_circle_buf_remain'] = createExportWrapper('lv_circle_buf_remain', 1);
  _lv_circle_buf_is_empty = Module['_lv_circle_buf_is_empty'] = createExportWrapper('lv_circle_buf_is_empty', 1);
  _lv_circle_buf_is_full = Module['_lv_circle_buf_is_full'] = createExportWrapper('lv_circle_buf_is_full', 1);
  _lv_circle_buf_reset = Module['_lv_circle_buf_reset'] = createExportWrapper('lv_circle_buf_reset', 1);
  _lv_circle_buf_head = Module['_lv_circle_buf_head'] = createExportWrapper('lv_circle_buf_head', 1);
  _lv_circle_buf_tail = Module['_lv_circle_buf_tail'] = createExportWrapper('lv_circle_buf_tail', 1);
  _lv_circle_buf_read = Module['_lv_circle_buf_read'] = createExportWrapper('lv_circle_buf_read', 2);
  _lv_circle_buf_peek_at = Module['_lv_circle_buf_peek_at'] = createExportWrapper('lv_circle_buf_peek_at', 3);
  _lv_circle_buf_write = Module['_lv_circle_buf_write'] = createExportWrapper('lv_circle_buf_write', 2);
  _lv_circle_buf_fill = Module['_lv_circle_buf_fill'] = createExportWrapper('lv_circle_buf_fill', 4);
  _lv_circle_buf_skip = Module['_lv_circle_buf_skip'] = createExportWrapper('lv_circle_buf_skip', 1);
  _lv_circle_buf_peek = Module['_lv_circle_buf_peek'] = createExportWrapper('lv_circle_buf_peek', 2);
  _lv_color_lighten = Module['_lv_color_lighten'] = createExportWrapper('lv_color_lighten', 3);
  _lv_color_darken = Module['_lv_color_darken'] = createExportWrapper('lv_color_darken', 3);
  _lv_color_hsv_to_rgb = Module['_lv_color_hsv_to_rgb'] = createExportWrapper('lv_color_hsv_to_rgb', 4);
  _lv_color_rgb_to_hsv = Module['_lv_color_rgb_to_hsv'] = createExportWrapper('lv_color_rgb_to_hsv', 4);
  _lv_color_to_hsv = Module['_lv_color_to_hsv'] = createExportWrapper('lv_color_to_hsv', 2);
  _lv_color_to_int = Module['_lv_color_to_int'] = createExportWrapper('lv_color_to_int', 1);
  _lv_color_hex3 = Module['_lv_color_hex3'] = createExportWrapper('lv_color_hex3', 2);
  _lv_color_brightness = Module['_lv_color_brightness'] = createExportWrapper('lv_color_brightness', 1);
  _lv_color_filter_dsc_init = Module['_lv_color_filter_dsc_init'] = createExportWrapper('lv_color_filter_dsc_init', 2);
  _lv_event_dsc_get_cb = Module['_lv_event_dsc_get_cb'] = createExportWrapper('lv_event_dsc_get_cb', 1);
  _lv_event_dsc_get_user_data = Module['_lv_event_dsc_get_user_data'] = createExportWrapper('lv_event_dsc_get_user_data', 1);
  _lv_event_stop_bubbling = Module['_lv_event_stop_bubbling'] = createExportWrapper('lv_event_stop_bubbling', 1);
  _lv_event_stop_trickling = Module['_lv_event_stop_trickling'] = createExportWrapper('lv_event_stop_trickling', 1);
  _lv_event_stop_processing = Module['_lv_event_stop_processing'] = createExportWrapper('lv_event_stop_processing', 1);
  _lv_event_register_id = Module['_lv_event_register_id'] = createExportWrapper('lv_event_register_id', 0);
  _lv_event_code_get_name = Module['_lv_event_code_get_name'] = createExportWrapper('lv_event_code_get_name', 1);
  _lv_fs_is_ready = Module['_lv_fs_is_ready'] = createExportWrapper('lv_fs_is_ready', 1);
  _lv_fs_get_drv = Module['_lv_fs_get_drv'] = createExportWrapper('lv_fs_get_drv', 1);
  _lv_fs_get_buffer_from_path = Module['_lv_fs_get_buffer_from_path'] = createExportWrapper('lv_fs_get_buffer_from_path', 3);
  _lv_fs_make_path_from_buffer = Module['_lv_fs_make_path_from_buffer'] = createExportWrapper('lv_fs_make_path_from_buffer', 5);
  _lv_fs_write = Module['_lv_fs_write'] = createExportWrapper('lv_fs_write', 4);
  _lv_fs_tell = Module['_lv_fs_tell'] = createExportWrapper('lv_fs_tell', 2);
  _lv_fs_get_size = Module['_lv_fs_get_size'] = createExportWrapper('lv_fs_get_size', 2);
  _lv_fs_path_get_size = Module['_lv_fs_path_get_size'] = createExportWrapper('lv_fs_path_get_size', 2);
  _lv_fs_load_to_buf = Module['_lv_fs_load_to_buf'] = createExportWrapper('lv_fs_load_to_buf', 3);
  _lv_fs_dir_open = Module['_lv_fs_dir_open'] = createExportWrapper('lv_fs_dir_open', 2);
  _lv_fs_dir_read = Module['_lv_fs_dir_read'] = createExportWrapper('lv_fs_dir_read', 3);
  _lv_fs_dir_close = Module['_lv_fs_dir_close'] = createExportWrapper('lv_fs_dir_close', 1);
  _lv_fs_get_letters = Module['_lv_fs_get_letters'] = createExportWrapper('lv_fs_get_letters', 1);
  _lv_fs_up = Module['_lv_fs_up'] = createExportWrapper('lv_fs_up', 1);
  _lv_fs_get_last = Module['_lv_fs_get_last'] = createExportWrapper('lv_fs_get_last', 1);
  _lv_fs_path_join = Module['_lv_fs_path_join'] = createExportWrapper('lv_fs_path_join', 4);
  _lv_grad_init_stops = Module['_lv_grad_init_stops'] = createExportWrapper('lv_grad_init_stops', 5);
  _lv_grad_horizontal_init = Module['_lv_grad_horizontal_init'] = createExportWrapper('lv_grad_horizontal_init', 1);
  _lv_grad_vertical_init = Module['_lv_grad_vertical_init'] = createExportWrapper('lv_grad_vertical_init', 1);
  _lv_grad_linear_init = Module['_lv_grad_linear_init'] = createExportWrapper('lv_grad_linear_init', 6);
  _lv_grad_radial_init = Module['_lv_grad_radial_init'] = createExportWrapper('lv_grad_radial_init', 6);
  _lv_grad_conical_init = Module['_lv_grad_conical_init'] = createExportWrapper('lv_grad_conical_init', 6);
  _lv_grad_radial_set_focal = Module['_lv_grad_radial_set_focal'] = createExportWrapper('lv_grad_radial_set_focal', 4);
  _lv_iter_get_context = Module['_lv_iter_get_context'] = createExportWrapper('lv_iter_get_context', 1);
  _lv_iter_destroy = Module['_lv_iter_destroy'] = createExportWrapper('lv_iter_destroy', 1);
  _lv_iter_make_peekable = Module['_lv_iter_make_peekable'] = createExportWrapper('lv_iter_make_peekable', 2);
  _lv_iter_next = Module['_lv_iter_next'] = createExportWrapper('lv_iter_next', 2);
  _lv_iter_peek = Module['_lv_iter_peek'] = createExportWrapper('lv_iter_peek', 2);
  _lv_iter_peek_advance = Module['_lv_iter_peek_advance'] = createExportWrapper('lv_iter_peek_advance', 1);
  _lv_iter_peek_reset = Module['_lv_iter_peek_reset'] = createExportWrapper('lv_iter_peek_reset', 1);
  _lv_ll_chg_list = Module['_lv_ll_chg_list'] = createExportWrapper('lv_ll_chg_list', 4);
  _lv_vsnprintf = Module['_lv_vsnprintf'] = createExportWrapper('lv_vsnprintf', 4);
  _fflush = createExportWrapper('fflush', 1);
  _lv_log = Module['_lv_log'] = createExportWrapper('lv_log', 2);
  _lv_lru_create = Module['_lv_lru_create'] = createExportWrapper('lv_lru_create', 4);
  _lv_lru_delete = Module['_lv_lru_delete'] = createExportWrapper('lv_lru_delete', 1);
  _lv_lru_set = Module['_lv_lru_set'] = createExportWrapper('lv_lru_set', 5);
  _lv_lru_remove_lru_item = Module['_lv_lru_remove_lru_item'] = createExportWrapper('lv_lru_remove_lru_item', 1);
  _lv_lru_get = Module['_lv_lru_get'] = createExportWrapper('lv_lru_get', 4);
  _lv_lru_remove = Module['_lv_lru_remove'] = createExportWrapper('lv_lru_remove', 3);
  _lv_sqrt = Module['_lv_sqrt'] = createExportWrapper('lv_sqrt', 3);
  _lv_sqrt32 = Module['_lv_sqrt32'] = createExportWrapper('lv_sqrt32', 1);
  _lv_atan2 = Module['_lv_atan2'] = createExportWrapper('lv_atan2', 2);
  _lv_pow = Module['_lv_pow'] = createExportWrapper('lv_pow', 2);
  _lv_rand = Module['_lv_rand'] = createExportWrapper('lv_rand', 2);
  _lv_palette_lighten = Module['_lv_palette_lighten'] = createExportWrapper('lv_palette_lighten', 3);
  _lv_palette_darken = Module['_lv_palette_darken'] = createExportWrapper('lv_palette_darken', 3);
  _lv_rb_minimum_from = Module['_lv_rb_minimum_from'] = createExportWrapper('lv_rb_minimum_from', 1);
  _lv_rb_remove = Module['_lv_rb_remove'] = createExportWrapper('lv_rb_remove', 2);
  _lv_rb_drop = Module['_lv_rb_drop'] = createExportWrapper('lv_rb_drop', 2);
  _lv_rb_minimum = Module['_lv_rb_minimum'] = createExportWrapper('lv_rb_minimum', 1);
  _lv_rb_maximum = Module['_lv_rb_maximum'] = createExportWrapper('lv_rb_maximum', 1);
  _lv_rb_maximum_from = Module['_lv_rb_maximum_from'] = createExportWrapper('lv_rb_maximum_from', 1);
  _lv_style_copy = Module['_lv_style_copy'] = createExportWrapper('lv_style_copy', 2);
  _lv_style_merge = Module['_lv_style_merge'] = createExportWrapper('lv_style_merge', 2);
  _lv_style_register_prop = Module['_lv_style_register_prop'] = createExportWrapper('lv_style_register_prop', 1);
  _lv_style_get_num_custom_props = Module['_lv_style_get_num_custom_props'] = createExportWrapper('lv_style_get_num_custom_props', 0);
  _lv_style_transition_dsc_init = Module['_lv_style_transition_dsc_init'] = createExportWrapper('lv_style_transition_dsc_init', 6);
  _lv_style_set_width = Module['_lv_style_set_width'] = createExportWrapper('lv_style_set_width', 2);
  _lv_style_set_min_width = Module['_lv_style_set_min_width'] = createExportWrapper('lv_style_set_min_width', 2);
  _lv_style_set_max_width = Module['_lv_style_set_max_width'] = createExportWrapper('lv_style_set_max_width', 2);
  _lv_style_set_height = Module['_lv_style_set_height'] = createExportWrapper('lv_style_set_height', 2);
  _lv_style_set_min_height = Module['_lv_style_set_min_height'] = createExportWrapper('lv_style_set_min_height', 2);
  _lv_style_set_max_height = Module['_lv_style_set_max_height'] = createExportWrapper('lv_style_set_max_height', 2);
  _lv_style_set_length = Module['_lv_style_set_length'] = createExportWrapper('lv_style_set_length', 2);
  _lv_style_set_x = Module['_lv_style_set_x'] = createExportWrapper('lv_style_set_x', 2);
  _lv_style_set_y = Module['_lv_style_set_y'] = createExportWrapper('lv_style_set_y', 2);
  _lv_style_set_align = Module['_lv_style_set_align'] = createExportWrapper('lv_style_set_align', 2);
  _lv_style_set_transform_width = Module['_lv_style_set_transform_width'] = createExportWrapper('lv_style_set_transform_width', 2);
  _lv_style_set_transform_height = Module['_lv_style_set_transform_height'] = createExportWrapper('lv_style_set_transform_height', 2);
  _lv_style_set_translate_x = Module['_lv_style_set_translate_x'] = createExportWrapper('lv_style_set_translate_x', 2);
  _lv_style_set_translate_y = Module['_lv_style_set_translate_y'] = createExportWrapper('lv_style_set_translate_y', 2);
  _lv_style_set_translate_radial = Module['_lv_style_set_translate_radial'] = createExportWrapper('lv_style_set_translate_radial', 2);
  _lv_style_set_transform_scale_x = Module['_lv_style_set_transform_scale_x'] = createExportWrapper('lv_style_set_transform_scale_x', 2);
  _lv_style_set_transform_scale_y = Module['_lv_style_set_transform_scale_y'] = createExportWrapper('lv_style_set_transform_scale_y', 2);
  _lv_style_set_transform_rotation = Module['_lv_style_set_transform_rotation'] = createExportWrapper('lv_style_set_transform_rotation', 2);
  _lv_style_set_transform_pivot_x = Module['_lv_style_set_transform_pivot_x'] = createExportWrapper('lv_style_set_transform_pivot_x', 2);
  _lv_style_set_transform_pivot_y = Module['_lv_style_set_transform_pivot_y'] = createExportWrapper('lv_style_set_transform_pivot_y', 2);
  _lv_style_set_transform_skew_x = Module['_lv_style_set_transform_skew_x'] = createExportWrapper('lv_style_set_transform_skew_x', 2);
  _lv_style_set_transform_skew_y = Module['_lv_style_set_transform_skew_y'] = createExportWrapper('lv_style_set_transform_skew_y', 2);
  _lv_style_set_pad_top = Module['_lv_style_set_pad_top'] = createExportWrapper('lv_style_set_pad_top', 2);
  _lv_style_set_pad_bottom = Module['_lv_style_set_pad_bottom'] = createExportWrapper('lv_style_set_pad_bottom', 2);
  _lv_style_set_pad_left = Module['_lv_style_set_pad_left'] = createExportWrapper('lv_style_set_pad_left', 2);
  _lv_style_set_pad_right = Module['_lv_style_set_pad_right'] = createExportWrapper('lv_style_set_pad_right', 2);
  _lv_style_set_pad_row = Module['_lv_style_set_pad_row'] = createExportWrapper('lv_style_set_pad_row', 2);
  _lv_style_set_pad_column = Module['_lv_style_set_pad_column'] = createExportWrapper('lv_style_set_pad_column', 2);
  _lv_style_set_pad_radial = Module['_lv_style_set_pad_radial'] = createExportWrapper('lv_style_set_pad_radial', 2);
  _lv_style_set_margin_top = Module['_lv_style_set_margin_top'] = createExportWrapper('lv_style_set_margin_top', 2);
  _lv_style_set_margin_bottom = Module['_lv_style_set_margin_bottom'] = createExportWrapper('lv_style_set_margin_bottom', 2);
  _lv_style_set_margin_left = Module['_lv_style_set_margin_left'] = createExportWrapper('lv_style_set_margin_left', 2);
  _lv_style_set_margin_right = Module['_lv_style_set_margin_right'] = createExportWrapper('lv_style_set_margin_right', 2);
  _lv_style_set_bg_color = Module['_lv_style_set_bg_color'] = createExportWrapper('lv_style_set_bg_color', 2);
  _lv_style_set_bg_opa = Module['_lv_style_set_bg_opa'] = createExportWrapper('lv_style_set_bg_opa', 2);
  _lv_style_set_bg_grad_color = Module['_lv_style_set_bg_grad_color'] = createExportWrapper('lv_style_set_bg_grad_color', 2);
  _lv_style_set_bg_grad_dir = Module['_lv_style_set_bg_grad_dir'] = createExportWrapper('lv_style_set_bg_grad_dir', 2);
  _lv_style_set_bg_main_stop = Module['_lv_style_set_bg_main_stop'] = createExportWrapper('lv_style_set_bg_main_stop', 2);
  _lv_style_set_bg_grad_stop = Module['_lv_style_set_bg_grad_stop'] = createExportWrapper('lv_style_set_bg_grad_stop', 2);
  _lv_style_set_bg_main_opa = Module['_lv_style_set_bg_main_opa'] = createExportWrapper('lv_style_set_bg_main_opa', 2);
  _lv_style_set_bg_grad_opa = Module['_lv_style_set_bg_grad_opa'] = createExportWrapper('lv_style_set_bg_grad_opa', 2);
  _lv_style_set_bg_grad = Module['_lv_style_set_bg_grad'] = createExportWrapper('lv_style_set_bg_grad', 2);
  _lv_style_set_bg_image_src = Module['_lv_style_set_bg_image_src'] = createExportWrapper('lv_style_set_bg_image_src', 2);
  _lv_style_set_bg_image_opa = Module['_lv_style_set_bg_image_opa'] = createExportWrapper('lv_style_set_bg_image_opa', 2);
  _lv_style_set_bg_image_recolor = Module['_lv_style_set_bg_image_recolor'] = createExportWrapper('lv_style_set_bg_image_recolor', 2);
  _lv_style_set_bg_image_recolor_opa = Module['_lv_style_set_bg_image_recolor_opa'] = createExportWrapper('lv_style_set_bg_image_recolor_opa', 2);
  _lv_style_set_bg_image_tiled = Module['_lv_style_set_bg_image_tiled'] = createExportWrapper('lv_style_set_bg_image_tiled', 2);
  _lv_style_set_border_color = Module['_lv_style_set_border_color'] = createExportWrapper('lv_style_set_border_color', 2);
  _lv_style_set_border_opa = Module['_lv_style_set_border_opa'] = createExportWrapper('lv_style_set_border_opa', 2);
  _lv_style_set_border_width = Module['_lv_style_set_border_width'] = createExportWrapper('lv_style_set_border_width', 2);
  _lv_style_set_border_side = Module['_lv_style_set_border_side'] = createExportWrapper('lv_style_set_border_side', 2);
  _lv_style_set_border_post = Module['_lv_style_set_border_post'] = createExportWrapper('lv_style_set_border_post', 2);
  _lv_style_set_outline_width = Module['_lv_style_set_outline_width'] = createExportWrapper('lv_style_set_outline_width', 2);
  _lv_style_set_outline_color = Module['_lv_style_set_outline_color'] = createExportWrapper('lv_style_set_outline_color', 2);
  _lv_style_set_outline_opa = Module['_lv_style_set_outline_opa'] = createExportWrapper('lv_style_set_outline_opa', 2);
  _lv_style_set_outline_pad = Module['_lv_style_set_outline_pad'] = createExportWrapper('lv_style_set_outline_pad', 2);
  _lv_style_set_shadow_width = Module['_lv_style_set_shadow_width'] = createExportWrapper('lv_style_set_shadow_width', 2);
  _lv_style_set_shadow_offset_x = Module['_lv_style_set_shadow_offset_x'] = createExportWrapper('lv_style_set_shadow_offset_x', 2);
  _lv_style_set_shadow_offset_y = Module['_lv_style_set_shadow_offset_y'] = createExportWrapper('lv_style_set_shadow_offset_y', 2);
  _lv_style_set_shadow_spread = Module['_lv_style_set_shadow_spread'] = createExportWrapper('lv_style_set_shadow_spread', 2);
  _lv_style_set_shadow_color = Module['_lv_style_set_shadow_color'] = createExportWrapper('lv_style_set_shadow_color', 2);
  _lv_style_set_shadow_opa = Module['_lv_style_set_shadow_opa'] = createExportWrapper('lv_style_set_shadow_opa', 2);
  _lv_style_set_image_opa = Module['_lv_style_set_image_opa'] = createExportWrapper('lv_style_set_image_opa', 2);
  _lv_style_set_image_recolor = Module['_lv_style_set_image_recolor'] = createExportWrapper('lv_style_set_image_recolor', 2);
  _lv_style_set_image_recolor_opa = Module['_lv_style_set_image_recolor_opa'] = createExportWrapper('lv_style_set_image_recolor_opa', 2);
  _lv_style_set_image_colorkey = Module['_lv_style_set_image_colorkey'] = createExportWrapper('lv_style_set_image_colorkey', 2);
  _lv_style_set_line_width = Module['_lv_style_set_line_width'] = createExportWrapper('lv_style_set_line_width', 2);
  _lv_style_set_line_dash_width = Module['_lv_style_set_line_dash_width'] = createExportWrapper('lv_style_set_line_dash_width', 2);
  _lv_style_set_line_dash_gap = Module['_lv_style_set_line_dash_gap'] = createExportWrapper('lv_style_set_line_dash_gap', 2);
  _lv_style_set_line_rounded = Module['_lv_style_set_line_rounded'] = createExportWrapper('lv_style_set_line_rounded', 2);
  _lv_style_set_line_color = Module['_lv_style_set_line_color'] = createExportWrapper('lv_style_set_line_color', 2);
  _lv_style_set_line_opa = Module['_lv_style_set_line_opa'] = createExportWrapper('lv_style_set_line_opa', 2);
  _lv_style_set_arc_width = Module['_lv_style_set_arc_width'] = createExportWrapper('lv_style_set_arc_width', 2);
  _lv_style_set_arc_rounded = Module['_lv_style_set_arc_rounded'] = createExportWrapper('lv_style_set_arc_rounded', 2);
  _lv_style_set_arc_color = Module['_lv_style_set_arc_color'] = createExportWrapper('lv_style_set_arc_color', 2);
  _lv_style_set_arc_opa = Module['_lv_style_set_arc_opa'] = createExportWrapper('lv_style_set_arc_opa', 2);
  _lv_style_set_arc_image_src = Module['_lv_style_set_arc_image_src'] = createExportWrapper('lv_style_set_arc_image_src', 2);
  _lv_style_set_text_color = Module['_lv_style_set_text_color'] = createExportWrapper('lv_style_set_text_color', 2);
  _lv_style_set_text_opa = Module['_lv_style_set_text_opa'] = createExportWrapper('lv_style_set_text_opa', 2);
  _lv_style_set_text_font = Module['_lv_style_set_text_font'] = createExportWrapper('lv_style_set_text_font', 2);
  _lv_style_set_text_letter_space = Module['_lv_style_set_text_letter_space'] = createExportWrapper('lv_style_set_text_letter_space', 2);
  _lv_style_set_text_line_space = Module['_lv_style_set_text_line_space'] = createExportWrapper('lv_style_set_text_line_space', 2);
  _lv_style_set_text_decor = Module['_lv_style_set_text_decor'] = createExportWrapper('lv_style_set_text_decor', 2);
  _lv_style_set_text_align = Module['_lv_style_set_text_align'] = createExportWrapper('lv_style_set_text_align', 2);
  _lv_style_set_text_outline_stroke_color = Module['_lv_style_set_text_outline_stroke_color'] = createExportWrapper('lv_style_set_text_outline_stroke_color', 2);
  _lv_style_set_text_outline_stroke_width = Module['_lv_style_set_text_outline_stroke_width'] = createExportWrapper('lv_style_set_text_outline_stroke_width', 2);
  _lv_style_set_text_outline_stroke_opa = Module['_lv_style_set_text_outline_stroke_opa'] = createExportWrapper('lv_style_set_text_outline_stroke_opa', 2);
  _lv_style_set_radius = Module['_lv_style_set_radius'] = createExportWrapper('lv_style_set_radius', 2);
  _lv_style_set_radial_offset = Module['_lv_style_set_radial_offset'] = createExportWrapper('lv_style_set_radial_offset', 2);
  _lv_style_set_clip_corner = Module['_lv_style_set_clip_corner'] = createExportWrapper('lv_style_set_clip_corner', 2);
  _lv_style_set_opa = Module['_lv_style_set_opa'] = createExportWrapper('lv_style_set_opa', 2);
  _lv_style_set_opa_layered = Module['_lv_style_set_opa_layered'] = createExportWrapper('lv_style_set_opa_layered', 2);
  _lv_style_set_color_filter_dsc = Module['_lv_style_set_color_filter_dsc'] = createExportWrapper('lv_style_set_color_filter_dsc', 2);
  _lv_style_set_color_filter_opa = Module['_lv_style_set_color_filter_opa'] = createExportWrapper('lv_style_set_color_filter_opa', 2);
  _lv_style_set_recolor = Module['_lv_style_set_recolor'] = createExportWrapper('lv_style_set_recolor', 2);
  _lv_style_set_recolor_opa = Module['_lv_style_set_recolor_opa'] = createExportWrapper('lv_style_set_recolor_opa', 2);
  _lv_style_set_anim = Module['_lv_style_set_anim'] = createExportWrapper('lv_style_set_anim', 2);
  _lv_style_set_anim_duration = Module['_lv_style_set_anim_duration'] = createExportWrapper('lv_style_set_anim_duration', 2);
  _lv_style_set_transition = Module['_lv_style_set_transition'] = createExportWrapper('lv_style_set_transition', 2);
  _lv_style_set_blend_mode = Module['_lv_style_set_blend_mode'] = createExportWrapper('lv_style_set_blend_mode', 2);
  _lv_style_set_layout = Module['_lv_style_set_layout'] = createExportWrapper('lv_style_set_layout', 2);
  _lv_style_set_base_dir = Module['_lv_style_set_base_dir'] = createExportWrapper('lv_style_set_base_dir', 2);
  _lv_style_set_bitmap_mask_src = Module['_lv_style_set_bitmap_mask_src'] = createExportWrapper('lv_style_set_bitmap_mask_src', 2);
  _lv_style_set_rotary_sensitivity = Module['_lv_style_set_rotary_sensitivity'] = createExportWrapper('lv_style_set_rotary_sensitivity', 2);
  _lv_style_set_flex_flow = Module['_lv_style_set_flex_flow'] = createExportWrapper('lv_style_set_flex_flow', 2);
  _lv_style_set_flex_main_place = Module['_lv_style_set_flex_main_place'] = createExportWrapper('lv_style_set_flex_main_place', 2);
  _lv_style_set_flex_cross_place = Module['_lv_style_set_flex_cross_place'] = createExportWrapper('lv_style_set_flex_cross_place', 2);
  _lv_style_set_flex_track_place = Module['_lv_style_set_flex_track_place'] = createExportWrapper('lv_style_set_flex_track_place', 2);
  _lv_style_set_flex_grow = Module['_lv_style_set_flex_grow'] = createExportWrapper('lv_style_set_flex_grow', 2);
  _lv_style_set_grid_column_dsc_array = Module['_lv_style_set_grid_column_dsc_array'] = createExportWrapper('lv_style_set_grid_column_dsc_array', 2);
  _lv_style_set_grid_column_align = Module['_lv_style_set_grid_column_align'] = createExportWrapper('lv_style_set_grid_column_align', 2);
  _lv_style_set_grid_row_dsc_array = Module['_lv_style_set_grid_row_dsc_array'] = createExportWrapper('lv_style_set_grid_row_dsc_array', 2);
  _lv_style_set_grid_row_align = Module['_lv_style_set_grid_row_align'] = createExportWrapper('lv_style_set_grid_row_align', 2);
  _lv_style_set_grid_cell_column_pos = Module['_lv_style_set_grid_cell_column_pos'] = createExportWrapper('lv_style_set_grid_cell_column_pos', 2);
  _lv_style_set_grid_cell_x_align = Module['_lv_style_set_grid_cell_x_align'] = createExportWrapper('lv_style_set_grid_cell_x_align', 2);
  _lv_style_set_grid_cell_column_span = Module['_lv_style_set_grid_cell_column_span'] = createExportWrapper('lv_style_set_grid_cell_column_span', 2);
  _lv_style_set_grid_cell_row_pos = Module['_lv_style_set_grid_cell_row_pos'] = createExportWrapper('lv_style_set_grid_cell_row_pos', 2);
  _lv_style_set_grid_cell_y_align = Module['_lv_style_set_grid_cell_y_align'] = createExportWrapper('lv_style_set_grid_cell_y_align', 2);
  _lv_style_set_grid_cell_row_span = Module['_lv_style_set_grid_cell_row_span'] = createExportWrapper('lv_style_set_grid_cell_row_span', 2);
  _lv_text_attributes_init = Module['_lv_text_attributes_init'] = createExportWrapper('lv_text_attributes_init', 1);
  _lv_text_get_size = Module['_lv_text_get_size'] = createExportWrapper('lv_text_get_size', 7);
  _lv_text_is_cmd = Module['_lv_text_is_cmd'] = createExportWrapper('lv_text_is_cmd', 2);
  _lv_text_ins = Module['_lv_text_ins'] = createExportWrapper('lv_text_ins', 3);
  _lv_text_cut = Module['_lv_text_cut'] = createExportWrapper('lv_text_cut', 3);
  _lv_text_set_text_vfmt = Module['_lv_text_set_text_vfmt'] = createExportWrapper('lv_text_set_text_vfmt', 2);
  _lv_timer_enable = Module['_lv_timer_enable'] = createExportWrapper('lv_timer_enable', 1);
  _lv_lock = Module['_lv_lock'] = createExportWrapper('lv_lock', 0);
  _lv_unlock = Module['_lv_unlock'] = createExportWrapper('lv_unlock', 0);
  _lv_timer_periodic_handler = Module['_lv_timer_periodic_handler'] = createExportWrapper('lv_timer_periodic_handler', 0);
  _lv_timer_create_basic = Module['_lv_timer_create_basic'] = createExportWrapper('lv_timer_create_basic', 0);
  _lv_timer_set_period = Module['_lv_timer_set_period'] = createExportWrapper('lv_timer_set_period', 2);
  _lv_timer_set_auto_delete = Module['_lv_timer_set_auto_delete'] = createExportWrapper('lv_timer_set_auto_delete', 2);
  _lv_timer_set_user_data = Module['_lv_timer_set_user_data'] = createExportWrapper('lv_timer_set_user_data', 2);
  _lv_timer_reset = Module['_lv_timer_reset'] = createExportWrapper('lv_timer_reset', 1);
  _lv_timer_get_idle = Module['_lv_timer_get_idle'] = createExportWrapper('lv_timer_get_idle', 0);
  _lv_timer_get_time_until_next = Module['_lv_timer_get_time_until_next'] = createExportWrapper('lv_timer_get_time_until_next', 0);
  _lv_timer_handler_run_in_period = Module['_lv_timer_handler_run_in_period'] = createExportWrapper('lv_timer_handler_run_in_period', 1);
  _lv_timer_get_user_data = Module['_lv_timer_get_user_data'] = createExportWrapper('lv_timer_get_user_data', 1);
  _lv_timer_handler_set_resume_cb = Module['_lv_timer_handler_set_resume_cb'] = createExportWrapper('lv_timer_handler_set_resume_cb', 2);
  _lv_tree_node_create = Module['_lv_tree_node_create'] = createExportWrapper('lv_tree_node_create', 2);
  _lv_tree_node_delete = Module['_lv_tree_node_delete'] = createExportWrapper('lv_tree_node_delete', 1);
  _lv_tree_walk = Module['_lv_tree_walk'] = createExportWrapper('lv_tree_walk', 6);
  _lv_draw_buf_save_to_file = Module['_lv_draw_buf_save_to_file'] = createExportWrapper('lv_draw_buf_save_to_file', 2);
  _lv_lock_isr = Module['_lv_lock_isr'] = createExportWrapper('lv_lock_isr', 0);
  _lv_sleep_ms = Module['_lv_sleep_ms'] = createExportWrapper('lv_sleep_ms', 1);
  _lv_delay_ms = Module['_lv_delay_ms'] = createExportWrapper('lv_delay_ms', 1);
  _lv_os_get_idle_percent = Module['_lv_os_get_idle_percent'] = createExportWrapper('lv_os_get_idle_percent', 0);
  _lv_gridnav_add = Module['_lv_gridnav_add'] = createExportWrapper('lv_gridnav_add', 2);
  _lv_gridnav_remove = Module['_lv_gridnav_remove'] = createExportWrapper('lv_gridnav_remove', 1);
  _lv_gridnav_set_focused = Module['_lv_gridnav_set_focused'] = createExportWrapper('lv_gridnav_set_focused', 3);
  _lv_subject_init_int = Module['_lv_subject_init_int'] = createExportWrapper('lv_subject_init_int', 2);
  _lv_subject_set_int = Module['_lv_subject_set_int'] = createExportWrapper('lv_subject_set_int', 2);
  _lv_subject_notify = Module['_lv_subject_notify'] = createExportWrapper('lv_subject_notify', 1);
  _lv_subject_get_int = Module['_lv_subject_get_int'] = createExportWrapper('lv_subject_get_int', 1);
  _lv_subject_get_previous_int = Module['_lv_subject_get_previous_int'] = createExportWrapper('lv_subject_get_previous_int', 1);
  _lv_subject_set_min_value_int = Module['_lv_subject_set_min_value_int'] = createExportWrapper('lv_subject_set_min_value_int', 2);
  _lv_subject_set_max_value_int = Module['_lv_subject_set_max_value_int'] = createExportWrapper('lv_subject_set_max_value_int', 2);
  _lv_subject_init_string = Module['_lv_subject_init_string'] = createExportWrapper('lv_subject_init_string', 5);
  _lv_subject_copy_string = Module['_lv_subject_copy_string'] = createExportWrapper('lv_subject_copy_string', 2);
  _lv_subject_snprintf = Module['_lv_subject_snprintf'] = createExportWrapper('lv_subject_snprintf', 3);
  _lv_subject_get_string = Module['_lv_subject_get_string'] = createExportWrapper('lv_subject_get_string', 1);
  _lv_subject_get_previous_string = Module['_lv_subject_get_previous_string'] = createExportWrapper('lv_subject_get_previous_string', 1);
  _lv_subject_init_pointer = Module['_lv_subject_init_pointer'] = createExportWrapper('lv_subject_init_pointer', 2);
  _lv_subject_set_pointer = Module['_lv_subject_set_pointer'] = createExportWrapper('lv_subject_set_pointer', 2);
  _lv_subject_get_pointer = Module['_lv_subject_get_pointer'] = createExportWrapper('lv_subject_get_pointer', 1);
  _lv_subject_get_previous_pointer = Module['_lv_subject_get_previous_pointer'] = createExportWrapper('lv_subject_get_previous_pointer', 1);
  _lv_subject_init_color = Module['_lv_subject_init_color'] = createExportWrapper('lv_subject_init_color', 2);
  _lv_subject_set_color = Module['_lv_subject_set_color'] = createExportWrapper('lv_subject_set_color', 2);
  _lv_subject_get_color = Module['_lv_subject_get_color'] = createExportWrapper('lv_subject_get_color', 2);
  _lv_subject_get_previous_color = Module['_lv_subject_get_previous_color'] = createExportWrapper('lv_subject_get_previous_color', 2);
  _lv_subject_init_group = Module['_lv_subject_init_group'] = createExportWrapper('lv_subject_init_group', 3);
  _lv_subject_add_observer_obj = Module['_lv_subject_add_observer_obj'] = createExportWrapper('lv_subject_add_observer_obj', 4);
  _lv_subject_add_observer = Module['_lv_subject_add_observer'] = createExportWrapper('lv_subject_add_observer', 3);
  _lv_subject_deinit = Module['_lv_subject_deinit'] = createExportWrapper('lv_subject_deinit', 1);
  _lv_observer_remove = Module['_lv_observer_remove'] = createExportWrapper('lv_observer_remove', 1);
  _lv_subject_get_group_element = Module['_lv_subject_get_group_element'] = createExportWrapper('lv_subject_get_group_element', 2);
  _lv_subject_add_observer_with_target = Module['_lv_subject_add_observer_with_target'] = createExportWrapper('lv_subject_add_observer_with_target', 4);
  _lv_obj_remove_from_subject = Module['_lv_obj_remove_from_subject'] = createExportWrapper('lv_obj_remove_from_subject', 2);
  _lv_observer_get_target = Module['_lv_observer_get_target'] = createExportWrapper('lv_observer_get_target', 1);
  _lv_obj_add_subject_increment_event = Module['_lv_obj_add_subject_increment_event'] = createExportWrapper('lv_obj_add_subject_increment_event', 4);
  _lv_obj_set_subject_increment_event_min_value = Module['_lv_obj_set_subject_increment_event_min_value'] = createExportWrapper('lv_obj_set_subject_increment_event_min_value', 3);
  _lv_obj_set_subject_increment_event_max_value = Module['_lv_obj_set_subject_increment_event_max_value'] = createExportWrapper('lv_obj_set_subject_increment_event_max_value', 3);
  _lv_obj_set_subject_increment_event_rollover = Module['_lv_obj_set_subject_increment_event_rollover'] = createExportWrapper('lv_obj_set_subject_increment_event_rollover', 3);
  _lv_obj_add_subject_toggle_event = Module['_lv_obj_add_subject_toggle_event'] = createExportWrapper('lv_obj_add_subject_toggle_event', 3);
  _lv_obj_add_subject_set_int_event = Module['_lv_obj_add_subject_set_int_event'] = createExportWrapper('lv_obj_add_subject_set_int_event', 4);
  _lv_obj_add_subject_set_string_event = Module['_lv_obj_add_subject_set_string_event'] = createExportWrapper('lv_obj_add_subject_set_string_event', 4);
  _lv_obj_bind_style = Module['_lv_obj_bind_style'] = createExportWrapper('lv_obj_bind_style', 5);
  _lv_obj_bind_flag_if_eq = Module['_lv_obj_bind_flag_if_eq'] = createExportWrapper('lv_obj_bind_flag_if_eq', 4);
  _lv_obj_bind_flag_if_not_eq = Module['_lv_obj_bind_flag_if_not_eq'] = createExportWrapper('lv_obj_bind_flag_if_not_eq', 4);
  _lv_obj_bind_flag_if_gt = Module['_lv_obj_bind_flag_if_gt'] = createExportWrapper('lv_obj_bind_flag_if_gt', 4);
  _lv_obj_bind_flag_if_ge = Module['_lv_obj_bind_flag_if_ge'] = createExportWrapper('lv_obj_bind_flag_if_ge', 4);
  _lv_obj_bind_flag_if_lt = Module['_lv_obj_bind_flag_if_lt'] = createExportWrapper('lv_obj_bind_flag_if_lt', 4);
  _lv_obj_bind_flag_if_le = Module['_lv_obj_bind_flag_if_le'] = createExportWrapper('lv_obj_bind_flag_if_le', 4);
  _lv_obj_bind_state_if_eq = Module['_lv_obj_bind_state_if_eq'] = createExportWrapper('lv_obj_bind_state_if_eq', 4);
  _lv_obj_bind_state_if_not_eq = Module['_lv_obj_bind_state_if_not_eq'] = createExportWrapper('lv_obj_bind_state_if_not_eq', 4);
  _lv_obj_bind_state_if_gt = Module['_lv_obj_bind_state_if_gt'] = createExportWrapper('lv_obj_bind_state_if_gt', 4);
  _lv_obj_bind_state_if_ge = Module['_lv_obj_bind_state_if_ge'] = createExportWrapper('lv_obj_bind_state_if_ge', 4);
  _lv_obj_bind_state_if_lt = Module['_lv_obj_bind_state_if_lt'] = createExportWrapper('lv_obj_bind_state_if_lt', 4);
  _lv_obj_bind_state_if_le = Module['_lv_obj_bind_state_if_le'] = createExportWrapper('lv_obj_bind_state_if_le', 4);
  _lv_obj_bind_checked = Module['_lv_obj_bind_checked'] = createExportWrapper('lv_obj_bind_checked', 2);
  _lv_observer_get_target_obj = Module['_lv_observer_get_target_obj'] = createExportWrapper('lv_observer_get_target_obj', 1);
  _lv_observer_get_user_data = Module['_lv_observer_get_user_data'] = createExportWrapper('lv_observer_get_user_data', 1);
  _lv_strnlen = Module['_lv_strnlen'] = createExportWrapper('lv_strnlen', 2);
  _lv_strncpy = Module['_lv_strncpy'] = createExportWrapper('lv_strncpy', 3);
  _lv_strcpy = Module['_lv_strcpy'] = createExportWrapper('lv_strcpy', 2);
  _lv_strncmp = Module['_lv_strncmp'] = createExportWrapper('lv_strncmp', 3);
  _lv_strcat = Module['_lv_strcat'] = createExportWrapper('lv_strcat', 2);
  _lv_strncat = Module['_lv_strncat'] = createExportWrapper('lv_strncat', 3);
  _lv_strchr = Module['_lv_strchr'] = createExportWrapper('lv_strchr', 2);
  _lv_mem_add_pool = Module['_lv_mem_add_pool'] = createExportWrapper('lv_mem_add_pool', 2);
  _lv_mem_remove_pool = Module['_lv_mem_remove_pool'] = createExportWrapper('lv_mem_remove_pool', 1);
  _lv_malloc_core = Module['_lv_malloc_core'] = createExportWrapper('lv_malloc_core', 1);
  _lv_realloc_core = Module['_lv_realloc_core'] = createExportWrapper('lv_realloc_core', 2);
  _lv_free_core = Module['_lv_free_core'] = createExportWrapper('lv_free_core', 1);
  _lv_mem_monitor_core = Module['_lv_mem_monitor_core'] = createExportWrapper('lv_mem_monitor_core', 1);
  _lv_mem_test_core = Module['_lv_mem_test_core'] = createExportWrapper('lv_mem_test_core', 0);
  _lv_calloc = Module['_lv_calloc'] = createExportWrapper('lv_calloc', 2);
  _lv_zalloc = Module['_lv_zalloc'] = createExportWrapper('lv_zalloc', 1);
  _lv_reallocf = Module['_lv_reallocf'] = createExportWrapper('lv_reallocf', 2);
  _lv_mem_test = Module['_lv_mem_test'] = createExportWrapper('lv_mem_test', 0);
  _lv_mem_monitor = Module['_lv_mem_monitor'] = createExportWrapper('lv_mem_monitor', 1);
  _lv_theme_get_from_obj = Module['_lv_theme_get_from_obj'] = createExportWrapper('lv_theme_get_from_obj', 1);
  _lv_theme_set_parent = Module['_lv_theme_set_parent'] = createExportWrapper('lv_theme_set_parent', 2);
  _lv_theme_set_apply_cb = Module['_lv_theme_set_apply_cb'] = createExportWrapper('lv_theme_set_apply_cb', 2);
  _lv_theme_get_font_small = Module['_lv_theme_get_font_small'] = createExportWrapper('lv_theme_get_font_small', 1);
  _lv_theme_get_font_normal = Module['_lv_theme_get_font_normal'] = createExportWrapper('lv_theme_get_font_normal', 1);
  _lv_theme_get_font_large = Module['_lv_theme_get_font_large'] = createExportWrapper('lv_theme_get_font_large', 1);
  _lv_theme_get_color_primary = Module['_lv_theme_get_color_primary'] = createExportWrapper('lv_theme_get_color_primary', 2);
  _lv_theme_get_color_secondary = Module['_lv_theme_get_color_secondary'] = createExportWrapper('lv_theme_get_color_secondary', 2);
  _lv_theme_mono_init = Module['_lv_theme_mono_init'] = createExportWrapper('lv_theme_mono_init', 3);
  _lv_theme_mono_is_inited = Module['_lv_theme_mono_is_inited'] = createExportWrapper('lv_theme_mono_is_inited', 0);
  _lv_theme_mono_get = Module['_lv_theme_mono_get'] = createExportWrapper('lv_theme_mono_get', 0);
  _lv_theme_simple_init = Module['_lv_theme_simple_init'] = createExportWrapper('lv_theme_simple_init', 1);
  _lv_theme_simple_is_inited = Module['_lv_theme_simple_is_inited'] = createExportWrapper('lv_theme_simple_is_inited', 0);
  _lv_theme_simple_get = Module['_lv_theme_simple_get'] = createExportWrapper('lv_theme_simple_get', 0);
  _lv_tick_set_cb = Module['_lv_tick_set_cb'] = createExportWrapper('lv_tick_set_cb', 1);
  _lv_tick_get_cb = Module['_lv_tick_get_cb'] = createExportWrapper('lv_tick_get_cb', 0);
  _lv_delay_set_cb = Module['_lv_delay_set_cb'] = createExportWrapper('lv_delay_set_cb', 1);
  _lv_animimg_set_src_reverse = Module['_lv_animimg_set_src_reverse'] = createExportWrapper('lv_animimg_set_src_reverse', 3);
  _lv_animimg_delete = Module['_lv_animimg_delete'] = createExportWrapper('lv_animimg_delete', 1);
  _lv_animimg_set_reverse_duration = Module['_lv_animimg_set_reverse_duration'] = createExportWrapper('lv_animimg_set_reverse_duration', 2);
  _lv_animimg_set_reverse_delay = Module['_lv_animimg_set_reverse_delay'] = createExportWrapper('lv_animimg_set_reverse_delay', 2);
  _lv_animimg_set_start_cb = Module['_lv_animimg_set_start_cb'] = createExportWrapper('lv_animimg_set_start_cb', 2);
  _lv_animimg_set_completed_cb = Module['_lv_animimg_set_completed_cb'] = createExportWrapper('lv_animimg_set_completed_cb', 2);
  _lv_animimg_get_src = Module['_lv_animimg_get_src'] = createExportWrapper('lv_animimg_get_src', 1);
  _lv_animimg_get_src_count = Module['_lv_animimg_get_src_count'] = createExportWrapper('lv_animimg_get_src_count', 1);
  _lv_animimg_get_duration = Module['_lv_animimg_get_duration'] = createExportWrapper('lv_animimg_get_duration', 1);
  _lv_animimg_get_repeat_count = Module['_lv_animimg_get_repeat_count'] = createExportWrapper('lv_animimg_get_repeat_count', 1);
  _lv_animimg_get_anim = Module['_lv_animimg_get_anim'] = createExportWrapper('lv_animimg_get_anim', 1);
  _lv_arc_set_start_angle = Module['_lv_arc_set_start_angle'] = createExportWrapper('lv_arc_set_start_angle', 2);
  _lv_arc_set_end_angle = Module['_lv_arc_set_end_angle'] = createExportWrapper('lv_arc_set_end_angle', 2);
  _lv_arc_set_angles = Module['_lv_arc_set_angles'] = createExportWrapper('lv_arc_set_angles', 3);
  _lv_arc_set_bg_angles = Module['_lv_arc_set_bg_angles'] = createExportWrapper('lv_arc_set_bg_angles', 3);
  _lv_arc_set_min_value = Module['_lv_arc_set_min_value'] = createExportWrapper('lv_arc_set_min_value', 2);
  _lv_arc_set_max_value = Module['_lv_arc_set_max_value'] = createExportWrapper('lv_arc_set_max_value', 2);
  _lv_arc_set_change_rate = Module['_lv_arc_set_change_rate'] = createExportWrapper('lv_arc_set_change_rate', 2);
  _lv_arc_set_knob_offset = Module['_lv_arc_set_knob_offset'] = createExportWrapper('lv_arc_set_knob_offset', 2);
  _lv_arc_get_angle_start = Module['_lv_arc_get_angle_start'] = createExportWrapper('lv_arc_get_angle_start', 1);
  _lv_arc_get_angle_end = Module['_lv_arc_get_angle_end'] = createExportWrapper('lv_arc_get_angle_end', 1);
  _lv_arc_get_bg_angle_start = Module['_lv_arc_get_bg_angle_start'] = createExportWrapper('lv_arc_get_bg_angle_start', 1);
  _lv_arc_get_bg_angle_end = Module['_lv_arc_get_bg_angle_end'] = createExportWrapper('lv_arc_get_bg_angle_end', 1);
  _lv_arc_get_mode = Module['_lv_arc_get_mode'] = createExportWrapper('lv_arc_get_mode', 1);
  _lv_arc_get_rotation = Module['_lv_arc_get_rotation'] = createExportWrapper('lv_arc_get_rotation', 1);
  _lv_arc_get_knob_offset = Module['_lv_arc_get_knob_offset'] = createExportWrapper('lv_arc_get_knob_offset', 1);
  _lv_arc_bind_value = Module['_lv_arc_bind_value'] = createExportWrapper('lv_arc_bind_value', 2);
  _lv_arc_align_obj_to_angle = Module['_lv_arc_align_obj_to_angle'] = createExportWrapper('lv_arc_align_obj_to_angle', 3);
  _lv_arc_rotate_obj_to_angle = Module['_lv_arc_rotate_obj_to_angle'] = createExportWrapper('lv_arc_rotate_obj_to_angle', 3);
  _lv_arclabel_create = Module['_lv_arclabel_create'] = createExportWrapper('lv_arclabel_create', 1);
  _lv_arclabel_set_text = Module['_lv_arclabel_set_text'] = createExportWrapper('lv_arclabel_set_text', 2);
  _lv_arclabel_set_text_fmt = Module['_lv_arclabel_set_text_fmt'] = createExportWrapper('lv_arclabel_set_text_fmt', 3);
  _lv_arclabel_set_text_static = Module['_lv_arclabel_set_text_static'] = createExportWrapper('lv_arclabel_set_text_static', 2);
  _lv_arclabel_set_angle_start = Module['_lv_arclabel_set_angle_start'] = createExportWrapper('lv_arclabel_set_angle_start', 2);
  _lv_arclabel_set_angle_size = Module['_lv_arclabel_set_angle_size'] = createExportWrapper('lv_arclabel_set_angle_size', 2);
  _lv_arclabel_set_offset = Module['_lv_arclabel_set_offset'] = createExportWrapper('lv_arclabel_set_offset', 2);
  _lv_arclabel_set_dir = Module['_lv_arclabel_set_dir'] = createExportWrapper('lv_arclabel_set_dir', 2);
  _lv_arclabel_set_recolor = Module['_lv_arclabel_set_recolor'] = createExportWrapper('lv_arclabel_set_recolor', 2);
  _lv_arclabel_set_radius = Module['_lv_arclabel_set_radius'] = createExportWrapper('lv_arclabel_set_radius', 2);
  _lv_arclabel_set_center_offset_x = Module['_lv_arclabel_set_center_offset_x'] = createExportWrapper('lv_arclabel_set_center_offset_x', 2);
  _lv_arclabel_set_center_offset_y = Module['_lv_arclabel_set_center_offset_y'] = createExportWrapper('lv_arclabel_set_center_offset_y', 2);
  _lv_arclabel_set_text_vertical_align = Module['_lv_arclabel_set_text_vertical_align'] = createExportWrapper('lv_arclabel_set_text_vertical_align', 2);
  _lv_arclabel_set_text_horizontal_align = Module['_lv_arclabel_set_text_horizontal_align'] = createExportWrapper('lv_arclabel_set_text_horizontal_align', 2);
  _lv_arclabel_get_angle_start = Module['_lv_arclabel_get_angle_start'] = createExportWrapper('lv_arclabel_get_angle_start', 1);
  _lv_arclabel_get_angle_size = Module['_lv_arclabel_get_angle_size'] = createExportWrapper('lv_arclabel_get_angle_size', 1);
  _lv_arclabel_get_dir = Module['_lv_arclabel_get_dir'] = createExportWrapper('lv_arclabel_get_dir', 1);
  _lv_arclabel_get_recolor = Module['_lv_arclabel_get_recolor'] = createExportWrapper('lv_arclabel_get_recolor', 1);
  _lv_arclabel_get_radius = Module['_lv_arclabel_get_radius'] = createExportWrapper('lv_arclabel_get_radius', 1);
  _lv_arclabel_get_center_offset_x = Module['_lv_arclabel_get_center_offset_x'] = createExportWrapper('lv_arclabel_get_center_offset_x', 1);
  _lv_arclabel_get_center_offset_y = Module['_lv_arclabel_get_center_offset_y'] = createExportWrapper('lv_arclabel_get_center_offset_y', 1);
  _lv_arclabel_get_text_vertical_align = Module['_lv_arclabel_get_text_vertical_align'] = createExportWrapper('lv_arclabel_get_text_vertical_align', 1);
  _lv_arclabel_get_text_horizontal_align = Module['_lv_arclabel_get_text_horizontal_align'] = createExportWrapper('lv_arclabel_get_text_horizontal_align', 1);
  _lv_bar_get_mode = Module['_lv_bar_get_mode'] = createExportWrapper('lv_bar_get_mode', 1);
  _lv_bar_set_min_value = Module['_lv_bar_set_min_value'] = createExportWrapper('lv_bar_set_min_value', 2);
  _lv_bar_get_max_value = Module['_lv_bar_get_max_value'] = createExportWrapper('lv_bar_get_max_value', 1);
  _lv_bar_set_max_value = Module['_lv_bar_set_max_value'] = createExportWrapper('lv_bar_set_max_value', 2);
  _lv_bar_get_min_value = Module['_lv_bar_get_min_value'] = createExportWrapper('lv_bar_get_min_value', 1);
  _lv_bar_set_orientation = Module['_lv_bar_set_orientation'] = createExportWrapper('lv_bar_set_orientation', 2);
  _lv_bar_get_orientation = Module['_lv_bar_get_orientation'] = createExportWrapper('lv_bar_get_orientation', 1);
  _lv_bar_is_symmetrical = Module['_lv_bar_is_symmetrical'] = createExportWrapper('lv_bar_is_symmetrical', 1);
  _lv_bar_bind_value = Module['_lv_bar_bind_value'] = createExportWrapper('lv_bar_bind_value', 2);
  _lv_buttonmatrix_set_selected_button = Module['_lv_buttonmatrix_set_selected_button'] = createExportWrapper('lv_buttonmatrix_set_selected_button', 2);
  _lv_buttonmatrix_set_button_ctrl = Module['_lv_buttonmatrix_set_button_ctrl'] = createExportWrapper('lv_buttonmatrix_set_button_ctrl', 3);
  _lv_buttonmatrix_clear_button_ctrl_all = Module['_lv_buttonmatrix_clear_button_ctrl_all'] = createExportWrapper('lv_buttonmatrix_clear_button_ctrl_all', 2);
  _lv_buttonmatrix_clear_button_ctrl = Module['_lv_buttonmatrix_clear_button_ctrl'] = createExportWrapper('lv_buttonmatrix_clear_button_ctrl', 3);
  _lv_buttonmatrix_set_button_ctrl_all = Module['_lv_buttonmatrix_set_button_ctrl_all'] = createExportWrapper('lv_buttonmatrix_set_button_ctrl_all', 2);
  _lv_buttonmatrix_set_button_width = Module['_lv_buttonmatrix_set_button_width'] = createExportWrapper('lv_buttonmatrix_set_button_width', 3);
  _lv_buttonmatrix_get_map = Module['_lv_buttonmatrix_get_map'] = createExportWrapper('lv_buttonmatrix_get_map', 1);
  _lv_buttonmatrix_get_selected_button = Module['_lv_buttonmatrix_get_selected_button'] = createExportWrapper('lv_buttonmatrix_get_selected_button', 1);
  _lv_buttonmatrix_get_button_text = Module['_lv_buttonmatrix_get_button_text'] = createExportWrapper('lv_buttonmatrix_get_button_text', 2);
  _lv_buttonmatrix_has_button_ctrl = Module['_lv_buttonmatrix_has_button_ctrl'] = createExportWrapper('lv_buttonmatrix_has_button_ctrl', 3);
  _lv_buttonmatrix_get_one_checked = Module['_lv_buttonmatrix_get_one_checked'] = createExportWrapper('lv_buttonmatrix_get_one_checked', 1);
  _lv_calendar_set_day_names = Module['_lv_calendar_set_day_names'] = createExportWrapper('lv_calendar_set_day_names', 2);
  _lv_calendar_set_today_year = Module['_lv_calendar_set_today_year'] = createExportWrapper('lv_calendar_set_today_year', 2);
  _lv_calendar_set_today_month = Module['_lv_calendar_set_today_month'] = createExportWrapper('lv_calendar_set_today_month', 2);
  _lv_calendar_set_today_day = Module['_lv_calendar_set_today_day'] = createExportWrapper('lv_calendar_set_today_day', 2);
  _lv_calendar_set_highlighted_dates = Module['_lv_calendar_set_highlighted_dates'] = createExportWrapper('lv_calendar_set_highlighted_dates', 3);
  _lv_calendar_get_day_name = Module['_lv_calendar_get_day_name'] = createExportWrapper('lv_calendar_get_day_name', 1);
  _lv_calendar_set_shown_year = Module['_lv_calendar_set_shown_year'] = createExportWrapper('lv_calendar_set_shown_year', 2);
  _lv_calendar_set_shown_month = Module['_lv_calendar_set_shown_month'] = createExportWrapper('lv_calendar_set_shown_month', 2);
  _lv_calendar_get_btnmatrix = Module['_lv_calendar_get_btnmatrix'] = createExportWrapper('lv_calendar_get_btnmatrix', 1);
  _lv_calendar_get_today_date = Module['_lv_calendar_get_today_date'] = createExportWrapper('lv_calendar_get_today_date', 1);
  _lv_calendar_get_showed_date = Module['_lv_calendar_get_showed_date'] = createExportWrapper('lv_calendar_get_showed_date', 1);
  _lv_calendar_get_highlighted_dates = Module['_lv_calendar_get_highlighted_dates'] = createExportWrapper('lv_calendar_get_highlighted_dates', 1);
  _lv_calendar_get_highlighted_dates_num = Module['_lv_calendar_get_highlighted_dates_num'] = createExportWrapper('lv_calendar_get_highlighted_dates_num', 1);
  _lv_calendar_get_pressed_date = Module['_lv_calendar_get_pressed_date'] = createExportWrapper('lv_calendar_get_pressed_date', 2);
  _lv_calendar_set_chinese_mode = Module['_lv_calendar_set_chinese_mode'] = createExportWrapper('lv_calendar_set_chinese_mode', 2);
  _lv_calendar_gregorian_to_chinese = Module['_lv_calendar_gregorian_to_chinese'] = createExportWrapper('lv_calendar_gregorian_to_chinese', 2);
  _lv_label_set_text_fmt = Module['_lv_label_set_text_fmt'] = createExportWrapper('lv_label_set_text_fmt', 3);
  _lv_calendar_add_header_dropdown = Module['_lv_calendar_add_header_dropdown'] = createExportWrapper('lv_calendar_add_header_dropdown', 1);
  _lv_calendar_header_dropdown_set_year_list = Module['_lv_calendar_header_dropdown_set_year_list'] = createExportWrapper('lv_calendar_header_dropdown_set_year_list', 2);
  _lv_dropdown_clear_options = Module['_lv_dropdown_clear_options'] = createExportWrapper('lv_dropdown_clear_options', 1);
  _lv_canvas_set_buffer = Module['_lv_canvas_set_buffer'] = createExportWrapper('lv_canvas_set_buffer', 5);
  _lv_image_get_src = Module['_lv_image_get_src'] = createExportWrapper('lv_image_get_src', 1);
  _lv_canvas_get_px = Module['_lv_canvas_get_px'] = createExportWrapper('lv_canvas_get_px', 4);
  _lv_canvas_get_image = Module['_lv_canvas_get_image'] = createExportWrapper('lv_canvas_get_image', 1);
  _lv_canvas_get_buf = Module['_lv_canvas_get_buf'] = createExportWrapper('lv_canvas_get_buf', 1);
  _lv_canvas_copy_buf = Module['_lv_canvas_copy_buf'] = createExportWrapper('lv_canvas_copy_buf', 4);
  _lv_canvas_fill_bg = Module['_lv_canvas_fill_bg'] = createExportWrapper('lv_canvas_fill_bg', 3);
  _lv_canvas_init_layer = Module['_lv_canvas_init_layer'] = createExportWrapper('lv_canvas_init_layer', 2);
  _lv_canvas_finish_layer = Module['_lv_canvas_finish_layer'] = createExportWrapper('lv_canvas_finish_layer', 2);
  _lv_canvas_buf_size = Module['_lv_canvas_buf_size'] = createExportWrapper('lv_canvas_buf_size', 4);
  _lv_chart_get_point_pos_by_id = Module['_lv_chart_get_point_pos_by_id'] = createExportWrapper('lv_chart_get_point_pos_by_id', 4);
  _lv_chart_set_type = Module['_lv_chart_set_type'] = createExportWrapper('lv_chart_set_type', 2);
  _lv_chart_refresh = Module['_lv_chart_refresh'] = createExportWrapper('lv_chart_refresh', 1);
  _lv_chart_set_point_count = Module['_lv_chart_set_point_count'] = createExportWrapper('lv_chart_set_point_count', 2);
  _lv_chart_set_axis_min_value = Module['_lv_chart_set_axis_min_value'] = createExportWrapper('lv_chart_set_axis_min_value', 3);
  _lv_chart_set_axis_max_value = Module['_lv_chart_set_axis_max_value'] = createExportWrapper('lv_chart_set_axis_max_value', 3);
  _lv_chart_set_axis_range = Module['_lv_chart_set_axis_range'] = createExportWrapper('lv_chart_set_axis_range', 4);
  _lv_chart_set_update_mode = Module['_lv_chart_set_update_mode'] = createExportWrapper('lv_chart_set_update_mode', 2);
  _lv_chart_set_div_line_count = Module['_lv_chart_set_div_line_count'] = createExportWrapper('lv_chart_set_div_line_count', 3);
  _lv_chart_set_hor_div_line_count = Module['_lv_chart_set_hor_div_line_count'] = createExportWrapper('lv_chart_set_hor_div_line_count', 2);
  _lv_chart_set_ver_div_line_count = Module['_lv_chart_set_ver_div_line_count'] = createExportWrapper('lv_chart_set_ver_div_line_count', 2);
  _lv_chart_get_type = Module['_lv_chart_get_type'] = createExportWrapper('lv_chart_get_type', 1);
  _lv_chart_get_point_count = Module['_lv_chart_get_point_count'] = createExportWrapper('lv_chart_get_point_count', 1);
  _lv_chart_get_x_start_point = Module['_lv_chart_get_x_start_point'] = createExportWrapper('lv_chart_get_x_start_point', 2);
  _lv_chart_add_series = Module['_lv_chart_add_series'] = createExportWrapper('lv_chart_add_series', 3);
  _lv_chart_remove_series = Module['_lv_chart_remove_series'] = createExportWrapper('lv_chart_remove_series', 2);
  _lv_chart_hide_series = Module['_lv_chart_hide_series'] = createExportWrapper('lv_chart_hide_series', 3);
  _lv_chart_set_series_color = Module['_lv_chart_set_series_color'] = createExportWrapper('lv_chart_set_series_color', 3);
  _lv_chart_get_series_color = Module['_lv_chart_get_series_color'] = createExportWrapper('lv_chart_get_series_color', 3);
  _lv_chart_set_x_start_point = Module['_lv_chart_set_x_start_point'] = createExportWrapper('lv_chart_set_x_start_point', 3);
  _lv_chart_get_series_next = Module['_lv_chart_get_series_next'] = createExportWrapper('lv_chart_get_series_next', 2);
  _lv_chart_add_cursor = Module['_lv_chart_add_cursor'] = createExportWrapper('lv_chart_add_cursor', 3);
  _lv_chart_remove_cursor = Module['_lv_chart_remove_cursor'] = createExportWrapper('lv_chart_remove_cursor', 2);
  _lv_chart_set_cursor_pos = Module['_lv_chart_set_cursor_pos'] = createExportWrapper('lv_chart_set_cursor_pos', 3);
  _lv_chart_set_cursor_pos_x = Module['_lv_chart_set_cursor_pos_x'] = createExportWrapper('lv_chart_set_cursor_pos_x', 3);
  _lv_chart_set_cursor_pos_y = Module['_lv_chart_set_cursor_pos_y'] = createExportWrapper('lv_chart_set_cursor_pos_y', 3);
  _lv_chart_set_cursor_point = Module['_lv_chart_set_cursor_point'] = createExportWrapper('lv_chart_set_cursor_point', 4);
  _lv_chart_get_cursor_point = Module['_lv_chart_get_cursor_point'] = createExportWrapper('lv_chart_get_cursor_point', 3);
  _lv_chart_set_all_values = Module['_lv_chart_set_all_values'] = createExportWrapper('lv_chart_set_all_values', 3);
  _lv_chart_set_next_value = Module['_lv_chart_set_next_value'] = createExportWrapper('lv_chart_set_next_value', 3);
  _lv_chart_set_next_value2 = Module['_lv_chart_set_next_value2'] = createExportWrapper('lv_chart_set_next_value2', 4);
  _lv_chart_set_series_values = Module['_lv_chart_set_series_values'] = createExportWrapper('lv_chart_set_series_values', 4);
  _lv_chart_set_series_values2 = Module['_lv_chart_set_series_values2'] = createExportWrapper('lv_chart_set_series_values2', 5);
  _lv_chart_set_series_value_by_id = Module['_lv_chart_set_series_value_by_id'] = createExportWrapper('lv_chart_set_series_value_by_id', 4);
  _lv_chart_set_series_value_by_id2 = Module['_lv_chart_set_series_value_by_id2'] = createExportWrapper('lv_chart_set_series_value_by_id2', 5);
  _lv_chart_set_series_ext_y_array = Module['_lv_chart_set_series_ext_y_array'] = createExportWrapper('lv_chart_set_series_ext_y_array', 3);
  _lv_chart_set_series_ext_x_array = Module['_lv_chart_set_series_ext_x_array'] = createExportWrapper('lv_chart_set_series_ext_x_array', 3);
  _lv_chart_get_series_y_array = Module['_lv_chart_get_series_y_array'] = createExportWrapper('lv_chart_get_series_y_array', 2);
  _lv_chart_get_series_x_array = Module['_lv_chart_get_series_x_array'] = createExportWrapper('lv_chart_get_series_x_array', 2);
  _lv_chart_get_pressed_point = Module['_lv_chart_get_pressed_point'] = createExportWrapper('lv_chart_get_pressed_point', 1);
  _lv_chart_get_first_point_center_offset = Module['_lv_chart_get_first_point_center_offset'] = createExportWrapper('lv_chart_get_first_point_center_offset', 1);
  _lv_checkbox_set_text_static = Module['_lv_checkbox_set_text_static'] = createExportWrapper('lv_checkbox_set_text_static', 2);
  _lv_checkbox_get_text = Module['_lv_checkbox_get_text'] = createExportWrapper('lv_checkbox_get_text', 1);
  _lv_dropdown_set_options_static = Module['_lv_dropdown_set_options_static'] = createExportWrapper('lv_dropdown_set_options_static', 2);
  _lv_dropdown_open = Module['_lv_dropdown_open'] = createExportWrapper('lv_dropdown_open', 1);
  _lv_dropdown_is_open = Module['_lv_dropdown_is_open'] = createExportWrapper('lv_dropdown_is_open', 1);
  _lv_dropdown_close = Module['_lv_dropdown_close'] = createExportWrapper('lv_dropdown_close', 1);
  _lv_dropdown_set_text = Module['_lv_dropdown_set_text'] = createExportWrapper('lv_dropdown_set_text', 2);
  _lv_dropdown_add_option = Module['_lv_dropdown_add_option'] = createExportWrapper('lv_dropdown_add_option', 3);
  _lv_dropdown_set_selected_highlight = Module['_lv_dropdown_set_selected_highlight'] = createExportWrapper('lv_dropdown_set_selected_highlight', 2);
  _lv_dropdown_get_text = Module['_lv_dropdown_get_text'] = createExportWrapper('lv_dropdown_get_text', 1);
  _lv_dropdown_get_option_count = Module['_lv_dropdown_get_option_count'] = createExportWrapper('lv_dropdown_get_option_count', 1);
  _lv_dropdown_get_selected_str = Module['_lv_dropdown_get_selected_str'] = createExportWrapper('lv_dropdown_get_selected_str', 3);
  _lv_dropdown_get_option_index = Module['_lv_dropdown_get_option_index'] = createExportWrapper('lv_dropdown_get_option_index', 2);
  _lv_dropdown_get_symbol = Module['_lv_dropdown_get_symbol'] = createExportWrapper('lv_dropdown_get_symbol', 1);
  _lv_dropdown_get_selected_highlight = Module['_lv_dropdown_get_selected_highlight'] = createExportWrapper('lv_dropdown_get_selected_highlight', 1);
  _lv_dropdown_get_dir = Module['_lv_dropdown_get_dir'] = createExportWrapper('lv_dropdown_get_dir', 1);
  _lv_label_set_text_static = Module['_lv_label_set_text_static'] = createExportWrapper('lv_label_set_text_static', 2);
  _lv_dropdown_bind_value = Module['_lv_dropdown_bind_value'] = createExportWrapper('lv_dropdown_bind_value', 2);
  _lv_image_get_pivot = Module['_lv_image_get_pivot'] = createExportWrapper('lv_image_get_pivot', 2);
  _lv_image_set_offset_x = Module['_lv_image_set_offset_x'] = createExportWrapper('lv_image_set_offset_x', 2);
  _lv_image_set_offset_y = Module['_lv_image_set_offset_y'] = createExportWrapper('lv_image_set_offset_y', 2);
  _lv_image_set_pivot_x = Module['_lv_image_set_pivot_x'] = createExportWrapper('lv_image_set_pivot_x', 2);
  _lv_image_set_pivot_y = Module['_lv_image_set_pivot_y'] = createExportWrapper('lv_image_set_pivot_y', 2);
  _lv_image_set_scale_x = Module['_lv_image_set_scale_x'] = createExportWrapper('lv_image_set_scale_x', 2);
  _lv_image_set_scale_y = Module['_lv_image_set_scale_y'] = createExportWrapper('lv_image_set_scale_y', 2);
  _lv_image_set_blend_mode = Module['_lv_image_set_blend_mode'] = createExportWrapper('lv_image_set_blend_mode', 2);
  _lv_image_set_antialias = Module['_lv_image_set_antialias'] = createExportWrapper('lv_image_set_antialias', 2);
  _lv_image_set_bitmap_map_src = Module['_lv_image_set_bitmap_map_src'] = createExportWrapper('lv_image_set_bitmap_map_src', 2);
  _lv_image_get_offset_x = Module['_lv_image_get_offset_x'] = createExportWrapper('lv_image_get_offset_x', 1);
  _lv_image_get_offset_y = Module['_lv_image_get_offset_y'] = createExportWrapper('lv_image_get_offset_y', 1);
  _lv_image_get_rotation = Module['_lv_image_get_rotation'] = createExportWrapper('lv_image_get_rotation', 1);
  _lv_image_get_scale = Module['_lv_image_get_scale'] = createExportWrapper('lv_image_get_scale', 1);
  _lv_image_get_scale_x = Module['_lv_image_get_scale_x'] = createExportWrapper('lv_image_get_scale_x', 1);
  _lv_image_get_scale_y = Module['_lv_image_get_scale_y'] = createExportWrapper('lv_image_get_scale_y', 1);
  _lv_image_get_src_width = Module['_lv_image_get_src_width'] = createExportWrapper('lv_image_get_src_width', 1);
  _lv_image_get_src_height = Module['_lv_image_get_src_height'] = createExportWrapper('lv_image_get_src_height', 1);
  _lv_image_get_transformed_width = Module['_lv_image_get_transformed_width'] = createExportWrapper('lv_image_get_transformed_width', 1);
  _lv_image_get_transformed_height = Module['_lv_image_get_transformed_height'] = createExportWrapper('lv_image_get_transformed_height', 1);
  _lv_image_get_blend_mode = Module['_lv_image_get_blend_mode'] = createExportWrapper('lv_image_get_blend_mode', 1);
  _lv_image_get_antialias = Module['_lv_image_get_antialias'] = createExportWrapper('lv_image_get_antialias', 1);
  _lv_image_get_inner_align = Module['_lv_image_get_inner_align'] = createExportWrapper('lv_image_get_inner_align', 1);
  _lv_image_get_bitmap_map_src = Module['_lv_image_get_bitmap_map_src'] = createExportWrapper('lv_image_get_bitmap_map_src', 1);
  _lv_image_bind_src = Module['_lv_image_bind_src'] = createExportWrapper('lv_image_bind_src', 2);
  _lv_imagebutton_set_state = Module['_lv_imagebutton_set_state'] = createExportWrapper('lv_imagebutton_set_state', 2);
  _lv_imagebutton_get_src_left = Module['_lv_imagebutton_get_src_left'] = createExportWrapper('lv_imagebutton_get_src_left', 2);
  _lv_imagebutton_get_src_middle = Module['_lv_imagebutton_get_src_middle'] = createExportWrapper('lv_imagebutton_get_src_middle', 2);
  _lv_imagebutton_get_src_right = Module['_lv_imagebutton_get_src_right'] = createExportWrapper('lv_imagebutton_get_src_right', 2);
  _lv_keyboard_def_event_cb = Module['_lv_keyboard_def_event_cb'] = createExportWrapper('lv_keyboard_def_event_cb', 1);
  _lv_keyboard_set_popovers = Module['_lv_keyboard_set_popovers'] = createExportWrapper('lv_keyboard_set_popovers', 2);
  _lv_keyboard_set_map = Module['_lv_keyboard_set_map'] = createExportWrapper('lv_keyboard_set_map', 4);
  _lv_keyboard_get_textarea = Module['_lv_keyboard_get_textarea'] = createExportWrapper('lv_keyboard_get_textarea', 1);
  _lv_keyboard_get_mode = Module['_lv_keyboard_get_mode'] = createExportWrapper('lv_keyboard_get_mode', 1);
  _lv_keyboard_get_popovers = Module['_lv_keyboard_get_popovers'] = createExportWrapper('lv_keyboard_get_popovers', 1);
  _lv_textarea_add_char = Module['_lv_textarea_add_char'] = createExportWrapper('lv_textarea_add_char', 2);
  _lv_textarea_get_one_line = Module['_lv_textarea_get_one_line'] = createExportWrapper('lv_textarea_get_one_line', 1);
  _lv_textarea_cursor_left = Module['_lv_textarea_cursor_left'] = createExportWrapper('lv_textarea_cursor_left', 1);
  _lv_textarea_cursor_right = Module['_lv_textarea_cursor_right'] = createExportWrapper('lv_textarea_cursor_right', 1);
  _lv_textarea_delete_char = Module['_lv_textarea_delete_char'] = createExportWrapper('lv_textarea_delete_char', 1);
  _lv_textarea_get_cursor_pos = Module['_lv_textarea_get_cursor_pos'] = createExportWrapper('lv_textarea_get_cursor_pos', 1);
  _lv_textarea_set_cursor_pos = Module['_lv_textarea_set_cursor_pos'] = createExportWrapper('lv_textarea_set_cursor_pos', 2);
  _lv_textarea_add_text = Module['_lv_textarea_add_text'] = createExportWrapper('lv_textarea_add_text', 2);
  _lv_keyboard_get_map_array = Module['_lv_keyboard_get_map_array'] = createExportWrapper('lv_keyboard_get_map_array', 1);
  _lv_keyboard_get_selected_button = Module['_lv_keyboard_get_selected_button'] = createExportWrapper('lv_keyboard_get_selected_button', 1);
  _lv_keyboard_get_button_text = Module['_lv_keyboard_get_button_text'] = createExportWrapper('lv_keyboard_get_button_text', 2);
  _lv_label_set_text_vfmt = Module['_lv_label_set_text_vfmt'] = createExportWrapper('lv_label_set_text_vfmt', 3);
  _lv_label_get_letter_on = Module['_lv_label_get_letter_on'] = createExportWrapper('lv_label_get_letter_on', 3);
  _lv_label_set_text_selection_start = Module['_lv_label_set_text_selection_start'] = createExportWrapper('lv_label_set_text_selection_start', 2);
  _lv_label_set_text_selection_end = Module['_lv_label_set_text_selection_end'] = createExportWrapper('lv_label_set_text_selection_end', 2);
  _lv_label_set_recolor = Module['_lv_label_set_recolor'] = createExportWrapper('lv_label_set_recolor', 2);
  _lv_label_get_long_mode = Module['_lv_label_get_long_mode'] = createExportWrapper('lv_label_get_long_mode', 1);
  _lv_label_get_letter_pos = Module['_lv_label_get_letter_pos'] = createExportWrapper('lv_label_get_letter_pos', 3);
  _lv_label_is_char_under_pos = Module['_lv_label_is_char_under_pos'] = createExportWrapper('lv_label_is_char_under_pos', 2);
  _lv_label_get_text_selection_start = Module['_lv_label_get_text_selection_start'] = createExportWrapper('lv_label_get_text_selection_start', 1);
  _lv_label_get_text_selection_end = Module['_lv_label_get_text_selection_end'] = createExportWrapper('lv_label_get_text_selection_end', 1);
  _lv_label_get_recolor = Module['_lv_label_get_recolor'] = createExportWrapper('lv_label_get_recolor', 1);
  _lv_label_bind_text = Module['_lv_label_bind_text'] = createExportWrapper('lv_label_bind_text', 3);
  _lv_label_ins_text = Module['_lv_label_ins_text'] = createExportWrapper('lv_label_ins_text', 3);
  _lv_label_cut_text = Module['_lv_label_cut_text'] = createExportWrapper('lv_label_cut_text', 3);
  _lv_led_on = Module['_lv_led_on'] = createExportWrapper('lv_led_on', 1);
  _lv_led_off = Module['_lv_led_off'] = createExportWrapper('lv_led_off', 1);
  _lv_led_toggle = Module['_lv_led_toggle'] = createExportWrapper('lv_led_toggle', 1);
  _lv_line_set_points_mutable = Module['_lv_line_set_points_mutable'] = createExportWrapper('lv_line_set_points_mutable', 3);
  _lv_line_get_points = Module['_lv_line_get_points'] = createExportWrapper('lv_line_get_points', 1);
  _lv_line_get_point_count = Module['_lv_line_get_point_count'] = createExportWrapper('lv_line_get_point_count', 1);
  _lv_line_is_point_array_mutable = Module['_lv_line_is_point_array_mutable'] = createExportWrapper('lv_line_is_point_array_mutable', 1);
  _lv_line_get_points_mutable = Module['_lv_line_get_points_mutable'] = createExportWrapper('lv_line_get_points_mutable', 1);
  _lv_line_get_y_invert = Module['_lv_line_get_y_invert'] = createExportWrapper('lv_line_get_y_invert', 1);
  _lv_list_add_text = Module['_lv_list_add_text'] = createExportWrapper('lv_list_add_text', 2);
  _lv_list_add_button = Module['_lv_list_add_button'] = createExportWrapper('lv_list_add_button', 3);
  _lv_list_get_button_text = Module['_lv_list_get_button_text'] = createExportWrapper('lv_list_get_button_text', 2);
  _lv_list_set_button_text = Module['_lv_list_set_button_text'] = createExportWrapper('lv_list_set_button_text', 3);
  _lv_menu_page_create = Module['_lv_menu_page_create'] = createExportWrapper('lv_menu_page_create', 2);
  _lv_menu_set_page_title = Module['_lv_menu_set_page_title'] = createExportWrapper('lv_menu_set_page_title', 2);
  _lv_menu_cont_create = Module['_lv_menu_cont_create'] = createExportWrapper('lv_menu_cont_create', 1);
  _lv_menu_section_create = Module['_lv_menu_section_create'] = createExportWrapper('lv_menu_section_create', 1);
  _lv_menu_separator_create = Module['_lv_menu_separator_create'] = createExportWrapper('lv_menu_separator_create', 1);
  _lv_menu_set_page = Module['_lv_menu_set_page'] = createExportWrapper('lv_menu_set_page', 2);
  _lv_menu_clear_history = Module['_lv_menu_clear_history'] = createExportWrapper('lv_menu_clear_history', 1);
  _lv_menu_set_sidebar_page = Module['_lv_menu_set_sidebar_page'] = createExportWrapper('lv_menu_set_sidebar_page', 2);
  _lv_menu_set_mode_header = Module['_lv_menu_set_mode_header'] = createExportWrapper('lv_menu_set_mode_header', 2);
  _lv_menu_set_mode_root_back_button = Module['_lv_menu_set_mode_root_back_button'] = createExportWrapper('lv_menu_set_mode_root_back_button', 2);
  _lv_menu_set_load_page_event = Module['_lv_menu_set_load_page_event'] = createExportWrapper('lv_menu_set_load_page_event', 3);
  _lv_menu_set_page_title_static = Module['_lv_menu_set_page_title_static'] = createExportWrapper('lv_menu_set_page_title_static', 2);
  _lv_menu_get_cur_main_page = Module['_lv_menu_get_cur_main_page'] = createExportWrapper('lv_menu_get_cur_main_page', 1);
  _lv_menu_get_cur_sidebar_page = Module['_lv_menu_get_cur_sidebar_page'] = createExportWrapper('lv_menu_get_cur_sidebar_page', 1);
  _lv_menu_get_main_header = Module['_lv_menu_get_main_header'] = createExportWrapper('lv_menu_get_main_header', 1);
  _lv_menu_get_main_header_back_button = Module['_lv_menu_get_main_header_back_button'] = createExportWrapper('lv_menu_get_main_header_back_button', 1);
  _lv_menu_get_sidebar_header = Module['_lv_menu_get_sidebar_header'] = createExportWrapper('lv_menu_get_sidebar_header', 1);
  _lv_menu_get_sidebar_header_back_button = Module['_lv_menu_get_sidebar_header_back_button'] = createExportWrapper('lv_menu_get_sidebar_header_back_button', 1);
  _lv_menu_back_button_is_root = Module['_lv_menu_back_button_is_root'] = createExportWrapper('lv_menu_back_button_is_root', 2);
  _lv_msgbox_add_title = Module['_lv_msgbox_add_title'] = createExportWrapper('lv_msgbox_add_title', 2);
  _lv_msgbox_add_header_button = Module['_lv_msgbox_add_header_button'] = createExportWrapper('lv_msgbox_add_header_button', 2);
  _lv_msgbox_add_text = Module['_lv_msgbox_add_text'] = createExportWrapper('lv_msgbox_add_text', 2);
  _lv_msgbox_add_footer_button = Module['_lv_msgbox_add_footer_button'] = createExportWrapper('lv_msgbox_add_footer_button', 2);
  _lv_msgbox_add_close_button = Module['_lv_msgbox_add_close_button'] = createExportWrapper('lv_msgbox_add_close_button', 1);
  _lv_msgbox_get_header = Module['_lv_msgbox_get_header'] = createExportWrapper('lv_msgbox_get_header', 1);
  _lv_msgbox_get_footer = Module['_lv_msgbox_get_footer'] = createExportWrapper('lv_msgbox_get_footer', 1);
  _lv_msgbox_get_content = Module['_lv_msgbox_get_content'] = createExportWrapper('lv_msgbox_get_content', 1);
  _lv_msgbox_get_title = Module['_lv_msgbox_get_title'] = createExportWrapper('lv_msgbox_get_title', 1);
  _lv_msgbox_close = Module['_lv_msgbox_close'] = createExportWrapper('lv_msgbox_close', 1);
  _lv_msgbox_close_async = Module['_lv_msgbox_close_async'] = createExportWrapper('lv_msgbox_close_async', 1);
  _lv_roller_set_selected_str = Module['_lv_roller_set_selected_str'] = createExportWrapper('lv_roller_set_selected_str', 3);
  _lv_roller_set_visible_row_count = Module['_lv_roller_set_visible_row_count'] = createExportWrapper('lv_roller_set_visible_row_count', 2);
  _lv_roller_get_selected_str = Module['_lv_roller_get_selected_str'] = createExportWrapper('lv_roller_get_selected_str', 3);
  _lv_roller_get_option_str = Module['_lv_roller_get_option_str'] = createExportWrapper('lv_roller_get_option_str', 4);
  _lv_roller_bind_value = Module['_lv_roller_bind_value'] = createExportWrapper('lv_roller_bind_value', 2);
  _lv_scale_set_min_value = Module['_lv_scale_set_min_value'] = createExportWrapper('lv_scale_set_min_value', 2);
  _lv_scale_set_max_value = Module['_lv_scale_set_max_value'] = createExportWrapper('lv_scale_set_max_value', 2);
  _lv_scale_set_angle_range = Module['_lv_scale_set_angle_range'] = createExportWrapper('lv_scale_set_angle_range', 2);
  _lv_scale_set_rotation = Module['_lv_scale_set_rotation'] = createExportWrapper('lv_scale_set_rotation', 2);
  _lv_scale_set_line_needle_value = Module['_lv_scale_set_line_needle_value'] = createExportWrapper('lv_scale_set_line_needle_value', 4);
  _lv_scale_set_image_needle_value = Module['_lv_scale_set_image_needle_value'] = createExportWrapper('lv_scale_set_image_needle_value', 3);
  _lv_scale_set_text_src = Module['_lv_scale_set_text_src'] = createExportWrapper('lv_scale_set_text_src', 2);
  _lv_scale_set_post_draw = Module['_lv_scale_set_post_draw'] = createExportWrapper('lv_scale_set_post_draw', 2);
  _lv_scale_set_draw_ticks_on_top = Module['_lv_scale_set_draw_ticks_on_top'] = createExportWrapper('lv_scale_set_draw_ticks_on_top', 2);
  _lv_scale_add_section = Module['_lv_scale_add_section'] = createExportWrapper('lv_scale_add_section', 1);
  _lv_scale_set_section_range = Module['_lv_scale_set_section_range'] = createExportWrapper('lv_scale_set_section_range', 4);
  _lv_scale_set_section_min_value = Module['_lv_scale_set_section_min_value'] = createExportWrapper('lv_scale_set_section_min_value', 3);
  _lv_scale_set_section_max_value = Module['_lv_scale_set_section_max_value'] = createExportWrapper('lv_scale_set_section_max_value', 3);
  _lv_scale_section_set_range = Module['_lv_scale_section_set_range'] = createExportWrapper('lv_scale_section_set_range', 3);
  _lv_scale_set_section_style_main = Module['_lv_scale_set_section_style_main'] = createExportWrapper('lv_scale_set_section_style_main', 3);
  _lv_scale_set_section_style_indicator = Module['_lv_scale_set_section_style_indicator'] = createExportWrapper('lv_scale_set_section_style_indicator', 3);
  _lv_scale_set_section_style_items = Module['_lv_scale_set_section_style_items'] = createExportWrapper('lv_scale_set_section_style_items', 3);
  _lv_scale_section_set_style = Module['_lv_scale_section_set_style'] = createExportWrapper('lv_scale_section_set_style', 3);
  _lv_scale_get_mode = Module['_lv_scale_get_mode'] = createExportWrapper('lv_scale_get_mode', 1);
  _lv_scale_get_total_tick_count = Module['_lv_scale_get_total_tick_count'] = createExportWrapper('lv_scale_get_total_tick_count', 1);
  _lv_scale_get_major_tick_every = Module['_lv_scale_get_major_tick_every'] = createExportWrapper('lv_scale_get_major_tick_every', 1);
  _lv_scale_get_rotation = Module['_lv_scale_get_rotation'] = createExportWrapper('lv_scale_get_rotation', 1);
  _lv_scale_get_label_show = Module['_lv_scale_get_label_show'] = createExportWrapper('lv_scale_get_label_show', 1);
  _lv_scale_get_angle_range = Module['_lv_scale_get_angle_range'] = createExportWrapper('lv_scale_get_angle_range', 1);
  _lv_scale_get_range_min_value = Module['_lv_scale_get_range_min_value'] = createExportWrapper('lv_scale_get_range_min_value', 1);
  _lv_scale_get_range_max_value = Module['_lv_scale_get_range_max_value'] = createExportWrapper('lv_scale_get_range_max_value', 1);
  _lv_scale_bind_section_min_value = Module['_lv_scale_bind_section_min_value'] = createExportWrapper('lv_scale_bind_section_min_value', 3);
  _lv_scale_bind_section_max_value = Module['_lv_scale_bind_section_max_value'] = createExportWrapper('lv_scale_bind_section_max_value', 3);
  _lv_slider_is_dragged = Module['_lv_slider_is_dragged'] = createExportWrapper('lv_slider_is_dragged', 1);
  _lv_slider_set_min_value = Module['_lv_slider_set_min_value'] = createExportWrapper('lv_slider_set_min_value', 2);
  _lv_slider_set_max_value = Module['_lv_slider_set_max_value'] = createExportWrapper('lv_slider_set_max_value', 2);
  _lv_slider_set_orientation = Module['_lv_slider_set_orientation'] = createExportWrapper('lv_slider_set_orientation', 2);
  _lv_slider_get_value = Module['_lv_slider_get_value'] = createExportWrapper('lv_slider_get_value', 1);
  _lv_slider_get_mode = Module['_lv_slider_get_mode'] = createExportWrapper('lv_slider_get_mode', 1);
  _lv_slider_get_orientation = Module['_lv_slider_get_orientation'] = createExportWrapper('lv_slider_get_orientation', 1);
  _lv_slider_is_symmetrical = Module['_lv_slider_is_symmetrical'] = createExportWrapper('lv_slider_is_symmetrical', 1);
  _lv_slider_bind_value = Module['_lv_slider_bind_value'] = createExportWrapper('lv_slider_bind_value', 2);
  _lv_spangroup_get_expand_height = Module['_lv_spangroup_get_expand_height'] = createExportWrapper('lv_spangroup_get_expand_height', 2);
  _lv_spangroup_get_expand_width = Module['_lv_spangroup_get_expand_width'] = createExportWrapper('lv_spangroup_get_expand_width', 2);
  _lv_spangroup_get_max_line_height = Module['_lv_spangroup_get_max_line_height'] = createExportWrapper('lv_spangroup_get_max_line_height', 1);
  _lv_spangroup_add_span = Module['_lv_spangroup_add_span'] = createExportWrapper('lv_spangroup_add_span', 1);
  _lv_spangroup_refresh = Module['_lv_spangroup_refresh'] = createExportWrapper('lv_spangroup_refresh', 1);
  _lv_spangroup_delete_span = Module['_lv_spangroup_delete_span'] = createExportWrapper('lv_spangroup_delete_span', 2);
  _lv_span_set_text = Module['_lv_span_set_text'] = createExportWrapper('lv_span_set_text', 2);
  _lv_span_set_text_fmt = Module['_lv_span_set_text_fmt'] = createExportWrapper('lv_span_set_text_fmt', 3);
  _lv_spangroup_set_span_text = Module['_lv_spangroup_set_span_text'] = createExportWrapper('lv_spangroup_set_span_text', 3);
  _lv_span_set_text_static = Module['_lv_span_set_text_static'] = createExportWrapper('lv_span_set_text_static', 2);
  _lv_spangroup_set_span_text_static = Module['_lv_spangroup_set_span_text_static'] = createExportWrapper('lv_spangroup_set_span_text_static', 3);
  _lv_spangroup_set_span_text_fmt = Module['_lv_spangroup_set_span_text_fmt'] = createExportWrapper('lv_spangroup_set_span_text_fmt', 4);
  _lv_spangroup_set_span_style = Module['_lv_spangroup_set_span_style'] = createExportWrapper('lv_spangroup_set_span_style', 3);
  _lv_spangroup_set_align = Module['_lv_spangroup_set_align'] = createExportWrapper('lv_spangroup_set_align', 2);
  _lv_spangroup_set_overflow = Module['_lv_spangroup_set_overflow'] = createExportWrapper('lv_spangroup_set_overflow', 2);
  _lv_spangroup_set_indent = Module['_lv_spangroup_set_indent'] = createExportWrapper('lv_spangroup_set_indent', 2);
  _lv_spangroup_set_mode = Module['_lv_spangroup_set_mode'] = createExportWrapper('lv_spangroup_set_mode', 2);
  _lv_spangroup_set_max_lines = Module['_lv_spangroup_set_max_lines'] = createExportWrapper('lv_spangroup_set_max_lines', 2);
  _lv_span_get_style = Module['_lv_span_get_style'] = createExportWrapper('lv_span_get_style', 1);
  _lv_span_get_text = Module['_lv_span_get_text'] = createExportWrapper('lv_span_get_text', 1);
  _lv_spangroup_get_child = Module['_lv_spangroup_get_child'] = createExportWrapper('lv_spangroup_get_child', 2);
  _lv_spangroup_get_span_count = Module['_lv_spangroup_get_span_count'] = createExportWrapper('lv_spangroup_get_span_count', 1);
  _lv_spangroup_get_align = Module['_lv_spangroup_get_align'] = createExportWrapper('lv_spangroup_get_align', 1);
  _lv_spangroup_get_overflow = Module['_lv_spangroup_get_overflow'] = createExportWrapper('lv_spangroup_get_overflow', 1);
  _lv_spangroup_get_indent = Module['_lv_spangroup_get_indent'] = createExportWrapper('lv_spangroup_get_indent', 1);
  _lv_spangroup_get_mode = Module['_lv_spangroup_get_mode'] = createExportWrapper('lv_spangroup_get_mode', 1);
  _lv_spangroup_get_max_lines = Module['_lv_spangroup_get_max_lines'] = createExportWrapper('lv_spangroup_get_max_lines', 1);
  _lv_spangroup_get_span_coords = Module['_lv_spangroup_get_span_coords'] = createExportWrapper('lv_spangroup_get_span_coords', 3);
  _lv_spangroup_get_span_by_point = Module['_lv_spangroup_get_span_by_point'] = createExportWrapper('lv_spangroup_get_span_by_point', 2);
  _lv_spangroup_bind_span_text = Module['_lv_spangroup_bind_span_text'] = createExportWrapper('lv_spangroup_bind_span_text', 4);
  _lv_textarea_set_cursor_click_pos = Module['_lv_textarea_set_cursor_click_pos'] = createExportWrapper('lv_textarea_set_cursor_click_pos', 2);
  _lv_spinbox_step_next = Module['_lv_spinbox_step_next'] = createExportWrapper('lv_spinbox_step_next', 1);
  _lv_spinbox_step_prev = Module['_lv_spinbox_step_prev'] = createExportWrapper('lv_spinbox_step_prev', 1);
  _lv_spinbox_increment = Module['_lv_spinbox_increment'] = createExportWrapper('lv_spinbox_increment', 1);
  _lv_spinbox_decrement = Module['_lv_spinbox_decrement'] = createExportWrapper('lv_spinbox_decrement', 1);
  _lv_spinbox_set_digit_count = Module['_lv_spinbox_set_digit_count'] = createExportWrapper('lv_spinbox_set_digit_count', 2);
  _lv_spinbox_set_dec_point_pos = Module['_lv_spinbox_set_dec_point_pos'] = createExportWrapper('lv_spinbox_set_dec_point_pos', 2);
  _lv_spinbox_set_min_value = Module['_lv_spinbox_set_min_value'] = createExportWrapper('lv_spinbox_set_min_value', 2);
  _lv_spinbox_set_max_value = Module['_lv_spinbox_set_max_value'] = createExportWrapper('lv_spinbox_set_max_value', 2);
  _lv_spinbox_set_cursor_pos = Module['_lv_spinbox_set_cursor_pos'] = createExportWrapper('lv_spinbox_set_cursor_pos', 2);
  _lv_spinbox_set_digit_step_direction = Module['_lv_spinbox_set_digit_step_direction'] = createExportWrapper('lv_spinbox_set_digit_step_direction', 2);
  _lv_spinbox_get_rollover = Module['_lv_spinbox_get_rollover'] = createExportWrapper('lv_spinbox_get_rollover', 1);
  _lv_spinbox_bind_value = Module['_lv_spinbox_bind_value'] = createExportWrapper('lv_spinbox_bind_value', 2);
  _lv_switch_set_orientation = Module['_lv_switch_set_orientation'] = createExportWrapper('lv_switch_set_orientation', 2);
  _lv_switch_get_orientation = Module['_lv_switch_get_orientation'] = createExportWrapper('lv_switch_get_orientation', 1);
  _lv_table_set_cell_value = Module['_lv_table_set_cell_value'] = createExportWrapper('lv_table_set_cell_value', 4);
  _lv_table_set_column_count = Module['_lv_table_set_column_count'] = createExportWrapper('lv_table_set_column_count', 2);
  _lv_table_set_row_count = Module['_lv_table_set_row_count'] = createExportWrapper('lv_table_set_row_count', 2);
  _lv_table_set_cell_value_fmt = Module['_lv_table_set_cell_value_fmt'] = createExportWrapper('lv_table_set_cell_value_fmt', 5);
  _lv_table_set_column_width = Module['_lv_table_set_column_width'] = createExportWrapper('lv_table_set_column_width', 3);
  _lv_table_set_cell_ctrl = Module['_lv_table_set_cell_ctrl'] = createExportWrapper('lv_table_set_cell_ctrl', 4);
  _lv_table_clear_cell_ctrl = Module['_lv_table_clear_cell_ctrl'] = createExportWrapper('lv_table_clear_cell_ctrl', 4);
  _lv_table_set_cell_user_data = Module['_lv_table_set_cell_user_data'] = createExportWrapper('lv_table_set_cell_user_data', 4);
  _lv_table_set_selected_cell = Module['_lv_table_set_selected_cell'] = createExportWrapper('lv_table_set_selected_cell', 3);
  _lv_table_get_cell_value = Module['_lv_table_get_cell_value'] = createExportWrapper('lv_table_get_cell_value', 3);
  _lv_table_get_row_count = Module['_lv_table_get_row_count'] = createExportWrapper('lv_table_get_row_count', 1);
  _lv_table_get_column_count = Module['_lv_table_get_column_count'] = createExportWrapper('lv_table_get_column_count', 1);
  _lv_table_get_column_width = Module['_lv_table_get_column_width'] = createExportWrapper('lv_table_get_column_width', 2);
  _lv_table_has_cell_ctrl = Module['_lv_table_has_cell_ctrl'] = createExportWrapper('lv_table_has_cell_ctrl', 4);
  _lv_table_get_selected_cell = Module['_lv_table_get_selected_cell'] = createExportWrapper('lv_table_get_selected_cell', 3);
  _lv_table_get_cell_user_data = Module['_lv_table_get_cell_user_data'] = createExportWrapper('lv_table_get_cell_user_data', 3);
  _lv_tabview_get_content = Module['_lv_tabview_get_content'] = createExportWrapper('lv_tabview_get_content', 1);
  _lv_tabview_rename_tab = Module['_lv_tabview_rename_tab'] = createExportWrapper('lv_tabview_rename_tab', 3);
  _lv_tabview_get_tab_count = Module['_lv_tabview_get_tab_count'] = createExportWrapper('lv_tabview_get_tab_count', 1);
  _lv_tabview_get_tab_active = Module['_lv_tabview_get_tab_active'] = createExportWrapper('lv_tabview_get_tab_active', 1);
  _lv_tabview_get_tab_button = Module['_lv_tabview_get_tab_button'] = createExportWrapper('lv_tabview_get_tab_button', 2);
  _lv_textarea_cursor_up = Module['_lv_textarea_cursor_up'] = createExportWrapper('lv_textarea_cursor_up', 1);
  _lv_textarea_cursor_down = Module['_lv_textarea_cursor_down'] = createExportWrapper('lv_textarea_cursor_down', 1);
  _lv_textarea_delete_char_forward = Module['_lv_textarea_delete_char_forward'] = createExportWrapper('lv_textarea_delete_char_forward', 1);
  _lv_textarea_clear_selection = Module['_lv_textarea_clear_selection'] = createExportWrapper('lv_textarea_clear_selection', 1);
  _lv_textarea_get_accepted_chars = Module['_lv_textarea_get_accepted_chars'] = createExportWrapper('lv_textarea_get_accepted_chars', 1);
  _lv_textarea_set_password_bullet = Module['_lv_textarea_set_password_bullet'] = createExportWrapper('lv_textarea_set_password_bullet', 2);
  _lv_textarea_set_insert_replace = Module['_lv_textarea_set_insert_replace'] = createExportWrapper('lv_textarea_set_insert_replace', 2);
  _lv_textarea_set_text_selection = Module['_lv_textarea_set_text_selection'] = createExportWrapper('lv_textarea_set_text_selection', 2);
  _lv_textarea_set_password_show_time = Module['_lv_textarea_set_password_show_time'] = createExportWrapper('lv_textarea_set_password_show_time', 2);
  _lv_textarea_set_align = Module['_lv_textarea_set_align'] = createExportWrapper('lv_textarea_set_align', 2);
  _lv_textarea_get_label = Module['_lv_textarea_get_label'] = createExportWrapper('lv_textarea_get_label', 1);
  _lv_textarea_get_placeholder_text = Module['_lv_textarea_get_placeholder_text'] = createExportWrapper('lv_textarea_get_placeholder_text', 1);
  _lv_textarea_get_cursor_click_pos = Module['_lv_textarea_get_cursor_click_pos'] = createExportWrapper('lv_textarea_get_cursor_click_pos', 1);
  _lv_textarea_get_password_mode = Module['_lv_textarea_get_password_mode'] = createExportWrapper('lv_textarea_get_password_mode', 1);
  _lv_textarea_get_password_bullet = Module['_lv_textarea_get_password_bullet'] = createExportWrapper('lv_textarea_get_password_bullet', 1);
  _lv_textarea_text_is_selected = Module['_lv_textarea_text_is_selected'] = createExportWrapper('lv_textarea_text_is_selected', 1);
  _lv_textarea_get_text_selection = Module['_lv_textarea_get_text_selection'] = createExportWrapper('lv_textarea_get_text_selection', 1);
  _lv_textarea_get_password_show_time = Module['_lv_textarea_get_password_show_time'] = createExportWrapper('lv_textarea_get_password_show_time', 1);
  _lv_textarea_get_current_char = Module['_lv_textarea_get_current_char'] = createExportWrapper('lv_textarea_get_current_char', 1);
  _lv_tileview_add_tile = Module['_lv_tileview_add_tile'] = createExportWrapper('lv_tileview_add_tile', 4);
  _lv_tileview_set_tile = Module['_lv_tileview_set_tile'] = createExportWrapper('lv_tileview_set_tile', 3);
  _lv_tileview_set_tile_by_index = Module['_lv_tileview_set_tile_by_index'] = createExportWrapper('lv_tileview_set_tile_by_index', 4);
  _lv_tileview_get_tile_active = Module['_lv_tileview_get_tile_active'] = createExportWrapper('lv_tileview_get_tile_active', 1);
  _lv_win_add_title = Module['_lv_win_add_title'] = createExportWrapper('lv_win_add_title', 2);
  _lv_win_get_header = Module['_lv_win_get_header'] = createExportWrapper('lv_win_get_header', 1);
  _lv_win_add_button = Module['_lv_win_add_button'] = createExportWrapper('lv_win_add_button', 3);
  _lv_win_get_content = Module['_lv_win_get_content'] = createExportWrapper('lv_win_get_content', 1);
  _onMqttEvent = Module['_onMqttEvent'] = createExportWrapper('onMqttEvent', 4);
  _eez_flow_init_themes = Module['_eez_flow_init_themes'] = createExportWrapper('eez_flow_init_themes', 5);
  _flowPropagateValueLVGLEvent = Module['_flowPropagateValueLVGLEvent'] = createExportWrapper('flowPropagateValueLVGLEvent', 4);
  __evalTextProperty = Module['__evalTextProperty'] = createExportWrapper('_evalTextProperty', 6);
  __evalIntegerProperty = Module['__evalIntegerProperty'] = createExportWrapper('_evalIntegerProperty', 6);
  __evalUnsignedIntegerProperty = Module['__evalUnsignedIntegerProperty'] = createExportWrapper('_evalUnsignedIntegerProperty', 6);
  __evalBooleanProperty = Module['__evalBooleanProperty'] = createExportWrapper('_evalBooleanProperty', 6);
  __evalStringArrayPropertyAndJoin = Module['__evalStringArrayPropertyAndJoin'] = createExportWrapper('_evalStringArrayPropertyAndJoin', 7);
  __assignStringProperty = Module['__assignStringProperty'] = createExportWrapper('_assignStringProperty', 7);
  __assignIntegerProperty = Module['__assignIntegerProperty'] = createExportWrapper('_assignIntegerProperty', 7);
  __assignBooleanProperty = Module['__assignBooleanProperty'] = createExportWrapper('_assignBooleanProperty', 7);
  _compareRollerOptions = Module['_compareRollerOptions'] = createExportWrapper('compareRollerOptions', 4);
  _emscripten_stack_get_end = wasmExports['emscripten_stack_get_end'];
  _emscripten_stack_get_base = wasmExports['emscripten_stack_get_base'];
  _emscripten_builtin_memalign = createExportWrapper('emscripten_builtin_memalign', 2);
  _strerror = createExportWrapper('strerror', 1);
  _setThrew = createExportWrapper('setThrew', 2);
  _emscripten_stack_init = wasmExports['emscripten_stack_init'];
  _emscripten_stack_get_free = wasmExports['emscripten_stack_get_free'];
  __emscripten_stack_restore = wasmExports['_emscripten_stack_restore'];
  __emscripten_stack_alloc = wasmExports['_emscripten_stack_alloc'];
  _emscripten_stack_get_current = wasmExports['emscripten_stack_get_current'];
  memory = wasmMemory = wasmExports['memory'];
  __indirect_function_table = wasmTable = wasmExports['__indirect_function_table'];
}

var wasmImports = {
  /** @export */
  __assert_fail: ___assert_fail,
  /** @export */
  __cxa_throw: ___cxa_throw,
  /** @export */
  __syscall_fcntl64: ___syscall_fcntl64,
  /** @export */
  __syscall_fstat64: ___syscall_fstat64,
  /** @export */
  __syscall_getdents64: ___syscall_getdents64,
  /** @export */
  __syscall_ioctl: ___syscall_ioctl,
  /** @export */
  __syscall_lstat64: ___syscall_lstat64,
  /** @export */
  __syscall_newfstatat: ___syscall_newfstatat,
  /** @export */
  __syscall_openat: ___syscall_openat,
  /** @export */
  __syscall_stat64: ___syscall_stat64,
  /** @export */
  _abort_js: __abort_js,
  /** @export */
  _emscripten_throw_longjmp: __emscripten_throw_longjmp,
  /** @export */
  _mmap_js: __mmap_js,
  /** @export */
  _munmap_js: __munmap_js,
  /** @export */
  clock_time_get: _clock_time_get,
  /** @export */
  emscripten_asm_const_int: _emscripten_asm_const_int,
  /** @export */
  emscripten_force_exit: _emscripten_force_exit,
  /** @export */
  emscripten_get_now: _emscripten_get_now,
  /** @export */
  emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */
  environ_get: _environ_get,
  /** @export */
  environ_sizes_get: _environ_sizes_get,
  /** @export */
  fd_close: _fd_close,
  /** @export */
  fd_read: _fd_read,
  /** @export */
  fd_seek: _fd_seek,
  /** @export */
  fd_write: _fd_write,
  /** @export */
  invoke_iii,
  /** @export */
  invoke_iiiii,
  /** @export */
  invoke_viiii
};

function invoke_viiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0) throw e;
    _setThrew(1, 0);
  }
}


// include: postamble.js
// === Auto-generated postamble setup entry stuff ===

var calledRun;

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
    dependenciesFulfilled = run;
    return;
  }

  stackCheckInit();

  preRun();

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    dependenciesFulfilled = run;
    return;
  }

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    assert(!calledRun);
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    Module['onRuntimeInitialized']?.();
    consumedModuleProp('onRuntimeInitialized');

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(() => {
      setTimeout(() => Module['setStatus'](''), 1);
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
    for (var name of ['stdout', 'stderr']) {
      var info = FS.analyzePath('/dev/' + name);
      if (!info) return;
      var stream = info.object;
      var rdev = stream.rdev;
      var tty = TTY.ttys[rdev];
      if (tty?.output?.length) {
        has = true;
      }
    }
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.');
  }
}

var wasmExports;

// With async instantation wasmExports is assigned asynchronously when the
// instance is received.
createWasm();

run();

// end include: postamble.js

// include: /home/mvladic/studio-wasm-libs/lvgl-runtime/v9.4.0/../common/post.js
}
// end include: /home/mvladic/studio-wasm-libs/lvgl-runtime/v9.4.0/../common/post.js

