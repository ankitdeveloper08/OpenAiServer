import prisma from "../prisma/prismaClient.js";

export const createChat = async (req, res) => {
  try {
    const chat = await prisma.chat.create({
      data: {
        userId: req.user.id,
        title: "New Chat",
      },
    });

    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getChats = async (req, res) => {
  try {
    const chats = await prisma.chat.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    res.json(chats);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getChatById = async (req, res) => {
  try {
    const chat = await prisma.chat.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};