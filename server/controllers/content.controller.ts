import { Request, Response } from "express";
import { storage } from "../storage";
import { insertContentSchema } from "@shared/schema";
import { ZodError } from "zod";
import { simulateKafkaMessage } from "../kafka-simulator";

export class ContentController {
  // Get all contents
  async getAllContents(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

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

      if (!contents) {
        return res.status(500).json({ message: "Failed to fetch contents" });
      }

      console.log(`Returning ${contents.length} content items`);

      if (contents.length > 0) {
        console.log("First content example:", { 
          id: contents[0].id,
          status: contents[0].status,
          verification: contents[0].sourceVerification
        });
      }

      return res.json(contents);
    } catch (error) {
      console.error("Error fetching contents:", error);
      return res.status(500).json({ 
        message: "Error fetching contents",
        error: error instanceof Error ? error.message : String(error)
      });
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
      console.log("Update content request:", {
        body: req.body,
        params: req.params,
        user: req.user ? { id: (req.user as Express.User).id, role: (req.user as Express.User).role } : null
      });

      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: "Unauthorized - Please log in"
        });
      }

      const contentId = Number(req.params.id);
      if (!contentId || isNaN(contentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid content ID"
        });
      }

      const existingContent = await storage.getContent(contentId);
      const user = req.user as Express.User;

      console.log("Existing content:", existingContent);

      if (!existingContent) {
        return res.status(404).json({ message: "Content not found" });
      }

      if (existingContent.assigned_to_id !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "You can only edit content assigned to you" });
      }

      // Parse và validate input data
      const inputData = {
        ...req.body,
        updatedAt: new Date()
      };

      // Parse safe thành boolean hoặc null
      if (inputData.safe !== undefined) {
        if (typeof inputData.safe === 'string') {
          inputData.safe = inputData.safe === 'true' ? true : inputData.safe === 'false' ? false : null;
        } else if (typeof inputData.safe !== 'boolean') {
          inputData.safe = null;
        }
      }

      // Xử lý các trường có thể null
      ['categories', 'labels', 'processingResult', 'source'].forEach(field => {
        if (inputData[field] === undefined || inputData[field] === '') {
          inputData[field] = null;
        }
        if (field === 'source' && inputData[field]) {
          try {
            // Đảm bảo source là JSON string hợp lệ
            const parsed = JSON.parse(inputData[field]);
            inputData[field] = JSON.stringify(parsed);
          } catch {
            // Nếu không phải JSON, giữ nguyên giá trị string
          }
        }
      });

      // Đảm bảo comments và reactions là số
      if (inputData.comments !== undefined) {
        inputData.comments = Number(inputData.comments) || 0;
      }
      if (inputData.reactions !== undefined) {
        inputData.reactions = Number(inputData.reactions) || 0;
      }

      // Parse dates
      if (inputData.assignedAt) {
        inputData.assignedAt = new Date(inputData.assignedAt);
      }
      if (inputData.approveTime) {
        inputData.approveTime = new Date(inputData.approveTime);
      }

      // Thêm các trường tự động
      if (inputData.status === 'completed') {
        inputData.approver_id = user.id;
        inputData.approveTime = new Date();
      }

      // Log input data trước khi validate
      console.log("Processed input data:", inputData);

      // Validate data
      const validatedData = insertContentSchema.partial().parse(inputData);

      // Log validated data
      console.log("Validated data:", validatedData);

      console.log('Updating content with data:', {
        contentId,
        validatedData,
        user: {
          id: user.id,
          role: user.role
        }
      });

      try {
        const updatedContent = await storage.updateContent(contentId, validatedData);

        if (!updatedContent) {
          console.error('No content returned after update');
          return res.status(500).json({
            success: false,
            message: "Failed to update content"
          });
        }

        console.log('Content updated successfully:', updatedContent);

        // Fetch updated content to verify changes
        const verifiedContent = await storage.getContent(contentId);
        console.log('Verified updated content:', verifiedContent);

        return res.json({
          success: true,
          data: updatedContent,
          verified: verifiedContent
        });
      } catch (dbError) {
        console.error('Database error during update:', dbError);
        return res.status(500).json({
          success: false,
          message: "Database error during update",
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      console.error('Error in update content controller:', error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Validation error", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ 
        success: false,
        message: "Error updating content",
        error: error instanceof Error ? error.message : String(error)
      });
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