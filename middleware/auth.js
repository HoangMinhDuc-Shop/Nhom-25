/**
 * Authentication and Authorization Middleware
 * Phân quyền dựa trên vai trò: admin, accountant, resident
 */

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login?error=Vui lòng đăng nhập để tiếp tục');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/auth/login?error=Vui lòng đăng nhập');
    }

    const userRole = req.session.user.role;
    if (roles.includes(userRole)) {
      return next();
    }

    // Nếu không đủ quyền
    res.status(403).render('error', {
      title: '403 - Không có quyền truy cập',
      message: 'Bạn không có quyền truy cập vào chức năng này!',
      user: req.session.user
    });
  };
}

function attachUserLocals(req, res, next) {
  res.locals.user = req.session ? req.session.user : null;
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  next();
}

module.exports = {
  isAuthenticated,
  requireRole,
  attachUserLocals
};
