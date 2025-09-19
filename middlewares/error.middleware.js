module.exports = (err, req, res, next) => {
  console.error(err);
  const status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(status).json({
    message: err.message || 'Internal Server Error',
    // include stack in dev
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};
