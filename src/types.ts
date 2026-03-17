export interface LayoutSettings {
  radiusMultiplier: number;
  angleSpread: number;
  rotation: number;
  linkStyle: 'curved' | 'straight';
}

export interface YogaPose {
  id: string;
  name: string;
  title?: string; // Optional title for the sequence (usually on root)
  description: string;
  tips?: string[];
  priority?: number;
  duration?: number; // in minutes
  children?: YogaPose[];
  x?: number;
  y?: number;
  layoutSettings?: LayoutSettings;
}

export const updateNodeInTree = (root: YogaPose, id: string, updatedData: Partial<YogaPose>): YogaPose => {
  if (root.id === id) {
    return { ...root, ...updatedData };
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map(child => updateNodeInTree(child, id, updatedData))
    };
  }
  return root;
};

export const addNodeToTree = (root: YogaPose, parentId: string, newNode: YogaPose): YogaPose => {
  if (root.id === parentId) {
    return {
      ...root,
      children: [...(root.children || []), newNode]
    };
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map(child => addNodeToTree(child, parentId, newNode))
    };
  }
  return root;
};

export const findNodeById = (root: YogaPose, id: string): YogaPose | null => {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
};

export const deleteNodeFromTree = (root: YogaPose, id: string): YogaPose | null => {
  if (root.id === id) return null;
  if (root.children) {
    return {
      ...root,
      children: root.children
        .map(child => deleteNodeFromTree(child, id))
        .filter((child): child is YogaPose => child !== null)
    };
  }
  return root;
};

export const moveNodeInTree = (root: YogaPose, id: string, targetParentId: string, targetIndex: number): YogaPose => {
  const nodeToMove = findNodeById(root, id);
  if (!nodeToMove) return root;

  // Remove from current position
  const rootWithoutNode = deleteNodeFromTree(root, id);
  if (!rootWithoutNode) return root;

  // Insert into new position
  const insertIntoParent = (node: YogaPose): YogaPose => {
    if (node.id === targetParentId) {
      const children = [...(node.children || [])];
      children.splice(targetIndex, 0, nodeToMove);
      return { ...node, children };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(insertIntoParent)
      };
    }
    return node;
  };

  return insertIntoParent(rootWithoutNode);
};

export const formatTime = (minutes: number) => {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getSequenceStats = (node: YogaPose) => {
  let duration = 0;
  let count = 0;
  
  const traverse = (n: YogaPose) => {
    if (!n.children || n.children.length === 0) {
      duration += n.duration || 0;
      count += 1;
    } else {
      n.children.forEach(traverse);
    }
  };
  
  traverse(node);
  return { duration, count };
};
