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
// include: /home/mvladic/studio-wasm-libs/eez-gui-lite-runtime/pre.js
module["exports"] = function (postWorkerToRendererMessage) {
    var Module = {};

    Module.postWorkerToRendererMessage = postWorkerToRendererMessage;

    Module.onRuntimeInitialized = function () {
        postWorkerToRendererMessage({ init: {} });
    }

    Module.print = function (args) {
        console.log("From eez-gui-lite-runtime:", args);
    };

    Module.printErr = function (args) {
        console.error("From eez-gui-lite-runtime:", args);
    };

    Module.locateFile = function (path, scriptDirectory) {
        if (scriptDirectory) return scriptDirectory + path;
        return __dirname + "/" + path;
    };

    runWasmModule(Module);

    return Module;
}

function runWasmModule(Module) {

// end include: /home/mvladic/studio-wasm-libs/eez-gui-lite-runtime/pre.js


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

  // No ATINITS hooks

  wasmExports['__wasm_call_ctors']();

  // No ATPOSTCTORS hooks
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

// show errors on likely calls to FS when it was not included
var FS = {
  error() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM');
  },
  init() { FS.error() },
  createDataFile() { FS.error() },
  createPreloadedFile() { FS.error() },
  createLazyFile() { FS.error() },
  open() { FS.error() },
  mkdev() { FS.error() },
  registerDevice() { FS.error() },
  analyzePath() { FS.error() },

  ErrnoError() { FS.error() },
};


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
  return locateFile('eez_gui_lite_runtime.wasm');
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

  

  var __abort_js = () =>
      abort('native code called abort()');

  var _emscripten_get_now = () => performance.now();

  var getHeapMax = () =>
      // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
      // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
      // for any code that deals with heap sizes, which would require special
      // casing all heap size related code to treat 0 specially.
      2147483648;
  
  var alignMemory = (size, alignment) => {
      assert(alignment, "alignment argument is required");
      return Math.ceil(size / alignment) * alignment;
    };
  
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
  var SYSCALLS = {
  varargs:undefined,
  getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
  };
  var _fd_close = (fd) => {
      abort('fd_close called without SYSCALLS_REQUIRE_FILESYSTEM');
    };

  var INT53_MAX = 9007199254740992;
  
  var INT53_MIN = -9007199254740992;
  var bigintToI53Checked = (num) => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);
  function _fd_seek(fd, offset, whence, newOffset) {
    offset = bigintToI53Checked(offset);
  
  
      return 70;
    ;
  }

  var printCharBuffers = [null,[],[]];
  
  var printChar = (stream, curr) => {
      var buffer = printCharBuffers[stream];
      assert(buffer);
      if (curr === 0 || curr === 10) {
        (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
        buffer.length = 0;
      } else {
        buffer.push(curr);
      }
    };
  
  var flush_NO_FILESYSTEM = () => {
      // flush anything remaining in the buffers during shutdown
      _fflush(0);
      if (printCharBuffers[1].length) printChar(1, 10);
      if (printCharBuffers[2].length) printChar(2, 10);
    };
  
  
  var _fd_write = (fd, iov, iovcnt, pnum) => {
      // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
      var num = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        for (var j = 0; j < len; j++) {
          printChar(fd, HEAPU8[ptr+j]);
        }
        num += len;
      }
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    };

  function _js_get_bool_prop(prop) {
          if (Module._jsGetBoolProp) {
              return Module._jsGetBoolProp(prop);
          }
          return 0; // false
      }

  function _js_get_int_prop(prop) {
          if (Module._jsGetIntProp) {
              return Module._jsGetIntProp(prop);
          }
          return 0;
      }

  function _js_get_str_prop(prop) {
          if (Module._jsGetStrProp) {
              return Module._jsGetStrProp(prop);
          }
          return 0; // NULL
      }

  function _js_on_event(widgetPtr, eventType) {
          if (Module._jsOnEvent) {
              Module._jsOnEvent(widgetPtr, eventType);
          }
      }

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
  var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
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

// End JS library code

// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.

{

  // Begin ATMODULES hooks
  if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];
if (Module['print']) out = Module['print'];
if (Module['printErr']) err = Module['printErr'];
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];

Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

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
  'zeroMemory',
  'exitJS',
  'withStackSave',
  'strError',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'readEmAsmArgs',
  'jstoi_q',
  'getExecutableName',
  'autoResumeAudioContext',
  'getDynCaller',
  'dynCall',
  'handleException',
  'keepRuntimeAlive',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'callUserCallback',
  'maybeExit',
  'asyncLoad',
  'asmjsMangle',
  'mmapAlloc',
  'HandleAllocator',
  'getUniqueRunDependency',
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
  'intArrayFromString',
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
  'maybeCStringToJsString',
  'findEventTarget',
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
  'getEnvStrings',
  'checkWasiClock',
  'wasiRightsToMuslOFlags',
  'wasiOFlagsToMuslOFlags',
  'initRandomFill',
  'randomFill',
  'safeSetTimeout',
  'setImmediateWrapped',
  'safeRequestAnimationFrame',
  'clearImmediateWrapped',
  'registerPostMainLoop',
  'registerPreMainLoop',
  'getPromise',
  'makePromise',
  'idsToPromises',
  'makePromiseCallback',
  'ExceptionInfo',
  'findMatchingCatch',
  'Browser_asyncPrepareDataCounter',
  'isLeapYear',
  'ydayFromDate',
  'arraySum',
  'addDays',
  'getSocketFromFD',
  'getSocketAddress',
  'FS_createPreloadedFile',
  'FS_preloadFile',
  'FS_modeStringToFlags',
  'FS_getMode',
  'FS_stdin_getChar',
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
  'getHeapMax',
  'growMemory',
  'ENV',
  'ERRNO_CODES',
  'DNS',
  'Protocols',
  'Sockets',
  'timers',
  'warnOnce',
  'readEmAsmArgsArray',
  'alignMemory',
  'wasmTable',
  'wasmMemory',
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
  'UTF16Decoder',
  'JSEvents',
  'specialHTMLTargets',
  'findCanvasEventTarget',
  'currentFullscreenStrategy',
  'restoreOldWindowedStyle',
  'UNWIND_CACHE',
  'ExitStatus',
  'flush_NO_FILESYSTEM',
  'emSetImmediate',
  'emClearImmediate_deps',
  'emClearImmediate',
  'promiseMap',
  'uncaughtExceptionCount',
  'exceptionLast',
  'exceptionCaught',
  'Browser',
  'requestFullscreen',
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
  'FS_stdin_getChar_buffer',
  'FS_unlink',
  'FS_createPath',
  'FS_createDevice',
  'FS_readFile',
  'FS',
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

