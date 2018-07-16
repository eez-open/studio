Shared component: [chart.tsx](../src/shared/ui/chart.tsx)

Used in:

-   Waveform

    -   [Generic](../src/instrument/window/waveform/generic.tsx)
    -   [DLog](../src/instrument/window/waveform/generic.tsx)
    -   [Multi](../src/instrument/window/waveform/generic.tsx)

-   Lists

    -   [Envelope](../src/instrument/window/lists/envelope.tsx)
    -   [Table](../src/instrument/window/lists/table.tsx)

```mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
    click B "http://www.github.com" "This is a link"
```

```graphviz
digraph finite_state_machine {
    rankdir=LR;
    size="8,5"

    node [shape = doublecircle URL = "https://www.github.com"]; S;
    node [shape = point ]; qi

    node [shape = circle];
    qi -> S;
    S  -> q1 [ label = "a" ];
    S  -> S  [ label = "a" ];
    q1 -> S  [ label = "a" ];
    q1 -> q2 [ label = "ddb" ];
    q2 -> q1 [ label = "b" ];
    q2 -> q2 [ label = "b" ];
}
```
