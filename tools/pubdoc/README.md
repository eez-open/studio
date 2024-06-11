-   set environment variables:

```
$env:WP_USERNAME="..."
$env:WP_PASSWORD="..."
```

-   update config/dev.json and config/prod.json

Add for each new html file:

```
    {
        "content": "<component name>.html",
        "status": "publish"
    }
```

-   execute:

```
cd tools/pubdoc/build
npm run pubdoc-dev
npm run pubdoc-prod
```
