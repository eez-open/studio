export class DataBuffer {
    buffer: Uint8Array;
    offset: number;

    constructor() {
        this.buffer = new Uint8Array(10 * 1024 * 1024);
        this.offset = 0;
    }

    packUInt8(value: number) {
        this.buffer[this.offset++] = value;
    }

    packInt8(value: number) {
        if (value < 0) {
            this.buffer[this.offset++] = 256 + value;
        } else {
            this.buffer[this.offset++] = value;
        }
    }

    packUInt16(value: number) {
        this.packUInt8(value & 0xff);
        this.packUInt8(value >> 8);
    }

    packInt16(value: number) {
        if (value < 0) {
            value = 65536 + value;
        }
        this.packUInt8(value & 0xff);
        this.packUInt8(value >> 8);
    }

    packUInt32(value: number) {
        this.packUInt8(value & 0xff);
        this.packUInt8((value >> 8) & 0xff);
        this.packUInt8((value >> 16) & 0xff);
        this.packUInt8(value >> 24);
    }

    packFloat(value: number) {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeFloatLE(value);
        this.packUInt8(buffer[0]);
        this.packUInt8(buffer[1]);
        this.packUInt8(buffer[2]);
        this.packUInt8(buffer[3]);
    }

    packUInt8AtOffset(offset: number, value: number) {
        this.buffer[offset] = value;
    }

    packUInt32AtOffset(offset: number, value: number) {
        this.packUInt8AtOffset(offset + 0, value & 0xff);
        this.packUInt8AtOffset(offset + 1, (value >> 8) & 0xff);
        this.packUInt8AtOffset(offset + 2, (value >> 16) & 0xff);
        this.packUInt8AtOffset(offset + 3, value >> 24);
    }

    packArray(array: Uint8Array | number[]) {
        this.buffer.set(array, this.offset);
        this.offset += array.length;
    }

    addPadding(dataLength: number, length: number) {
        if (length === 2) {
            if (dataLength % 2) {
                this.packUInt8(0);
            }
        } else if (length >= 4) {
            if (dataLength % 4) {
                const n = 4 - (dataLength % 4);
                for (let i = 0; i < n; ++i) {
                    this.packUInt8(0);
                }
            }
        }
    }

    async packRegions(
        numRegions: number,
        buildRegion: (i: number) => Promise<void>
    ) {
        const headerOffset = this.offset;

        for (let i = 0; i < numRegions; i++) {
            this.packUInt32(0);
        }

        const dataOffset = this.offset;

        for (let i = 0; i < numRegions; i++) {
            this.packUInt32AtOffset(
                headerOffset + i * 4,
                this.offset - headerOffset
            );
            await buildRegion(i);
            this.addPadding(this.offset - dataOffset, 4);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

abstract class Field {
    offset: number;
    size: number;

    enumObjects(objects: ObjectField[]) {}
    finish() {}
    abstract pack(dataBuffer: DataBuffer): void;
}

export abstract class ObjectField extends Field {
    objectSize: number;

    _objectOffset: number;

    get objectOffset() {
        return this._objectOffset;
    }

    set objectOffset(value: number) {
        this._objectOffset = value;
    }

    abstract packObject(dataBuffer: DataBuffer): void;
}

export class Struct extends ObjectField {
    fields: Field[] = [];

    constructor() {
        super();
        this.size = 4;
    }

    addField(field: Field) {
        this.fields.push(field);
    }

    enumObjects(objects: ObjectField[]) {
        this.fields.forEach(field => field.enumObjects(objects));
    }

    finish() {
        this.objectSize = this.fields.reduce((offset, field) => {
            if (field.size === 2) {
                if (offset % 2 === 1) {
                    offset += 1;
                }
            } else if (field.size >= 4) {
                if (offset % 4 > 0) {
                    offset += 4 - (offset % 4);
                }
            }

            field.offset = offset;

            return offset + field.size;
        }, 0);

        if (this.objectSize % 4 > 0) {
            this.objectSize += 4 - (this.objectSize % 4);
        }
    }

    pack(dataBuffer: DataBuffer) {
        return dataBuffer.packUInt32(this.objectOffset);
    }

    packObject(dataBuffer: DataBuffer) {
        const offsetAtStart = dataBuffer.offset;

        this.fields.forEach(field => {
            dataBuffer.addPadding(
                dataBuffer.offset - offsetAtStart,
                field.size
            );
            field.pack(dataBuffer);
        });

        dataBuffer.addPadding(dataBuffer.offset - offsetAtStart, 4);
    }
}

export class ObjectPtr extends Field {
    constructor(public value: ObjectField | undefined) {
        super();
        this.size = 4;
    }

    enumObjects(objects: ObjectField[]) {
        if (this.value) {
            objects.push(this.value);
        }
    }

    pack(dataBuffer: DataBuffer) {
        return dataBuffer.packUInt32(this.value ? this.value.objectOffset : 0);
    }
}

export class ObjectList extends Field {
    items: ObjectField[] = [];

    constructor() {
        super();
        this.size = 8;
    }

    addItem(item: ObjectField) {
        this.items.push(item);
    }

    enumObjects(objects: ObjectField[]) {
        this.items.forEach(item => objects.push(item));
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.items.length);
        dataBuffer.packUInt32(
            this.items.length > 0 ? this.items[0].objectOffset : 0
        );
    }
}

export class StringList extends Field {
    items: ObjectField[] = [];

    constructor() {
        super();
        this.size = 8;
    }

    addItem(item: ObjectField) {
        this.items.push(item);
        this.size += 4;
    }

    enumObjects(objects: ObjectField[]) {
        this.items.forEach(item => objects.push(item));
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.items.length);
        dataBuffer.packUInt32(8); // offset of the first string
        this.items.forEach(item => dataBuffer.packUInt32(item.objectOffset));
    }
}

export class String extends ObjectField {
    constructor(public value: string) {
        super();
        this.size = 4;

        this.objectSize = this.value.length + 1;
        if (this.objectSize % 4 > 0) {
            this.objectSize += 4 - (this.objectSize % 4);
        }
    }

    enumObjects(objects: ObjectField[]) {
        objects.push(this);
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.objectOffset);
    }

    packObject(dataBuffer: DataBuffer) {
        const offsetAtStart = dataBuffer.offset;

        for (let i = 0; i < this.value.length; i++) {
            dataBuffer.packUInt8(this.value.charCodeAt(i));
        }
        dataBuffer.packUInt8(0);

        dataBuffer.addPadding(dataBuffer.offset - offsetAtStart, 4);
    }
}

