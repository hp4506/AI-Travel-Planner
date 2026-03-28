const { GoogleGenerativeAI } = require('@google/generative-ai');

const NEW_KEY = "AIzaSyAQbIjayyBgNvTlX2YqOWU_PgB--NQNiyU";
const genAI = new GoogleGenerativeAI(NEW_KEY);

async function listModels() {
    console.log("Listing models...");
    try {
        // The list_models method is not directly on genAI in the same way, 
        // we usually use the model info.
        // Wait, the SDK has a way to list models.
        // Actually, let's just try to call a different model like 'gemini-pro'.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result = await model.generateContent("Test");
        console.log("Success with 1.5-pro:", result.response.text());
    } catch (e) {
        console.error("1.5-pro Failed Code:", e.status);
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
        const result = await model.generateContent("Test");
        console.log("Success with 1.0-pro:", result.response.text());
    } catch (e) {
        console.error("1.0-pro Failed Code:", e.status);
    }
}

listModels();
