import Anthropic from "@anthropic-ai/sdk";
import TelegramBot from "node-telegram-bot-api";
import * as cron from "node-cron";
import * as dotenv from "dotenv";

dotenv.config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const WB_TOKEN = process.env.WB_API_TOKEN!;
const ADMIN_ID = process.env.TELEGRAM_CHAT_ID!;
const approvedUsers = new Set<string>([ADMIN_ID]);
const pendingUsers = new Map<string, string>();
const seenOrders = new Set<number>();

async function sendTelegram(message: string): Promise<void> {
    const chunks = message.match(/[\s\S]{1,4000}/g) || [message];
    for (const chunk of chunks) {
        await bot.sendMessage(CHAT_ID, chunk, { parse_mode: "Markdown" });
        await sleep(500);
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getNewOrders(): Promise<any[]> {
    const dateFrom = new Date();
    dateFrom.setMinutes(dateFrom.getMinutes() - 10);
    const dateStr = dateFrom.toISOString().split(".")[0];
    const res = await fetch(
        `https://statistics-api.wildberries.ru/api/v1/supplier/orders?dateFrom=${dateStr}&flag=1`,
        { headers: { Authorization: WB_TOKEN } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

async function getTodayStats(): Promise<any[]> {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(
        `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${today}&flag=1`,
        { headers: { Authorization: WB_TOKEN } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

async function checkNewSales(): Promise<void> {
    try {
        const orders = await getNewOrders();
        const newOrders = orders.filter((o: any) => !seenOrders.has(o.gNumber));
        for (const order of newOrders) {
            seenOrders.add(order.gNumber);
            const msg =
                `🛍 *NEW SALE!*\n` +
                `📦 ${order.subject || "Товар"}\n` +
                `💰 ${order.totalPrice || order.priceWithDisc} руб\n` +
                `📍 ${order.warehouseName || "Склад WB"}\n` +
                `🏙 ${order.regionName || ""}\n` +
                `⏰ ${new Date().toLocaleTimeString("ru-RU")}`;
            await sendTelegram(msg);
        }
    } catch (e) {
        console.error("Error checking sales:", e);
    }
}

export async function sendDailySummary(): Promise<void> {
    try {
        const sales = await getTodayStats();
        if (!sales || sales.length === 0) {
            await sendTelegram("📊 *Daily Summary*\n\nNo sales today yet.");
            return;
        }
        const totalRevenue = sales.reduce((sum: number, s: any) => sum + (s.priceWithDisc || 0), 0);
        const totalSales = sales.length;
        const avgPrice = Math.round(totalRevenue / totalSales);
        const msg =
            `📊 *DAILY SUMMARY*\n` +
            `📅 ${new Date().toLocaleDateString("ru-RU")}\n\n` +
            `🛍 Sales today: *${totalSales}*\n` +
            `💰 Revenue: *${Math.round(totalRevenue).toLocaleString()} руб*\n` +
            `📈 Avg price: *${avgPrice} руб*`;
        await sendTelegram(msg);
    } catch (e) {
        console.error("Error sending summary:", e);
    }
}

async function askClaude(prompt: string): Promise<string> {
    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
    });
    return (response.content[0] as { text: string }).text;
}

const RESEARCH_PROMPTS = {
    products: `You are a Wildberries marketplace expert. Find TOP 5 trending products for 2026 with high margin 50%+, low competition, no license, small size, price 1500-2500 RUB on WB, available on Alibaba $2-6. For each: name, WB price, Alibaba price, margin %, competition level, Alibaba search query.`,
    competitors: `You are a Wildberries expert. Analyze vacuum sealer niche on WB. Provide: average price range, top 3 competitor strategies, common complaints, 3 ways to differentiate, recommended price for 2026.`,
    trends: `You are a marketplace analyst. Top trending categories on Wildberries April 2026? Focus on growing demand, low saturation, women 25-45, home/kitchen/beauty. Give 5 trends with reasoning.`,
};

export async function runProductResearch(): Promise<void> {
    await sendTelegram("🔍 Researching new products...");
    const result = await askClaude(RESEARCH_PROMPTS.products);
    await sendTelegram(`📦 *NEW PRODUCT OPPORTUNITIES*\n\n${result}`);
}

export async function runCompetitorAnalysis(): Promise<void> {
    await sendTelegram("📊 Analyzing competitors...");
    const result = await askClaude(RESEARCH_PROMPTS.competitors);
    await sendTelegram(`🥊 *COMPETITOR ANALYSIS*\n\n${result}`);
}

export async function runTrendAnalysis(): Promise<void> {
    await sendTelegram("📈 Checking market trends...");
    const result = await askClaude(RESEARCH_PROMPTS.trends);
    await sendTelegram(`🔥 *MARKET TRENDS*\n\n${result}`);
}

export async function runFullReport(): Promise<void> {
    const date = new Date().toLocaleDateString("ru-RU");
    await sendTelegram(`🚀 *WB AGENT REPORT*\n📅 ${date}`);
    await runProductResearch();
    await sleep(2000);
    await runCompetitorAnalysis();
    await sleep(2000);
    await runTrendAnalysis();
    await sendTelegram("✅ *Report complete!*");
}

function setupBotCommands(): void {
    bot.setMyCommands([
        { command: "start", description: "Request access" },
        { command: "help", description: "Show commands" },
        { command: "report", description: "Full report" },
        { command: "sales", description: "Today sales" },
        { command: "products", description: "New product ideas" },
        { command: "trends", description: "Market trends" },
        { command: "competitors", description: "Competitor analysis" },
        { command: "status", description: "Agent status" },
        { command: "users", description: "Show approved users (admin)" },
        { command: "approve", description: "Approve user (admin)" },
        { command: "remove", description: "Remove user (admin)" },
    ]);

    bot.onText(/\/start/, async (msg) => {
        const userId = msg.chat.id.toString();
        const userName = msg.chat.username || msg.chat.first_name || userId;
        if (approvedUsers.has(userId)) {
            await bot.sendMessage(userId, `👋 *Welcome back ${userName}!*\n\nType /help to see commands.`, { parse_mode: "Markdown" });
            return;
        }
        pendingUsers.set(userId, userName);
        await bot.sendMessage(userId, `👋 Hi *${userName}!*\n\n⏳ Your access request has been sent.\nPlease wait for admin approval.`, { parse_mode: "Markdown" });
        await bot.sendMessage(ADMIN_ID, `🔔 *New access request!*\n\n👤 Name: ${userName}\n🆔 ID: ${userId}\n\nTo approve: /approve ${userId}\nTo reject: /remove ${userId}`, { parse_mode: "Markdown" });
    });

    bot.onText(/\/help/, async (msg) => {
        const userId = msg.chat.id.toString();
        if (!approvedUsers.has(userId)) { await bot.sendMessage(userId, "⛔ Access denied. Send /start to request access."); return; }
        await bot.sendMessage(userId, `*WB Agent Commands:*\n\n📊 /report\n🛍 /sales\n📦 /products\n📈 /trends\n🥊 /competitors\n✅ /status`, { parse_mode: "Markdown" });
    });

    bot.onText(/\/approve (.+)/, async (msg, match) => {
        if (msg.chat.id.toString() !== ADMIN_ID) return;
        const userId = match![1].trim();
        approvedUsers.add(userId);
        pendingUsers.delete(userId);
        await bot.sendMessage(ADMIN_ID, `✅ User ${userId} approved!`);
        await bot.sendMessage(userId, `✅ *Access granted!*\n\nWelcome! Type /help to see commands.`, { parse_mode: "Markdown" });
    });

    bot.onText(/\/remove (.+)/, async (msg, match) => {
        if (msg.chat.id.toString() !== ADMIN_ID) return;
        const userId = match![1].trim();
        approvedUsers.delete(userId);
        pendingUsers.delete(userId);
        await bot.sendMessage(ADMIN_ID, `🗑 User ${userId} removed!`);
        try { await bot.sendMessage(userId, "⛔ Your access has been revoked."); } catch (e) {}
    });

    bot.onText(/\/users/, async (msg) => {
        if (msg.chat.id.toString() !== ADMIN_ID) return;
        const list = [...approvedUsers].join('\n') || 'No users';
        const pending = [...pendingUsers.entries()].map(([id, name]) => `${name} (${id})`).join('\n') || 'None';
        await bot.sendMessage(ADMIN_ID, `*✅ Approved:*\n${list}\n\n*⏳ Pending:*\n${pending}`, { parse_mode: "Markdown" });
    });

    bot.onText(/\/report/, async (msg) => {
        if (!approvedUsers.has(msg.chat.id.toString())) { await bot.sendMessage(msg.chat.id, "⛔ Access denied."); return; }
        await runFullReport();
    });

    bot.onText(/\/sales/, async (msg) => {
        if (!approvedUsers.has(msg.chat.id.toString())) { await bot.sendMessage(msg.chat.id, "⛔ Access denied."); return; }
        await sendDailySummary();
    });

    bot.onText(/\/products/, async (msg) => {
        if (!approvedUsers.has(msg.chat.id.toString())) { await bot.sendMessage(msg.chat.id, "⛔ Access denied."); return; }
        await runProductResearch();
    });

    bot.onText(/\/trends/, async (msg) => {
        if (!approvedUsers.has(msg.chat.id.toString())) { await bot.sendMessage(msg.chat.id, "⛔ Access denied."); return; }
        await runTrendAnalysis();
    });

    bot.onText(/\/competitors/, async (msg) => {
        if (!approvedUsers.has(msg.chat.id.toString())) { await bot.sendMessage(msg.chat.id, "⛔ Access denied."); return; }
        await runCompetitorAnalysis();
    });

    bot.onText(/\/status/, async (msg) => {
        if (!approvedUsers.has(msg.chat.id.toString())) { await bot.sendMessage(msg.chat.id, "⛔ Access denied."); return; }
        await bot.sendMessage(msg.chat.id,
            `✅ *WB Agent Status*\n\n🤖 Running\n👥 Users: ${approvedUsers.size}\n⏰ Sales: every 5 min\n📊 Daily: 9 PM\n🔍 Weekly: Monday 9 AM\n🕐 ${new Date().toLocaleString("ru-RU")}`,
            { parse_mode: "Markdown" }
        );
    });

    console.log("✅ Bot commands ready!");
}

export async function startAgent(): Promise<void> {
    console.log("🤖 WB Agent starting...");
    setupBotCommands();
    cron.schedule("*/5 * * * *", async () => { await checkNewSales(); });
    cron.schedule("0 21 * * *", async () => { await sendDailySummary(); });
    cron.schedule("0 9 * * 1", async () => { await runFullReport(); });
    console.log("✅ Agent running!");
    await checkNewSales();
    await sendTelegram("🤖 *WB Agent started!*\n\nType /help to see commands.");
}