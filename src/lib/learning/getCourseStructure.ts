import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

export async function getCourseStructure(courseId: string, studentId: string) {
  const supabase = await createSupabaseServerComponentClient();

  // 1. Get all lessons for this course to determine total weeks
  // (Assuming 1 lesson per week for the Term Streak calculation)
  const { data: lessons, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, order')
    .eq('course_id', courseId)
    .order('order', { ascending: true });

  // 2. Get student progress to see what is "Completed" vs "Current"
  const { data: progress } = await supabase
    .from('student_lesson_progress')
    .select('lesson_id, completed')
    .eq('student_id', studentId);

  if (lessonError || !lessons) return [];

  // 3. Map into our WeekStatus shape
  return lessons.map((lesson, index) => {
    const isCompleted = progress?.find(p => p.lesson_id === lesson.id)?.completed || false;
    
    // Logic: The first incomplete lesson is the "Current" one
    const prevCompleted = index === 0 || (progress?.find(p => p.lesson_id === lessons[index-1].id)?.completed);
    const isCurrent = !isCompleted && prevCompleted;

    return {
      weekNumber: index + 1,
      lessonId: lesson.id,
      title: lesson.title,
      attended: isCompleted,
      lmsDays: 0, // We would fetch this from our Overdrive logic separately
      isCurrent: isCurrent
    };
  });
}