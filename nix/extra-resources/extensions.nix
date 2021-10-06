{
  catalogPath,
  lib,
}:

let
  inherit (builtins)
    attrValues
    elem
    fetchurl
    filter
    head
    sort
  ;

  inherit (lib)
    forEach
    groupBy
    importJSON
    versionAtLeast
  ;

  catalog = importJSON catalogPath;

  extensionIdsToDownload = [
    "b278d8da-1c17-4baa-9837-1761b2481c2b"
    "687b6dee-2093-4c36-afb7-cfc7ea2bf262"
    "d0964223-a599-43f6-8aa2-4eb52f76a395"
  ];

  filteredCatalog = filter (e: elem e.id extensionIdsToDownload) catalog;
  filteredExtensionVersions = groupBy (e: e.id) filteredCatalog;
in
forEach (attrValues filteredExtensionVersions) (allExtensionVersions:
    let
      extension = head (sort (x: y: versionAtLeast x.version y.version) allExtensionVersions);
    in
    {
      filename = "${extension.name}-${extension.version}.zip";
      storePath = fetchurl { url = extension.download; inherit (extension) sha256; };
    }
  )
