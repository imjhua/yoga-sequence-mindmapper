import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Edit3, X, ChevronDown, Save, MessageCircle } from 'lucide-react';
import { FAQItem } from '../types';

interface FAQProps {
  faqItems: FAQItem[];
  onUpdate: (faqItems: FAQItem[]) => void;
  isSaving?: boolean;
}

const FAQ: React.FC<FAQProps> = ({ faqItems, onUpdate, isSaving = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<Partial<FAQItem>>({});

  const handleAddFAQ = useCallback(() => {
    setIsAdding(true);
    setEditForm({
      id: `faq-${Date.now()}`,
      question: '',
      answer: ''
    });
  }, []);

  const handleSaveNewFAQ = useCallback(() => {
    if (editForm.id && editForm.question && editForm.answer) {
      onUpdate([...faqItems, editForm as FAQItem]);
      setIsAdding(false);
      setEditForm({});
    }
  }, [editForm, faqItems, onUpdate]);

  const handleEditFAQ = useCallback((item: FAQItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId && editForm.id) {
      const updated = faqItems.map(item =>
        item.id === editingId ? (editForm as FAQItem) : item
      );
      onUpdate(updated);
      setEditingId(null);
      setEditForm({});
    }
  }, [editingId, editForm, faqItems, onUpdate]);

  const handleDeleteFAQ = useCallback((id: string) => {
    onUpdate(faqItems.filter(item => item.id !== id));
  }, [faqItems, onUpdate]);

  const handleCancel = useCallback(() => {
    setIsAdding(false);
    setEditingId(null);
    setEditForm({});
  }, []);

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#5A5A40] hover:bg-[#4A4A30] text-white shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="FAQ"
      >
        <MessageCircle size={24} />
      </motion.button>

      {/* FAQ Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 right-0 top-0 z-30 w-1/2 bg-[#F5F2ED] shadow-2xl flex flex-col border-l border-[#5A5A40]/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 p-4 pb-4 border-b border-[#5A5A40]/10 bg-white/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1A1A1A] uppercase tracking-wide">FAQ</h2>
                <span className="text-xs text-[#5A5A40]/60 font-medium">
                  {faqItems.length}
                </span>
                {isSaving && (
                  <span className="text-xs text-[#5A5A40]/40 font-medium animate-pulse">
                    저장중...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddFAQ}
                  className="p-2 rounded-lg bg-[#5A5A40] hover:bg-[#4A4A30] text-white transition-all border border-[#5A5A40] shadow-sm active:scale-95"
                  title="새 FAQ 추가"
                >
                  <Plus size={18} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg bg-white/60 hover:bg-white text-[#5A5A40] transition-all border border-[#5A5A40]/10 shadow-sm active:scale-95"
                  title="닫기"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* FAQ Items */}
            <div className="flex-1 overflow-y-auto space-y-2 p-3">
              <AnimatePresence>
                {/* Add Form */}
                {isAdding && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white border-2 border-[#5A5A40] rounded-2xl p-3"
                  >
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm font-bold text-[#5A5A40] mb-1">
                          질문
                        </label>
                        <input
                          type="text"
                          autoFocus
                          value={editForm.question || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, question: e.target.value })
                          }
                          placeholder="질문을 입력하세요"
                          className="w-full px-3 py-2 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 rounded-lg outline-none focus:border-[#5A5A40] text-sm text-[#1A1A1A]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-[#5A5A40] mb-1">
                          답변
                        </label>
                        <textarea
                          value={editForm.answer || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, answer: e.target.value })
                          }
                          placeholder="답변을 입력하세요"
                          rows={24}
                          className="w-full px-3 py-2 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 rounded-lg outline-none focus:border-[#5A5A40] text-sm text-[#1A1A1A] resize-none"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveNewFAQ}
                          disabled={!editForm.question || !editForm.answer}
                          className="flex-1 px-3 py-2 bg-[#5A5A40] hover:bg-[#4A4A30] disabled:bg-[#5A5A40]/50 text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <Save size={14} />
                          저장
                        </button>
                        <button
                          onClick={handleCancel}
                          className="flex-1 px-3 py-2 bg-white/60 hover:bg-white border border-[#5A5A40]/10 text-[#5A5A40] rounded-lg text-sm font-bold transition-all"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* FAQ Items */}
                {faqItems.map(item => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white border border-[#5A5A40]/10 rounded-xl overflow-hidden hover:border-[#5A5A40]/30 transition-all"
                  >
                    {editingId === item.id ? (
                      // Edit Mode
                      <div className="p-3 space-y-2">
                        <div>
                          <label className="block text-sm font-bold text-[#5A5A40] mb-1">
                            질문
                          </label>
                          <input
                            type="text"
                            value={editForm.question || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, question: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 rounded-lg outline-none focus:border-[#5A5A40] text-sm text-[#1A1A1A]"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-[#5A5A40] mb-1">
                            답변
                          </label>
                          <textarea
                            value={editForm.answer || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, answer: e.target.value })
                            }
                            rows={24}
                            className="w-full px-3 py-2 bg-[#F5F2ED]/40 border border-[#5A5A40]/10 rounded-lg outline-none focus:border-[#5A5A40] text-sm text-[#1A1A1A] resize-none"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="flex-1 px-3 py-2 bg-[#5A5A40] hover:bg-[#4A4A30] text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="flex-1 px-3 py-2 bg-white/60 hover:bg-white border border-[#5A5A40]/10 text-[#5A5A40] rounded-lg text-sm font-bold transition-all"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Display Mode
                      <>
                        <button
                          onClick={() =>
                            setExpandedId(expandedId === item.id ? null : item.id)
                          }
                          className="w-full p-3 flex items-start justify-between gap-2 hover:bg-[#F5F2ED]/30 transition-colors text-left"
                        >
                          <p className="text-sm font-semibold text-[#1A1A1A] flex-1">
                            {item.question}
                          </p>
                          <ChevronDown
                            size={16}
                            className={`text-[#5A5A40] transition-transform flex-shrink-0 ${
                              expandedId === item.id ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* Answer */}
                        <AnimatePresence>
                          {expandedId === item.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="border-t border-[#5A5A40]/10 bg-[#F5F2ED]/30 px-3 py-2"
                            >
                              <p className="text-sm text-[#1A1A1A]/80 leading-relaxed mb-2 whitespace-pre-wrap">
                                {item.answer}
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditFAQ(item)}
                                  className="flex-1 px-2 py-1.5 bg-white/60 hover:bg-white border border-[#5A5A40]/10 text-[#5A5A40] rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1"
                                >
                                  <Edit3 size={12} />
                                  수정
                                </button>
                                <button
                                  onClick={() => handleDeleteFAQ(item.id)}
                                  className="flex-1 px-2 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1"
                                >
                                  <Trash2 size={12} />
                                  삭제
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Empty State */}
              {faqItems.length === 0 && !isAdding && (
                <div className="flex items-center justify-center py-8">
                  <p className="text-[#5A5A40]/40 text-center font-medium text-xs">
                    FAQ가 없습니다.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-20 bg-black/20"
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default FAQ;
