import { marked } from "marked";
import DOMPurify from "dompurify";

// Markdown can come from untrusted sources (project files, downloaded
// catalogs) and is rendered in a window with Node integration, so the HTML
// generated from it must be sanitized before it is inserted into the DOM.
export function markdownToSafeHtml(text: string) {
    const html = marked.parse(text, {
        mangle: false,
        headerIds: false
    }) as string;

    return DOMPurify.sanitize(html, {
        FORBID_TAGS: ["style", "form", "button", "textarea", "select"],
        FORBID_ATTR: ["formaction"]
    });
}

const SAFE_EXTERNAL_PROTOCOLS = ["http:", "https:", "mailto:"];

export function isSafeExternalUrl(url: string | undefined) {
    if (!url) {
        return false;
    }
    try {
        return SAFE_EXTERNAL_PROTOCOLS.includes(new URL(url).protocol);
    } catch (err) {
        return false;
    }
}
