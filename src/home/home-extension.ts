import { IExtension } from "shared/extensions/extension";

import "home/store";

const homeExtension: IExtension = {
    id: "home",
    preInstalled: true,
    name: "Home",
    version: "0.1",
    author: "Envox",
    image: "",
    properties: {}
};

export default homeExtension;
