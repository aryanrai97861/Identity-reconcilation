import { Router, Request, Response } from "express";
import { identifyContact } from "../services/contact.service";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body;

    const result = await identifyContact({ email, phoneNumber });
    res.status(200).json(result);
  } catch (error: any) {
    if (error.message === "At least one of email or phoneNumber must be provided") {
      res.status(400).json({ error: error.message });
    } else {
      console.error("Error in /identify:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
