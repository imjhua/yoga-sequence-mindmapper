import React, { useState, useCallback, useMemo } from 'react';
import { motion, Reorder, useDragControls } from 'motion/react';
import { Clock, ArrowRight, Timer, Plus, Trash2, GripVertical, Target } from 'lucide-react';
import { YogaPose, findNodeById, formatTime } from '../types';

interface TimelineProps {
  data: YogaPose;
  onEdit: (node: YogaPose) => void;
  onAdd: (parentId: string) => void;
  onDelete: (id: string) => void;
  onReorder: (newPoses: YogaPose[]) => void;
  onUpdateDuration: (id: string, duration: number) => void;
  onUpdateField: (id: string, field: string, value: any) => void;
  onCopyJson: () => void;
  copied: boolean;
}

const TimelineItem: React.FC<{
  node: YogaPose;
  depth: number;
  data: YogaPose;
  index: number;
  editingField: { id: string; field: 'name' | 'description' } | null;
  tempValue: string;
  setTempValue: (v: string) => void;
  handleFieldSubmit: () => void;
  handleFieldKeyDown: (e: React.KeyboardEvent) => void;
  handleFieldClick: (e: React.MouseEvent, pose: YogaPose, field: 'name' | 'description') => void;
  onAdd: (parentId: string) => void;
  onDelete: (id: string) => void;
  onReorder: (newPoses: YogaPose[]) => void;
  handleDurationClick: (pose: YogaPose) => void;
  editingDurationId: string | null;
  tempDuration: string;
  setTempDuration: (v: string) => void;
  handleDurationSubmit: (id: string) => void;
  handleDurationKeyDown: (e: React.KeyboardEvent, id: string) => void;
  formatTime: (seconds: number) => string;
}> = ({ 
  node, depth, data, index, editingField, tempValue, setTempValue, 
  handleFieldSubmit, handleFieldKeyDown, handleFieldClick, 
  onAdd, onDelete, onReorder, handleDurationClick, editingDurationId, 
  tempDuration, setTempDuration, handleDurationSubmit, 
  handleDurationKeyDown, formatTime
}) => {
  const controls = useDragControls();
  const indent = Math.max(0, (depth - 2) * (window.innerWidth < 640 ? 12 : 24));

  const sortedChildren = useMemo(() => {
    return [...(node.children || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }, [node.children]);

  return (
    <Reorder.Item
      value={node.id}
      dragListener={false}
      dragControls={controls}
      initial={false}
      layout="position"
      whileDrag={{ 
        scale: 1.01,
        zIndex: 50,
      }}
      className="relative select-none"
    >
      <div className="flex flex-col">
        <div 
          className="flex items-center gap-2 sm:gap-4 w-full group"
          style={{ paddingLeft: `${indent}px` }}
        >
          {/* Marker & Drag Handle */}
          <div 
            className="relative z-10 flex items-center gap-1 sm:gap-2 cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => controls.start(e)}
            style={{ touchAction: 'none' }}
          >
            <div className="opacity-0 group-hover:opacity-40 text-[#5A5A40] p-1">
              <GripVertical size={12} className="sm:w-[14px] sm:h-[14px]" />
            </div>
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shadow-sm transition-transform active:scale-95 ${
              depth === 2 ? 'bg-[#5A5A40] text-white' : 'bg-white text-[#5A5A40] border border-[#5A5A40]/10'
            }`}>
              <span className="text-[10px] sm:text-xs font-bold">{index}</span>
            </div>
          </div>

          {/* Content */}
          <div 
            className={`flex-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl shadow-sm border flex items-center justify-between gap-2 sm:gap-4 ${
              depth === 2 ? 'bg-white border-[#5A5A40]/20 shadow-md' : 'bg-white/50 border-[#5A5A40]/5 hover:border-[#5A5A40]/20'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                {editingField?.id === node.id && editingField.field === 'name' ? (
                  <input
                    autoFocus
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleFieldSubmit}
                    onKeyDown={handleFieldKeyDown}
                    className="w-full text-xs sm:text-sm font-bold text-[#1A1A1A] bg-[#F5F2ED] border-none outline-none rounded px-1"
                  />
                ) : (
                  <h3 
                    onClick={(e) => handleFieldClick(e, node, 'name')}
                    className={`text-xs sm:text-sm font-bold text-[#1A1A1A] truncate hover:bg-[#F5F2ED] rounded px-1 cursor-text ${depth === 2 ? 'text-sm sm:text-base' : ''}`}
                  >
                    {node.name}
                  </h3>
                )}
              </div>
              
              {editingField?.id === node.id && editingField.field === 'description' ? (
                <input
                  autoFocus
                  type="text"
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  onBlur={handleFieldSubmit}
                  onKeyDown={handleFieldKeyDown}
                  className="w-full text-[9px] sm:text-[10px] text-[#1A1A1A]/60 bg-[#F5F2ED] border-none outline-none rounded px-1 mt-1"
                />
              ) : (
                <p 
                  onClick={(e) => handleFieldClick(e, node, 'description')}
                  className="text-[9px] sm:text-[10px] text-[#1A1A1A]/60 line-clamp-1 rounded px-1 cursor-text mt-0.5"
                >
                  {node.description || '설명을 입력하세요...'}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className="flex items-center gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100">
                <button 
                  onClick={(e) => { e.stopPropagation(); onAdd(node.id); }}
                  className="p-1 sm:p-1.5 hover:bg-[#F5F2ED] text-[#5A5A40] rounded-md"
                  title="Add Child Pose"
                >
                  <Plus size={12} className="sm:w-[14px] sm:h-[14px]" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                  className="p-1 sm:p-1.5 hover:bg-red-50 text-red-500 rounded-md"
                  title="Delete Pose"
                >
                  <Trash2 size={12} className="sm:w-[14px] sm:h-[14px]" />
                </button>
              </div>

              <div 
                className="flex items-center gap-1 text-[#5A5A40] bg-[#F5F2ED] px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md text-[8px] sm:text-[9px] font-bold min-w-[35px] sm:min-w-[45px] justify-center cursor-text"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDurationClick(node);
                }}
              >
                <Timer size={8} className="sm:w-[10px] sm:h-[10px]" />
                {editingDurationId === node.id ? (
                  <input
                    autoFocus
                    type="number"
                    step="0.1"
                    value={tempDuration}
                    onChange={(e) => setTempDuration(e.target.value)}
                    onBlur={() => handleDurationSubmit(node.id)}
                    onKeyDown={(e) => handleDurationKeyDown(e, node.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 sm:w-10 bg-transparent border-none outline-none text-center p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <span>{formatTime(node.duration || 0)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Children rendered recursively inside a Reorder.Group */}
        {sortedChildren.length > 0 && (
          <div className="mt-2">
            <Reorder.Group
              axis="y"
              values={sortedChildren.map(c => c.id)}
              onReorder={(newIds) => {
                const newOrder = newIds.map(id => sortedChildren.find(c => c.id === id)!);
                onReorder(newOrder);
              }}
              className="space-y-2"
            >
              {sortedChildren.map((child, idx) => (
                <TimelineItem 
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  data={data}
                  index={idx + 1}
                  editingField={editingField}
                  tempValue={tempValue}
                  setTempValue={setTempValue}
                  handleFieldSubmit={handleFieldSubmit}
                  handleFieldKeyDown={handleFieldKeyDown}
                  handleFieldClick={handleFieldClick}
                  onAdd={onAdd}
                  onDelete={onDelete}
                  onReorder={onReorder}
                  handleDurationClick={handleDurationClick}
                  editingDurationId={editingDurationId}
                  tempDuration={tempDuration}
                  setTempDuration={setTempDuration}
                  handleDurationSubmit={handleDurationSubmit}
                  handleDurationKeyDown={handleDurationKeyDown}
                  formatTime={formatTime}
                />
              ))}
            </Reorder.Group>
          </div>
        )}
      </div>
    </Reorder.Item>
  );
};

const Timeline: React.FC<TimelineProps> = ({ 
  data, onEdit, onAdd, onDelete, onReorder, onUpdateDuration, onUpdateField, onCopyJson, copied 
}) => {
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ id: string; field: 'name' | 'description' } | null>(null);
  const [tempDuration, setTempDuration] = useState<string>('');
  const [tempValue, setTempValue] = useState<string>('');

  const handleDurationClick = (pose: YogaPose) => {
    setEditingDurationId(pose.id);
    setTempDuration((pose.duration || 0).toString());
  };

  const handleDurationSubmit = (id: string) => {
    const newDuration = parseFloat(tempDuration);
    if (!isNaN(newDuration)) {
      onUpdateDuration(id, newDuration);
    }
    setEditingDurationId(null);
  };

  const handleDurationKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleDurationSubmit(id);
    } else if (e.key === 'Escape') {
      setEditingDurationId(null);
    }
  };

  const handleFieldClick = (e: React.MouseEvent, pose: YogaPose, field: 'name' | 'description') => {
    e.stopPropagation();
    setEditingField({ id: pose.id, field });
    setTempValue(pose[field] || '');
  };

  const handleFieldSubmit = () => {
    if (editingField) {
      onUpdateField(editingField.id, editingField.field, tempValue);
      setEditingField(null);
    }
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFieldSubmit();
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  };

  const allAsanas = useMemo(() => {
    const asanas: YogaPose[] = [];
    data.children?.forEach(cat => {
      cat.children?.forEach(asana => {
        asanas.push(asana);
      });
    });
    return asanas.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }, [data]);

  return (
    <div className="w-full h-full bg-[#F5F2ED] overflow-y-auto p-2 pt-40 md:pt-42">
      <div className="max-w-3xl mx-auto mt-4 pb-40">
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-3 sm:left-4 top-0 bottom-0 w-px bg-[#5A5A40]/10 z-0" />

          <Reorder.Group 
            axis="y" 
            values={allAsanas.map(a => a.id)} 
            onReorder={(newIds) => {
              const newOrder = newIds.map(id => allAsanas.find(a => a.id === id)!);
              onReorder(newOrder);
            }}
            className="space-y-2 sm:space-y-4 pb-40"
          >
            {allAsanas.map((child, idx) => (
              <TimelineItem 
                key={child.id}
                node={child}
                depth={2}
                data={data}
                index={idx + 1}
                editingField={editingField}
                tempValue={tempValue}
                setTempValue={setTempValue}
                handleFieldSubmit={handleFieldSubmit}
                handleFieldKeyDown={handleFieldKeyDown}
                handleFieldClick={handleFieldClick}
                onAdd={onAdd}
                onDelete={onDelete}
                onReorder={onReorder}
                handleDurationClick={handleDurationClick}
                editingDurationId={editingDurationId}
                tempDuration={tempDuration}
                setTempDuration={setTempDuration}
                handleDurationSubmit={handleDurationSubmit}
                handleDurationKeyDown={handleDurationKeyDown}
                formatTime={formatTime}
              />
            ))}
          </Reorder.Group>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
