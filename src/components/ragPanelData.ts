export const QUICK_QUESTIONS = [
  { label: 'YOLO26n-pose 선정', query: 'YOLO26n-pose를 선택한 근거는?' },
  { label: 'PyTorch vs TensorRT', query: 'PyTorch와 TensorRT 성능 차이는 무엇인가요?' },
  { label: '트래킹 고도화', query: 'Track ID 파편화 완화' },
  { label: 'Baseline median/p95', query: 'Baseline 측정에서 median(p50)과 p95 지연값은 얼마인가요?' },
  { label: 'MQTT E2E p95', query: 'MQTT End-to-End Alert Latency의 p95는 얼마이며 1초 SLA를 만족하나요?' },
  { label: 'Fall/Faint lifecycle', query: '낙상 알림이 계속 반복되는 문제는 어떻게 해결했나요?' },
  { label: 'MQTT 이벤트', query: 'MQTT 이벤트 스키마와 camera_login_id 전달 흐름' },
  { label: 'MJPEG stale 복구', query: 'MJPEG stream not ready 문제는 왜 발생했나요?' },
  { label: 'RTSP 지연 분석', query: 'RTSP 큐 지연' },
  { label: '영상 경계 초기화', query: '비디오 경계 초기화' },
  { label: 'Incident VLM/RAG', query: '언제 어디서 누가 넘어졌는지 검색하는 기능은 구현됐나요?' },
  { label: 'RAG 청킹·평가', query: 'RAG 청킹 평가' },
] as const;
