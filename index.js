require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Client, LocalAuth } = require('whatsapp-web.js');

http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Bot is running...\n');
}).listen(process.env.PORT || 3000);

const SESSION_DATA_PATH = path.join(__dirname, '.wwebjs_auth');
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DATA_PATH }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_CACHE_DIR + '/chrome/linux-144.0.7559.96/chrome-linux64/chrome'
    }
});

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

client.on('ready', () => { console.log('>> البوت جاهز تماماً! <<'); });

client.on('message', async msg => {
    if (msg.from.includes('@g.us')) return;
    try {
        const result = await model.generateContent(msg.body);
        await msg.reply(result.response.text());
    } catch (e) { console.error(e); }
});

async function start() {
    console.log('جاري التشغيل...');
    await client.initialize();
    if (process.env.PHONE_NUMBER) {
        console.log(`طلب الكود للرقم: ${process.env.PHONE_NUMBER}`);
        setTimeout(async () => {
            try {
                const code = await client.getPairingCode(process.env.PHONE_NUMBER);
                console.log('*****************************************');
                console.log('كود الربط هو:', code);
                console.log('*****************************************');
            } catch (err) {
                console.log('فشل الطلب والسبب هو:', err.message); // هنا سنعرف العلة
            }
        }, 15000); // زيادة وقت الانتظار قليلاً
    }
}
start();
