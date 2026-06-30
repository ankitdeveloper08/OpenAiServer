import prisma from "../prisma/prismaClient.js";

const DAILY_LIMIT = Number(process.env.DAILY_PROMPT_LIMIT) || 6;

export const checkPromptLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let usage = await prisma.promptUsage.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    // First prompt of the day
    if (!usage) {
      usage = await prisma.promptUsage.create({
        data: {
          userId,
          date: today,
          promptCount: 1,
        },
      });
      req.promptUsage = {
        used: 1,
        remaining: DAILY_LIMIT - 1,
      };
      return next();
    }
    // Already exhausted
    if (usage.promptCount >= DAILY_LIMIT) {
      return res.status(429).json({
        success: false,
        message: "Daily prompt limit reached.",
        used: usage.promptCount,
        remaining: 0,
        isLimitReached: true,
      });
    }

    // Increment usage
    usage = await prisma.promptUsage.update({
      where: {
        id: usage.id,
      },
      data: {
        promptCount: {
          increment: 1,
        },
      },
    });
    const remaining = DAILY_LIMIT - usage.promptCount;

    res.setHeader("X-Remaining-Prompts", remaining);
    req.promptUsage = {
      used: usage.promptCount,
      remaining,
    };
    next();
  } catch (error) {
    console.error("Prompt limiter error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to validate prompt limit.",
    });
  }
};
