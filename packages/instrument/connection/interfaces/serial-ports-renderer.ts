import { ipcRenderer } from "electron";

export async function getSerialPorts(): Promise<
    {
        path: string;
        manufacturer?: string;
        productId?: string;
        pnpId?: string;
    }[]
> {
    return await ipcRenderer.invoke("getSerialPorts");
}
