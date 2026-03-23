"use client";

import React, { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

interface BlocklyComponentProps {
  missionType: string;
  onCodeChange?: (code: string) => void;
}

export default function BlocklyComponent({ missionType, onCodeChange }: BlocklyComponentProps) {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspace = useRef<Blockly.WorkspaceSvg | null>(null);

  useEffect(() => {
    if (!blocklyDiv.current) return;

    // 1. Define the Toolbox with proper type casting to avoid the 'custom' error
    const getToolbox = () => {
      const contents: any[] = [
        { 
          kind: 'category', 
          name: 'Logic', 
          colour: '#60a5fa', 
          contents: [
            { kind: 'block', type: 'controls_if' }, 
            { kind: 'block', type: 'logic_compare' }
          ] 
        },
        { 
          kind: 'category', 
          name: 'Math', 
          colour: '#4ade80', 
          contents: [
            { kind: 'block', type: 'math_number' }
          ] 
        },
      ];

      // Only add Variables if the mission requires it
      if (missionType === 'variables' || missionType === 'scratch') {
        contents.push({ 
          kind: 'category', 
          name: 'Variables', 
          custom: 'VARIABLE', // TS now accepts this because of the 'any[]' cast
          colour: '#f59e0b' 
        });
      }

      return { kind: 'categoryToolbox', contents };
    };

    // 2. Inject Blockly
    workspace.current = Blockly.inject(blocklyDiv.current, {
      toolbox: getToolbox(),
      grid: { spacing: 20, length: 3, colour: '#1e293b', snap: true },
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 1.0 },
      theme: Blockly.Themes.Classic,
    });

    // 3. Listen for changes
    const handleChange = () => {
      const code = javascriptGenerator.workspaceToCode(workspace.current!);
      if (onCodeChange) onCodeChange(code);
    };

    workspace.current.addChangeListener(handleChange);

    return () => {
      workspace.current?.dispose();
    };
  }, [missionType, onCodeChange]);

  return (
    <div className="w-full h-full relative">
      <div ref={blocklyDiv} className="w-full h-full" />
    </div>
  );
}