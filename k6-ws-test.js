import ws from "k6/ws";
import { check, sleep } from "k6";

const SERVER_URL = "ws://localhost:8080/ws/chat"; // ✅ WebSocket 엔드포인트
const CLIENT_COUNT = 1; // ✅ 동시 접속 사용자 수
const MESSAGE_COUNT = 1; // ✅ 각 클라이언트가 보낼 메시지 개수
const ROOM_ID = 1; // ✅ 채팅방 ID

export const options = {
  vus: CLIENT_COUNT, // 가상 사용자 수
  duration: "10s", // 테스트 실행 시간
};

export default function () {
  const token = `testToken${__VU}`; // ✅ 사용자마다 다른 토큰 사용
  const headers = {}; // 🔥 WebSocket 핸드셰이크에서는 헤더 X

  const res = ws.connect(SERVER_URL, { headers }, function (socket) {
    socket.on("open", function () {
      console.log(`[Client ${__VU}] ✅ WebSocket 연결 성공!`);

      // ✅ STOMP CONNECT 메시지 전송 (형식 수정)
      const stompMessage = `CONNECT
accept-version:1.2
host:localhost
Authorization: Bearer ${token}

\u0000`; // ✅ NULL 문자 필수!

      console.log(`[Client ${__VU}] 📤 STOMP CONNECT 메시지 전송:\n${stompMessage}`);
      socket.send(stompMessage);

      sleep(2);  // ✅ STOMP CONNECT 후 충분한 대기 시간 추가

      // ✅ 메시지 수신 핸들러 설정
      socket.on("message", function (msg) {
        console.log(`[Client ${__VU}] 📩 메시지 수신: ${msg}`);

        if (msg.includes("CONNECTED")) {
          console.log(`[Client ${__VU}] ✅ STOMP CONNECTED 수신!`);

          // ✅ STOMP SUBSCRIBE 메시지 보내기
          const subscribeMessage = `SUBSCRIBE
id:sub-0
destination:/topic/chat/${ROOM_ID}

\u0000`;
          socket.send(subscribeMessage);
          console.log(`[Client ${__VU}] 📤 STOMP SUBSCRIBE 메시지 전송`);

          sleep(1);  // ✅ 서버가 SUBSCRIBE 처리할 시간 확보

          // ✅ 메시지 전송
          const message = `SEND
destination:/app/sendMessage
content-type:application/json

{"message":"Hello from Client ${__VU}!","roomId":${ROOM_ID}}

\u0000`;
          socket.send(message);
          console.log(`[Client ${__VU}] 📤 메시지 전송: Hello from Client ${__VU}!`);
        }
      });

      socket.on("close", function () {
        console.log(`[Client ${__VU}] 🛑 WebSocket 연결 종료`);
      });

      socket.on("error", function (e) {
        console.error(`[Client ${__VU}] ❌ WebSocket 오류: ${e.error()}`);
      });

      sleep(15); // ✅ 15초 동안 WebSocket 유지
      socket.close();
    });
  });

  check(res, { "WebSocket 연결 성공": (r) => r && r.status === 101 });
}
