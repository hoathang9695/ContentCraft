
import { Request, Response, NextFunction } from "express";

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  console.log(`Session check for ${req.path}:`, {
    sessionID: req.sessionID,
    hasSession: !!req.session,
    isAuthenticated: req.isAuthenticated(),
    user: req.isAuthenticated() ? { 
      id: (req.user as Express.User)?.id,
      username: (req.user as Express.User)?.username,
      role: (req.user as Express.User)?.role
    } : 'Not authenticated'
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