export class Color extends ObjectField {
    constructor(public value: number) {
        super();
        this.value = value;
        this.objectSize = 2;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.objectOffset);
    }

    packObject(dataBuffer: DataBuffer) {
        dataBuffer.packUInt16(this.value);
    }
}

export class StructRef extends ObjectField {
    constructor(public value: Struct) {
        super();
        this.value = value;
        this.objectSize = 4;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.objectOffset);
    }

    packObject(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.value.objectOffset);
    }
}

export class UInt8 extends Field {
    constructor(public value: number) {
        super();
        this.size = 1;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt8(this.value);
    }
}

export class UInt16 extends Field {
    constructor(public value: number) {
        super();
        this.size = 2;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt16(this.value);
    }
}

export class UInt32 extends Field {
    constructor(public value: number) {
        super();
        this.size = 4;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.value);
    }
}

export class Int16 extends Field {
    constructor(public value: number) {
        super();
        this.size = 2;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packInt16(this.value);
    }
}

export class Float extends Field {
    constructor(public value: number) {
        super();
        this.size = 4;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packFloat(this.value);
    }
}

export class UInt8ArrayField extends Field {
    constructor(public value: Uint8Array) {
        super();
        this.size = value.length;
        if (this.size % 4 > 0) {
            this.size += 4 - (this.size % 4);
        }
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packArray(this.value);
        dataBuffer.addPadding(this.value.length, 4);
    }
}

////////////////////////////////////////////////////////////////////////////////

export function pack(dataBuffer: DataBuffer, objects: ObjectField[] = []) {
    objects.forEach(object => object.packObject(dataBuffer));
}

export function buildListData(
    build: (document: Struct) => void,
    dataBuffer: DataBuffer | null
) {
    function finish() {
        let objects: ObjectField[] = [];
        let newObjects: ObjectField[] = [document];
        while (newObjects.length > 0) {
            objects = objects.concat(newObjects);
            let temp: ObjectField[] = [];
            newObjects.forEach(object => object.enumObjects(temp));
            newObjects = temp.filter(object => objects.indexOf(object) == -1);
        }

        objects.forEach(object => object.finish());

        let objectOffset = 0;
        objects.forEach(object => {
            object.objectOffset = objectOffset;
            objectOffset += object.objectSize;
        });

        return objects;
    }

    let document = new Struct();

    build(document);

    if (dataBuffer) {
        let objects = finish();
        pack(dataBuffer, objects);
    }

    return [];
}
