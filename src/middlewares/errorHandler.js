export default function errorHandler(error, req, res, next) {
  const status =
    Number.isInteger(error?.status) ? error.status
    : Number.isInteger(error?.code) ? error.code
    : 500;
  console.error(error);
  return res.status(status).json({
    path: req.path,
    method: req.method,
    message: error.message ?? 'Internal Server Error',
    data: error.data ?? error.meta ?? undefined,
    date: new Date(),
  });
}
