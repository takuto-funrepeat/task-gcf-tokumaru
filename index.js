const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// ボディパーサーの設定
app.use(bodyParser.json());

// test-debug.jsの関数をインポート
const { backup_gcf_call } = require('./task-gcf-tokumaru.js');

// ルートに対するPOSTリクエストを処理
app.post('/', backup_gcf_call);

app.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しました`);
});
