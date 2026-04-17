import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Target, Sparkles, Map as MapIcon, Save, Timer, Code, LayoutGrid, Plus, Edit3 } from 'lucide-react';
import MindMap from './components/MindMap';
import Timeline from './components/Timeline';
import FAQ from './components/Memo';
import { YogaPose, FAQItem, updateNodeInTree, addNodeToTree, deleteNodeFromTree, findNodeById, moveNodeInTree, formatTime, getSequenceStats } from './types';

// TODO: Replace with your actual GAS Web App URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwFt8oDMlJqUhfJDZ8n8MqCpYnhHjuaL1YYlkWwyhR5a6xeAC9IoOBh3Rkp1J3z_ATXFg/exec';

// Fallback initial data in case GAS is not yet configured
const initialData: Record<string, YogaPose> = {};

export default function App() {
  const [allSequences, setAllSequences] = useState<Record<string, YogaPose>>(initialData);
  const [selectedId, setSelectedId] = useState<string>(() => {
    return localStorage.getItem('lastSelectedSequenceId') || '';
  });

  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (selectedId) {
      localStorage.setItem('lastSelectedSequenceId', selectedId);
    }
  }, [selectedId]);

  // Load all sequences from GAS on app startup
  useEffect(() => {
    const loadAllData = async () => {
      if (!GAS_URL) {
        console.warn('GAS_URL is not configured. Please see GAS_INSTRUCTIONS.md');
        setDataLoaded(true);
        return;
      }

      try {
        const response = await fetch(GAS_URL);
        if (response.ok) {
          const data = await response.json();
          if (data && Object.keys(data).length > 0) {
            setAllSequences(data);
            
            // 데이터가 로드된 후, 현재 선택된 ID가 유효하지 않으면 첫 번째 데이터 선택
            setSelectedId(prev => {
              const keys = Object.keys(data).sort((a, b) => a.localeCompare(b));
              if (!prev || !data[prev]) {
                return keys[0];
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.error('Error loading data from GAS:', error);
      } finally {
        setDataLoaded(true);
      }
    };
    loadAllData();
  }, []);

  const sequence = allSequences[selectedId];

  const setSequence = useCallback((update: YogaPose | ((prev: YogaPose) => YogaPose)) => {
    setAllSequences(prev => {
      const current = prev[selectedId];
      if (!current) return prev;
      const next = typeof update === 'function' ? update(current) : update;
      return {
        ...prev,
        [selectedId]: next
      };
    });
  }, [selectedId]);

  const [editingPose, setEditingPose] = useState<YogaPose | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [view, setView] = useState<'mindmap' | 'timeline'>('mindmap');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reparentingNodeId, setReparentingNodeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [faqSaving, setFaqSaving] = useState(false);
  const [faqLoaded, setFaqLoaded] = useState(false);

  const handleSaveToFile = useCallback(async () => {
    if (!GAS_URL) {
      alert('GAS_URL이 설정되지 않았습니다. GAS_INSTRUCTIONS.md를 확인해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain', // GAS doesn't always like application/json from different origins
        },
        body: JSON.stringify({ id: selectedId, data: sequence }),
      });

      const result = await response.json();
      if (result.status === 'success') {
        alert('성공적으로 Google Sheets에 저장되었습니다!');
      } else {
        alert(`저장 실패: ${result.message}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다. 브라우저 콘솔을 확인해 주세요.');
    } finally {
      setIsSaving(false);
    }
  }, [selectedId, sequence]);

  const stats = React.useMemo(() => {
    if (!sequence) return { duration: 0, count: 0 };
    return getSequenceStats(sequence);
  }, [sequence]);

  const handleCopyJson = useCallback(() => {
    if (!sequence) return;
    navigator.clipboard.writeText(JSON.stringify(sequence, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sequence]);

  const handleUpdateSequenceInfo = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingInfo(false);
  }, []);

  const handleUpdateNode = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPose || !sequence) return;
    const updated = updateNodeInTree(sequence, editingPose.id, editingPose);
    setSequence(updated);
    setEditingPose(null);
  }, [editingPose, sequence, setSequence]);

  const handleAddNode = useCallback((parentId: string) => {
    if (!sequence) return;
    const parentNode = findNodeById(sequence, parentId);

    const newNode: YogaPose = {
      id: `node-${Date.now()}`,
      name: '새로운 자세',
      description: '',
      duration: 0,
      children: [],
      // Set initial position near parent if parent has coordinates
      // x is angle in radians, y is radius in pixels
      x: parentNode?.x !== undefined ? parentNode.x + 0.2 : undefined,
      y: parentNode?.y !== undefined ? parentNode.y + 100 : undefined,
    };
    const updated = addNodeToTree(sequence, parentId, newNode);
    setSequence(updated);
  }, [sequence, setSequence]);

  const handleDeleteNode = useCallback((id: string) => {
    if (!sequence || id === sequence.id) return;

    const nodeToDelete = findNodeById(sequence, id);
    if (!nodeToDelete) return;

    // Check if node has "additional information"
    const hasInfo =
      (nodeToDelete.name !== '새로운 자세') ||
      (nodeToDelete.description !== '') ||
      (nodeToDelete.tips && nodeToDelete.tips.length > 0) ||
      (nodeToDelete.children && nodeToDelete.children.length > 0);

    if (hasInfo) {
      setDeletingId(id);
    } else {
      const updated = deleteNodeFromTree(sequence, id);
      if (updated) setSequence(updated);
    }
  }, [sequence, setSequence]);

  const confirmDelete = useCallback(() => {
    if (deletingId && sequence) {
      const updated = deleteNodeFromTree(sequence, deletingId);
      if (updated) setSequence(updated);
      setDeletingId(null);
    }
  }, [deletingId, sequence, setSequence]);

  const handleUpdatePriority = useCallback((id: string, priority: number) => {
    setSequence(prev => updateNodeInTree(prev, id, { priority }));
  }, [setSequence]);

  const handleUpdateDuration = useCallback((id: string, duration: number) => {
    setSequence(prev => updateNodeInTree(prev, id, { duration }));
  }, [setSequence]);

  const handleUpdateField = useCallback((id: string, field: string, value: any) => {
    setSequence(prev => updateNodeInTree(prev, id, { [field]: value }));
  }, [setSequence]);

  const handleReorder = useCallback((newPoses: YogaPose[]) => {
    setSequence(prev => {
      const priorityMap = new Map(newPoses.map((p, i) => [p.id, (i + 1) * 10]));

      const updateTree = (node: YogaPose): YogaPose => {
        let newNode = { ...node };
        if (priorityMap.has(node.id)) {
          newNode.priority = priorityMap.get(node.id);
        }
        if (node.children) {
          newNode.children = node.children.map(updateTree);
        }
        return newNode;
      };

      return updateTree(prev);
    });
  }, [setSequence]);

  const handleUpdatePositions = useCallback((updates: { id: string, x: number | undefined, y: number | undefined }[]) => {
    setSequence(prev => {
      let updated = { ...prev };
      updates.forEach(update => {
        updated = updateNodeInTree(updated, update.id, { x: update.x, y: update.y });
      });
      return updated;
    });
  }, [setSequence]);

  const handleMoveNode = useCallback((nodeId: string, targetParentId: string) => {
    if (!sequence || nodeId === targetParentId) {
      setReparentingNodeId(null);
      return;
    }

    // Check if targetParentId is a descendant of nodeId to prevent cycles
    const nodeToMove = findNodeById(sequence, nodeId);
    if (nodeToMove) {
      const isDescendant = (parent: YogaPose, targetId: string): boolean => {
        if (!parent.children) return false;
        return parent.children.some(child => child.id === targetId || isDescendant(child, targetId));
      };
      if (isDescendant(nodeToMove, targetParentId)) {
        alert("자신의 하위 노드로 이동할 수 없습니다.");
        setReparentingNodeId(null);
        return;
      }
    }

    const updated = moveNodeInTree(sequence, nodeId, targetParentId, 0);
    setSequence(updated);
    setReparentingNodeId(null);
    setEditingPose(null);
  }, [sequence, setSequence]);

  const handleUpdateLayout = useCallback((settings: any) => {
    if (!sequence) return;
    setSequence({
      ...sequence,
      layoutSettings: { ...sequence.layoutSettings, ...settings }
    });
  }, [sequence, setSequence]);

  const tabs = React.useMemo(() => {
    return Object.keys(allSequences).sort((a, b) => {
      return a.localeCompare(b);
    });
  }, [allSequences]);

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl font-medium">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!sequence) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center text-white p-8 text-center">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold mb-4">시퀀스 데이터를 찾을 수 없습니다</h2>
          <p className="text-neutral-400 mb-6">
            GAS_URL 설정이 올바른지, 그리고 구글 시트에 데이터가 있는지 확인해 주세요.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {Object.keys(allSequences).length > 0 ? (
              Object.keys(allSequences).map(id => (
                <button
                  key={id}
                  onClick={() => setSelectedId(id)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  {id}
                </button>
              ))
            ) : (
              <p className="text-sm text-neutral-500">등록된 시퀀스가 없습니다.</p>
            )}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-full transition-colors font-medium"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // <div className="flex flex-row justify-between items-start gap-2">

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-[#F5F2ED]">
      {/* Header & Tabs Selector */}
      <div className="absolute top-0 left-0 right-0 z-20 p-2 md:p-4 flex flex-col gap-4 pointer-events-none">
        <div className="flex flex-col md:flex-row justify-between items-start gap-1 md:gap-4">
          <header className="pointer-events-auto bg-[#F5F2ED]/80 backdrop-blur-md p-3 md:p-5 rounded-2xl border border-[#5A5A40]/10 shadow-sm cursor-pointer hover:bg-[#F5F2ED] transition-all group flex items-center w-full md:w-auto">
            <div className="flex flex-col w-full">
              <span className="text-[9px] uppercase tracking-[0.3em] text-[#5A5A40] font-bold opacity-80">Yoga Sequence Architect</span>
              <div className="flex flex-col items-center justify-between w-full gap-2"
                onClick={() => setIsEditingInfo(true)}
              >
                <h1 className="mt-2 uppercase font-sans text-2xl md:text-3xl font-bold text-[#1A1A1A] leading-tight">
                  {sequence.title || 'Yoga Sequence'}
                </h1>
                <div className="max-w-[500px] font-sans text-xs md:text-sm text-[#5A5A40] font-medium tracking-wide whitespace-pre-wrap">
                  {sequence.description}
                </div>
              </div>
              <div className="pointer-events-auto flex justify-center bg-white/80 backdrop-blur-md p-1 mt-2 rounded-xl border border-[#5A5A40]/10 shadow-lg mt-1 w-full">
                <button
                  onClick={() => setView('mindmap')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-1 items-center justify-center gap-2 ${view === 'mindmap' ? 'bg-[#5A5A40] text-white shadow-md' : 'text-[#5A5A40] hover:bg-[#F5F2ED]'
                    }`}
                >
                  <MapIcon size={14} />
                  MindMap
                </button>
                <button
                  onClick={() => setView('timeline')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-1 items-center justify-center gap-2 ${view === 'timeline' ? 'bg-[#5A5A40] text-white shadow-md' : 'text-[#5A5A40] hover:bg-[#F5F2ED]'
                    }`}
                >
                  <Timer size={14} />
                  Timeline
                </button>
              </div>
            </div>
          </header>

          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <div className="pointer-events-auto flex items-center gap-1 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-[#5A5A40]/10 shadow-lg overflow-x-auto w-full md:max-w-[600px] custom-scrollbar">
              {tabs.map(id => {
                const seq = allSequences[id];
                const displayLabel = seq?.title || id;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedId(id)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap ${selectedId === id
                      ? 'bg-[#5A5A40] text-white shadow-md'
                      : 'text-[#5A5A40] hover:bg-[#F5F2ED]'
                      }`}
                  >
                    {displayLabel}
                  </button>
                );
              })}
            </div>

            {/* {view === 'timeline' && (
              <div className="pointer-events-auto flex items-center gap-2 sm:gap-4 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl animate-in slide-in-from-top-2 duration-300 bg-white/40 border border-[#5A5A40]/5">
                <div className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-4 border-r border-[#5A5A40]/10">
                  <span className="text-[10px] sm:text-[11px] font-black text-[#1A1A1A] uppercase tracking-tight">Timeline</span>
                  <span className="text-[#5A5A40] text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em] opacity-60">
                    {formatTime(stats.duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const categories = sequence.children || [];
                      if (categories.length > 0) {
                        handleAddNode(categories[categories.length - 1].id);
                      } else {
                        handleAddNode(sequence.id);
                      }
                    }}
                    className="flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1.5 bg-[#5A5A40] text-white rounded-xl text-[9px] sm:text-[10px] font-bold hover:bg-[#4A4A30] active:scale-95 shadow-md"
                  >
                    <Plus size={10} className="sm:w-[12px] sm:h-[12px]" />
                  </button>
                </div>
              </div>
            )} */}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 relative">
        {view === 'mindmap' ? (
          <MindMap
            data={sequence}
            onEdit={setEditingPose}
            onAdd={handleAddNode}
            onDelete={handleDeleteNode}
            onUpdatePriority={handleUpdatePriority}
            onUpdatePositions={handleUpdatePositions}
            onUpdateLayout={handleUpdateLayout}
            onUpdateField={handleUpdateField}
            isEditing={!!editingPose}
            reparentingNodeId={reparentingNodeId}
            onStartReparenting={setReparentingNodeId}
            onMoveNode={handleMoveNode}
          />
        ) : (
          <Timeline
            data={sequence}
            onEdit={setEditingPose}
            onAdd={handleAddNode}
            onDelete={handleDeleteNode}
            onReorder={handleReorder}
            onUpdateDuration={handleUpdateDuration}
            onUpdateField={handleUpdateField}
            onCopyJson={handleCopyJson}
            copied={copied}
          />
        )}

        {/* Floating Action Buttons */}
        <div className="absolute bottom-6 left-6 z-40 flex items-center gap-3 bg-white/90 backdrop-blur-md p-3 rounded-full border border-[#5A5A40]/10 shadow-lg">
          <motion.button
            onClick={handleCopyJson}
            className="px-3 py-2 bg-[#5A5A40] hover:bg-[#4A4A30] text-white rounded-full border border-[#5A5A40]/20 transition-all flex items-center gap-2 shadow-md active:scale-95"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Copy JSON"
          >
            <Code size={16} />
            <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">{copied ? 'Copied!' : 'JSON'}</span>
          </motion.button>
          <motion.button
            onClick={handleSaveToFile}
            disabled={isSaving}
            className="px-3 py-2 bg-[#5A5A40] hover:bg-[#4A4A30] disabled:opacity-50 text-white rounded-full border border-[#5A5A40]/20 transition-all flex items-center gap-2 shadow-md active:scale-95"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Save to File"
          >
            <Save size={16} />
            <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
          </motion.button>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1A1A1A]/40 backdrop-blur-sm p-4"
            onClick={() => setDeletingId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xs bg-white border border-[#5A5A40]/10 rounded-2xl shadow-2xl p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <X size={24} />
              </div>
              <h3 className="text-sm font-bold text-[#1A1A1A] mb-2">정말 삭제하시겠습니까?</h3>
              <p className="text-[11px] text-[#1A1A1A]/60 mb-6">
                '{findNodeById(sequence, deletingId)?.name}' 노드에 입력된 정보가 있습니다. 삭제하면 복구할 수 없습니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 px-4 py-2 rounded-xl text-[11px] font-bold text-[#5A5A40] bg-[#F5F2ED] hover:bg-[#EBE8E2] transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 rounded-xl text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditingInfo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/40 backdrop-blur-sm p-4"
            onClick={() => setIsEditingInfo(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="w-full max-w-[500px] bg-white border border-[#5A5A40]/10 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleUpdateSequenceInfo} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A5A40]">Edit Sequence Info</h3>
                  <button type="button" onClick={() => setIsEditingInfo(false)} className="text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-[#5A5A40]/50 mb-1 font-bold">Sequence Title</label>
                    <input
                      autoFocus
                      type="text"
                      value={sequence.title || ''}
                      onChange={(e) => setSequence({ ...sequence, title: e.target.value })}
                      className="w-full px-4 py-2 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 focus:border-[#5A5A40] rounded-xl outline-none transition-all font-sans text-base text-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-[#5A5A40]/50 mb-1 font-bold">Description</label>
                    <textarea
                      rows={3}
                      value={sequence.description || ''}
                      onChange={(e) => setSequence({ ...sequence, description: e.target.value })}
                      placeholder="시퀀스에 대한 설명을 입력하세요."
                      className="w-full px-4 py-2 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 focus:border-[#5A5A40] rounded-xl outline-none transition-all text-sm text-[#1A1A1A]/70 resize-none"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    className="w-full bg-[#5A5A40] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all shadow-md active:scale-95 text-sm"
                  >
                    <Save size={16} />
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingPose && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/40 backdrop-blur-sm p-4"
            onClick={() => setEditingPose(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="w-full max-w-[500px] bg-white border border-[#5A5A40]/10 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleUpdateNode} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#5A5A40]">Edit Pose</h3>
                  <button type="button" onClick={() => setEditingPose(null)} className="text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[8px] uppercase tracking-widest text-[#5A5A40]/50 mb-0.5 font-bold">Name</label>
                    <input
                      autoFocus
                      type="text"
                      value={editingPose.name}
                      onChange={(e) => setEditingPose({ ...editingPose, name: e.target.value })}
                      className="w-full px-3 py-1.5 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 focus:border-[#5A5A40] rounded-lg outline-none transition-all font-sans text-sm text-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] uppercase tracking-widest text-[#5A5A40]/50 mb-0.5 font-bold">Description</label>
                    <textarea
                      rows={6}
                      value={editingPose.description}
                      onChange={(e) => setEditingPose({ ...editingPose, description: e.target.value })}
                      placeholder="자세에 대한 설명을 입력하세요."
                      className="w-full px-3 py-1.5 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 focus:border-[#5A5A40] rounded-lg outline-none transition-all text-sm text-[#1A1A1A]/70 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] uppercase tracking-widest text-[#5A5A40]/50 mb-0.5 font-bold">Duration (min)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editingPose.duration || 0}
                      onChange={(e) => setEditingPose({ ...editingPose, duration: parseFloat(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 focus:border-[#5A5A40] rounded-lg outline-none transition-all text-sm text-[#1A1A1A]"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <button
                    type="submit"
                    className="w-full bg-[#5A5A40] text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all shadow-md shadow-[#5A5A40]/5 active:scale-95 text-xs"
                  >
                    <Save size={14} />
                    Save Changes
                  </button>

                  {editingPose.id !== sequence.id && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteNode(editingPose.id);
                        setEditingPose(null);
                      }}
                      className="w-full bg-red-50 text-red-500 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all text-[10px] border border-red-100"
                    >
                      <X size={12} />
                      Delete Node
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global FAQ Panel */}
      <FAQ faqItems={faqItems} onUpdate={setFaqItems} isSaving={faqSaving} />
    </div>
  );
}
