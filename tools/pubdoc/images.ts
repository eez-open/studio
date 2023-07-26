import fs from "fs";
var sha256 = require("sha256");

import { WPClient } from "./wp-client";
import { Config } from "./types";

export async function updateImages(
    config: Config,
    wpClient: WPClient,
    saveChanges: () => Promise<void>
) {
    const imagesFolderPath = config.filePathBase + "/images";

    const imageFileNames = await fs.promises.readdir(imagesFolderPath);
    for (const fileName of imageFileNames) {
        if (config.images.find(image => image.fileName == fileName)) {
            continue;
        }
        config.images.push({ fileName });
    }

    let errorOccurred = false;

    for (const image of config.images) {
        try {
            const imageFilePath = imagesFolderPath + "/" + image.fileName;

            const imageFileContent = await fs.promises.readFile(
                imagesFolderPath + "/" + image.fileName
            );

            const sha256Hash = sha256(imageFileContent);

            if (image.id != undefined) {
                if (image.sha256 == sha256Hash) {
                    continue;
                }

                await wpClient.deleteImage(image.id);

                console.log("Updating existing image: " + image.fileName);
            } else {
                console.log("Uploading new image: " + image.fileName);
            }

            const result = await wpClient.uploadImage(
                imageFilePath,
                sha256Hash,
                image.fileName,
                image.fileName,
                image.fileName,
                image.fileName
            );

            image.id = result.id;
            image.source_url = result.source_url;
            image.sha256 = sha256Hash;

            await saveChanges();
        } catch (err) {
            console.error(
                `Failed to upload image "${image.fileName}": ${err.message}`
            );
            errorOccurred = true;
            break;
        }
    }

    return {
        errorOccurred
    };
}
