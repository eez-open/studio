import { computed } from "mobx";

// A computed({ keepAlive: true }) value stays subscribed to every observable it
// has read, and MobX has no way to release it. That's fine for the objects of a
// project opened in a tab, they live exactly as long as its ProjectStore.
//
// But master and imported projects are loaded into the store of the project
// that uses them, and loaded again (as new objects) every time their file
// changes. Their computed values read observables of that store (selected
// theme, runtime, open projects, ...), so with keepAlive every discarded copy
// would stay in memory for as long as the store lives.

let loadingExternalProject = false;

export function setLoadingExternalProject(value: boolean) {
    loadingExternalProject = value;
}

// Use instead of computed({ keepAlive: true }) when making project objects
// observable (i.e. in their constructors).
export function keepAliveComputed() {
    return loadingExternalProject ? computed : computed({ keepAlive: true });
}
