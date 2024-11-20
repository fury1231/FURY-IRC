const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./irc_users.db', (err) => {
	if (err) {
		console.error('無法連接到資料庫:', err.message);
	} else {
		console.log('成功連接到資料庫');
	}
});
db.serialize(() => {
	db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT NOT NULL,
            password TEXT NOT NULL,
            socket_id TEXT NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
		if (err) {
			console.error('無法創建資料表:', err.message);
		} else {
			console.log('資料表初始化成功');
		}
	})
})
