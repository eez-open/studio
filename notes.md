# CSS

## Flexbox

```
parent {
    display: flex;
    flex-direction: row|column;
    flex-wrap: nowrap;

    /* if row then defines horizontal alignment */
    justify-content: flex-start|flex-end|center|space-between|space-around;

    /* if row then defines vertical alignment and vertical stretch */
    align-items: flex-start|flex-end|center|baseline|stretch;
}

child {
    flex: <grow> <shrink> auto;

    /* override align-items from parent */
    align-self: auto | flex-start|flex-end|center|baseline|stretch
}
```

# TypeScript

## Index types

*   keyof T
*   T[K]

```
interface Person {
    name: string;
    age: number;
}

let personProps: keyof Person; // 'name' | 'age'
let name: Person['name']; // string
```

```
function getProperty<T, K extends keyof T>(o: T, name: K): T[K] {
    return o[name]; // o[name] is of type T[K]
}

let name: string = getProperty(person, 'name');
let age: number = getProperty(person, 'age');
let unknown = getProperty(person, 'unknown'); // error, 'unknown' is not in 'name' | 'age'
```

# REACT

## Framgent

How to return 2 div's?

    <div>bla</div>
    <div>bla</div>

This way:

    <React.Fragment>
        <div>bla</div>
        <div>bla</div>
    </React.Fragment>
