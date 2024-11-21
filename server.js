const net = require('net');
const db = require('./db');

// 保存連接用戶
let clients = [];

const server = net.createServer((socket) => {
    console.log('一位新用戶連線！');
    socket.write('歡迎使用Fury的IRC! 請輸入暱稱跟密碼~ ex:fury 123456\n');

    let isAuthenticated = false; // 用戶是否已驗證
    let nickname = ''; // 用戶暱稱

    // 當客戶端發送數據時
    socket.on('data', (data) => {
        const message = data.toString().trim();

        // 處理私人訊息
        if (message.startsWith('/private')) {
            const [, privateNickname, ...messageParts] = message.split(' ');
            const privateMessage = messageParts.join(' ');

            if (!privateNickname || !privateMessage.trim()) {
                socket.write('請輸入正確格式: /private <暱稱> <訊息>\n');
                return;
            }

            const targetClient = clients.find((client) => client.nickname === privateNickname);
            if (targetClient) {
                targetClient.socket.write(`[私人訊息] ${nickname}: ${privateMessage}\n`);
                socket.write(`[已發送給 ${privateNickname}] ${privateMessage}\n`);
            } else {
                socket.write(`找不到用戶 ${privateNickname} 或該用戶不在線。\n`);
            }
            return;
        }

        // 註冊邏輯
        if (message.startsWith('/register')) {
            const [, newInputNickname, newInputPassword] = message.split(' ');

            if (!newInputNickname || !newInputPassword) {
                socket.write('註冊失敗: 格式為 /register <暱稱> <密碼>\n');
                return;
            }

            db.get(`SELECT * FROM users WHERE nickname = ?`, [newInputNickname], (err, row) => {
                if (err) {
                    console.error('查詢用戶時發生錯誤:', err.message);
                    socket.write('註冊失敗: 伺服器錯誤，請稍後再試。\n');
                } else if (row) {
                    socket.write('註冊失敗: 暱稱已被使用。\n');
                } else {
                    db.run(`INSERT INTO users (nickname, password) VALUES (?, ?)`, [newInputNickname, newInputPassword], (err) => {
                        if (err) {
                            console.error('新增用戶時發生錯誤:', err.message);
                            socket.write('註冊失敗: 伺服器錯誤，請稍後再試。\n');
                        } else {
                            socket.write('註冊成功! 請重新登入。\n');
                        }
                    });
                }
            });
            return;
        }

        // 登入邏輯
        if (!isAuthenticated) {
            const [inputNickName, inputPassword] = message.split(' ');

            if (!inputNickName || !inputPassword) {
                socket.write('請輸入暱稱跟密碼: ex: fury 123456\n');
                return;
            }

            db.get(`SELECT * FROM users WHERE nickname = ?`, [inputNickName], (err, user) => {
                if (err) {
                    console.error('查詢用戶時發生錯誤:', err.message);
                    socket.write('登入失敗: 伺服器錯誤，請稍後再試。\n');
                } else if (user) {
                    if (user.password === inputPassword) {
                        isAuthenticated = true;
                        nickname = inputNickName;
                        socket.write('登入成功!\n');
                        clients.push({ nickname, socket });
                    } else {
                        socket.write('密碼錯誤。\n');
                    }
                } else {
                    socket.write('用戶不存在，請先註冊。\n');
                }
            });
            return;
        }

        // 列出在線用戶
        if (message.startsWith('/list')) {
            const userList = clients.map((client) => client.nickname).join(', ');
            socket.write(`在線用戶: ${userList}\n`);
            return;
        }

        // 廣播訊息
        broadcast(message, socket);
    });

    // 用戶斷開連接
    socket.on('end', () => {
        if (nickname) {
            console.log(`${nickname} 斷開連接`);
            clients = clients.filter((client) => client.nickname !== nickname);
            broadcast(`${nickname} 離開了聊天`, socket);
        }
    });

    // 連線錯誤處理
    socket.on('error', (err) => {
        console.error('連線錯誤:', err.message);
    });
});

// 廣播函數
function broadcast(message, senderSocket) {
    const sender = clients.find((client) => client.socket === senderSocket);
    const senderNickname = sender ? sender.nickname : '匿名';
    clients.forEach((client) => {
        if (client.socket !== senderSocket) {
            client.socket.write(`[${senderNickname}]: ${message}\n`);
        }
    });
}

// 定時檢查失效連線
setInterval(() => {
    console.log('檢查失效連線...');
    clients = clients.filter(client => {
        if (client.socket.destroyed) {
            console.log(`${client.nickname} 斷開連接`);
            return false;
        }
        return true;
    });
}, 5 * 60 * 1000);

// 啟動伺服器
server.listen(6667, () => {
    console.log('IRC 伺服器運行於端口 6667');
});