// Imports from the Wasm binary.
var _mainLoop = Module['_mainLoop'] = makeInvalidEarlyAccess('_mainLoop');
var _initEezGuiLite = Module['_initEezGuiLite'] = makeInvalidEarlyAccess('_initEezGuiLite');
var _eezgui_set_state_buffer = Module['_eezgui_set_state_buffer'] = makeInvalidEarlyAccess('_eezgui_set_state_buffer');
var _getSyncedBuffer = Module['_getSyncedBuffer'] = makeInvalidEarlyAccess('_getSyncedBuffer');
var _setColors = Module['_setColors'] = makeInvalidEarlyAccess('_setColors');
var _eezgui_set_colors = Module['_eezgui_set_colors'] = makeInvalidEarlyAccess('_eezgui_set_colors');
var _setFonts = Module['_setFonts'] = makeInvalidEarlyAccess('_setFonts');
var _eezgui_set_fonts = Module['_eezgui_set_fonts'] = makeInvalidEarlyAccess('_eezgui_set_fonts');
var _setStyles = Module['_setStyles'] = makeInvalidEarlyAccess('_setStyles');
var _eezgui_set_styles = Module['_eezgui_set_styles'] = makeInvalidEarlyAccess('_eezgui_set_styles');
var _allocTextWidget = Module['_allocTextWidget'] = makeInvalidEarlyAccess('_allocTextWidget');
var _malloc = Module['_malloc'] = makeInvalidEarlyAccess('_malloc');
var _allocButtonWidget = Module['_allocButtonWidget'] = makeInvalidEarlyAccess('_allocButtonWidget');
var _allocRectangleWidget = Module['_allocRectangleWidget'] = makeInvalidEarlyAccess('_allocRectangleWidget');
var _allocSwitchWidget = Module['_allocSwitchWidget'] = makeInvalidEarlyAccess('_allocSwitchWidget');
var _allocSelectWidget = Module['_allocSelectWidget'] = makeInvalidEarlyAccess('_allocSelectWidget');
var _allocContainerWidget = Module['_allocContainerWidget'] = makeInvalidEarlyAccess('_allocContainerWidget');
var _freeWidget = Module['_freeWidget'] = makeInvalidEarlyAccess('_freeWidget');
var _free = Module['_free'] = makeInvalidEarlyAccess('_free');
var _setWidgetFlags = Module['_setWidgetFlags'] = makeInvalidEarlyAccess('_setWidgetFlags');
var _setWidgetGeometry = Module['_setWidgetGeometry'] = makeInvalidEarlyAccess('_setWidgetGeometry');
var _setWidgetStyle = Module['_setWidgetStyle'] = makeInvalidEarlyAccess('_setWidgetStyle');
var _setWidgetVisible = Module['_setWidgetVisible'] = makeInvalidEarlyAccess('_setWidgetVisible');
var _setTextWidgetText = Module['_setTextWidgetText'] = makeInvalidEarlyAccess('_setTextWidgetText');
var _setButtonWidgetText = Module['_setButtonWidgetText'] = makeInvalidEarlyAccess('_setButtonWidgetText');
var _setSwitchWidgetChecked = Module['_setSwitchWidgetChecked'] = makeInvalidEarlyAccess('_setSwitchWidgetChecked');
var _startPage = Module['_startPage'] = makeInvalidEarlyAccess('_startPage');
var _eezgui_start_page = Module['_eezgui_start_page'] = makeInvalidEarlyAccess('_eezgui_start_page');
var _endPage = Module['_endPage'] = makeInvalidEarlyAccess('_endPage');
var _eezgui_end_page = Module['_eezgui_end_page'] = makeInvalidEarlyAccess('_eezgui_end_page');
var _renderTextWidget = Module['_renderTextWidget'] = makeInvalidEarlyAccess('_renderTextWidget');
var _eezgui_text = Module['_eezgui_text'] = makeInvalidEarlyAccess('_eezgui_text');
var _renderButtonWidget = Module['_renderButtonWidget'] = makeInvalidEarlyAccess('_renderButtonWidget');
var _eezgui_button = Module['_eezgui_button'] = makeInvalidEarlyAccess('_eezgui_button');
var _renderRectangleWidget = Module['_renderRectangleWidget'] = makeInvalidEarlyAccess('_renderRectangleWidget');
var _eezgui_rectangle = Module['_eezgui_rectangle'] = makeInvalidEarlyAccess('_eezgui_rectangle');
var _renderSwitchWidget = Module['_renderSwitchWidget'] = makeInvalidEarlyAccess('_renderSwitchWidget');
var _eezgui_switch = Module['_eezgui_switch'] = makeInvalidEarlyAccess('_eezgui_switch');
var _renderSelectBegin = Module['_renderSelectBegin'] = makeInvalidEarlyAccess('_renderSelectBegin');
var _eezgui_select_begin = Module['_eezgui_select_begin'] = makeInvalidEarlyAccess('_eezgui_select_begin');
var _renderSelectEnd = Module['_renderSelectEnd'] = makeInvalidEarlyAccess('_renderSelectEnd');
var _eezgui_select_end = Module['_eezgui_select_end'] = makeInvalidEarlyAccess('_eezgui_select_end');
var _renderContainerBegin = Module['_renderContainerBegin'] = makeInvalidEarlyAccess('_renderContainerBegin');
var _eezgui_container_begin = Module['_eezgui_container_begin'] = makeInvalidEarlyAccess('_eezgui_container_begin');
var _renderContainerEnd = Module['_renderContainerEnd'] = makeInvalidEarlyAccess('_renderContainerEnd');
var _eezgui_container_end = Module['_eezgui_container_end'] = makeInvalidEarlyAccess('_eezgui_container_end');
var _pointerInput = Module['_pointerInput'] = makeInvalidEarlyAccess('_pointerInput');
var _eezgui_pointer_input = Module['_eezgui_pointer_input'] = makeInvalidEarlyAccess('_eezgui_pointer_input');
var _requestRefresh = Module['_requestRefresh'] = makeInvalidEarlyAccess('_requestRefresh');
var _eezgui_refresh = Module['_eezgui_refresh'] = makeInvalidEarlyAccess('_eezgui_refresh');
var _sizeofStyle = Module['_sizeofStyle'] = makeInvalidEarlyAccess('_sizeofStyle');
var _sizeofColor = Module['_sizeofColor'] = makeInvalidEarlyAccess('_sizeofColor');
var _sizeofFontData = Module['_sizeofFontData'] = makeInvalidEarlyAccess('_sizeofFontData');
var _sizeofGlyphData = Module['_sizeofGlyphData'] = makeInvalidEarlyAccess('_sizeofGlyphData');
var _sizeofGlyphsGroup = Module['_sizeofGlyphsGroup'] = makeInvalidEarlyAccess('_sizeofGlyphsGroup');
var _sizeofTextWidget = Module['_sizeofTextWidget'] = makeInvalidEarlyAccess('_sizeofTextWidget');
var _sizeofButtonWidget = Module['_sizeofButtonWidget'] = makeInvalidEarlyAccess('_sizeofButtonWidget');
var _sizeofRectangleWidget = Module['_sizeofRectangleWidget'] = makeInvalidEarlyAccess('_sizeofRectangleWidget');
var _sizeofSwitchWidget = Module['_sizeofSwitchWidget'] = makeInvalidEarlyAccess('_sizeofSwitchWidget');
var _sizeofSelectWidget = Module['_sizeofSelectWidget'] = makeInvalidEarlyAccess('_sizeofSelectWidget');
var _sizeofContainerWidget = Module['_sizeofContainerWidget'] = makeInvalidEarlyAccess('_sizeofContainerWidget');
var _offsetofStyleFlags = Module['_offsetofStyleFlags'] = makeInvalidEarlyAccess('_offsetofStyleFlags');
var _offsetofStyleBgColor = Module['_offsetofStyleBgColor'] = makeInvalidEarlyAccess('_offsetofStyleBgColor');
var _offsetofStyleColor = Module['_offsetofStyleColor'] = makeInvalidEarlyAccess('_offsetofStyleColor');
var _offsetofStyleActiveBgColor = Module['_offsetofStyleActiveBgColor'] = makeInvalidEarlyAccess('_offsetofStyleActiveBgColor');
var _offsetofStyleActiveColor = Module['_offsetofStyleActiveColor'] = makeInvalidEarlyAccess('_offsetofStyleActiveColor');
var _offsetofStyleBorderSizeTop = Module['_offsetofStyleBorderSizeTop'] = makeInvalidEarlyAccess('_offsetofStyleBorderSizeTop');
var _offsetofStyleBorderSizeRight = Module['_offsetofStyleBorderSizeRight'] = makeInvalidEarlyAccess('_offsetofStyleBorderSizeRight');
var _offsetofStyleBorderSizeBottom = Module['_offsetofStyleBorderSizeBottom'] = makeInvalidEarlyAccess('_offsetofStyleBorderSizeBottom');
var _offsetofStyleBorderSizeLeft = Module['_offsetofStyleBorderSizeLeft'] = makeInvalidEarlyAccess('_offsetofStyleBorderSizeLeft');
var _offsetofStyleBorderColor = Module['_offsetofStyleBorderColor'] = makeInvalidEarlyAccess('_offsetofStyleBorderColor');
var _offsetofStyleFont = Module['_offsetofStyleFont'] = makeInvalidEarlyAccess('_offsetofStyleFont');
var _offsetofStylePaddingTop = Module['_offsetofStylePaddingTop'] = makeInvalidEarlyAccess('_offsetofStylePaddingTop');
var _offsetofStylePaddingRight = Module['_offsetofStylePaddingRight'] = makeInvalidEarlyAccess('_offsetofStylePaddingRight');
var _offsetofStylePaddingBottom = Module['_offsetofStylePaddingBottom'] = makeInvalidEarlyAccess('_offsetofStylePaddingBottom');
var _offsetofStylePaddingLeft = Module['_offsetofStylePaddingLeft'] = makeInvalidEarlyAccess('_offsetofStylePaddingLeft');
var _offsetofGlyphDx = Module['_offsetofGlyphDx'] = makeInvalidEarlyAccess('_offsetofGlyphDx');
var _offsetofGlyphW = Module['_offsetofGlyphW'] = makeInvalidEarlyAccess('_offsetofGlyphW');
var _offsetofGlyphH = Module['_offsetofGlyphH'] = makeInvalidEarlyAccess('_offsetofGlyphH');
var _offsetofGlyphX = Module['_offsetofGlyphX'] = makeInvalidEarlyAccess('_offsetofGlyphX');
var _offsetofGlyphY = Module['_offsetofGlyphY'] = makeInvalidEarlyAccess('_offsetofGlyphY');
var _offsetofGlyphPixelsIndex = Module['_offsetofGlyphPixelsIndex'] = makeInvalidEarlyAccess('_offsetofGlyphPixelsIndex');
var _offsetofGroupEncoding = Module['_offsetofGroupEncoding'] = makeInvalidEarlyAccess('_offsetofGroupEncoding');
var _offsetofGroupGlyphIndex = Module['_offsetofGroupGlyphIndex'] = makeInvalidEarlyAccess('_offsetofGroupGlyphIndex');
var _offsetofGroupLength = Module['_offsetofGroupLength'] = makeInvalidEarlyAccess('_offsetofGroupLength');
var _offsetofFontAscent = Module['_offsetofFontAscent'] = makeInvalidEarlyAccess('_offsetofFontAscent');
var _offsetofFontDescent = Module['_offsetofFontDescent'] = makeInvalidEarlyAccess('_offsetofFontDescent');
var _offsetofFontEncodingStart = Module['_offsetofFontEncodingStart'] = makeInvalidEarlyAccess('_offsetofFontEncodingStart');
var _offsetofFontEncodingEnd = Module['_offsetofFontEncodingEnd'] = makeInvalidEarlyAccess('_offsetofFontEncodingEnd');
var _offsetofFontGroups = Module['_offsetofFontGroups'] = makeInvalidEarlyAccess('_offsetofFontGroups');
var _offsetofFontGlyphs = Module['_offsetofFontGlyphs'] = makeInvalidEarlyAccess('_offsetofFontGlyphs');
var _offsetofFontPixels = Module['_offsetofFontPixels'] = makeInvalidEarlyAccess('_offsetofFontPixels');
var _offsetofWidgetFlags = Module['_offsetofWidgetFlags'] = makeInvalidEarlyAccess('_offsetofWidgetFlags');
var _offsetofWidgetX = Module['_offsetofWidgetX'] = makeInvalidEarlyAccess('_offsetofWidgetX');
var _offsetofWidgetY = Module['_offsetofWidgetY'] = makeInvalidEarlyAccess('_offsetofWidgetY');
var _offsetofWidgetW = Module['_offsetofWidgetW'] = makeInvalidEarlyAccess('_offsetofWidgetW');
var _offsetofWidgetH = Module['_offsetofWidgetH'] = makeInvalidEarlyAccess('_offsetofWidgetH');
var _offsetofWidgetStyle = Module['_offsetofWidgetStyle'] = makeInvalidEarlyAccess('_offsetofWidgetStyle');
var _offsetofWidgetVisible = Module['_offsetofWidgetVisible'] = makeInvalidEarlyAccess('_offsetofWidgetVisible');
var _offsetofTextWidgetText = Module['_offsetofTextWidgetText'] = makeInvalidEarlyAccess('_offsetofTextWidgetText');
var _offsetofButtonWidgetText = Module['_offsetofButtonWidgetText'] = makeInvalidEarlyAccess('_offsetofButtonWidgetText');
var _offsetofSwitchWidgetChecked = Module['_offsetofSwitchWidgetChecked'] = makeInvalidEarlyAccess('_offsetofSwitchWidgetChecked');
var _getWidgetFlagClickable = Module['_getWidgetFlagClickable'] = makeInvalidEarlyAccess('_getWidgetFlagClickable');
var _getStyleFlagHorzAlignLeft = Module['_getStyleFlagHorzAlignLeft'] = makeInvalidEarlyAccess('_getStyleFlagHorzAlignLeft');
var _getStyleFlagHorzAlignRight = Module['_getStyleFlagHorzAlignRight'] = makeInvalidEarlyAccess('_getStyleFlagHorzAlignRight');
var _getStyleFlagHorzAlignCenter = Module['_getStyleFlagHorzAlignCenter'] = makeInvalidEarlyAccess('_getStyleFlagHorzAlignCenter');
var _getStyleFlagVertAlignTop = Module['_getStyleFlagVertAlignTop'] = makeInvalidEarlyAccess('_getStyleFlagVertAlignTop');
var _getStyleFlagVertAlignBottom = Module['_getStyleFlagVertAlignBottom'] = makeInvalidEarlyAccess('_getStyleFlagVertAlignBottom');
var _getStyleFlagVertAlignCenter = Module['_getStyleFlagVertAlignCenter'] = makeInvalidEarlyAccess('_getStyleFlagVertAlignCenter');
var _getStyleFlagBlink = Module['_getStyleFlagBlink'] = makeInvalidEarlyAccess('_getStyleFlagBlink');
var _makeColor = Module['_makeColor'] = makeInvalidEarlyAccess('_makeColor');
var _eezgui_alloc_from_state = Module['_eezgui_alloc_from_state'] = makeInvalidEarlyAccess('_eezgui_alloc_from_state');
var _String_format = Module['_String_format'] = makeInvalidEarlyAccess('_String_format');
var _Math_min = Module['_Math_min'] = makeInvalidEarlyAccess('_Math_min');
var _Math_max = Module['_Math_max'] = makeInvalidEarlyAccess('_Math_max');
var _System_getTick = Module['_System_getTick'] = makeInvalidEarlyAccess('_System_getTick');
var _eezgui_log = Module['_eezgui_log'] = makeInvalidEarlyAccess('_eezgui_log');
var _fflush = makeInvalidEarlyAccess('_fflush');
var _strerror = makeInvalidEarlyAccess('_strerror');
var _emscripten_stack_get_end = makeInvalidEarlyAccess('_emscripten_stack_get_end');
var _emscripten_stack_get_base = makeInvalidEarlyAccess('_emscripten_stack_get_base');
var _emscripten_stack_init = makeInvalidEarlyAccess('_emscripten_stack_init');
var _emscripten_stack_get_free = makeInvalidEarlyAccess('_emscripten_stack_get_free');
var __emscripten_stack_restore = makeInvalidEarlyAccess('__emscripten_stack_restore');
var __emscripten_stack_alloc = makeInvalidEarlyAccess('__emscripten_stack_alloc');
var _emscripten_stack_get_current = makeInvalidEarlyAccess('_emscripten_stack_get_current');
var memory = makeInvalidEarlyAccess('memory');
var __indirect_function_table = makeInvalidEarlyAccess('__indirect_function_table');
var wasmMemory = makeInvalidEarlyAccess('wasmMemory');

