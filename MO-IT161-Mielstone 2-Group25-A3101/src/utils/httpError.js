function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Express 4 does not catch rejected promises, so wrap async handlers.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { httpError, asyncHandler };
