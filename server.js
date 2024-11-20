const net = require('net');
const db = require('./db');

// 保存連接用戶
let clients = [];

const server = net.createServer((socket)=>{
    console.log('一位新用戶連線！');
    socket.write('歡迎使用Fury的IRC! 請輸入暱稱跟密碼~ ex:fury 123456\n');


    let isAuthenticated = false; // 用戶成功登入? 暱稱密碼輸入正確標記為true
    let nickname = ''; // 用戶暱稱

    // 當客戶端發送數據 觸發data事件
    socket.on('data', (data)=> {

        const message = data.toString().trim();

        // 發送訊息遍歷給CLIENTS
        function broadcast(message, senderSocket) {
            clients.forEach((client)=> {
                if(client.socket !== senderSocket) {
                    client.socket.write(`${nickname}: ${message}\n`);
                }
            })
        }

        if(!isAuthenticated) {

            const [inputNickName, inputPassword] = message.split(' ');
            if( !inputNickName || !inputPassword ) {
                socket.write('請輸入暱稱跟密碼~ ex:fury 123456\n');
                return;
            }

            db.get(
                `SELECT * FROM users WHERE nickname = ?`,
                [inputNickName],
                (err, user)=> {
                    if(err) {
                        console.error('查詢用戶時發生錯誤:', err.message);
                        socket.write('登入失敗\n');
                        return;
                    }

                    if(user) {
                        if(user.password === inputPassword) {
                            isAuthenticated = true;
                            nickname = inputNickName;
                            socket.write('登入成功\n');
                            clients.push({nickname, socket});
                        } else {
                            socket.write('密碼錯誤\n');
                        }
                    } else {
                        db.run(
                            `INSERT INTO users (nickname, password, socket_id) VALUES (?, ?, ?)`,
                            [inputNickname, inputPassword, socket.remoteAddress],
                            (err)=> {
                                if(!err) {
                                    nickname = inputNickName;
                                    isAuthenticated = true;
                                    clients.push({nickname, socket});

                                } else {
                                    console.error('創建用戶時發生錯誤:', err.message);
                                    socket.write('登入失敗\n');
                                }
                            }
                        )
                    }

                }


            )
        } else {
            if (message.startsWith('/list')){
                const userList = clients.map((client)=> client.nickname).join(', ');
                socket.write(`在線用戶: ${userList}\n`);
            }
        }


    })

    socket.on('end', ()=>{
        if (nickname) {
            console.log(`${nickname} 斷開連接`);
            clients = clients.filter((client)=> client.nickname !== nickname);
            broadcast(`${nickname} 離開了聊天`);
        }
    })
    
    socket.on('error', (err)=>{
        console.error('發生錯誤:', err.message);
    })



})

setInterval(()=>{
    console.log('檢查失效連線');
    clients = clients.fliter( client=>{
        if(client.socket.destroyed) {
            console.log(`${client.nickname} 斷開連接`);
            return false;
        }
        return true;
    }

    )
},5 * 60 * 1000)

// 啟動伺服器
server.listen(6667, () => {
    console.log('IRC 伺服器運行於端口 6667');
});