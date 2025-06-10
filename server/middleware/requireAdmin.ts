
import { Request, Response, NextFunction } from "express";

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  console.log(`Admin check for ${req.path}:`, {
    sessionID: req.sessionID,
    hasSession: !!req.session,
    isAuthenticated: req.isAuthenticated(),
    user: req.isAuthenticated() ? { 
      id: (req.user as Express.User)?.id,
      username: (req.user as Express.User)?.username,
      role: (req.user as Express.User)?.role
    } : 'Not authenticated'
  });
  
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = req.user as Express.User;
  if (user.role !== 'admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
};
