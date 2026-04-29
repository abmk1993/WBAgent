import { startAgent, runFullReport } from "./agent";
import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const args = process.argv.slice(2);

if (args[0] === "--run-now") {
    console.log("🚀 Running agent immediately...");
    runFullReport()
        .then(() => process.exit(0))
        .catch((err: any) => {
            console.error("❌ Error:", err);
            process.exit(1);
        });
} else {
    startAgent()
        .then(() => console.log("✅ WB Agent is running!"))
        .catch((err: any) => console.error("❌ Error:", err));
}