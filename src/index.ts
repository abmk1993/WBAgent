import express from "express";
import { startAgent, runFullReport, bot } from "./agent";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN;

// Webhook endpoint for Telegram
app.post(`/bot${TOKEN}`, (req: any, res: any) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.get("/", (req: any, res: any) => {
    res.send("WB Agent is running! ✅");
});

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    // Set webhook URL
    if (RAILWAY_URL) {
        await bot.setWebHook(`https://${RAILWAY_URL}/bot${TOKEN}`);
        console.log(`✅ Webhook set: https://${RAILWAY_URL}/bot${TOKEN}`);
    } else {
        console.log("⚠️ RAILWAY_PUBLIC_DOMAIN not set!");
    }

    await startAgent();
});