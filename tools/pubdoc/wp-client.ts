import fs from "fs";
import path from "path";
import WPAPI from "wpapi";

import { Server } from "./types";

export class WPClient {
    username = "mvladic";
    password = "txA79bc12";

    wp: WPAPI;

    constructor(private server: Server, username: string, password: string) {
        this.wp = new WPAPI({
            endpoint: this.server.address,
            username: username,
            password: password
        });

        // this.wp.categories().then(result => console.log(result));

        this.wp.epkb_post_type_2 = this.wp.registerRoute(
            "wp/v2",
            "/epkb_post_type_2/(?P<id>)"
        );

        //this.wp.epkb_post_type_2().then((result: any) => console.log(result));

        // this.wp
        //     .epkb_post_type_2()
        //     .id(354614)
        //     .then((result: any) => console.log(result));
    }

    async createArticle(
        title: string,
        content: string,
        slug: string,
        category: number,
        status: string
    ) {
        return new Promise<number>((resolve, reject) => {
            this.wp
                .epkb_post_type_2()
                .create({
                    // "title" and "content" are the only required properties
                    title,
                    content,
                    slug,
                    epkb_post_type_2_category: [category],
                    status
                })
                .then((post: any) => {
                    resolve(post.id);
                })
                .catch((err: any) => {
                    reject(err.message);
                });
        });
    }

    async updateArticle(
        id: number,
        title: string,
        content: string,
        slug: string,
        category: number,
        status: string
    ) {
        return new Promise<void>((resolve, reject) => {
            this.wp
                .epkb_post_type_2()
                .id(id)
                .update({
                    title,
                    content,
                    slug,
                    epkb_post_type_2_category: [category],
                    status
                })
                .then((post: any) => {
                    resolve();
                })
                .catch((err: any) => {
                    reject(err.message);
                });
        });
    }

    async uploadImage(
        imageFile: string,
        imageContent_sha256: string,
        title: string,
        alt_text: string,
        caption: string,
        description: string
    ) {
        const tempFile = `${imageContent_sha256}-${path.basename(imageFile)}`;

        await fs.promises.copyFile(imageFile, tempFile);

        return new Promise<{
            id: number;
            source_url: string;
        }>((resolve, reject) =>
            this.wp
                .media()
                // Specify a path to the file you want to upload, or a Buffer
                .file(tempFile)
                .create({
                    title,
                    alt_text,
                    caption,
                    description
                })
                .then(function (response) {
                    resolve({
                        id: response.id,
                        source_url: response.source_url
                    });
                })
                .catch(function (err) {
                    console.error("Failed to upload image: " + err.message);
                    console.dir(err);
                })
                .finally(async () => {
                    await fs.promises.unlink(tempFile);
                })
        );
    }

    async deleteImage(id: number) {
        return new Promise<void>((resolve, reject) =>
            this.wp
                .media()
                // Specify a path to the file you want to upload, or a Buffer
                .id(id)
                .delete({ force: true })
                .then(function (response) {
                    resolve();
                })
                .catch(function (err) {
                    reject(err.message);
                })
        );
    }
}
