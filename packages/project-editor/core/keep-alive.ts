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
//
// The same goes for objects made outside of a project, e.g. the state styles of
// an assets build: the page editor builds the assets of the page again after
// every change, so with keepAlive the state styles of every build would stay.

let loadingExternalProject = false;
let creatingTemporaryObject = false;

export function setLoadingExternalProject(value: boolean) {
    loadingExternalProject = value;
}

// Use to create an object that isn't a part of a project (and is dropped after
// it is used), so its computed values aren't kept alive.
export function createTemporaryObject<T>(create: () => T): T {
    const saved = creatingTemporaryObject;
    creatingTemporaryObject = true;
    try {
        return create();
    } finally {
        creatingTemporaryObject = saved;
    }
}

// Use instead of computed({ keepAlive: true }) when making project objects
// observable (i.e. in their constructors).
export function keepAliveComputed() {
    return loadingExternalProject || creatingTemporaryObject
        ? computed
        : computed({ keepAlive: true });
}
