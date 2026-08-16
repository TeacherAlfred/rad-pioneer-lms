// Euclidean distance between two 128-d face-api.js descriptors. Below
// ~0.6 is face-api.js's own standard threshold for "same person" (used
// by its built-in FaceMatcher) - kept here so both the client (drawing
// "possible match" hints) and the server (computing suggestions on
// assignment) agree on the same number.
export const FACE_MATCH_THRESHOLD = 0.6;

export function descriptorDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}
