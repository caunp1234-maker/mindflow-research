require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || value.startsWith('change-me')) {
    throw new Error(
      `환경변수 ${name}이(가) 설정되지 않았습니다. server/.env.example을 참고해 server/.env를 만드세요.`
    );
  }
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgres://mindflow:mindflow@localhost:5432/mindflow_research',
  // JWT_SECRET / ENCRYPTION_KEY는 실제 서버 기동(index.js)·마이그레이션 시점에만 강제한다.
  // 스키마 파일을 단순히 require하는 단계(예: 테스트)에서 곧바로 죽지 않도록 지연 평가한다.
  get jwtSecret() {
    return required('JWT_SECRET');
  },
  get encryptionKey() {
    return required('ENCRYPTION_KEY');
  },
};
