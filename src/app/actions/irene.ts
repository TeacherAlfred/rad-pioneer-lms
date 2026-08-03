"use server";

import { db } from "../../db/index";
import { projIreneResponses, projIreneVoters, projIreneVotes } from "../../db/schema/irene";
import { eq } from "drizzle-orm"; // <-- We need this for the .select() filter

export async function getIreneLeaderboard() {
  try {
    // 1. Fetch verified responses using standard SQL select (more resilient than db.query)
    const responses = await db.select()
      .from(projIreneResponses)
      .where(eq(projIreneResponses.isVerified, true));

    // 2. Fetch all votes
    const votes = await db.select().from(projIreneVotes);

    // 3. Aggregate vote counts manually
    const classStats: Record<string, { grade: string, totalVotes: number }> = {};
    const responseStats: Record<string, number> = {};

    responses.forEach(r => {
      if (!classStats[r.className]) classStats[r.className] = { grade: r.grade, totalVotes: 0 };
    });

    votes.forEach(vote => {
      const rId = vote.responseId;
      const parentResponse = responses.find(r => r.id === rId);
      
      if (parentResponse) {
        const className = parentResponse.className;
        if (classStats[className]) classStats[className].totalVotes += 1;
      }
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
  } catch (error: any) {
    console.error("Leaderboard DB Error:", error);
    // SURFACING THE REAL ERROR
    return { success: false, error: error.message || String(error) };
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

    await db.transaction(async (tx) => {
      const [newVoter] = await tx.insert(projIreneVoters).values({
        email: payload.votingTab === 'email' ? payload.contactInput : null,
        whatsappNumber: payload.votingTab === 'whatsapp' ? payload.contactInput : null,
        deviceId: payload.deviceId,
        voterType: payload.votingTab,
        votesAwarded: votesAwarded,
        expiresAt: expiresAt,
      }).returning();

      const votePayloads = Array.from({ length: votesAwarded }).map(() => ({
        voterId: newVoter.id,
        responseId: payload.responseId,
      }));
      
      await tx.insert(projIreneVotes).values(votePayloads);
    });

    return { success: true };
  } catch (error: any) {
    console.error("Voting error:", error);
    return { success: false, error: error.message || String(error) };
  }
}