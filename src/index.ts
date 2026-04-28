import { startAgent, runFullReport } from "./agent";

// Prevent multiple instances
const instanceId = Date.now();
console.log(`Starting instance: ${instanceId}`);

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
    // Wait random time to avoid conflicts during redeploy
    const delay = Math.floor(Math.random() * 3000) + 2000;
    console.log(`Waiting ${delay}ms before starting...`);
    setTimeout(() => {
        startAgent()
            .then(() => console.log("✅ WB Agent is running!"))
            .catch((err: any) => console.error("❌ Error:", err));
    }, delay);
}