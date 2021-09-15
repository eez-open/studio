{ lib
, stdenv
, symlinkJoin
, system
, ...
}:

{
  # Pass electron-builder symlinks to avoid unnecessary copies
  # Originally seen in https://github.com/NixOS/nixpkgs/pull/86169
  symlinkElectron = electron: symlinkJoin {
    name = "symlinked-electron";
    paths = [ electron.out ];
    passthru = { inherit (electron) version headers; };
  };

  getElectronExecutable = electron:
    if stdenv.isDarwin then
      "${electron}/Applications/Electron.app/Contents/MacOS/Electron"
    else
      "${electron}/bin/electron"
    ;

  electronBuilderUnpackedDirname = {
    aarch64-darwin = "mac"; # just a guess, unchecked
    aarch64-linux = "linux-arm64-unpacked";
    i686-linux = "linux-ia32-unpacked";
    x86_64-darwin = "mac";
    x86_64-linux = "linux-unpacked";
    # armv7l-linux = "linux-armv7l-unpacked";
  }.${system};
}
