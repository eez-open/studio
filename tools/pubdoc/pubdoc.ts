import { argv } from "node:process";
import fs from "fs";
import path from "path";
import { WPClient } from "./wp-client";
import { Config } from "./types";

var sha256 = require("sha256");

let configFilePath;
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
    process.exit(1);
}

const username = process.env.WP_USERNAME;
if (!username) {
    console.log("Missing WP_USERNAME environment variable");
    console.error(`\tWindows PowerShell: $env:WP_USERNAME="username"`);
    console.error(`\tLinux: export WP_USERNAME=username`);
    process.exit(1);
}

const password = process.env.WP_PASSWORD;
if (!password) {
    console.log("Missing WP_PASSWORD environment variable");
    console.error(`\tWindows PowerShell: $env:WP_PASSWORD="password"`);
    console.error(`\tLinux: export WP_PASSWORD=password`);
    process.exit(1);
}

(async () => {
    let configFile = await fs.promises.readFile(configFilePath, "utf8");
    let config: Config = JSON.parse(configFile);

    const wpClient = new WPClient(config.server, username, password);

    let changed = false;

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
                        changed = true;
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
                            changed = true;
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
            }
        }
    }

    if (changed) {
        await fs.promises.writeFile(
            configFilePath,
            JSON.stringify(config, null, 4),
            "utf-8"
        );
    }
})();
