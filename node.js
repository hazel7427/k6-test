const WebSocket = require("ws");
const StompJs = require("@stomp/stompjs");

const SERVER_URL = "ws://localhost:8080/ws/chat";  // WebSocket 직접 연결 (SockJS X)
const CLIENT_COUNT = 1;  // 가상 사용자 수
const MESSAGE_COUNT = 1;  // 각 클라이언트가 보낼 메시지 수
const ROOM_ID = 1;

async function getUserTokens() {
    return Array.from({ length: CLIENT_COUNT }, (_, i) => `testToken${i + 1}`);
}

let clients = [];

async function createClient(clientId, token) {
    console.log(`🔑 [Client ${clientId}] 토큰: ${token}`);
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(SERVER_URL);

        socket.on("open", () => {
            console.log(`✅ [Client ${clientId}] WebSocket 연결 성공!`);
        });

        socket.on("error", (error) => {
            console.error(`❌ [Client ${clientId}] WebSocket 오류 발생:`, error.message);
            reject(error);
        });

        socket.on("close", (code, reason) => {
            console.log(`🔌 [Client ${clientId}] WebSocket 연결 종료 (Code: ${code}, Reason: ${reason})`);
        });

        const stompClient = new StompJs.Client({
            webSocketFactory: () => socket,
            connectHeaders: { Authorization: `Bearer ${token}` },
            debug: (msg) => console.log(`🛠 [Client ${clientId}] ${msg}`),
            onConnect: () => {
                console.log(`✅ [Client ${clientId}] STOMP 연결 성공!`);

                // 채팅방 구독
                stompClient.subscribe(`/topic/chat/${ROOM_ID}`, (message) => {
                    console.log(`📩 [Client ${clientId}] 메시지 수신:`, JSON.parse(message.body));
                });

                // 연결 후 일정 시간 후에 메시지 전송
                setTimeout(() => {
                    for (let i = 0; i < MESSAGE_COUNT; i++) {
                        const message = { message: `Hello from Client ${clientId}!`, roomId: ROOM_ID };
                        stompClient.publish({ destination: "/app/sendMessage", body: JSON.stringify(message) });
                        console.log(`📤 [Client ${clientId}] 메시지 전송:`, message);
                    }
                }, 2000); // 기존보다 조금 더 여유를 줌

                resolve(stompClient);
            },
            onStompError: (frame) => {
                console.error(`❌ [Client ${clientId}] STOMP Broker 오류:`, frame);
                reject(new Error(`STOMP 오류 발생 (Client ${clientId})`));
            },
        });

        stompClient.activate();
        clients.push(stompClient);
    });
}

async function runLoadTest() {
    console.log("🚀 사용자 토큰 생성 중...");
    const userTokens = await getUserTokens();

    console.log(`✅ ${userTokens.length}개의 사용자 토큰을 불러왔습니다.`);
    console.log(`🚀 ${CLIENT_COUNT}명의 가상 사용자가 WebSocket 연결을 시작합니다...`);

    try {
        await Promise.all(userTokens.map((token, i) => createClient(i, token)));
        console.log("✅ 모든 클라이언트가 연결 완료 & 메시지 전송 시작!");
    } catch (error) {
        console.error("❌ 클라이언트 연결 중 오류 발생:", error.message);
    }

    // 10초 후 모든 클라이언트 연결 해제
    setTimeout(() => {
        console.log("🛑 모든 클라이언트 연결 해제");
        clients.forEach((client) => client.deactivate());
        process.exit(0);
    }, 10000);
}

// 부하 테스트 실행
runLoadTest();
