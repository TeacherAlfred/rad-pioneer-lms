"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Zap, Play, Box, Cpu, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";

export type BlockCategory = 'trigger' | 'rule' | 'action';

export interface LogicBlock {
  id: string;
  category: BlockCategory;
  label: string;
  makecode_drawer: string;
  makecode_color: string;
  children: LogicBlock[];
}

const LOGIC_RULES = [
  { id: 'r1', label: 'IF [condition] THEN...', makecode_drawer: 'Logic', makecode_color: '#00b3b3', category: 'rule' as const },
  { id: 'r2', label: 'REPEAT [x] TIMES...', makecode_drawer: 'Loops', makecode_color: '#00a654', category: 'rule' as const },
  { id: 'r3', label: 'WAIT FOR [time] THEN...', makecode_drawer: 'Basic', makecode_color: '#1e90ff', category: 'rule' as const },
];

interface NestedLogicBuilderProps {
  selectedInput: any | null;
  selectedOutput: any | null;
  onSubmitBlueprint: (blueprint: LogicBlock[]) => void;
}

export default function NestedLogicBuilder({ selectedInput, selectedOutput, onSubmitBlueprint }: NestedLogicBuilderProps) {
  
  const [workspaceMode, setWorkspaceMode] = useState<'plan' | 'build'>('plan');

  const AVAILABLE_INPUTS = selectedInput ? [
    { id: `in-${selectedInput.id}`, label: `When ${selectedInput.name} triggers`, makecode_drawer: selectedInput.makecode_drawer, makecode_color: selectedInput.makecode_color, category: 'trigger' as const }
  ] : [];

  const AVAILABLE_OUTPUTS = selectedOutput ? [
    { id: `out-${selectedOutput.id}`, label: `Activate ${selectedOutput.name}`, makecode_drawer: selectedOutput.makecode_drawer, makecode_color: selectedOutput.makecode_color, category: 'action' as const }
  ] : [];

  const [logicTree, setLogicTree] = useState<LogicBlock[]>([
    {
      id: 'root-start',
      category: 'trigger',
      label: 'START: When System Powers On',
      makecode_drawer: 'Basic',
      makecode_color: '#1e90ff',
      children: []
    }
  ]);

  const [activeParentId, setActiveParentId] = useState<string | null>(null);

  const addBlockToParent = (parentId: string, newBlockData: any) => {
    const newBlock: LogicBlock = {
      ...newBlockData,
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      children: []
    };

    const recursiveAdd = (blocks: LogicBlock[]): LogicBlock[] => {
      return blocks.map(block => {
        if (block.id === parentId) {
          return { ...block, children: [...block.children, newBlock] };
        }
        if (block.children.length > 0) {
          return { ...block, children: recursiveAdd(block.children) };
        }
        return block;
      });
    };

    setLogicTree(recursiveAdd(logicTree));
    setActiveParentId(null);
  };

  const removeBlock = (idToRemove: string) => {
    const recursiveRemove = (blocks: LogicBlock[]): LogicBlock[] => {
      return blocks.filter(b => b.id !== idToRemove).map(block => ({
        ...block,
        children: recursiveRemove(block.children)
      }));
    };
    setLogicTree(recursiveRemove(logicTree));
  };

  const RecursiveBlockRenderer = ({ block, depth = 0 }: { block: LogicBlock, depth?: number }) => {
    const isRoot = block.id === 'root-start';
    return (
      <div className={`relative ${depth > 0 ? 'ml-6 md:ml-8 mt-2' : ''}`}>
        {depth > 0 && <div className="absolute -left-6 top-0 w-6 h-8 border-l-2 border-b-2 border-slate-600 rounded-bl-lg" />}
        <motion.div 
          layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 p-3 md:p-4 rounded-xl border border-white/10 shadow-lg relative z-10 group
            ${block.category === 'trigger' ? 'bg-[#1e90ff]/20 border-[#1e90ff]/50' : 
              block.category === 'rule' ? 'bg-[#00a654]/20 border-[#00a654]/50' : 
              'bg-[#b30000]/20 border-[#b30000]/50'}`}
        >
          <div className="flex-1 flex items-center gap-3">
            {block.category === 'trigger' ? <Play size={16} className="text-[#1e90ff]" /> : 
             block.category === 'rule' ? <Cpu size={16} className="text-[#00a654]" /> : 
             <Zap size={16} className="text-[#b30000]" />}
            <span className="text-xs md:text-sm font-bold text-white uppercase tracking-wider">{block.label}</span>
          </div>
          {!isRoot && (
            <button onClick={() => removeBlock(block.id)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400 transition-all">
              <Trash2 size={16} />
            </button>
          )}
        </motion.div>

        <div className="relative pl-2 border-l-2 border-dashed border-slate-700/50 ml-6 mt-2 mb-2">
          <AnimatePresence>
            {block.children.map(child => <RecursiveBlockRenderer key={child.id} block={child} depth={depth + 1} />)}
          </AnimatePresence>
          {activeParentId === block.id ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 p-4 bg-[#0f172a] rounded-xl border border-white/10 shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Next Logic Block</span>
                <button onClick={() => setActiveParentId(null)} className="text-slate-500 hover:text-white text-xs font-bold uppercase">Cancel</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {isRoot && AVAILABLE_INPUTS.map(input => (
                  <button key={input.id} onClick={() => addBlockToParent(block.id, input)} className="text-left p-2 rounded bg-[#1e90ff]/10 hover:bg-[#1e90ff]/30 text-[#1e90ff] text-xs font-bold border border-[#1e90ff]/20 transition-colors">+ {input.label}</button>
                ))}
                {LOGIC_RULES.map(rule => (
                  <button key={rule.id} onClick={() => addBlockToParent(block.id, rule)} className="text-left p-2 rounded bg-[#00a654]/10 hover:bg-[#00a654]/30 text-[#00a654] text-xs font-bold border border-[#00a654]/20 transition-colors">+ {rule.label}</button>
                ))}
                {AVAILABLE_OUTPUTS.map(output => (
                  <button key={output.id} onClick={() => addBlockToParent(block.id, output)} className="text-left p-2 rounded bg-[#b30000]/10 hover:bg-[#b30000]/30 text-[#b30000] text-xs font-bold border border-[#b30000]/20 transition-colors">+ {output.label}</button>
                ))}
              </div>
            </motion.div>
          ) : (
            <button onClick={() => setActiveParentId(block.id)} className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-white/5 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">
              <Plus size={12} /> Add inside
            </button>
          )}
        </div>
      </div>
    );
  };

  const flattenTree = (blocks: LogicBlock[]): LogicBlock[] => {
    let flat: LogicBlock[] = [];
    blocks.forEach(b => { flat.push(b); flat = flat.concat(flattenTree(b.children)); });
    return flat;
  };
  const flattenedBlocks = flattenTree(logicTree);

  const CluesPanel = () => (
    <motion.div layoutId="clues-panel" className="w-full h-full bg-[#0f172a] rounded-[32px] border border-blue-500/20 shadow-2xl flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-blue-500/20 bg-blue-500/10 flex items-center gap-3 shrink-0">
        <Zap className="text-blue-400" size={18} />
        <h2 className="text-sm font-black uppercase tracking-widest text-blue-400">MakeCode Clues</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        <p className="text-xs text-slate-400 leading-relaxed mb-6 font-mono">
          // Keep this open as your reference! Combine these blocks in MakeCode to build your logic.
        </p>
        <AnimatePresence>
          {flattenedBlocks.map((block, idx) => (
            <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={`trans-${block.id}`} className="flex items-stretch gap-4 bg-black/40 rounded-xl p-4 border border-white/5">
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black bg-white/10 text-white shrink-0">{idx + 1}</div>
                {idx < flattenedBlocks.length - 1 && <div className="w-0.5 flex-1 bg-white/10" />}
              </div>
              <div className="flex-1 py-1">
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">{block.category}</p>
                <p className="text-xs text-slate-300 mb-3 truncate">{block.label}</p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={{ borderColor: `${block.makecode_color}40`, backgroundColor: `${block.makecode_color}10` }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: block.makecode_color }} />
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: block.makecode_color }}>{block.makecode_drawer} Drawer</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto h-[700px]">
      
      {/* HEADER CONTROLS */}
      <div className="flex justify-between items-end shrink-0 w-full">
        <div>
          <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">
            {workspaceMode === 'plan' ? 'Part 1: Decomposition' : 'Part 2: Implementation'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {workspaceMode === 'plan' 
              ? 'Draft your logic in plain English. We will translate it into code clues.' 
              : 'Keep your logic clues open here, and build the final system in a new MakeCode tab.'}
          </p>
        </div>
        {workspaceMode === 'plan' ? (
          <button onClick={() => setWorkspaceMode('build')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-105">
            Lock Blueprint & Start Coding <ArrowRight size={16} />
          </button>
        ) : (
          <div className="flex gap-4">
             <button onClick={() => setWorkspaceMode('plan')} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-white/10">
               Edit Blueprint
             </button>
             <button onClick={() => onSubmitBlueprint(logicTree)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105">
               <CheckCircle2 size={16} /> Complete Task & Continue
             </button>
          </div>
        )}
      </div>

      {/* DYNAMIC WORKSPACE LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-6 w-full h-full relative overflow-hidden">
        
        {/* LAYOUT 1: PLAN MODE */}
        {workspaceMode === 'plan' && (
          <>
            <motion.div key="blueprint" layoutId="blueprint-builder" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full lg:w-[60%] bg-[#020617] rounded-[32px] border border-white/10 shadow-2xl flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 bg-black/40 flex items-center gap-3">
                <Box className="text-blue-400" size={18} />
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Plain-English Blueprint</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar">
                {logicTree.map(block => <RecursiveBlockRenderer key={block.id} block={block} />)}
              </div>
            </motion.div>

            <motion.div key="clues-right" layout className="w-full lg:w-[40%] h-full">
              <CluesPanel />
            </motion.div>
          </>
        )}

        {/* LAYOUT 2: BUILD MODE */}
        {workspaceMode === 'build' && (
          <>
            {/* Clues slide to the left */}
            <motion.div key="clues-left" layout className="w-full lg:w-[40%] h-full">
              <CluesPanel />
            </motion.div>

            {/* Launch Station slides in from the right */}
            <motion.div key="launch-station" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="w-full lg:w-[60%] flex flex-col h-full">
              <div className="bg-[#0f172a] rounded-[32px] border border-white/10 shadow-2xl p-12 flex-1 flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden">
                
                {/* Background Decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="w-24 h-24 bg-blue-500/10 border-2 border-blue-500/30 rounded-[32px] flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.3)] relative z-10">
                  <ExternalLink className="text-blue-400 w-12 h-12" />
                </div>
                
                <div className="space-y-4 relative z-10">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">MakeCode Studio</h2>
                  <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed">
                    Keep this window open as your blueprint reference. Click below to open your coding environment in a new tab!
                  </p>
                </div>

                <a 
                  href="https://makecode.microbit.org/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="relative z-10 px-12 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_40px_rgba(59,130,246,0.4)] hover:scale-105 flex items-center gap-3 hover:-translate-y-1"
                >
                  Launch MakeCode <ExternalLink size={20} />
                </a>

              </div>
            </motion.div>
          </>
        )}

      </div>
    </div>
  );
}