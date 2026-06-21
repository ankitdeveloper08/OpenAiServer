import prisma from "../prisma/prismaClient.js";

// ➜ Add message to chat
export const addMessage = async (req, res) => {
  try {
    const { chatId, role, content } = req.body;

    if (!chatId || !role || !content) {
      return res.status(400).json({
        message: "chatId, role, content are required",
      });
    }

    const message = await prisma.chatMessage.create({
      data: {
        chatId,
        role,       // "user" or "assistant"
        content,
      },
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};