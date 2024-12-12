import { compress } from "project-editor/build/lz4";

export class DataBuffer {
    buffer = Buffer.alloc(32 * 1024 * 1024);

    currentOffset: number = 0;

    writeLaterObjectList: {
        currentOffset: number;
        callback: () => void;
        padding: number;
    }[] = [];

    futureArrayList: {
        currentOffset: number;
        callback: () => void;
    }[] = [];

    constructor(public utf8Support: boolean) {}

    writeInt8(value: number) {
        this.buffer.writeInt8(value, this.currentOffset);
        this.currentOffset += 1;
    }

    writeUint8(value: number) {
        try {
            this.buffer.writeUInt8(value, this.currentOffset);
        } catch (err) {
            console.error(err);
        }
        this.currentOffset += 1;
    }

    writeInt16(value: number) {
        if (this.currentOffset % 2) {
            throw "invalid offset 1";
        }
        this.buffer.writeInt16LE(value, this.currentOffset);
        this.currentOffset += 2;
    }

    writeUint16(value: number) {
        if (this.currentOffset % 2) {
            throw "invalid offset 2";
        }
        this.buffer.writeUInt16LE(value, this.currentOffset);
        this.currentOffset += 2;
    }

    writeUint16NonAligned(value: number) {
        this.buffer.writeUInt16LE(value, this.currentOffset);
        this.currentOffset += 2;
    }

    writeInt32(value: number) {
        if (this.currentOffset % 4) {
            throw "invalid offset 3";
        }
        this.buffer.writeInt32LE(value, this.currentOffset);
        this.currentOffset += 4;
    }

    writeUint32(value: number) {
        if (this.currentOffset % 4) {
            throw "invalid offset 4";
        }
        this.buffer.writeUInt32LE(value, this.currentOffset);
        this.currentOffset += 4;
    }

    writeUint64(value: number) {
        if (this.currentOffset % 8) {
            throw "invalid offset 5";
        }
        this.buffer.writeBigUInt64LE(BigInt(value), this.currentOffset);
        this.currentOffset += 8;
    }

    writeFloat(value: number) {
        if (this.currentOffset % 4) {
            throw "invalid offset 6";
        }
        this.buffer.writeFloatLE(value, this.currentOffset);
        this.currentOffset += 4;
    }

    writeDouble(value: number) {
        if (this.currentOffset % 8) {
            throw "invalid offset 7";
        }
        this.buffer.writeDoubleLE(value, this.currentOffset);
        this.currentOffset += 8;
    }

    writeUint8Array(array: Uint8Array | number[]) {
        if (this.currentOffset % 4) {
            throw "invalid offset 8";
        }
        this.buffer.set(array, this.currentOffset);
        this.currentOffset += array.length;
        this.addPadding();
    }

    writeString(str: string) {
        if (this.currentOffset % 4) {
            throw "invalid offset 9";
        }
        let buffer: Buffer;
        if (this.utf8Support) {
            buffer = Buffer.from(str, "utf8");
        } else {
            buffer = Buffer.from(str, "binary");
        }
        for (let i = 0; i < buffer.length; i++) {
            this.writeUint8(buffer[i]);
        }
        this.writeUint8(0);
        this.addPadding();
    }

    writeArray<T>(
        arr: T[],
        callback: (item: T, i: number) => void,
        padding: number = 4
    ) {
        if (this.currentOffset % 4) {
            throw "invalid offset 10";
        }
        if (arr.length > 0) {
            this.writeUint32(arr.length);
            this.writeObjectOffset(() => {
                for (let i = 0; i < arr.length; i++) {
                    this.writeObjectOffset(() => callback(arr[i], i), padding);
                }
            });
        } else {
            this.writeUint32(0);
            this.writeUint32(0);
        }
    }

    writeFutureArray(callback: () => void) {
        if (this.currentOffset % 4) {
            throw "invalid offset 11";
        }
        const currentOffset = this.currentOffset;
        this.writeUint32(0);
        this.writeUint32(0);
        this.futureArrayList.push({
            currentOffset,
            callback
        });
    }

