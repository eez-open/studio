import WPAPI from "wpapi";
import { Server } from "./types";

export class WPClient {
    username = "mvladic";
    password = "txA79bc12";

    wp: WPAPI;

    constructor(private server: Server, password: string) {
        this.wp = new WPAPI({
            endpoint: this.server.address,
            username: this.server.username,
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

    async createPage(title: string, content: string, slug: string) {
        return new Promise<number>(resolve => {
            this.wp
                .pages()
                .create({
                    // "title" and "content" are the only required properties
                    title,
                    content,
                    slug
                })
                .then(function (page) {
                    resolve(page.id);
                });
        });
    }

    async updatePage(id: number, title: string, content: string, slug: string) {
        return new Promise<void>(resolve => {
            this.wp
                .pages()
                .id(id)
                .update({
                    title,
                    content,
                    slug
                })
                .then(function (response) {
                    resolve();
                });
        });
    }

    async createArticle(
        title: string,
        content: string,
        slug: string,
        category: number,
        status: string
    ) {
        return new Promise<number>(resolve => {
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
        return new Promise<void>(resolve => {
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
                });
        });
    }
}
