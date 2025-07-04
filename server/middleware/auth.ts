import { Request, Response, NextFunction } from 'express';

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  console.log(`Session check for ${req.path}:`, {
    sessionID: req.sessionID,
    hasSession: !!req.session,
    isAuthenticated: req.isAuthenticated(),
    user: req.isAuthenticated()
      ? {
          id: (req.user as Express.User)?.id,
          username: (req.user as Express.User)?.username,
          role: (req.user as Express.User)?.role,
        }
      : "Not authenticated",
  });

  if (req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({ message: "Unauthorized" });
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && (req.user as Express.User).role === 'admin') {
    return next();
  }
  res.status(403).json({ message: "Admin access required" });
};

// Alias for isAuthenticated
export const requireAuth = isAuthenticated;

// Middleware for admin or owner access
export const requireAdminOrOwner = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = req.user as Express.User;
  
  // Admin có thể truy cập mọi thứ
  if (user.role === 'admin') {
    return next();
  }
  
  // Owner có thể truy cập resource của mình (cần implement logic kiểm tra ownership)
  // Hiện tại cho phép editor và owner truy cập
  if (user.role === 'editor' || user.role === 'owner') {
    return next();
  }
  
  res.status(403).json({ message: "Admin or owner access required" });
};