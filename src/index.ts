import express, { Request, Response } from "express";
import { initializeDatabase } from "./db";
import { identifyOrCreateContact } from "./services/identityService";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

main()
  .then(() => {
    console.log("Database initialized successfully");
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
  });

async function main() {
  await initializeDatabase();
}

app.get("/", (req: Request, res: Response) => {
  res.send("Hi User! Welcome to the BiteSpeed Backend Intern Task Assignment.");
});

app.post("/identify", async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body as {
    email?: string;
    phoneNumber?: string;
  };

  if (!email && !phoneNumber) {
    return res.status(400).json({
      message: "Either 'email' or 'phoneNumber' must be provided.",
    });
  }

  try {
    const contact = await identifyOrCreateContact({ email, phoneNumber });

    return res.status(200).json({ contact });
  } catch (error) {
    console.error("Error handling /identify request:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
