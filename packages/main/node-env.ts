// Must be imported first, before any library that checks NODE_ENV when loaded
// (e.g. mobx loads its production or development build). Same check as in
// home/index.html and service.html, which set it for the renderer processes.
const isDev = /[\\/]node_modules[\\/]electron[\\/]/.test(process.execPath);
process.env.NODE_ENV = isDev ? "development" : "production";

export {};
