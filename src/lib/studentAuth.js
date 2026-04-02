import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SALT_ROUNDS = 10;

export async function onboardStudent(parentId, studentIdentifier, additionalData) {
  const rawPin = Math.floor(1000 + Math.random() * 9000).toString();
  const pinHash = await bcrypt.hash(rawPin, SALT_ROUNDS);

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({
      role: 'student',
      linked_parent_id: parentId, // Updated to match your schema
      student_identifier: studentIdentifier,
      pin_hash: pinHash,
      // Include any other required defaults like xp: 0, etc.
      ...additionalData 
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to onboard student: ${error.message}`);

  return { 
    success: true, 
    student: newProfile, 
    temporaryPin: rawPin 
  };
}

export async function verifyStudentLogin(studentIdentifier, enteredPin) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, pin_hash')
    .eq('role', 'student')
    .eq('student_identifier', studentIdentifier)
    .single();

  if (error || !profile) {
    return { authenticated: false, message: "Student profile not found." };
  }

  // If they somehow have a null hash (e.g., missed migration), block login to be safe
  if (!profile.pin_hash) {
     return { authenticated: false, message: "Account setup incomplete. Please reset PIN." };
  }

  const isValid = await bcrypt.compare(enteredPin, profile.pin_hash);

  if (isValid) {
    return { authenticated: true, studentId: profile.id };
  } else {
    return { authenticated: false, message: "Incorrect PIN." };
  }
}

export async function resetStudentPin(parentId, studentId) {
  const newRawPin = Math.floor(1000 + Math.random() * 9000).toString();
  const pinHash = await bcrypt.hash(newRawPin, SALT_ROUNDS);

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update({ pin_hash: pinHash })
    .eq('id', studentId)
    .eq('linked_parent_id', parentId) // Updated to match your schema
    .select('student_identifier')
    .single();

  if (error || !updatedProfile) {
    throw new Error("Unauthorized or student not found.");
  }

  return { 
    success: true, 
    studentIdentifier: updatedProfile.student_identifier,
    newPin: newRawPin 
  };
}