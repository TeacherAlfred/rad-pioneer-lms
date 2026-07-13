"use client";

import { use, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import LinearCourseEditor from "@/components/admin/courses/LinearCourseEditor";
import MakecodeCourseEditor from "@/components/admin/courses/MakecodeCourseEditor";
import TrialMissionEditor from "@/components/admin/courses/TrialMissionEditor";
import VideoHubEditor from "@/components/admin/courses/VideoHubEditor";
// NEW: Import the new editor for the video_makecode hardware courses
import VideoMakecodeHubEditor from "@/components/admin/courses/VideoMakecodeHubEditor"; 

// Simple UUID regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CourseEditorDispatcher({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  
  const [templateType, setTemplateType] = useState<string | null>(null);
  const [sandboxType, setSandboxType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SECURITY/ROUTING FIX: Ensure courseId is a valid UUID before hitting Supabase
    // This prevents Turbopack from sending literal "{courseId}" during initial client hydration
    if (!courseId || !UUID_REGEX.test(courseId)) {
       return; 
    }

    async function checkTemplateType() {
      try {
        // Look up the template type AND peek at the first mission's sandbox_type
        const { data, error } = await supabase
          .from('courses')
          .select(`
            template_type,
            modules (
              missions (
                sandbox_type
              )
            )
          `)
          .eq('id', courseId)
          .single();
          
        if (error) throw error;
        
        setTemplateType(data.template_type);
        
        // Safely extract the sandbox_type from the first module's first mission
        const firstMissionSandbox = data.modules?.[0]?.missions?.[0]?.sandbox_type;
        setSandboxType(firstMissionSandbox || null);

      } catch (err) {
        console.error("Failed to route course template type", err);
      } finally {
        setLoading(false);
      }
    }
    
    checkTemplateType();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20 bg-[#020617] h-screen items-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  // DISPATCH LOGIC
  if (templateType === 'makecode_sandbox') {
    return <MakecodeCourseEditor courseId={courseId} />;
  }
  
  if (templateType === 'makecode_trial') {
    return <TrialMissionEditor courseId={courseId} />;
  }

  if (templateType === 'video_hub_sandbox') {
    // Branch the Video Hub UX based on whether it is hardware (MakeCode) or software (Scratch)
    if (sandboxType === 'video_makecode') {
      return <VideoMakecodeHubEditor courseId={courseId} />;
    }
    
    // Default fallback for video_scratch or legacy video hub courses
    return <VideoHubEditor courseId={courseId} />;
  }

  return <LinearCourseEditor courseId={courseId} />;
}