{
  lib,
}:

let
  inherit (builtins) fetchurl;

  catalogJson = {
    filename = "catalog.json";
    storePath = fetchurl {
      url = "https://github.com/eez-open/studio-extensions/raw/master/build/catalog.json";
      sha256 = "1lw72wjgrzhgwnyv2bac9nilsx2678v5cmyz86xd1affrpcmsk3f";
    };
  };

  catalogPath = catalogJson.storePath;
  extensions = import ./extensions.nix { inherit catalogPath lib; };
in
[
  catalogJson
  {
    filename = "catalog-version.json";
    storePath = fetchurl {
      url = "https://github.com/eez-open/studio-extensions/raw/master/build/catalog-version.json";
      sha256 = "1h3y933qkxhw3c7yr534d2mcjf8255d7gzcpdl4ziy0kzr6jzmxd";
    };
  }
  {
    filename = "catalog.zip";
    storePath = fetchurl {
      url = "https://github.com/eez-open/studio-extensions/raw/master/build/catalog.zip";
      sha256 = "18bx0pbcf0408gqpl36g7130v7hs4h60ajg8ysf6xmdcm1sv7mrw";
    };
  }
] ++ extensions
