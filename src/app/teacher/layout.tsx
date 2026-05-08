import FloatingTeacherChat from "@/components/teacher/FloatingTeacherChat";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* This renders whatever page the teacher is currently on */}
      {children}
      
      {/* This drops the floating chat globally over EVERY teacher page */}
      <FloatingTeacherChat />
    </>
  );
}