    writeNumberArray<T>(arr: T[], callback: (item: T, i: number) => void) {
        if (this.currentOffset % 4) {
            throw "invalid offset 12";
        }
        if (arr.length > 0) {
            this.writeUint32(arr.length);
            this.writeObjectOffset(() => {
                for (let i = 0; i < arr.length; i++) {
                    callback(arr[i], i);
                }
            });
        } else {
            this.writeUint32(0);
            this.writeUint32(0);
        }
    }

    writeObjectOffset(callback: () => void, padding: number = 4) {
        if (this.currentOffset % 4) {
            throw "invalid offset 13";
        }
        const currentOffset = this.currentOffset;
        this.writeUint32(0);
        this.writeLaterObjectList.push({ currentOffset, callback, padding });
    }

    addPadding() {
        if (this.currentOffset % 4) {
            const n = 4 - (this.currentOffset % 4);
            for (let i = 0; i < n; ++i) {
                this.writeUint8(0);
            }
        }
    }

    addPadding8() {
        if (this.currentOffset % 8) {
            const n = 8 - (this.currentOffset % 8);
            for (let i = 0; i < n; ++i) {
                this.writeUint8(0);
            }
        }
    }

    get size() {
        return this.currentOffset;
    }

    finalizeObjectList() {
        for (let i = 0; i < this.writeLaterObjectList.length; i++) {
            const writeLater = this.writeLaterObjectList[i];

            if (writeLater.padding == 8) {
                this.addPadding8();
            }

            const currentOffset = this.currentOffset;

            writeLater.callback();

            if (writeLater.padding == 8) {
                this.addPadding8();
            } else {
                this.addPadding();
            }

            this.buffer.writeInt32LE(
                currentOffset - writeLater.currentOffset,
                writeLater.currentOffset
            );
        }

        this.writeLaterObjectList = [];
    }

    finalize() {
        this.addPadding();

        this.finalizeObjectList();

        let currentOffset = this.currentOffset;

        for (let i = 0; i < this.futureArrayList.length; i++) {
            this.currentOffset = this.futureArrayList[i].currentOffset;
            this.futureArrayList[i].callback();
        }

        this.currentOffset = currentOffset;

        this.finalizeObjectList();

        const buffer = Buffer.alloc(this.size);
        this.buffer.copy(buffer, 0, 0, this.size);
        this.buffer = buffer;
    }

    async compress(compressionLevel: number) {
        return compress(this.buffer, compressionLevel);
    }
}

export class DummyDataBuffer {
    buffer = Buffer.from(new Uint8Array());

    currentOffset = 0;

    writeLaterObjectList: {
        currentOffset: number;
        callback: () => void;
        padding: number;
    }[] = [];

    futureArrayList: {
        currentOffset: number;
        callback: () => void;
    }[] = [];

    constructor(public utf8Support: boolean) {}

    writeInt8(value: number) {}

    writeUint8(value: number) {}

    writeInt16(value: number) {}

    writeUint16(value: number) {}

    writeUint16NonAligned(value: number) {}

    writeInt32(value: number) {}

    writeUint32(value: number) {}

    writeUint64(value: number) {}

    writeFloat(value: number) {}

    writeDouble(value: number) {}

    writeFutureValue(callback: () => void) {
        callback();
    }

    writeUint8Array(array: Uint8Array | number[]) {}

    writeString(str: string) {}

    writeArray<T>(
        arr: T[],
        callback: (item: T, i: number) => void,
        padding: number = 4
    ) {
        if (arr.length > 0) {
            for (let i = 0; i < arr.length; i++) {
                callback(arr[i], i);
            }
        }
    }

    writeFutureArray(callback: () => void) {
        callback();
    }

    writeNumberArray<T>(arr: T[], callback: (item: T, i: number) => void) {
        arr.forEach((item, i) => callback(item, i));
    }

    writeObjectOffset(callback: () => void, padding: number = 4) {
        callback();
    }

    addPadding() {}

    addPadding8() {}

    finalizeObjectList() {}

    finalize() {}

    get size() {
        return 0;
    }

    async compress(compressionLevel: number) {
        return { compressedBuffer: this.buffer, compressedSize: 0 };
    }
}
