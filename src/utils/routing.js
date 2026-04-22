
import { Graph } from "graphlib";

export const buildGraph = (nodes) => {
  const g = new Graph();
  nodes.forEach(n => g.setNode(n.id, n));
  nodes.forEach(n => {
    (n.connections || []).forEach(c => g.setEdge(n.id, c, 1));
  });
  return g;
};
