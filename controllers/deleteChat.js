import prisma from "../prisma/prismaClient.js";

export const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;

    // optional but safe cleanup
    await prisma.chatMessage.deleteMany({
      where: { chatId: id },
    });

    await prisma.chat.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};