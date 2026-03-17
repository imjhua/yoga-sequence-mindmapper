import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'motion/react';
import { Settings2, RotateCcw, SlidersHorizontal, GitGraph, X, Target } from 'lucide-react';
import { YogaPose, LayoutSettings } from '../types';

interface MindMapProps {
  data: YogaPose;
  onEdit: (node: YogaPose) => void;
  onAdd: (parentId: string) => void;
  onDelete: (id: string) => void;
  onUpdatePriority: (id: string, priority: number) => void;
  onUpdatePositions: (updates: { id: string, x: number | undefined, y: number | undefined }[]) => void;
  onUpdateLayout: (settings: Partial<LayoutSettings>) => void;
  onUpdateField: (id: string, field: string, value: any) => void;
  isEditing: boolean;
  reparentingNodeId: string | null;
  onStartReparenting: (id: string | null) => void;
  onMoveNode: (nodeId: string, targetParentId: string) => void;
}

const MindMap: React.FC<MindMapProps> = ({ 
  data, onEdit, onAdd, onDelete, onUpdatePriority, onUpdatePositions, onUpdateLayout, onUpdateField, 
  isEditing, reparentingNodeId, onStartReparenting, onMoveNode 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialTransformApplied = useRef(false);
  const isEditingRef = useRef(isEditing);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const settings = data.layoutSettings || {
    radiusMultiplier: 1,
    angleSpread: 1,
    rotation: 0,
    linkStyle: 'curved'
  };

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Get current transform if it exists, otherwise use identity
    const currentTransform = d3.zoomTransform(svgRef.current);
    g.attr('transform', currentTransform.toString());

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .clickDistance(10)
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);
    svg.on('dblclick.zoom', null);

    const radius = (Math.min(width, height) / 2.2);
    const tree = d3.tree<YogaPose>()
      .size([2 * Math.PI * settings.angleSpread, radius])
      .separation((a, b) => (a.parent === b.parent ? 3 : 6));

    const root = d3.hierarchy(data);
    root.sort((a, b) => (a.data.priority || 0) - (b.data.priority || 0));
    tree(root);

    // Apply persisted positions if they exist, and apply rotation
    const rotationRad = (settings.rotation * Math.PI) / 180;
    root.descendants().forEach(d => {
      if (d.data.x !== undefined) d.x = d.data.x;
      if (d.data.y !== undefined) d.y = d.data.y;
      
      // If no persisted position, use the tree layout but apply the custom depth gaps
      if (d.data.y === undefined) {
        if (d.depth === 1) d.y = 200;
        if (d.depth === 2) d.y = 340;
        if (d.depth > 2) d.y = (340 + (d.depth - 2) * 120);
      }

      // Apply global multipliers/offsets to EVERYONE for rendering
      d.x += rotationRad;
      d.y *= settings.radiusMultiplier;
    });

    // Set initial transform ONLY ONCE - after positions are calculated
    if (!initialTransformApplied.current && width > 0) {
      const rootNode = root.descendants()[0];
      const scale = 0.8;
      
      // Calculate root node's actual position in the coordinate system
      const angle = rootNode.x - Math.PI / 2;
      const rootX = rootNode.y * Math.cos(angle);
      const rootY = rootNode.y * Math.sin(angle);

      // Center the view on the root node: [width/2, height/2] = [rootX * scale + tx, rootY * scale + ty]
      const tx = width / 2 - rootX * scale;
      const ty = height / 2 - rootY * scale;

      const initialTransform = d3.zoomIdentity
        .translate(tx, ty)
        .scale(scale);
        
      svg.call(zoom.transform, initialTransform);
      initialTransformApplied.current = true;
    }

    // Function to update links and nodes based on current d.x and d.y
    const updatePositions = () => {
      const linkGenerator = settings.linkStyle === 'curved' 
        ? d3.linkRadial<any, any>().angle(d => d.x).radius(d => d.y)
        : (d: any) => {
            const angleA = d.source.x - Math.PI / 2;
            const xA = d.source.y * Math.cos(angleA);
            const yA = d.source.y * Math.sin(angleA);
            const angleB = d.target.x - Math.PI / 2;
            const xB = d.target.y * Math.cos(angleB);
            const yB = d.target.y * Math.sin(angleB);
            return `M${xA},${yA}L${xB},${yB}`;
          };

      g.selectAll<SVGPathElement, d3.HierarchyPointLink<YogaPose>>('.mindmap-link')
        .attr('d', linkGenerator as any);

      g.selectAll<SVGGElement, d3.HierarchyPointNode<YogaPose>>('.mindmap-node')
        .attr('transform', d => {
          const angle = d.x - Math.PI / 2;
          const x = d.y * Math.cos(angle);
          const y = d.y * Math.sin(angle);
          return `translate(${x},${y})`;
        });
    };

    // Links
    const linkGenerator = settings.linkStyle === 'curved' 
      ? d3.linkRadial<any, any>().angle(d => d.x).radius(d => d.y)
      : (d: any) => {
          const angleA = d.source.x - Math.PI / 2;
          const xA = d.source.y * Math.cos(angleA);
          const yA = d.source.y * Math.sin(angleA);
          const angleB = d.target.x - Math.PI / 2;
          const xB = d.target.y * Math.cos(angleB);
          const yB = d.target.y * Math.sin(angleB);
          return `M${xA},${yA}L${xB},${yB}`;
        };

    g.append('g')
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('class', 'mindmap-link')
      .attr('stroke', '#E0E0E0')
      .attr('stroke-width', '1.5px')
      .attr('fill', 'none')
      .attr('d', linkGenerator as any);

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('class', d => `mindmap-node group ${d.depth === 0 ? 'peak-node' : d.depth === 1 ? 'category-node' : 'pose-node'}`)
      .attr('transform', d => {
        const angle = d.x - Math.PI / 2;
        const x = d.y * Math.cos(angle);
        const y = d.y * Math.sin(angle);
        return `translate(${x},${y})`;
      });

    let dragStartPos: { x: number, y: number } | null = null;

    // Drag behavior
    const drag = d3.drag<SVGGElement, d3.HierarchyPointNode<YogaPose>>()
      .filter((event) => {
        // Don't drag if clicking on buttons or inputs
        const target = event.target as HTMLElement;
        return !event.button && !target.closest('.node-actions') && !target.closest('.priority-controls') && !target.closest('input');
      })
      .on('start', function(event) {
        dragStartPos = { x: event.x, y: event.y };
        d3.select(this).raise();
      })
      .on('drag', (event, d) => {
        if (isEditingRef.current) return;
        const dx = event.dx;
        const dy = event.dy;

        const moveSubtree = (n: d3.HierarchyPointNode<YogaPose>) => {
          const angle = n.x - Math.PI / 2;
          let x = n.y * Math.cos(angle);
          let y = n.y * Math.sin(angle);
          x += dx;
          y += dy;
          n.x = Math.atan2(y, x) + Math.PI / 2;
          n.y = Math.sqrt(x * x + y * y);
          if (n.children) n.children.forEach(moveSubtree);
        };

        moveSubtree(d);
        updatePositions();
      })
      .on('end', function(event, d) {
        if (isEditingRef.current) return;
        
        if (dragStartPos) {
          const dist = Math.sqrt(Math.pow(event.x - dragStartPos.x, 2) + Math.pow(event.y - dragStartPos.y, 2));
          if (dist < 7) {
            // This is a CLICK
            event.sourceEvent.stopPropagation();
            
            if (clickTimerRef.current) {
              // Double click detected
              clearTimeout(clickTimerRef.current);
              clickTimerRef.current = null;
              if (d.depth >= 0) {
                setEditingNodeId(d.data.id);
              }
            } else {
              // Potential single click
              clickTimerRef.current = setTimeout(() => {
                clickTimerRef.current = null;
                if (reparentingNodeId) {
                  if (reparentingNodeId !== d.data.id) {
                    onMoveNode(reparentingNodeId, d.data.id);
                  } else {
                    onStartReparenting(null);
                  }
                } else if (d.depth >= 1) {
                  onStartReparenting(d.data.id);
                }
              }, 250);
            }
            
            dragStartPos = null;
            return;
          }
        }
        dragStartPos = null;

        const updates: { id: string, x: number, y: number }[] = [];
        const collectUpdates = (n: d3.HierarchyPointNode<YogaPose>) => {
          // Subtract global offsets/multipliers before saving back to data
          const savedX = n.x - rotationRad;
          const savedY = n.y / settings.radiusMultiplier;
          updates.push({ id: n.data.id, x: savedX, y: savedY });
          if (n.children) n.children.forEach(collectUpdates);
        };
        collectUpdates(d);
        onUpdatePositions(updates);
      });

    node.call(drag as any);

    // Shapes based on depth
    node.each(function(d) {
      const el = d3.select(this);
      const fontSize = d.depth === 0 ? 18 : d.depth === 1 ? 14 : 12;
      const charWidth = fontSize * 0.8;
      const textWidth = Math.max(80, d.data.name.length * charWidth + 40);
      const height = d.depth === 0 ? 64 : d.depth === 1 ? 48 : 38;
      const rx = d.depth === 0 ? 32 : d.depth === 1 ? 12 : 6;
      
      el.append('rect')
        .attr('x', -textWidth / 2)
        .attr('y', -height / 2)
        .attr('width', textWidth)
        .attr('height', height)
        .attr('rx', rx)
        .attr('class', (d: any) => {
          const isSelected = reparentingNodeId === d.data.id;
          return `node-rect ${isSelected ? 'moving shadow-lg' : 'shadow-md'}`;
        })
        .on('mouseover', function(event, d: any) {
          if (reparentingNodeId && reparentingNodeId !== d.data.id) {
            d3.select(this).classed('potential-parent', true);
            d3.select(this).style('cursor', 'alias');
          }
        })
        .on('mouseout', function(event, d: any) {
          d3.select(this).classed('potential-parent', false);
          d3.select(this).style('cursor', 'pointer');
        });
    });

    // Centered Text Label
    const textGroup = node.append('g')
      .attr('class', 'text-group');

    textGroup.each(function(d_any) {
      const d = d_any as d3.HierarchyPointNode<YogaPose>;
      const el = d3.select(this);
      if (editingNodeId === d.data.id) {
        const fontSize = d.depth === 0 ? 18 : d.depth === 1 ? 14 : 12;
        const charWidth = fontSize * 0.8;
        const textWidth = Math.max(80, d.data.name.length * charWidth + 40);
        
        const input = el.append('foreignObject')
          .attr('x', -textWidth / 2 + 10)
          .attr('y', -15)
          .attr('width', textWidth - 20)
          .attr('height', 30)
          .append('xhtml:div')
          .attr('class', 'flex items-center justify-center h-full')
          .append('input')
          .attr('type', 'text')
          .attr('value', d.data.name)
          .attr('class', 'w-full h-full text-center text-sm font-medium bg-white/50 border border-[#5A5A40]/30 outline-none rounded px-1')
          .on('blur', function() {
            onUpdateField(d.data.id, 'name', (this as HTMLInputElement).value);
            setEditingNodeId(null);
          })
          .on('keydown', function(event) {
            if (event.key === 'Enter') {
              onUpdateField(d.data.id, 'name', (this as HTMLInputElement).value);
              setEditingNodeId(null);
            } else if (event.key === 'Escape') {
              setEditingNodeId(null);
            }
          })
          .on('click', (event) => event.stopPropagation())
          .on('mousedown', (event) => event.stopPropagation());

        setTimeout(() => {
          (input.node() as HTMLInputElement)?.focus();
          (input.node() as HTMLInputElement)?.select();
        }, 50);
      } else {
        el.append('text')
          .attr('dy', '0.35em')
          .attr('text-anchor', 'middle')
          .text(d.data.name)
          .attr('class', `font-sans pointer-events-none select-none ${
            d.depth === 0 ? 'text-lg font-semibold fill-white' : 
            d.depth === 1 ? 'text-sm font-medium fill-[#3D3D2D]' : 
            'text-[12px] font-medium fill-[#1A1A1A]'
          }`);
      }
    });

    // Action Buttons - Positioned below the node
    const actions = node.append('g')
      .attr('class', 'node-actions opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto')
      .attr('transform', d_any => {
        const d = d_any as d3.HierarchyPointNode<YogaPose>;
        const height = d.depth === 0 ? 64 : d.depth === 1 ? 48 : 38;
        return `translate(0, ${height / 2 + 18})`;
      });

    // Priority Controls - Top of the node (Only for Asana nodes - depth 2 or deeper)
    const priority = node.filter(d => d.depth >= 2 && reparentingNodeId !== d.data.id)
      .append('g')
      .attr('class', 'priority-controls')
      .attr('transform', d => {
        const height = d.depth === 0 ? 64 : d.depth === 1 ? 48 : 38;
        return `translate(0, ${-height / 2 - 12})`;
      });

    // Priority Background
    priority.append('rect')
      .attr('x', -24)
      .attr('y', -10)
      .attr('width', 48)
      .attr('height', 20)
      .attr('rx', 6)
      .attr('fill', '#F5F2ED')
      .attr('stroke', '#5A5A40')
      .attr('stroke-opacity', 0.2)
      .attr('stroke-width', 1);

    // Priority Input (Using foreignObject for direct keyboard entry)
    priority.append('foreignObject')
      .attr('x', -12)
      .attr('y', -8)
      .attr('width', 24)
      .attr('height', 16)
      .append('xhtml:div')
      .attr('class', 'flex items-center justify-center h-full')
      .append('input')
      .attr('type', 'number')
      .attr('value', d => d.data.priority || 0)
      .attr('class', 'w-full h-full text-center text-[10px] font-bold bg-transparent border-none outline-none text-[#5A5A40] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none')
      .on('change', function(event, d) {
        const val = parseInt((event.target as HTMLInputElement).value, 10);
        onUpdatePriority(d.data.id, isNaN(val) ? 0 : val);
      })
      .on('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
      })
      .on('mousedown', (event) => {
        event.stopPropagation();
      });

    // Decrement Button
    priority.append('text')
      .attr('x', -18)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#5A5A40')
      .attr('fill-opacity', 0.6)
      .attr('font-size', '14px')
      .attr('class', 'cursor-pointer hover:fill-opacity-100 select-none transition-all font-bold')
      .text('−')
      .on('click', (event, d) => {
        event.stopPropagation();
        event.preventDefault();
        onUpdatePriority(d.data.id, (d.data.priority || 0) - 1);
      });

    // Increment Button
    priority.append('text')
      .attr('x', 18)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#5A5A40')
      .attr('fill-opacity', 0.6)
      .attr('font-size', '14px')
      .attr('class', 'cursor-pointer hover:fill-opacity-100 select-none transition-all font-bold')
      .text('+')
      .on('click', (event, d) => {
        event.stopPropagation();
        event.preventDefault();
        onUpdatePriority(d.data.id, (d.data.priority || 0) + 1);
      });

    // Moving Label (Only when being moved)
    const movingLabel = node.filter(d => reparentingNodeId === d.data.id)
      .append('g')
      .attr('class', 'moving-label')
      .attr('transform', d => {
        const height = d.depth === 0 ? 64 : d.depth === 1 ? 48 : 38;
        return `translate(0, ${-height / 2 - 15})`;
      });

    movingLabel.append('path')
      .attr('d', 'M-35,0 L35,0 L35,18 L5,18 L0,23 L-5,18 L-35,18 Z')
      .attr('fill', '#1A1A1A');

    movingLabel.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 12)
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .text('이동할 위치 클릭');

    // Add button
    const addButton = actions.append('g')
      .attr('transform', d => d.depth >= 1 ? 'translate(-30, 0)' : 'translate(-15, 0)')
      .attr('class', 'cursor-pointer hover:brightness-125 transition-all')
      .on('click', (event, d_any) => {
        const d = d_any as d3.HierarchyPointNode<YogaPose>;
        event.stopPropagation();
        event.preventDefault();
        onAdd(d.data.id);
      });

    addButton.append('circle')
      .attr('r', 11)
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('fill', '#5A5A40');
    
    addButton.append('text')
      .attr('x', 0)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '14px')
      .attr('class', 'pointer-events-none font-bold')
      .text('+');

    // Info/Edit button
    const infoButton = actions.append('g')
      .attr('transform', d => d.depth >= 1 ? 'translate(0, 0)' : 'translate(15, 0)')
      .attr('class', 'cursor-pointer hover:brightness-125 transition-all')
      .on('click', (event, d_any) => {
        const d = d_any as d3.HierarchyPointNode<YogaPose>;
        event.stopPropagation();
        event.preventDefault();
        onEdit(d.data);
      });

    infoButton.append('circle')
      .attr('r', 11)
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('fill', 'white')
      .attr('stroke', '#5A5A40')
      .attr('stroke-width', 1);
    
    infoButton.append('text')
      .attr('x', 0)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#5A5A40')
      .attr('font-size', '12px')
      .attr('class', 'pointer-events-none font-bold')
      .text('i');

    // Delete button (Only for depth >= 1)
    const deleteButton = actions.filter(d => d.depth >= 1)
      .append('g')
      .attr('transform', 'translate(30, 0)')
      .attr('class', 'cursor-pointer hover:brightness-125 transition-all')
      .on('click', (event, d_any) => {
        const d = d_any as d3.HierarchyPointNode<YogaPose>;
        event.stopPropagation();
        event.preventDefault();
        onDelete(d.data.id);
      });

    deleteButton.append('circle')
      .attr('r', 11)
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('fill', '#FF4444');

    deleteButton.append('text')
      .attr('x', 0)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '14px')
      .attr('class', 'pointer-events-none font-bold')
      .text('−');

    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, [dimensions, data, onEdit, onAdd, onDelete, onUpdatePriority, onUpdatePositions, onUpdateField, editingNodeId, reparentingNodeId, onStartReparenting, onMoveNode]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full overflow-hidden bg-[#F5F2ED] relative"
      onClick={() => onStartReparenting(null)}
    >
      <svg ref={svgRef} className="w-full h-full" />

      {/* Reparenting Banner */}
      <AnimatePresence>
        {reparentingNodeId && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#5A5A40] text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <GitGraph size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Reparenting Mode</span>
                <span className="text-sm font-bold">새로운 부모 노드를 선택하세요</span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/20 mx-2" />
            <button 
              onClick={() => onStartReparenting(null)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-[11px] font-bold"
            >
              <X size={14} />
              취소
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Layout Settings Panel */}
      <div className="absolute top-4 right-20 flex flex-col items-end gap-2">
        <button 
          onClick={() => setShowLayoutSettings(!showLayoutSettings)}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${
            showLayoutSettings ? 'bg-[#5A5A40] text-white' : 'bg-white text-[#5A5A40] hover:bg-[#F5F2ED]'
          } border border-[#5A5A40]/10`}
        >
          <SlidersHorizontal size={20} />
        </button>

        <AnimatePresence>
          {showLayoutSettings && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className="bg-white/90 backdrop-blur-md border border-[#5A5A40]/10 p-5 rounded-2xl shadow-2xl w-64 space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]">Layout Settings</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (svgRef.current && zoomRef.current) {
                        const scale = 0.8;
                        const tx = dimensions.width / 2;
                        const ty = dimensions.height / 2;
                        d3.select(svgRef.current)
                          .transition()
                          .duration(750)
                          .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
                      }
                    }}
                    className="text-[#5A5A40]/40 hover:text-[#5A5A40] transition-colors"
                    title="Reset Zoom"
                  >
                    <Target size={14} />
                  </button>
                  <button 
                    onClick={() => {
                      onUpdateLayout({ radiusMultiplier: 1, angleSpread: 1, rotation: 0, linkStyle: 'curved' });
                      // Clear all manual positions
                      const clearPositions = (node: YogaPose): any[] => {
                        let updates = [{ id: node.id, x: undefined, y: undefined }];
                        if (node.children) {
                          node.children.forEach(child => {
                            updates = [...updates, ...clearPositions(child)];
                          });
                        }
                        return updates;
                      };
                      onUpdatePositions(clearPositions(data));
                    }}
                    className="text-[#5A5A40]/40 hover:text-[#5A5A40] transition-colors"
                    title="Reset Layout"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[9px] font-bold text-[#5A5A40]/60 uppercase">Branch Length</label>
                    <span className="text-[9px] font-mono text-[#5A5A40]">{settings.radiusMultiplier.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="2" step="0.1"
                    value={settings.radiusMultiplier}
                    onChange={(e) => onUpdateLayout({ radiusMultiplier: parseFloat(e.target.value) })}
                    className="w-full accent-[#5A5A40] h-1 bg-[#5A5A40]/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[9px] font-bold text-[#5A5A40]/60 uppercase">Spread Angle</label>
                    <span className="text-[9px] font-mono text-[#5A5A40]">{Math.round(settings.angleSpread * 360)}°</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="1" step="0.05"
                    value={settings.angleSpread}
                    onChange={(e) => onUpdateLayout({ angleSpread: parseFloat(e.target.value) })}
                    className="w-full accent-[#5A5A40] h-1 bg-[#5A5A40]/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[9px] font-bold text-[#5A5A40]/60 uppercase">Rotation</label>
                    <span className="text-[9px] font-mono text-[#5A5A40]">{settings.rotation}°</span>
                  </div>
                  <input 
                    type="range" min="-180" max="180" step="5"
                    value={settings.rotation}
                    onChange={(e) => onUpdateLayout({ rotation: parseInt(e.target.value) })}
                    className="w-full accent-[#5A5A40] h-1 bg-[#5A5A40]/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="pt-2 border-t border-[#5A5A40]/5">
                  <label className="text-[9px] font-bold text-[#5A5A40]/60 uppercase block mb-2">Link Style</label>
                  <div className="flex bg-[#F5F2ED] p-1 rounded-lg">
                    <button 
                      onClick={() => onUpdateLayout({ linkStyle: 'curved' })}
                      className={`flex-1 py-1 text-[9px] font-bold rounded-md transition-all ${settings.linkStyle === 'curved' ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#5A5A40]/40'}`}
                    >
                      Curved
                    </button>
                    <button 
                      onClick={() => onUpdateLayout({ linkStyle: 'straight' })}
                      className={`flex-1 py-1 text-[9px] font-bold rounded-md transition-all ${settings.linkStyle === 'straight' ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#5A5A40]/40'}`}
                    >
                      Straight
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MindMap;
