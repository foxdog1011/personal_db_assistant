declare module "react-force-graph-2d" {
  import {
    ComponentType,
    MutableRefObject,
    RefObject
  } from "react";

  export interface ForceGraphProps<N = any, L = any> {
    ref?: MutableRefObject<any> | RefObject<any>;
    graphData: { nodes: N[]; links: L[] };
    enableNodeDrag?: boolean;
    backgroundColor?: string;
    nodeLabel?: (node: N) => string;
    nodeCanvasObject?: (
      node: N,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => void;
    linkColor?: (link: L) => string;
    linkDirectionalParticles?: number;
    linkDirectionalParticleSpeed?: () => number;
    onNodeHover?: (node?: N) => void;
    onNodeClick?: (node: N) => void;
    onNodeDoubleClick?: (node: N) => void;
  }

  const ForceGraph2D: ComponentType<ForceGraphProps>;
  export default ForceGraph2D;
}
