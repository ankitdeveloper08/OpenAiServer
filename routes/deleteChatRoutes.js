router.delete("/api/chats/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.chat.delete({
      where: { id },
    });

    return res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
});