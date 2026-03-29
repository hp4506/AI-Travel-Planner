const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AIzaSyAte7ShFtU2vrbqx66bkRmMuHn4Yef_okA');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function test() {
    console.log('Starting...');
    try {
        const result = await model.generateContent('Say hi');
        console.log('Result:', result.response.text());
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
