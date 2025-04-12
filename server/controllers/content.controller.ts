
import { Request, Response } from "express";
import { storage } from "../storage";
import { insertContentSchema } from "@shared/schema";
import { ZodError } from "zod";
import { simulateKafkaMessage } from "../kafka-simulator";

export class ContentController {
  // Get all contents
  async getAllContents(req: Request, res: Response) {
    try {
      const user = req.user as Express.User;
      console.log("GET /api/contents - User authenticated:", { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      });
      
      let contents;
      
      if (user.role === 'admin') {
        console.log("Admin user - fetching ALL contents");
        contents = await storage.getAllContents();
      } else {
        console.log(`Regular user - fetching contents assigned to user ID ${user.id}`);
        contents = await storage.getContentsByAssignee(user.id);
      }
      
      console.log(`Returning ${contents.length} content items`);
      
      if (contents.length > 0) {
        console.log("First content example:", { 
          id: contents[0].id,
          status: contents[0].status,
          verification: contents[0].sourceVerification
        });
      }
      
      res.json(contents);
    } catch (error) {
      console.error("Error fetching contents:", error);
      res.status(500).json({ message: "Error fetching contents" });
    }
  }

  // Get content by ID
  async getContentById(req: Request, res: Response) {
    try {
      const contentId = Number(req.params.id);
      const content = await storage.getContent(contentId);
      const user = req.user as Express.User;
      
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      if (user.role !== 'admin' && content.assigned_to_id !== user.id) {
        return res.status(403).json({ message: "You can only view content assigned to you" });
      }
      
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Error fetching content" });
    }
  }

  // Create new content
  async createContent(req: Request, res: Response) {
    try {
      const user = req.user as Express.User;
      let assigned_to_id = user.id;
      
      if (user.role === 'admin' && req.body.assigned_to_id) {
        assigned_to_id = req.body.assigned_to_id;
      }
      
      console.log("Creating new content with data:", {
        userId: user.id,
        username: user.username,
        role: user.role,
        requestBody: req.body
      });
      
      const inputData = {
        ...req.body,
        assigned_to_id: Number(assigned_to_id),
        assignedAt: new Date()
      };
      
      if (isNaN(inputData.assigned_to_id)) {
        return res.status(400).json({ 
          message: "Invalid assigned_to_id value", 
          value: req.body.assigned_to_id
        });
      }
      
      const validatedData = insertContentSchema.parse(inputData);
      const newContent = await storage.createContent(validatedData);
      return res.status(201).json(newContent);
    } catch (error) {
      console.error("Error creating content:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ 
        message: "Error creating content",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Update content
  async updateContent(req: Request, res: Response) {
    try {
      const contentId = Number(req.params.id);
      const existingContent = await storage.getContent(contentId);
      const user = req.user as Express.User;
      
      if (!existingContent) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      if (existingContent.assigned_to_id !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "You can only edit content assigned to you" });
      }
      
      const validatedData = insertContentSchema.partial().parse(req.body);
      
      if (validatedData.status === 'completed') {
        validatedData.approver_id = user.id;
        validatedData.approveTime = new Date();
      }
      
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
  }

  // Delete content
  async deleteContent(req: Request, res: Response) {
    try {
      const contentId = Number(req.params.id);
      const existingContent = await storage.getContent(contentId);
      const user = req.user as Express.User;
      
      if (!existingContent) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only administrators can delete content" });
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
  }
}
