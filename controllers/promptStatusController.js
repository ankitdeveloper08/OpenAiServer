import prisma from "../prisma/prismaClient.js";

const DAILY_LIMIT = Number(process.env.DAILY_PROMPT_LIMIT) || 6;

export const getPromptStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const usage = await prisma.promptUsage.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });
    const used = usage?.promptCount || 0;
    const remaining = Math.max(DAILY_LIMIT - used, 0);
    return res.json({
      success: true,
      limit: DAILY_LIMIT,
      used,
      remaining,
      isLimitReached: remaining === 0,
      message: remaining === 0 ? "Daily prompt limit reached." : null,
    });
  } catch (error) {
    console.error("Prompt status error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch prompt status.",
    });
  }
};
