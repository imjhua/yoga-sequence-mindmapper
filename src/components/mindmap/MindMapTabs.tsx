import React from 'react';

interface MindMapTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: { label: string; subLabel?: string; value: string }[];
}

const MindMapTabs: React.FC<MindMapTabsProps> = ({ activeTab, onTabChange, tabs }) => {
  return (
    <div className="flex gap-2 mb-4">
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={`px-4 py-2 rounded-lg font-bold text-xs transition-all border border-[#5A5A40]/10 shadow-sm min-w-[80px] flex flex-col items-center justify-center
            ${activeTab === tab.value ? 'bg-[#5A5A40] text-white' : 'bg-white text-[#5A5A40] hover:bg-[#F5F2ED]'}`}
        >
          <span className="truncate max-w-[100px]">{tab.label}</span>
          {tab.subLabel && <span className="truncate max-w-[100px] text-[11px] font-normal opacity-80">{tab.subLabel}</span>}
        </button>
      ))}
    </div>
  );
};

export default MindMapTabs;
