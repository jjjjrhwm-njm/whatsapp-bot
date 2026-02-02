require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Client, LocalAuth } = require('whatsapp-web.js');

// 1. إنشاء سيرفر وهمي لمنع موقع Render من إغلاق البوت (Timed Out)
http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Bot is running properly...\n');
}).listen(process.env.PORT || 3000);

// 2. إعدادات المسارات والذكاء الاصطناعي
const MODEL_NAME = "gemini-1.5-flash"; // أو gemini-2.0-flash حسب رغبتك
const API_KEY = process.env.API_KEY;
const SESSION_DATA_PATH = path.join(__dirname, '.wwebjs_auth');
const CHAT_HISTORY_PATH = path.join(__dirname, 'chat_histories.json');

if (!fs.existsSync(SESSION_DATA_PATH)) { fs.mkdirSync(SESSION_DATA_PATH); }

let chatHistories = {};
if (fs.existsSync(CHAT_HISTORY_PATH)) {
    chatHistories = JSON.parse(fs.readFileSync(CHAT_HISTORY_PATH, 'utf8'));
}

// 3. إعداد عميل الواتساب مع متصفح كروم الخاص بـ Render
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DATA_PATH }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions'],
        executablePath: process.env.PUPPETEER_CACHE_DIR + '/chrome/linux-144.0.7559.96/chrome-linux64/chrome'
    }
});

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

function saveChatHistories() {
    fs.writeFileSync(CHAT_HISTORY_PATH, JSON.stringify(chatHistories, null, 2));
}

// 4. أحداث البوت
client.on('ready', () => {
    console.log('-----------------------------------------');
    console.log('>> تم الربط بنجاح! البوت جاهز الآن للرد <<');
    console.log('-----------------------------------------');
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
        console.error("خطأ في الرد:", error.message);
    }
});

// 5. تشغيل البوت وطلب كود الربط
async function start() {
    console.log('جاري تهيئة المتصفح ونظام الربط...');
    await client.initialize();
    
    if (process.env.PHONE_NUMBER) {
        console.log(`محاولة استخراج كود الربط للرقم: ${process.env.PHONE_NUMBER}`);
        setTimeout(async () => {
            try {
                if (typeof client.getPairingCode === 'function') {
                    const pairingCode = await client.getPairingCode(process.env.PHONE_NUMBER);
                    console.log('*****************************************');
                    console.log('كود الربط الخاص بك هو:', pairingCode);
                    console.log('*****************************************');
                } else {
                    console.log('خطأ: المكتبة لا تزال قديمة، يرجى عمل Clear Cache & Deploy');
                }
            } catch (err) {
                console.log('فشل طلب الكود، السبب:', err.message);
            }
        }, 20000); // انتظر 20 ثانية للتأكد من استقرار السيرفر
    }
}

start();
