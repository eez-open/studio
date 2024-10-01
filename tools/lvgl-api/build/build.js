"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Build = void 0;
const TAB = "    ";
class Build {
    startBuild() {
        this.result = "";
        this.indentation = "";
    }
    indent() {
        this.indentation += TAB;
    }
    unindent() {
        this.indentation = this.indentation.substring(0, this.indentation.length - TAB.length);
    }
    line(line) {
        this.result += this.indentation + line + "\n";
    }
    text(text) {
        this.result += text;
    }
}
exports.Build = Build;
