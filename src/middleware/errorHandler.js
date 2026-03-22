'use strict';

function errorHandler(err, req, res, next) {
  console.error(err.stack);
  const status = err.status || 500;
  if (req.accepts('html')) {
    res.status(status).render('error', { message: err.message, status });
  } else {
    res.status(status).json({ error: err.message });
  }
}

module.exports = { errorHandler };
