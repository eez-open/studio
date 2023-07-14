import { argv } from "node:process";
import fs from "fs";
import path from "path";
import { WPClient } from "./wp-client";
import { Config } from "./types";

var sha256 = require("sha256");

let configFilePath;

// print process.argv
for (let i = 2; i < argv.length; ) {
    if (argv[i] === "--config") {
        configFilePath = argv[i + 1];
        i += 2;
    } else {
        i++;
    }
}

if (!configFilePath) {
    console.error("Missing --config parameter");
    console.error(`Windows PowerShell: $env:WP_PASSWORD="password"`);
    process.exit(1);
}

const password = process.env.WP_PASSWORD;
if (!password) {
    console.log("Missing WP_PASSWORD environment variable");
    process.exit(1);
}

(async () => {
    let configFile = await fs.promises.readFile(configFilePath, "utf8");
    let config: Config = JSON.parse(configFile);

    const wpClient = new WPClient(config.server, password);

    for (const key in config.toc) {
        for (let group of config.toc[key]) {
            for (let article of group.articles) {
                const content = await fs.promises.readFile(
                    __dirname +
                        "/" +
                        path.dirname(configFilePath) +
                        "/" +
                        config.filePathBase +
                        article.content,
                    "utf8"
                );

                const title = path.basename(article.content, ".html");

                const slug =
                    key +
                    "-" +
                    group.category.name.toLowerCase() +
                    "-" +
                    title.toLowerCase().replace(/ /g, "-");

                const postsha256 = sha256(
                    content + title + slug + article.status
                );

                if (!article.id) {
                    console.log(`Creating: ${title}`);
                    try {
                        const id = await wpClient.createArticle(
                            title,
                            content,
                            slug,
                            group.category.id,
                            article.status
                        );
                        article.id = id;
                        article.sha256 = postsha256;
                    } catch (err) {
                        console.error(err);
                    }
                } else {
                    if (article.sha256 !== postsha256) {
                        try {
                            console.log(`Updating: ${title}`);
                            await wpClient.updateArticle(
                                article.id,
                                title,
                                content,
                                slug,
                                group.category.id,
                                article.status
                            );
                            article.sha256 = postsha256;
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
            }
        }
    }

    await fs.promises.writeFile(
        configFilePath,
        JSON.stringify(config, null, 4),
        "utf-8"
    );
})();
