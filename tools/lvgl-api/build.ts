const TAB = "    ";

export class Build {
    result: string;
    indentation: string;

    startBuild() {
        this.result = "";
        this.indentation = "";
    }

    indent() {
        this.indentation += TAB;
    }

    unindent() {
        this.indentation = this.indentation.substring(
            0,
            this.indentation.length - TAB.length
        );
    }

    line(line: string) {
        this.result += this.indentation + line + "\n";
    }

    text(text: string) {
        this.result += text;
    }
}