function assignWasmExports(wasmExports) {
  assert(typeof wasmExports['mainLoop'] != 'undefined', 'missing Wasm export: mainLoop');
  assert(typeof wasmExports['initEezGuiLite'] != 'undefined', 'missing Wasm export: initEezGuiLite');
  assert(typeof wasmExports['eezgui_set_state_buffer'] != 'undefined', 'missing Wasm export: eezgui_set_state_buffer');
  assert(typeof wasmExports['getSyncedBuffer'] != 'undefined', 'missing Wasm export: getSyncedBuffer');
  assert(typeof wasmExports['setColors'] != 'undefined', 'missing Wasm export: setColors');
  assert(typeof wasmExports['eezgui_set_colors'] != 'undefined', 'missing Wasm export: eezgui_set_colors');
  assert(typeof wasmExports['setFonts'] != 'undefined', 'missing Wasm export: setFonts');
  assert(typeof wasmExports['eezgui_set_fonts'] != 'undefined', 'missing Wasm export: eezgui_set_fonts');
  assert(typeof wasmExports['setStyles'] != 'undefined', 'missing Wasm export: setStyles');
  assert(typeof wasmExports['eezgui_set_styles'] != 'undefined', 'missing Wasm export: eezgui_set_styles');
  assert(typeof wasmExports['allocTextWidget'] != 'undefined', 'missing Wasm export: allocTextWidget');
  assert(typeof wasmExports['malloc'] != 'undefined', 'missing Wasm export: malloc');
  assert(typeof wasmExports['allocButtonWidget'] != 'undefined', 'missing Wasm export: allocButtonWidget');
  assert(typeof wasmExports['allocRectangleWidget'] != 'undefined', 'missing Wasm export: allocRectangleWidget');
  assert(typeof wasmExports['allocSwitchWidget'] != 'undefined', 'missing Wasm export: allocSwitchWidget');
  assert(typeof wasmExports['allocSelectWidget'] != 'undefined', 'missing Wasm export: allocSelectWidget');
  assert(typeof wasmExports['allocContainerWidget'] != 'undefined', 'missing Wasm export: allocContainerWidget');
  assert(typeof wasmExports['freeWidget'] != 'undefined', 'missing Wasm export: freeWidget');
  assert(typeof wasmExports['free'] != 'undefined', 'missing Wasm export: free');
  assert(typeof wasmExports['setWidgetFlags'] != 'undefined', 'missing Wasm export: setWidgetFlags');
  assert(typeof wasmExports['setWidgetGeometry'] != 'undefined', 'missing Wasm export: setWidgetGeometry');
  assert(typeof wasmExports['setWidgetStyle'] != 'undefined', 'missing Wasm export: setWidgetStyle');
  assert(typeof wasmExports['setWidgetVisible'] != 'undefined', 'missing Wasm export: setWidgetVisible');
  assert(typeof wasmExports['setTextWidgetText'] != 'undefined', 'missing Wasm export: setTextWidgetText');
  assert(typeof wasmExports['setButtonWidgetText'] != 'undefined', 'missing Wasm export: setButtonWidgetText');
  assert(typeof wasmExports['setSwitchWidgetChecked'] != 'undefined', 'missing Wasm export: setSwitchWidgetChecked');
  assert(typeof wasmExports['startPage'] != 'undefined', 'missing Wasm export: startPage');
  assert(typeof wasmExports['eezgui_start_page'] != 'undefined', 'missing Wasm export: eezgui_start_page');
  assert(typeof wasmExports['endPage'] != 'undefined', 'missing Wasm export: endPage');
  assert(typeof wasmExports['eezgui_end_page'] != 'undefined', 'missing Wasm export: eezgui_end_page');
  assert(typeof wasmExports['renderTextWidget'] != 'undefined', 'missing Wasm export: renderTextWidget');
  assert(typeof wasmExports['eezgui_text'] != 'undefined', 'missing Wasm export: eezgui_text');
  assert(typeof wasmExports['renderButtonWidget'] != 'undefined', 'missing Wasm export: renderButtonWidget');
  assert(typeof wasmExports['eezgui_button'] != 'undefined', 'missing Wasm export: eezgui_button');
  assert(typeof wasmExports['renderRectangleWidget'] != 'undefined', 'missing Wasm export: renderRectangleWidget');
  assert(typeof wasmExports['eezgui_rectangle'] != 'undefined', 'missing Wasm export: eezgui_rectangle');
  assert(typeof wasmExports['renderSwitchWidget'] != 'undefined', 'missing Wasm export: renderSwitchWidget');
  assert(typeof wasmExports['eezgui_switch'] != 'undefined', 'missing Wasm export: eezgui_switch');
  assert(typeof wasmExports['renderSelectBegin'] != 'undefined', 'missing Wasm export: renderSelectBegin');
  assert(typeof wasmExports['eezgui_select_begin'] != 'undefined', 'missing Wasm export: eezgui_select_begin');
  assert(typeof wasmExports['renderSelectEnd'] != 'undefined', 'missing Wasm export: renderSelectEnd');
  assert(typeof wasmExports['eezgui_select_end'] != 'undefined', 'missing Wasm export: eezgui_select_end');
  assert(typeof wasmExports['renderContainerBegin'] != 'undefined', 'missing Wasm export: renderContainerBegin');
  assert(typeof wasmExports['eezgui_container_begin'] != 'undefined', 'missing Wasm export: eezgui_container_begin');
  assert(typeof wasmExports['renderContainerEnd'] != 'undefined', 'missing Wasm export: renderContainerEnd');
  assert(typeof wasmExports['eezgui_container_end'] != 'undefined', 'missing Wasm export: eezgui_container_end');
  assert(typeof wasmExports['pointerInput'] != 'undefined', 'missing Wasm export: pointerInput');
  assert(typeof wasmExports['eezgui_pointer_input'] != 'undefined', 'missing Wasm export: eezgui_pointer_input');
  assert(typeof wasmExports['requestRefresh'] != 'undefined', 'missing Wasm export: requestRefresh');
  assert(typeof wasmExports['eezgui_refresh'] != 'undefined', 'missing Wasm export: eezgui_refresh');
  assert(typeof wasmExports['sizeofStyle'] != 'undefined', 'missing Wasm export: sizeofStyle');
  assert(typeof wasmExports['sizeofColor'] != 'undefined', 'missing Wasm export: sizeofColor');
  assert(typeof wasmExports['sizeofFontData'] != 'undefined', 'missing Wasm export: sizeofFontData');
  assert(typeof wasmExports['sizeofGlyphData'] != 'undefined', 'missing Wasm export: sizeofGlyphData');
  assert(typeof wasmExports['sizeofGlyphsGroup'] != 'undefined', 'missing Wasm export: sizeofGlyphsGroup');
  assert(typeof wasmExports['sizeofTextWidget'] != 'undefined', 'missing Wasm export: sizeofTextWidget');
  assert(typeof wasmExports['sizeofButtonWidget'] != 'undefined', 'missing Wasm export: sizeofButtonWidget');
  assert(typeof wasmExports['sizeofRectangleWidget'] != 'undefined', 'missing Wasm export: sizeofRectangleWidget');
  assert(typeof wasmExports['sizeofSwitchWidget'] != 'undefined', 'missing Wasm export: sizeofSwitchWidget');
  assert(typeof wasmExports['sizeofSelectWidget'] != 'undefined', 'missing Wasm export: sizeofSelectWidget');
  assert(typeof wasmExports['sizeofContainerWidget'] != 'undefined', 'missing Wasm export: sizeofContainerWidget');
  assert(typeof wasmExports['offsetofStyleFlags'] != 'undefined', 'missing Wasm export: offsetofStyleFlags');
  assert(typeof wasmExports['offsetofStyleBgColor'] != 'undefined', 'missing Wasm export: offsetofStyleBgColor');
  assert(typeof wasmExports['offsetofStyleColor'] != 'undefined', 'missing Wasm export: offsetofStyleColor');
  assert(typeof wasmExports['offsetofStyleActiveBgColor'] != 'undefined', 'missing Wasm export: offsetofStyleActiveBgColor');
  assert(typeof wasmExports['offsetofStyleActiveColor'] != 'undefined', 'missing Wasm export: offsetofStyleActiveColor');
  assert(typeof wasmExports['offsetofStyleBorderSizeTop'] != 'undefined', 'missing Wasm export: offsetofStyleBorderSizeTop');
  assert(typeof wasmExports['offsetofStyleBorderSizeRight'] != 'undefined', 'missing Wasm export: offsetofStyleBorderSizeRight');
  assert(typeof wasmExports['offsetofStyleBorderSizeBottom'] != 'undefined', 'missing Wasm export: offsetofStyleBorderSizeBottom');
  assert(typeof wasmExports['offsetofStyleBorderSizeLeft'] != 'undefined', 'missing Wasm export: offsetofStyleBorderSizeLeft');
  assert(typeof wasmExports['offsetofStyleBorderColor'] != 'undefined', 'missing Wasm export: offsetofStyleBorderColor');
  assert(typeof wasmExports['offsetofStyleFont'] != 'undefined', 'missing Wasm export: offsetofStyleFont');
  assert(typeof wasmExports['offsetofStylePaddingTop'] != 'undefined', 'missing Wasm export: offsetofStylePaddingTop');
  assert(typeof wasmExports['offsetofStylePaddingRight'] != 'undefined', 'missing Wasm export: offsetofStylePaddingRight');
  assert(typeof wasmExports['offsetofStylePaddingBottom'] != 'undefined', 'missing Wasm export: offsetofStylePaddingBottom');
  assert(typeof wasmExports['offsetofStylePaddingLeft'] != 'undefined', 'missing Wasm export: offsetofStylePaddingLeft');
  assert(typeof wasmExports['offsetofGlyphDx'] != 'undefined', 'missing Wasm export: offsetofGlyphDx');
  assert(typeof wasmExports['offsetofGlyphW'] != 'undefined', 'missing Wasm export: offsetofGlyphW');
  assert(typeof wasmExports['offsetofGlyphH'] != 'undefined', 'missing Wasm export: offsetofGlyphH');
  assert(typeof wasmExports['offsetofGlyphX'] != 'undefined', 'missing Wasm export: offsetofGlyphX');
  assert(typeof wasmExports['offsetofGlyphY'] != 'undefined', 'missing Wasm export: offsetofGlyphY');
  assert(typeof wasmExports['offsetofGlyphPixelsIndex'] != 'undefined', 'missing Wasm export: offsetofGlyphPixelsIndex');
  assert(typeof wasmExports['offsetofGroupEncoding'] != 'undefined', 'missing Wasm export: offsetofGroupEncoding');
  assert(typeof wasmExports['offsetofGroupGlyphIndex'] != 'undefined', 'missing Wasm export: offsetofGroupGlyphIndex');
  assert(typeof wasmExports['offsetofGroupLength'] != 'undefined', 'missing Wasm export: offsetofGroupLength');
  assert(typeof wasmExports['offsetofFontAscent'] != 'undefined', 'missing Wasm export: offsetofFontAscent');
  assert(typeof wasmExports['offsetofFontDescent'] != 'undefined', 'missing Wasm export: offsetofFontDescent');
  assert(typeof wasmExports['offsetofFontEncodingStart'] != 'undefined', 'missing Wasm export: offsetofFontEncodingStart');
  assert(typeof wasmExports['offsetofFontEncodingEnd'] != 'undefined', 'missing Wasm export: offsetofFontEncodingEnd');
  assert(typeof wasmExports['offsetofFontGroups'] != 'undefined', 'missing Wasm export: offsetofFontGroups');
  assert(typeof wasmExports['offsetofFontGlyphs'] != 'undefined', 'missing Wasm export: offsetofFontGlyphs');
  assert(typeof wasmExports['offsetofFontPixels'] != 'undefined', 'missing Wasm export: offsetofFontPixels');
  assert(typeof wasmExports['offsetofWidgetFlags'] != 'undefined', 'missing Wasm export: offsetofWidgetFlags');
  assert(typeof wasmExports['offsetofWidgetX'] != 'undefined', 'missing Wasm export: offsetofWidgetX');
  assert(typeof wasmExports['offsetofWidgetY'] != 'undefined', 'missing Wasm export: offsetofWidgetY');
  assert(typeof wasmExports['offsetofWidgetW'] != 'undefined', 'missing Wasm export: offsetofWidgetW');
  assert(typeof wasmExports['offsetofWidgetH'] != 'undefined', 'missing Wasm export: offsetofWidgetH');
  assert(typeof wasmExports['offsetofWidgetStyle'] != 'undefined', 'missing Wasm export: offsetofWidgetStyle');
  assert(typeof wasmExports['offsetofWidgetVisible'] != 'undefined', 'missing Wasm export: offsetofWidgetVisible');
  assert(typeof wasmExports['offsetofTextWidgetText'] != 'undefined', 'missing Wasm export: offsetofTextWidgetText');
  assert(typeof wasmExports['offsetofButtonWidgetText'] != 'undefined', 'missing Wasm export: offsetofButtonWidgetText');
  assert(typeof wasmExports['offsetofSwitchWidgetChecked'] != 'undefined', 'missing Wasm export: offsetofSwitchWidgetChecked');
  assert(typeof wasmExports['getWidgetFlagClickable'] != 'undefined', 'missing Wasm export: getWidgetFlagClickable');
  assert(typeof wasmExports['getStyleFlagHorzAlignLeft'] != 'undefined', 'missing Wasm export: getStyleFlagHorzAlignLeft');
  assert(typeof wasmExports['getStyleFlagHorzAlignRight'] != 'undefined', 'missing Wasm export: getStyleFlagHorzAlignRight');
  assert(typeof wasmExports['getStyleFlagHorzAlignCenter'] != 'undefined', 'missing Wasm export: getStyleFlagHorzAlignCenter');
  assert(typeof wasmExports['getStyleFlagVertAlignTop'] != 'undefined', 'missing Wasm export: getStyleFlagVertAlignTop');
  assert(typeof wasmExports['getStyleFlagVertAlignBottom'] != 'undefined', 'missing Wasm export: getStyleFlagVertAlignBottom');
  assert(typeof wasmExports['getStyleFlagVertAlignCenter'] != 'undefined', 'missing Wasm export: getStyleFlagVertAlignCenter');
  assert(typeof wasmExports['getStyleFlagBlink'] != 'undefined', 'missing Wasm export: getStyleFlagBlink');
  assert(typeof wasmExports['makeColor'] != 'undefined', 'missing Wasm export: makeColor');
  assert(typeof wasmExports['eezgui_alloc_from_state'] != 'undefined', 'missing Wasm export: eezgui_alloc_from_state');
  assert(typeof wasmExports['String_format'] != 'undefined', 'missing Wasm export: String_format');
  assert(typeof wasmExports['Math_min'] != 'undefined', 'missing Wasm export: Math_min');
  assert(typeof wasmExports['Math_max'] != 'undefined', 'missing Wasm export: Math_max');
  assert(typeof wasmExports['System_getTick'] != 'undefined', 'missing Wasm export: System_getTick');
  assert(typeof wasmExports['eezgui_log'] != 'undefined', 'missing Wasm export: eezgui_log');
  assert(typeof wasmExports['fflush'] != 'undefined', 'missing Wasm export: fflush');
  assert(typeof wasmExports['strerror'] != 'undefined', 'missing Wasm export: strerror');
  assert(typeof wasmExports['emscripten_stack_get_end'] != 'undefined', 'missing Wasm export: emscripten_stack_get_end');
  assert(typeof wasmExports['emscripten_stack_get_base'] != 'undefined', 'missing Wasm export: emscripten_stack_get_base');
  assert(typeof wasmExports['emscripten_stack_init'] != 'undefined', 'missing Wasm export: emscripten_stack_init');
  assert(typeof wasmExports['emscripten_stack_get_free'] != 'undefined', 'missing Wasm export: emscripten_stack_get_free');
  assert(typeof wasmExports['_emscripten_stack_restore'] != 'undefined', 'missing Wasm export: _emscripten_stack_restore');
  assert(typeof wasmExports['_emscripten_stack_alloc'] != 'undefined', 'missing Wasm export: _emscripten_stack_alloc');
  assert(typeof wasmExports['emscripten_stack_get_current'] != 'undefined', 'missing Wasm export: emscripten_stack_get_current');
  assert(typeof wasmExports['memory'] != 'undefined', 'missing Wasm export: memory');
  assert(typeof wasmExports['__indirect_function_table'] != 'undefined', 'missing Wasm export: __indirect_function_table');
  _mainLoop = Module['_mainLoop'] = createExportWrapper('mainLoop', 0);
  _initEezGuiLite = Module['_initEezGuiLite'] = createExportWrapper('initEezGuiLite', 2);
  _eezgui_set_state_buffer = Module['_eezgui_set_state_buffer'] = createExportWrapper('eezgui_set_state_buffer', 3);
  _getSyncedBuffer = Module['_getSyncedBuffer'] = createExportWrapper('getSyncedBuffer', 0);
  _setColors = Module['_setColors'] = createExportWrapper('setColors', 2);
  _eezgui_set_colors = Module['_eezgui_set_colors'] = createExportWrapper('eezgui_set_colors', 3);
  _setFonts = Module['_setFonts'] = createExportWrapper('setFonts', 2);
  _eezgui_set_fonts = Module['_eezgui_set_fonts'] = createExportWrapper('eezgui_set_fonts', 3);
  _setStyles = Module['_setStyles'] = createExportWrapper('setStyles', 2);
  _eezgui_set_styles = Module['_eezgui_set_styles'] = createExportWrapper('eezgui_set_styles', 3);
  _allocTextWidget = Module['_allocTextWidget'] = createExportWrapper('allocTextWidget', 0);
  _malloc = Module['_malloc'] = createExportWrapper('malloc', 1);
  _allocButtonWidget = Module['_allocButtonWidget'] = createExportWrapper('allocButtonWidget', 0);
  _allocRectangleWidget = Module['_allocRectangleWidget'] = createExportWrapper('allocRectangleWidget', 0);
  _allocSwitchWidget = Module['_allocSwitchWidget'] = createExportWrapper('allocSwitchWidget', 0);
  _allocSelectWidget = Module['_allocSelectWidget'] = createExportWrapper('allocSelectWidget', 0);
  _allocContainerWidget = Module['_allocContainerWidget'] = createExportWrapper('allocContainerWidget', 0);
  _freeWidget = Module['_freeWidget'] = createExportWrapper('freeWidget', 1);
  _free = Module['_free'] = createExportWrapper('free', 1);
  _setWidgetFlags = Module['_setWidgetFlags'] = createExportWrapper('setWidgetFlags', 2);
  _setWidgetGeometry = Module['_setWidgetGeometry'] = createExportWrapper('setWidgetGeometry', 5);
  _setWidgetStyle = Module['_setWidgetStyle'] = createExportWrapper('setWidgetStyle', 2);
  _setWidgetVisible = Module['_setWidgetVisible'] = createExportWrapper('setWidgetVisible', 2);
  _setTextWidgetText = Module['_setTextWidgetText'] = createExportWrapper('setTextWidgetText', 2);
  _setButtonWidgetText = Module['_setButtonWidgetText'] = createExportWrapper('setButtonWidgetText', 2);
  _setSwitchWidgetChecked = Module['_setSwitchWidgetChecked'] = createExportWrapper('setSwitchWidgetChecked', 2);
  _startPage = Module['_startPage'] = createExportWrapper('startPage', 2);
  _eezgui_start_page = Module['_eezgui_start_page'] = createExportWrapper('eezgui_start_page', 4);
  _endPage = Module['_endPage'] = createExportWrapper('endPage', 0);
  _eezgui_end_page = Module['_eezgui_end_page'] = createExportWrapper('eezgui_end_page', 1);
  _renderTextWidget = Module['_renderTextWidget'] = createExportWrapper('renderTextWidget', 1);
  _eezgui_text = Module['_eezgui_text'] = createExportWrapper('eezgui_text', 2);
  _renderButtonWidget = Module['_renderButtonWidget'] = createExportWrapper('renderButtonWidget', 1);
  _eezgui_button = Module['_eezgui_button'] = createExportWrapper('eezgui_button', 2);
  _renderRectangleWidget = Module['_renderRectangleWidget'] = createExportWrapper('renderRectangleWidget', 1);
  _eezgui_rectangle = Module['_eezgui_rectangle'] = createExportWrapper('eezgui_rectangle', 2);
  _renderSwitchWidget = Module['_renderSwitchWidget'] = createExportWrapper('renderSwitchWidget', 1);
  _eezgui_switch = Module['_eezgui_switch'] = createExportWrapper('eezgui_switch', 2);
  _renderSelectBegin = Module['_renderSelectBegin'] = createExportWrapper('renderSelectBegin', 1);
  _eezgui_select_begin = Module['_eezgui_select_begin'] = createExportWrapper('eezgui_select_begin', 2);
  _renderSelectEnd = Module['_renderSelectEnd'] = createExportWrapper('renderSelectEnd', 1);
  _eezgui_select_end = Module['_eezgui_select_end'] = createExportWrapper('eezgui_select_end', 2);
  _renderContainerBegin = Module['_renderContainerBegin'] = createExportWrapper('renderContainerBegin', 1);
  _eezgui_container_begin = Module['_eezgui_container_begin'] = createExportWrapper('eezgui_container_begin', 2);
  _renderContainerEnd = Module['_renderContainerEnd'] = createExportWrapper('renderContainerEnd', 1);
  _eezgui_container_end = Module['_eezgui_container_end'] = createExportWrapper('eezgui_container_end', 2);
  _pointerInput = Module['_pointerInput'] = createExportWrapper('pointerInput', 3);
  _eezgui_pointer_input = Module['_eezgui_pointer_input'] = createExportWrapper('eezgui_pointer_input', 4);
  _requestRefresh = Module['_requestRefresh'] = createExportWrapper('requestRefresh', 0);
  _eezgui_refresh = Module['_eezgui_refresh'] = createExportWrapper('eezgui_refresh', 1);
  _sizeofStyle = Module['_sizeofStyle'] = createExportWrapper('sizeofStyle', 0);
  _sizeofColor = Module['_sizeofColor'] = createExportWrapper('sizeofColor', 0);
  _sizeofFontData = Module['_sizeofFontData'] = createExportWrapper('sizeofFontData', 0);
  _sizeofGlyphData = Module['_sizeofGlyphData'] = createExportWrapper('sizeofGlyphData', 0);
  _sizeofGlyphsGroup = Module['_sizeofGlyphsGroup'] = createExportWrapper('sizeofGlyphsGroup', 0);
  _sizeofTextWidget = Module['_sizeofTextWidget'] = createExportWrapper('sizeofTextWidget', 0);
  _sizeofButtonWidget = Module['_sizeofButtonWidget'] = createExportWrapper('sizeofButtonWidget', 0);
  _sizeofRectangleWidget = Module['_sizeofRectangleWidget'] = createExportWrapper('sizeofRectangleWidget', 0);
  _sizeofSwitchWidget = Module['_sizeofSwitchWidget'] = createExportWrapper('sizeofSwitchWidget', 0);
  _sizeofSelectWidget = Module['_sizeofSelectWidget'] = createExportWrapper('sizeofSelectWidget', 0);
  _sizeofContainerWidget = Module['_sizeofContainerWidget'] = createExportWrapper('sizeofContainerWidget', 0);
  _offsetofStyleFlags = Module['_offsetofStyleFlags'] = createExportWrapper('offsetofStyleFlags', 0);
  _offsetofStyleBgColor = Module['_offsetofStyleBgColor'] = createExportWrapper('offsetofStyleBgColor', 0);
  _offsetofStyleColor = Module['_offsetofStyleColor'] = createExportWrapper('offsetofStyleColor', 0);
  _offsetofStyleActiveBgColor = Module['_offsetofStyleActiveBgColor'] = createExportWrapper('offsetofStyleActiveBgColor', 0);
  _offsetofStyleActiveColor = Module['_offsetofStyleActiveColor'] = createExportWrapper('offsetofStyleActiveColor', 0);
  _offsetofStyleBorderSizeTop = Module['_offsetofStyleBorderSizeTop'] = createExportWrapper('offsetofStyleBorderSizeTop', 0);
  _offsetofStyleBorderSizeRight = Module['_offsetofStyleBorderSizeRight'] = createExportWrapper('offsetofStyleBorderSizeRight', 0);
  _offsetofStyleBorderSizeBottom = Module['_offsetofStyleBorderSizeBottom'] = createExportWrapper('offsetofStyleBorderSizeBottom', 0);
  _offsetofStyleBorderSizeLeft = Module['_offsetofStyleBorderSizeLeft'] = createExportWrapper('offsetofStyleBorderSizeLeft', 0);
  _offsetofStyleBorderColor = Module['_offsetofStyleBorderColor'] = createExportWrapper('offsetofStyleBorderColor', 0);
  _offsetofStyleFont = Module['_offsetofStyleFont'] = createExportWrapper('offsetofStyleFont', 0);
  _offsetofStylePaddingTop = Module['_offsetofStylePaddingTop'] = createExportWrapper('offsetofStylePaddingTop', 0);
  _offsetofStylePaddingRight = Module['_offsetofStylePaddingRight'] = createExportWrapper('offsetofStylePaddingRight', 0);
  _offsetofStylePaddingBottom = Module['_offsetofStylePaddingBottom'] = createExportWrapper('offsetofStylePaddingBottom', 0);
  _offsetofStylePaddingLeft = Module['_offsetofStylePaddingLeft'] = createExportWrapper('offsetofStylePaddingLeft', 0);
  _offsetofGlyphDx = Module['_offsetofGlyphDx'] = createExportWrapper('offsetofGlyphDx', 0);
  _offsetofGlyphW = Module['_offsetofGlyphW'] = createExportWrapper('offsetofGlyphW', 0);
  _offsetofGlyphH = Module['_offsetofGlyphH'] = createExportWrapper('offsetofGlyphH', 0);
  _offsetofGlyphX = Module['_offsetofGlyphX'] = createExportWrapper('offsetofGlyphX', 0);
  _offsetofGlyphY = Module['_offsetofGlyphY'] = createExportWrapper('offsetofGlyphY', 0);
  _offsetofGlyphPixelsIndex = Module['_offsetofGlyphPixelsIndex'] = createExportWrapper('offsetofGlyphPixelsIndex', 0);
  _offsetofGroupEncoding = Module['_offsetofGroupEncoding'] = createExportWrapper('offsetofGroupEncoding', 0);
  _offsetofGroupGlyphIndex = Module['_offsetofGroupGlyphIndex'] = createExportWrapper('offsetofGroupGlyphIndex', 0);
  _offsetofGroupLength = Module['_offsetofGroupLength'] = createExportWrapper('offsetofGroupLength', 0);
  _offsetofFontAscent = Module['_offsetofFontAscent'] = createExportWrapper('offsetofFontAscent', 0);
  _offsetofFontDescent = Module['_offsetofFontDescent'] = createExportWrapper('offsetofFontDescent', 0);
  _offsetofFontEncodingStart = Module['_offsetofFontEncodingStart'] = createExportWrapper('offsetofFontEncodingStart', 0);
  _offsetofFontEncodingEnd = Module['_offsetofFontEncodingEnd'] = createExportWrapper('offsetofFontEncodingEnd', 0);
  _offsetofFontGroups = Module['_offsetofFontGroups'] = createExportWrapper('offsetofFontGroups', 0);
  _offsetofFontGlyphs = Module['_offsetofFontGlyphs'] = createExportWrapper('offsetofFontGlyphs', 0);
  _offsetofFontPixels = Module['_offsetofFontPixels'] = createExportWrapper('offsetofFontPixels', 0);
  _offsetofWidgetFlags = Module['_offsetofWidgetFlags'] = createExportWrapper('offsetofWidgetFlags', 0);
  _offsetofWidgetX = Module['_offsetofWidgetX'] = createExportWrapper('offsetofWidgetX', 0);
  _offsetofWidgetY = Module['_offsetofWidgetY'] = createExportWrapper('offsetofWidgetY', 0);
  _offsetofWidgetW = Module['_offsetofWidgetW'] = createExportWrapper('offsetofWidgetW', 0);
  _offsetofWidgetH = Module['_offsetofWidgetH'] = createExportWrapper('offsetofWidgetH', 0);
  _offsetofWidgetStyle = Module['_offsetofWidgetStyle'] = createExportWrapper('offsetofWidgetStyle', 0);
  _offsetofWidgetVisible = Module['_offsetofWidgetVisible'] = createExportWrapper('offsetofWidgetVisible', 0);
  _offsetofTextWidgetText = Module['_offsetofTextWidgetText'] = createExportWrapper('offsetofTextWidgetText', 0);
  _offsetofButtonWidgetText = Module['_offsetofButtonWidgetText'] = createExportWrapper('offsetofButtonWidgetText', 0);
  _offsetofSwitchWidgetChecked = Module['_offsetofSwitchWidgetChecked'] = createExportWrapper('offsetofSwitchWidgetChecked', 0);
  _getWidgetFlagClickable = Module['_getWidgetFlagClickable'] = createExportWrapper('getWidgetFlagClickable', 0);
  _getStyleFlagHorzAlignLeft = Module['_getStyleFlagHorzAlignLeft'] = createExportWrapper('getStyleFlagHorzAlignLeft', 0);
  _getStyleFlagHorzAlignRight = Module['_getStyleFlagHorzAlignRight'] = createExportWrapper('getStyleFlagHorzAlignRight', 0);
  _getStyleFlagHorzAlignCenter = Module['_getStyleFlagHorzAlignCenter'] = createExportWrapper('getStyleFlagHorzAlignCenter', 0);
  _getStyleFlagVertAlignTop = Module['_getStyleFlagVertAlignTop'] = createExportWrapper('getStyleFlagVertAlignTop', 0);
  _getStyleFlagVertAlignBottom = Module['_getStyleFlagVertAlignBottom'] = createExportWrapper('getStyleFlagVertAlignBottom', 0);
  _getStyleFlagVertAlignCenter = Module['_getStyleFlagVertAlignCenter'] = createExportWrapper('getStyleFlagVertAlignCenter', 0);
  _getStyleFlagBlink = Module['_getStyleFlagBlink'] = createExportWrapper('getStyleFlagBlink', 0);
  _makeColor = Module['_makeColor'] = createExportWrapper('makeColor', 3);
  _eezgui_alloc_from_state = Module['_eezgui_alloc_from_state'] = createExportWrapper('eezgui_alloc_from_state', 2);
  _String_format = Module['_String_format'] = createExportWrapper('String_format', 3);
  _Math_min = Module['_Math_min'] = createExportWrapper('Math_min', 2);
  _Math_max = Module['_Math_max'] = createExportWrapper('Math_max', 2);
  _System_getTick = Module['_System_getTick'] = createExportWrapper('System_getTick', 0);
  _eezgui_log = Module['_eezgui_log'] = createExportWrapper('eezgui_log', 5);
  _fflush = createExportWrapper('fflush', 1);
  _strerror = createExportWrapper('strerror', 1);
  _emscripten_stack_get_end = wasmExports['emscripten_stack_get_end'];
  _emscripten_stack_get_base = wasmExports['emscripten_stack_get_base'];
  _emscripten_stack_init = wasmExports['emscripten_stack_init'];
  _emscripten_stack_get_free = wasmExports['emscripten_stack_get_free'];
  __emscripten_stack_restore = wasmExports['_emscripten_stack_restore'];
  __emscripten_stack_alloc = wasmExports['_emscripten_stack_alloc'];
  _emscripten_stack_get_current = wasmExports['emscripten_stack_get_current'];
  memory = wasmMemory = wasmExports['memory'];
  __indirect_function_table = wasmExports['__indirect_function_table'];
}

var wasmImports = {
  /** @export */
  _abort_js: __abort_js,
  /** @export */
  emscripten_get_now: _emscripten_get_now,
  /** @export */
  emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */
  fd_close: _fd_close,
  /** @export */
  fd_seek: _fd_seek,
  /** @export */
  fd_write: _fd_write,
  /** @export */
  js_get_bool_prop: _js_get_bool_prop,
  /** @export */
  js_get_int_prop: _js_get_int_prop,
  /** @export */
  js_get_str_prop: _js_get_str_prop,
  /** @export */
  js_on_event: _js_on_event
};


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
    flush_NO_FILESYSTEM();
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -sFORCE_FILESYSTEM)');
  }
}

var wasmExports;

// With async instantation wasmExports is assigned asynchronously when the
// instance is received.
createWasm();

run();

// end include: postamble.js

// include: /home/mvladic/studio-wasm-libs/eez-gui-lite-runtime/post.js
}
// end include: /home/mvladic/studio-wasm-libs/eez-gui-lite-runtime/post.js

