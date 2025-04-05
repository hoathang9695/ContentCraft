import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import expressSession from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Create admin user if it doesn't exist
export async function createAdminUser() {
  try {
    const existingAdmin = await storage.getUserByUsername('admin');
    if (!existingAdmin) {
      const hashedPassword = await hashPassword('admin');
      await storage.createUser({
        username: 'admin',
        password: hashedPassword,
        name: 'Administrator',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active'
      });
      console.log('Admin user created successfully');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
    // Don't rethrow the error, let the application continue
    
    // Try again after a delay if this is a database connection issue
    const isConnectionError = error instanceof Error && 
      (error.message.includes('connection') || 
       error.message.includes('timeout') ||
       (error as any).code === '57P01');
       
    if (isConnectionError) {
      console.log('Will try to create admin user again in 5 seconds...');
      setTimeout(createAdminUser, 5000);
    }
  }
}

export function setupAuth(app: Express) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "very-secure-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    }
  };

  app.set("trust proxy", 1);
  app.use(expressSession(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Create admin user on startup
  createAdminUser();

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        
        // Check if user exists and password is correct
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        // Check if user is active
        if (user.status !== 'active' && user.role !== 'admin') {
          return done(null, false, { message: "Your account is pending approval. Please contact an administrator." });
        }
        
        // User exists, password is correct, and status is active (or user is admin)
        return done(null, user);
      } catch (error) {
        console.error('Error during authentication:', error);
        // Return a generic error message to avoid leaking information
        return done(null, false, { message: "Authentication failed. Please try again later." });
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      console.error('Error during user deserialization:', error);
      done(null, null); // Return null instead of error to prevent app crash
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      // Don't auto-login non-admin users that are in pending status
      if (user.role === 'admin' || user.status === 'active') {
        req.login(user, (err) => {
          if (err) return next(err);
          res.status(201).json(userWithoutPassword);
        });
      } else {
        // Just return the user without logging them in
        res.status(201).json({
          ...userWithoutPassword,
          message: "Account created successfully. Please wait for administrator approval before logging in."
        });
      }
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        // Use the message from the LocalStrategy if available
        return res.status(401).json({ message: info?.message || "Invalid username or password" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Remove password from response
    const { password, ...userWithoutPassword } = req.user as Express.User;
    res.json(userWithoutPassword);
  });
}
