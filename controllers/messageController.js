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
        role,
        content,
      },
    });

    // Auto rename chat on first user message
    if (role === "user") {
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { messages: true },
      });

      const userMessages = chat.messages.filter((m) => m.role === "user");

      if (chat.title === "New Chat" && userMessages.length === 1) {
        await prisma.chat.update({
          where: { id: chatId },
          data: {
            title: content.substring(0, 30),
          },
        });
      }
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};