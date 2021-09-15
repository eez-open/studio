{ version
, homepage
, downloadPage
, changelog
, maintainers
, platforms
}:
{ lib
, electron
, makeWrapper
, nix-filter
, nix-utils
, nodejs
, npmlock2nix
, stdenv
, symlinkJoin
, ...
}@pkgs:

let
  inherit (builtins)
    concatStringsSep
    map
  ;
  inherit (lib) importJSON;
  inherit (nix-utils) getPatches;
  inherit (npmlock2nix.internal) add_node_modules_to_cwd;
  inherit (nix-filter) inDirectory;
  inherit (import ./electron-lib.nix pkgs)
    electronBuilderUnpackedDirname
    getElectronExecutable
    symlinkElectron
  ;

  # Reading the files in the filtered directory is not possible right now.
  # Follow up on how https://github.com/NixOS/nix/pull/5163 will be resolved.
  src = ./..;
  packageJson = importJSON "${toString src}/package.json";
  pname = packageJson.name;
  mainProgram = pname;

  symlinkedElectron = symlinkElectron electron;

  nm = import ./node_modules.nix {
    inherit src nodejs;
    electron = symlinkedElectron;
  } pkgs;
in

stdenv.mkDerivation {
  inherit pname version;

  src = nix-filter {
    root = src;
    include = [
      "gulpfile.js"
      "icon.icns"
      "icon.ico"
      "package-lock.json"
      "package.json"
      "resources/expression-grammar.pegjs"
      "tsconfig.json"
      (inDirectory "installation")
      (inDirectory "libs")
      (inDirectory "packages")
    ];
    name = pname;
  };

  NO_UPDATE_NOTIFIER = 1;

  buildInputs = [ nm.out ];

  nativeBuildInputs = [
    makeWrapper.out
  ];

  patches = getPatches ./patches;

  # couldn't make it work with symlink. may be related to this
  # https://github.com/microsoft/TypeScript/issues/29518
  # although the error is different
  preConfigure = add_node_modules_to_cwd nm "copy";

  buildPhase =
    let
      extraResources = import ./extra-resources { inherit lib; };

      createSymlink = target: linkName: "ln -s ${target} ${linkName}";
      symlinkEach = files:
        let
          lines = map ({ filename, storePath }: createSymlink storePath filename) files;
        in
        concatStringsSep "\n" lines;
    in
    ''
      extraResourcesPath="installation/extra-resources"
      mkdir -p $extraResourcesPath
      pushd $extraResourcesPath
      ${symlinkEach extraResources}
      popd

      npm run build

      npx --no-install electron-builder \
        --config.electronVersion="${electron.version}" \
        --config.electronDist="${symlinkedElectron}/lib/electron" \
        --dir
    '';

  installPhase = ''
    mkdir -p $out/lib/${pname}
    resourcesDir=$out/lib/${pname}/resources

    mv ./dist/${electronBuilderUnpackedDirname}/resources $resourcesDir

    mkdir -p $out/bin
    makeWrapper '${getElectronExecutable electron}' "$out/bin/${mainProgram}" \
      --set ELECTRON_RESOURCES_PATH $resourcesDir \
      --add-flags "$resourcesDir/app.asar"
  '';

  meta = {
    description = packageJson.description;
    longDescription =
      "The EEZ Studio is an open source cross-platform modular visual tool" +
      "aimed to address various programming and management tasks for EEZ BB3" +
      "open source T&M chassis and EEZ H24005 programmable power supply and" +
      "other T&M devices that support SCPI from manufacturers such as" +
      "Keysight, Rigol, Siglent, etc.";

    inherit homepage downloadPage changelog;

    license = lib.licenses.gpl3Only;
    inherit maintainers mainProgram platforms;
  };
}
