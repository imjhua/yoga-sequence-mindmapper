import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Target, Sparkles, Map as MapIcon, Save, Timer, Code, LayoutGrid, Plus, Edit3, Trash2, RotateCcw } from 'lucide-react';
import MindMap from './components/MindMap';
import MindMapTabs from './components/mindmap/MindMapTabs';
import Timeline from './components/Timeline';
import FAQ from './components/Memo';
import { YogaPose, FAQItem, updateNodeInTree, addNodeToTree, deleteNodeFromTree, findNodeById, moveNodeInTree, formatTime, getSequenceStats } from './types';

// TODO: Replace with your actual GAS Web App URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz1Ls3CrlMEFGIB9cKE1NVS0lI8P1dGA8iELTqt-Frp7mtCTKNfWQ1yfsVBN0hoPnW6lA/exec';

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
          // 유효한 데이터만 필터링 (null, undefined, 빈 객체 제외)
          const validData = Object.entries(data || {})
            .filter(([, value]) => value && Object.keys(value).length > 0)
            .reduce((acc, [key, value]) => {
              acc[key] = value as YogaPose;
              return acc;
            }, {} as Record<string, YogaPose>);

          if (Object.keys(validData).length > 0) {
            setAllSequences(validData);
            
            // 데이터가 로드된 후, 현재 선택된 ID가 유효하지 않으면 첫 번째 데이터 선택
            setSelectedId(prev => {
              const keys = Object.keys(validData).sort((a, b) => a.localeCompare(b));
              if (!prev || !validData[prev]) {
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
  const [view, setView] = useState<'mindmap' | 'timeline'>(() => {
    // 초기 뷰를 화면 크기에 따라 결정
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'timeline' : 'mindmap';
    }
    return 'mindmap';
  });

  // 화면 리사이즈 감지 및 뷰 자동 변경
  useEffect(() => {
    const handleResize = () => {
      setView(() => window.innerWidth < 768 ? 'timeline' : 'mindmap');
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reparentingNodeId, setReparentingNodeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [faqSaving, setFaqSaving] = useState(false);
  const [faqLoaded, setFaqLoaded] = useState(false);
  const [clearingAllChildren, setClearingAllChildren] = useState(false);
  const [deletingTabId, setDeletingTabId] = useState<string | null>(null);

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
        // alert('성공적으로 Google Sheets에 저장되었습니다!');
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

  const handleAddNewSequence = useCallback(async () => {
    if (!GAS_URL) {
      alert('GAS_URL이 설정되지 않았습니다.');
      return;
    }

    const newName = prompt('새 시퀀스 이름을 입력하세요:', '새 요가 시퀀스');
    if (!newName) return;

    const defaultChildren: YogaPose[] = [
      { id: 'node-seated-pose', name: '좌법', description: '', duration: 0, children: [], x: 0.008771704426196791, y: 142.50548235015728 },
      { id: 'node-sitting', name: '시팅', description: '', duration: 0, children: [], x: 1.2108052682254489, y: 205.9318925997109 },
      { id: 'node-buildup', name: '빌드업', description: '', duration: 0, children: [], x: 2.0575475337765567, y: 160.1568020296522 },
      { id: 'node-peak', name: '최종', description: '', duration: 0, children: [], x: 3.1415868849170954, y: 115.00001525982229 },
      { id: 'node-cooldown', name: '쿨다운', description: '', duration: 0, children: [], x: 4.267406783783952, y: 188.65401370342346 },
      { id: 'node-savasana', name: '사바사나', description: '', duration: 0, children: [], x: -1.169705247542307, y: 198.50940855740194 },
    ];

    const newSequence: YogaPose = {
      id: `root-${Date.now()}`,
      name: newName,
      title: '힐링',
      description: '새로운 시퀀스 설명',
      duration: 0,
      priority: 0,
      x: 0,
      y: 0,
      children: defaultChildren
    };

    setIsSaving(true);
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ id: null, data: newSequence }),
      });

      const result = await response.json();
      if (result.status === 'success') {
        const refreshResponse = await fetch(GAS_URL);
        if (refreshResponse.ok) {
          const newData = await refreshResponse.json();
          setAllSequences(newData);
          const keys = Object.keys(newData).sort((a, b) => {
            const numA = parseInt(a.replace('row-', ''));
            const numB = parseInt(b.replace('row-', ''));
            return numA - numB;
          });
          const lastKey = keys[keys.length - 1];
          setSelectedId(lastKey);

          // 새로 추가된 시퀀스를 Google Sheets에 자동 저장
          try {
            await fetch(GAS_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ id: lastKey, data: newData[lastKey] }),
            });
          } catch (error) {
            console.error('Auto-save error:', error);
          }
        }
      }
    } catch (error) {
      console.error('Add error:', error);
      alert('추가 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, []);

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

    // 새 노드를 부모 노드의 위치에 생성
    const newNode: YogaPose = {
      id: `node-${Date.now()}`,
      name: '새로운 자세',
      description: '',
      duration: 0,
      children: [],
      // 부모 노드의 좌표를 그대로 사용
      x: parentNode?.x,
      y: parentNode?.y,
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

  const confirmClearAllChildren = useCallback(() => {
    if (sequence) {
      const defaultChildren: YogaPose[] = [
        { id: 'node-seated-pose', name: '좌법', description: '', duration: 0, children: [], x: 0.008771704426196791, y: 142.50548235015728 },
        { id: 'node-sitting', name: '시팅', description: '', duration: 0, children: [], x: 1.2108052682254489, y: 205.9318925997109 },
        { id: 'node-buildup', name: '빌드업', description: '', duration: 0, children: [], x: 2.0575475337765567, y: 160.1568020296522 },
        { id: 'node-peak', name: '최종', description: '', duration: 0, children: [], x: 3.1415868849170954, y: 115.00001525982229 },
        { id: 'node-cooldown', name: '쿨다운', description: '', duration: 0, children: [], x: 4.267406783783952, y: 188.65401370342346 },
        { id: 'node-savasana', name: '사바사나', description: '', duration: 0, children: [], x: -1.169705247542307, y: 198.50940855740194 },
      ];
      const resetSequence = {
        ...sequence,
        name: '새 요가 시퀀스',
        title: '힐링',
        duration: 0,
        priority: 0,
        x: 0,
        y: 0,
        children: defaultChildren
      };
      setIsSaving(true);
      setTimeout(() => {
        setSequence(resetSequence);
        setClearingAllChildren(false);
        setIsSaving(false);
      }, 600);
    }
  }, [sequence, setSequence]);

  const confirmDeleteTab = useCallback(async () => {
    if (!deletingTabId || !GAS_URL) {
      setDeletingTabId(null);
      return;
    }

    setIsSaving(true);
    setDeletingTabId(null); // 다이얼로그 즉시 닫기
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ id: deletingTabId, data: null, delete: true }),
      });

      const result = await response.json();
      if (result.status === 'success') {
        const newSequences = { ...allSequences };
        delete newSequences[deletingTabId];
        setAllSequences(newSequences);

        // 남은 시퀀스 중 첫 번째 선택
        const keys = Object.keys(newSequences).sort((a, b) => a.localeCompare(b));
        if (keys.length > 0) {
          setSelectedId(keys[0]);
        } else {
          setSelectedId('');
        }
        
        // 로딩 UI를 잠시 보여주기 위해 지연 추가
        await new Promise(resolve => setTimeout(resolve, 600));
      } else {
        alert(`삭제 실패: ${result.message}`);
      }
    } catch (error) {
      console.error('Delete tab error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [deletingTabId, allSequences, GAS_URL, setAllSequences]);

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
      const numA = parseInt(a.replace('row-', ''));
      const numB = parseInt(b.replace('row-', ''));
      return numA - numB;
    }).map(id => ({
      label: allSequences[id]?.title || 'Sequence',
      subLabel: allSequences[id]?.name || '',
      value: id
    }));
  }, [allSequences]);

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3 md:gap-4">
          <div className="w-10 md:w-12 h-10 md:h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-base md:text-xl font-medium">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!sequence) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center text-white p-4 md:p-8 text-center">
        <div className="max-w-md w-full">
          <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">시퀀스 데이터를 찾을 수 없습니다</h2>
          <p className="text-neutral-400 mb-4 md:mb-6 text-sm md:text-base">
            GAS_URL 설정이 올바른지, 그리고 구글 시트에 데이터가 있는지 확인해 주세요.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mb-6 md:mb-8">
            {Object.keys(allSequences).length > 0 ? (
              Object.keys(allSequences).map(id => (
                <button
                  key={id}
                  onClick={() => setSelectedId(id)}
                  className="px-3 md:px-4 py-1.5 md:py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-sm md:text-base"
                >
                  {id}
                </button>
              ))
            ) : (
              <p className="text-xs md:text-sm text-neutral-500">등록된 시퀀스가 없습니다.</p>
            )}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full px-4 md:px-6 py-2 md:py-3 bg-emerald-600 hover:bg-emerald-500 rounded-full transition-colors font-medium text-sm md:text-base"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // <div className="flex flex-row justify-between items-start gap-2">

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-[#F5F2ED] flex-col">
      {/* Header Bar */}
      <header className="relative flex flex-col px-3 md:px-6 pt-3 bg-white/40 backdrop-blur-sm border-b border-[#5A5A40]/5 z-20">
        {/* Title Section */}
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div
            className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsEditingInfo(true)}
          >
            {(() => {
              // 마인드맵 중앙 노드(depth 0, peak-node)명 사용
              const peakPose = sequence?.name || '';
              const displayTitle = peakPose 
                ? `${sequence?.title || 'Yoga Sequence'} - ${peakPose}`
                : (sequence?.title || 'Yoga Sequence');
              return (
                <h1 className="font-sans text-lg md:text-2xl font-bold text-[#1A1A1A] leading-tight truncate md:line-clamp-2">
                  {displayTitle}
                </h1>
              );
            })()}
            <p className="font-sans text-xs md:text-sm text-[#5A5A40] font-medium mt-0.5 md:mt-1 line-clamp-1 md:line-clamp-2">
              {sequence.description || '시퀀스 설명을 추가하세요.'}
            </p>
          </div>
          
          {/* Add New Sequence Button */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <motion.button
              onClick={handleAddNewSequence}
              disabled={isSaving}
              className="w-6 h-6 md:w-10 md:h-10 bg-white/60 hover:bg-white/80 disabled:opacity-50 text-[#5A5A40] rounded-lg shadow-sm border border-[#5A5A40]/20 flex items-center justify-center transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="새 시퀀스 추가"
            >
              <Plus size={14} className="md:w-5 md:h-5" />
            </motion.button>

            {sequence?.children && sequence.children.length > 0 && (
              <motion.button
                onClick={() => setClearingAllChildren(true)}
                className="w-6 h-6 md:w-10 md:h-10 bg-orange-50 hover:bg-orange-100 text-orange-500 rounded-lg shadow-sm border border-orange-200/50 flex items-center justify-center transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="초기화"
              >
                <RotateCcw size={14} className="md:w-5 md:h-5" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 md:gap-3 overflow-x-auto overflow-y-visible -mx-3 md:-mx-6 px-3 md:px-6 py-3">
          {/* View Toggle Buttons - Hidden on mobile, shown in header on md+ */}
          <div className="hidden md:flex items-center gap-1 md:gap-1.5 flex-shrink-0 border-r border-[#5A5A40]/10 pr-2 md:pr-3">
            <button
              onClick={() => setView('mindmap')}
              className={`px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-[11px] font-bold transition-all whitespace-nowrap border border-[#5A5A40]/30 flex items-center gap-1 md:gap-1.5 ${
                view === 'mindmap'
                  ? 'bg-[#5A5A40]/10 text-[#5A5A40]'
                  : 'bg-white/30 text-[#5A5A40]/70 hover:bg-white/50'
              }`}
              title="MindMap View"
            >
              <MapIcon size={12} className="md:w-3.5 md:h-3.5" />
              <span className="hidden sm:inline">MindMap</span>
            </button>
            <button
              onClick={() => setView('timeline')}
              className={`px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-[11px] font-bold transition-all whitespace-nowrap border border-[#5A5A40]/30 flex items-center gap-1 md:gap-1.5 ${
                view === 'timeline'
                  ? 'bg-[#5A5A40]/10 text-[#5A5A40]'
                  : 'bg-white/30 text-[#5A5A40]/70 hover:bg-white/50'
              }`}
              title="Timeline View"
            >
              <Timer size={12} className="md:w-3.5 md:h-3.5" />
              <span className="hidden sm:inline">Timeline</span>
            </button>
          </div>
          {/* Sequence Tabs - 분리된 컴포넌트 사용 */}
          <MindMapTabs
            activeTab={selectedId}
            onTabChange={setSelectedId}
            tabs={tabs}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {/* Mobile View Toggle Buttons - Only on mobile */}
        <div className="md:hidden fixed bottom-6 right-4 z-40 flex items-center gap-1 bg-white/80 backdrop-blur-sm p-1.5 rounded-lg border border-[#5A5A40]/20 shadow-md">
          <button
            onClick={() => setView('mindmap')}
            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
              view === 'mindmap'
                ? 'bg-[#5A5A40]/10 text-[#5A5A40]'
                : 'bg-white/30 text-[#5A5A40]/70 hover:bg-white/50'
            }`}
            title="MindMap View"
          >
            <MapIcon size={12} />
            <span>지도</span>
          </button>
          <button
            onClick={() => setView('timeline')}
            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
              view === 'timeline'
                ? 'bg-[#5A5A40]/10 text-[#5A5A40]'
                : 'bg-white/30 text-[#5A5A40]/70 hover:bg-white/50'
            }`}
            title="Timeline View"
          >
            <Timer size={12} />
            <span>타임라인</span>
          </button>
        </div>
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

        {/* Loading Overlay for Creating Sequence */}
        <AnimatePresence>
          {isSaving && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#1A1A1A]/40 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <div className="flex flex-col items-center gap-3 md:gap-4">
                <div className="w-10 md:w-12 h-10 md:h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-base md:text-xl font-medium text-white">처리 중입니다...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Action Buttons */}
        <div className="absolute bottom-4 left-4 md:left-auto md:right-4 md:bottom-6 z-40 flex items-center gap-1.5 md:gap-2 bg-white/80 backdrop-blur-md p-1.5 md:p-2 rounded-full border border-[#5A5A40]/10 shadow-md">
          <motion.button
            onClick={handleCopyJson}
            className="p-2 md:p-2.5 bg-[#5A5A40] hover:bg-[#4A4A30] text-white rounded-full transition-all flex items-center justify-center shadow-sm active:scale-95"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            title="Copy JSON"
          >
            <Code size={16} className="md:w-[18px] md:h-[18px]" />
          </motion.button>
          <motion.button
            onClick={handleSaveToFile}
            disabled={isSaving}
            className="p-2 md:p-2.5 bg-[#5A5A40] hover:bg-[#4A4A30] disabled:opacity-50 text-white rounded-full transition-all flex items-center justify-center shadow-sm active:scale-95"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            title="Save to Google Sheets"
          >
            <Save size={16} className="md:w-[18px] md:h-[18px]" />
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
              className="w-full max-w-xs bg-white border border-[#5A5A40]/10 rounded-2xl shadow-2xl p-4 md:p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 md:w-12 h-10 md:h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <X size={20} className="md:w-6 md:h-6" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-[#1A1A1A] mb-2">정말 삭제하시겠습니까?</h3>
              <p className="text-[11px] md:text-xs text-[#1A1A1A]/60 mb-4 md:mb-6">
                '{findNodeById(sequence, deletingId)?.name}' 노드에 입력된 정보가 있습니다. 삭제하면 복구할 수 없습니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[11px] md:text-xs font-bold text-[#5A5A40] bg-[#F5F2ED] hover:bg-[#EBE8E2] transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[11px] md:text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
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
              <form onSubmit={handleUpdateSequenceInfo} className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A5A40]">Edit Sequence Info</h3>
                  <button type="button" onClick={() => setIsEditingInfo(false)} className="text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors">
                    <X size={18} className="md:w-5 md:h-5" />
                  </button>
                </div>

                <div className="space-y-3 md:space-y-4">
                  <div>
                    <label className="block text-[8px] md:text-[9px] uppercase tracking-widest text-[#5A5A40]/50 mb-0.5 md:mb-1 font-bold">Sequence Title</label>
                    <input
                      autoFocus
                      type="text"
                      value={sequence.title || ''}
                      onChange={(e) => setSequence({ ...sequence, title: e.target.value })}
                      className="w-full px-3 md:px-4 py-1.5 md:py-2 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 focus:border-[#5A5A40] rounded-lg md:rounded-xl outline-none transition-all font-sans text-sm text-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] md:text-[9px] uppercase tracking-widest text-[#5A5A40]/50 mb-0.5 md:mb-1 font-bold">Description</label>
                    <textarea
                      rows={3}
                      value={sequence.description || ''}
                      onChange={(e) => setSequence({ ...sequence, description: e.target.value })}
                      placeholder="시퀀스에 대한 설명을 입력하세요."
                      className="w-full px-3 md:px-4 py-1.5 md:py-2 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 focus:border-[#5A5A40] rounded-lg md:rounded-xl outline-none transition-all text-sm text-[#1A1A1A]/70 resize-none"
                    />
                  </div>
                </div>

                <div className="mt-4 md:mt-6">
                  <button
                    type="submit"
                    className="w-full bg-[#5A5A40] text-white py-2 md:py-3 rounded-lg md:rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all shadow-md active:scale-95 text-xs md:text-sm"
                  >
                    <Save size={14} className="md:w-4 md:h-4" />
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
              className="w-full max-w-[500px] bg-white border border-[#5A5A40]/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleUpdateNode} className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4 sticky top-0 bg-white">
                  <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A5A40]">Edit Pose</h3>
                  <button type="button" onClick={() => setEditingPose(null)} className="text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors">
                    <X size={16} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>

                <div className="space-y-2 md:space-y-2.5">
                  <div>
                    <label className="block text-[8px] uppercase tracking-widest text-[#5A5A40]/50 mb-0.5 font-bold">Name</label>
                    <input
                      autoFocus
                      type="text"
                      value={editingPose.name}
                      onChange={(e) => setEditingPose({ ...editingPose, name: e.target.value })}
                      className="w-full px-3 py-1.5 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 focus:border-[#5A5A40] rounded-lg outline-none transition-all font-sans text-xs md:text-sm text-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] uppercase tracking-widest text-[#5A5A40]/50 mb-0.5 font-bold">Description</label>
                    <textarea
                      rows={4}
                      value={editingPose.description}
                      onChange={(e) => setEditingPose({ ...editingPose, description: e.target.value })}
                      placeholder="자세에 대한 설명을 입력하세요."
                      className="w-full px-3 py-1.5 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 focus:border-[#5A5A40] rounded-lg outline-none transition-all text-xs md:text-sm text-[#1A1A1A]/70 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] uppercase tracking-widest text-[#5A5A40]/50 mb-0.5 font-bold">Duration (min)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editingPose.duration || 0}
                      onChange={(e) => setEditingPose({ ...editingPose, duration: parseFloat(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 focus:border-[#5A5A40] rounded-lg outline-none transition-all text-xs md:text-sm text-[#1A1A1A]"
                    />
                  </div>
                </div>

                <div className="mt-4 md:mt-6 space-y-1.5">
                  <button
                    type="submit"
                    className="w-full bg-[#5A5A40] text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all shadow-md shadow-[#5A5A40]/5 active:scale-95 text-xs md:text-sm"
                  >
                    <Save size={12} className="md:w-3.5 md:h-3.5" />
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
                      <X size={10} className="md:w-3 md:h-3" />
                      Delete Node
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear All Children Confirmation Modal */}
      <AnimatePresence>
        {clearingAllChildren && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1A1A1A]/40 backdrop-blur-sm p-4"
            onClick={() => setClearingAllChildren(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xs bg-white border border-[#5A5A40]/10 rounded-2xl shadow-2xl p-4 md:p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 md:w-12 h-10 md:h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <RotateCcw size={20} className="md:w-6 md:h-6" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-[#1A1A1A] mb-2">노드를 초기화하시겠습니까?</h3>
              <p className="text-[11px] md:text-xs text-[#1A1A1A]/60 mb-4 md:mb-6">
                현재 중앙 노드와 모든 자식 노드가 기본값으로 초기화됩니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setClearingAllChildren(false)}
                  className="flex-1 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[11px] md:text-xs font-bold text-[#5A5A40] bg-[#F5F2ED] hover:bg-[#EBE8E2] transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={confirmClearAllChildren}
                  disabled={isSaving}
                  className="flex-1 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[11px] md:text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  초기화
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Tab Confirmation Modal */}
      <AnimatePresence>
        {deletingTabId && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1A1A1A]/40 backdrop-blur-sm p-4"
            onClick={() => setDeletingTabId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xs bg-white border border-[#5A5A40]/10 rounded-2xl shadow-2xl p-4 md:p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 md:w-12 h-10 md:h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <X size={20} className="md:w-6 md:h-6" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-[#1A1A1A] mb-2">시퀀스를 삭제하시겠습니까?</h3>
              <p className="text-[11px] md:text-xs text-[#1A1A1A]/60 mb-4 md:mb-6">
                '{allSequences[deletingTabId]?.title}' 시퀀스가 완전히 삭제됩니다. 복구할 수 없습니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeletingTabId(null)}
                  className="flex-1 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[11px] md:text-xs font-bold text-[#5A5A40] bg-[#F5F2ED] hover:bg-[#EBE8E2] transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={confirmDeleteTab}
                  disabled={isSaving}
                  className="flex-1 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[11px] md:text-xs font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global FAQ Panel */}
      {/* <FAQ faqItems={faqItems} onUpdate={setFaqItems} isSaving={faqSaving} /> */}
    </div>
  );
}
