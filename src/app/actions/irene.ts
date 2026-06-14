"use server";

import { db } from "../../db/index";
// UPDATE: Now importing directly from the new domain-specific schema file
import { projIreneResponses, projIreneVoters, projIreneVotes } from "../../db/schema/irene";
import { revalidatePath } from "next/cache";

export async function getIreneLeaderboard() {
  try {
    // 1. Fetch all verified responses
    const responses = await db.query.projIreneResponses.findMany({
      where: (responses, { eq }) => eq(responses.isVerified, true), // Only show verified
    });

    // 2. Fetch all votes
    const votes = await db.query.projIreneVotes.findMany({
      with: { response: true }
    });

    // 3. Aggregate vote counts in JS (matches your previous frontend logic)
    const classStats: Record<string, { grade: string, totalVotes: number }> = {};
    const responseStats: Record<string, number> = {};

    responses.forEach(r => {
      if (!classStats[r.className]) classStats[r.className] = { grade: r.grade, totalVotes: 0 };
    });

    votes.forEach(vote => {
      const className = vote.response?.className;
      const rId = vote.responseId;
      if (className && classStats[className]) classStats[className].totalVotes += 1;
      responseStats[rId] = (responseStats[rId] || 0) + 1;
    });

    // Attach total votes to responses
    const finalResponses = responses.map(r => ({
      id: r.id,
      parent_first_name: r.parentFirstName,
      cub_initial: r.cubInitial,
      class_name: r.className,
      grade: r.grade,
      q_why_start: r.qWhyStart,
      q_boss_level: r.qBossLevel,
      q_funny_fail: r.qFunnyFail,
      q_weird_habit: r.qWeirdHabit,
      totalVotes: responseStats[r.id] || 0
    }));

    return { success: true, responses: finalResponses, classStats };
  } catch (error) {
    console.error("Leaderboard error:", error);
    return { success: false, error: "Failed to load leaderboard." };
  }
}

export async function castIreneVote(payload: {
  responseId: string;
  deviceId: string;
  votingTab: 'whatsapp' | 'email' | 'anonymous';
  contactInput: string;
}) {
  try {
    const votesAwarded = payload.votingTab === 'whatsapp' ? 15 : payload.votingTab === 'email' ? 5 : 1;
    const expiresAt = new Date(); 
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Run as a transaction so if the vote inserts fail, the voter isn't created either
    await db.transaction(async (tx) => {
      // 1. Create the Voter
      const [newVoter] = await tx.insert(projIreneVoters).values({
        email: payload.votingTab === 'email' ? payload.contactInput : null,
        whatsappNumber: payload.votingTab === 'whatsapp' ? payload.contactInput : null,
        deviceId: payload.deviceId,
        voterType: payload.votingTab,
        votesAwarded: votesAwarded,
        expiresAt: expiresAt,
      }).returning();

      // 2. Create the precise number of Votes requested
      const votePayloads = Array.from({ length: votesAwarded }).map(() => ({
        voterId: newVoter.id,
        responseId: payload.responseId,
      }));
      
      await tx.insert(projIreneVotes).values(votePayloads);
    });

    return { success: true };
  } catch (error) {
    console.error("Voting error:", error);
    return { success: false, error: "Failed to cast vote." };
  }
}