import { startAgent, runFullReport } from "./agent";

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
        .then(() => console.log("✅ WB Agent is running! Press Ctrl+C to stop."))
        .catch((err: any) => console.error("❌ Error:", err));
}