import { NextResponse } from 'next/server';
import { resetStudentPin } from '@/lib/studentAuth';

export async function POST(request) {
  try {
    const { parentId, studentId } = await request.json();

    if (!parentId || !studentId) {
      return NextResponse.json(
        { error: "Missing required fields" }, 
        { status: 400 }
      );
    }

    const result = await resetStudentPin(parentId, studentId);
    
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error("PIN Reset Error:", error);
    return NextResponse.json(
      { error: "Failed to reset PIN. Please try again." }, 
      { status: 500 }
    );
  }
}