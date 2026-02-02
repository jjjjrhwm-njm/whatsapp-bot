require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// سيرفر وهمي لمنع فشل النشر
http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Bot is running...\n');
}).listen(process.env.PORT || 3000);

const MODEL_NAME = "gemini-2.0-flash";
const API_KEY = process.env.API_KEY;
const SESSION_DATA_PATH = path.join(__dirname, '.wwebjs_auth');
const CHAT_HISTORY_PATH = path.join(__dirname, 'chat_histories.json');

if (!fs.existsSync(SESSION_DATA_PATH)) { fs.mkdirSync(SESSION_DATA_PATH); }

let chatHistories = {};
if (fs.existsSync(CHAT_HISTORY_PATH)) {
    chatHistories = JSON.parse(fs.readFileSync(CHAT_HISTORY_PATH, 'utf8'));
}

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DATA_PATH }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_CACHE_DIR + '/chrome/linux-144.0.7559.96/chrome-linux64/chrome'
    }
});

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

function saveChatHistories() {
    fs.writeFileSync(CHAT_HISTORY_PATH, JSON.stringify(chatHistories, null, 2));
}

client.on('qr', qr => {
    if (!process.env.PHONE_NUMBER) {
        console.log('Scan this QR code:');
        qrcode.generate(qr, { small: true });
    }
});

client.on('ready', () => {
    console.log('>> البوت جاهز والربط تم بنجاح! <<');
});

client.on('message', async message => {
    const chat = await message.getChat();
    if (chat.isGroup || message.isStatus) return;

    const chatId = message.from;
    const userMessage = message.body;

    if (!chatHistories[chatId]) { chatHistories[chatId] = []; }

    try {
        const aiChat = model.startChat({ history: chatHistories[chatId] });
        const result = await aiChat.sendMessage(userMessage);
        const aiResponseText = result.response.text();
        await message.reply(aiResponseText);

        chatHistories[chatId].push({ role: 'user', parts: [{ text: userMessage }] });
        chatHistories[chatId].push({ role: 'model', parts: [{ text: aiResponseText }] });
        saveChatHistories();
    } catch (error) {
        console.error("Error:", error);
    }
});

async function start() {
    await client.initialize();
    // التأكد من وجود الرقم لطلب كود الربط
    if (process.env.PHONE_NUMBER) {
        setTimeout(async () => {
            try {
                const pairingCode = await client.getPairingCode(process.env.PHONE_NUMBER);
                console.log('-----------------------------------------');
                console.log('كود الربط الخاص بك هو:', pairingCode);
                console.log('-----------------------------------------');
            } catch (err) {
                console.log('فشل طلب الكود، تأكد من تحديث المكتبة.');
            }
        }, 5000);
    }
}

start();
