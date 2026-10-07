// Universal Pest Control — Standardized API Response Helpers

function apiSuccess(res, data = null, message = 'Success', statusCode = 200, meta = null) {
  const payload = {
    success: true,
    message,
    data
  };
  if (meta) {
    payload.meta = meta;
    payload.pagination = meta;
  }
  return res.status(statusCode).json(payload);
}

function apiError(res, message = 'An error occurred', statusCode = 500, errors = null) {
  const payload = {
    success: false,
    message
  };
  if (errors) {
    payload.errors = errors;
  }
  return res.status(statusCode).json(payload);
}

module.exports = {
  apiSuccess,
  apiError
};
