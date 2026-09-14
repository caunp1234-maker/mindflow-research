// Express 4는 async 라우트 핸들러 안에서 던진 예외를 자동으로 에러 미들웨어에 넘기지 않는다
// (reject된 프라미스가 처리되지 않고 그대로 남는다). 모든 async 핸들러를 이걸로 감싸서
// index.js의 에러 미들웨어가 항상 호출되도록 한다.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
