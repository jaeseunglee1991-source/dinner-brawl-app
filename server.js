// server.js (최상위 루트 폴더)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// 1. 우리가 분리해둔 모듈들 불러오기
const { pool, initDB } = require('./src/config/db'); 
const socketHandler = require('./src/socket/handler'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 정적 파일(public 폴더) 서빙
app.use(express.static('public'));

// 2. DB 초기화 실행
initDB();

// 3. 전역 방(Room) 데이터 관리 객체
const rooms = {};

// 4. 분리된 소켓 로직 실행 (io, DB연결, 방 데이터를 넘겨줌)
socketHandler(io, pool, rooms);

// 5. 서버 포트 오픈
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 서버 실행 중... 포트: ${PORT}`));
// ====== 유니티 연동용 로그인 API ======

// 유니티에서 보낸 폼(Form) 데이터를 읽을 수 있게 해주는 설정 (상단에 없다면 추가해주세요)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 유니티가 접속할 주소: POST /api/login
app.post('/api/login', async (req, res) => {
    // 유니티가 보낸 'id'와 'pw' 데이터를 꺼냅니다.
    const { id, pw } = req.body;

    try {
        // 기존 DB 조회: DB에서 해당 아이디를 찾습니다.
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        
        // 아이디가 없으면 400 에러를 유니티로 보냅니다.
        if (result.rows.length === 0) {
            return res.status(400).send("존재하지 않는 ID입니다.");
        }
        
        const user = result.rows[0];
        
        // 비밀번호가 틀리면 401 에러를 유니티로 보냅니다.
        if (user.pw !== pw) {
            return res.status(401).send("비밀번호 오류");
        }
        
        // 성공 시 200 OK와 함께 유니티로 메세지를 보냅니다.
        return res.status(200).send("Welcome " + user.nickname);

    } catch (err) {
        console.error("Login API Error: ", err);
        return res.status(500).send("서버 내부 DB 오류");
    }
});
