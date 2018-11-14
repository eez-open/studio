interface INode {
    x: number;
    y: number;
    width: number;
    height: number;

    children: INode[];

    selected: boolean;
}

interface ILink {
    fromNode: INode;
    toNode: INode;
}

interface IGraph {
    nodes: INode[];
    links: ILink[];
}
