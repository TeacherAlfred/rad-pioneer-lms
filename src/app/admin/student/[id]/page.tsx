import ComprehensiveStudentProfile from "@/components/shared/ComprehensiveStudentProfile";

export default async function AdminStudentView({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <ComprehensiveStudentProfile studentId={resolvedParams.id} role="admin" />;
}