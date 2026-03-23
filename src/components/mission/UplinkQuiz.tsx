"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Zap, ChevronRight, Award } from "lucide-react";
import { useMission } from "@/context/MissionContext";

interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number;
}

const MISSION_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Which Logic Gate only outputs 'True' if BOTH inputs are 'True'?",
    options: ["OR Gate", "AND Gate", "NOT Gate", "NAND Gate"],
    correctAnswer: 1,
  },
  {
    id: 2,
    text: "In Minecraft Redstone, what does a 'NOT' gate do to a signal?",
    options: ["Doubles it", "Splits it", "Inverts it", "Deletes it"],
    correctAnswer: 2,
  }
];

export default function UplinkQuiz({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const { awardXP } = useMission();

  const handleVerify = () => {
    const correct = selectedOption === MISSION_QUESTIONS[currentStep].correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      setTimeout(() => {
        if (currentStep < MISSION_QUESTIONS.length - 1) {
          setCurrentStep(prev => prev + 1);
          setSelectedOption(null);
          setIsCorrect(null);
        } else {
          awardXP(150); // Final verification reward
          onComplete();
        }
      }, 1500);
    }
  };

  const question = MISSION_QUESTIONS[currentStep];

  return (
    <div className="max-w-2xl mx-auto bg-[#020617] border border-white/10 rounded-[48px] p-10 shadow-2xl relative overflow-hidden">
      {/* Brand Aesthetic: Subtle Gradient Corner */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#45a79a]/5 blur-3xl rounded-full" />

      <div className="relative z-10 space-y-8">
        {/* Progress Header */}
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5574a9]">
            Verification_In_Progress
          </span>
          <span className="text-[10px] font-black text-slate-500">
            {currentStep + 1} / {MISSION_QUESTIONS.length}
          </span>
        </div>

        {/* Question Text */}
        <h2 className="text-2xl md:text-3xl font-black text-white italic leading-tight uppercase tracking-tighter">
          {question.text}
        </h2>

        {/* Options Grid */}
        <div className="space-y-3">
          {question.options.map((option, index) => (
            <button
              key={index}
              disabled={isCorrect !== null}
              onClick={() => setSelectedOption(index)}
              className={`w-full p-6 rounded-3xl border-2 text-left transition-all flex justify-between items-center group ${
                selectedOption === index 
                  ? "border-[#5d4385] bg-[#5d4385]/10 text-white" 
                  : "border-white/5 bg-white/5 text-slate-400 hover:border-white/20"
              } ${
                isCorrect === true && selectedOption === index ? "border-[#88be56] bg-[#88be56]/10" : ""
              } ${
                isCorrect === false && selectedOption === index ? "border-[#b83b3c] bg-[#b83b3c]/10" : ""
              }`}
            >
              <span className="font-bold text-sm tracking-tight">{option}</span>
              {selectedOption === index && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  {isCorrect === true ? <Check className="text-[#88be56]" /> : 
                   isCorrect === false ? <X className="text-[#b83b3c]" /> : 
                   <Zap size={16} className="text-[#5d4385]" />}
                </motion.div>
              )}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <button
          disabled={selectedOption === null || isCorrect === true}
          onClick={handleVerify}
          className="w-full h-20 rounded-[28px] bg-white text-[#020617] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isCorrect === true ? "Uplink Verified" : "Run Verification"}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}