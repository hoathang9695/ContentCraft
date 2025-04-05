import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { ZodError } from "zod";
import { insertContentSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Check if user is authenticated middleware
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Content CRUD API
  app.get("/api/contents", isAuthenticated, async (req, res) => {
    try {
      const contents = await storage.getAllContents();
      res.json(contents);
    } catch (error) {
      res.status(500).json({ message: "Error fetching contents" });
    }
  });

  app.get("/api/contents/:id", isAuthenticated, async (req, res) => {
    try {
      const content = await storage.getContent(Number(req.params.id));
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Error fetching content" });
    }
  });

  app.post("/api/contents", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertContentSchema.parse({
        ...req.body,
        authorId: (req.user as Express.User).id
      });
      
      const newContent = await storage.createContent(validatedData);
      res.status(201).json(newContent);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Error creating content" });
    }
  });

  app.put("/api/contents/:id", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      const existingContent = await storage.getContent(contentId);
      
      if (!existingContent) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Check if user is the author of the content
      if (existingContent.authorId !== (req.user as Express.User).id) {
        return res.status(403).json({ message: "You can only edit your own content" });
      }
      
      // Validate request body (partial validation)
      const validatedData = insertContentSchema.partial().parse(req.body);
      
      const updatedContent = await storage.updateContent(contentId, validatedData);
      res.json(updatedContent);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Error updating content" });
    }
  });

  app.delete("/api/contents/:id", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      const existingContent = await storage.getContent(contentId);
      
      if (!existingContent) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Check if user is the author of the content
      if (existingContent.authorId !== (req.user as Express.User).id) {
        return res.status(403).json({ message: "You can only delete your own content" });
      }
      
      const deleted = await storage.deleteContent(contentId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Error deleting content" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error deleting content" });
    }
  });

  // Get contents by current user
  app.get("/api/my-contents", isAuthenticated, async (req, res) => {
    try {
      const contents = await storage.getContentsByAuthor((req.user as Express.User).id);
      res.json(contents);
    } catch (error) {
      res.status(500).json({ message: "Error fetching your contents" });
    }
  });

  // Dashboard statistics
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const allContents = await storage.getAllContents();
      const userContents = allContents.filter(c => c.authorId === (req.user as Express.User).id);
      
      // Count contents by status
      const published = userContents.filter(c => c.status === 'published').length;
      const draft = userContents.filter(c => c.status === 'draft').length;
      const review = userContents.filter(c => c.status === 'review').length;
      
      res.json({
        totalContent: userContents.length,
        published,
        draft,
        review
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
