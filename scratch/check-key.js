require('dotenv').config();
const key = process.env.GENERATIVE_AI_API_KEY;
if (key) {
    console.log(`Key length: ${key.length}`);
    console.log(`Key start: ${key.substring(0, 7)}`);
    console.log(`Key end: ${key.substring(key.length - 4)}`);
} else {
    console.log('Key NOT FOUND in process.env');
}
